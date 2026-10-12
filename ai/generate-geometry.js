#!/usr/bin/env node
const fs = require("node:fs")
const path = require("node:path")
const { makeTilemap, makeWaypoints, makeGates } = require("../tracks/create-tilemap")

const DEFAULT_CONFIG = Object.freeze({
    size: 200, width: 4, simplify: 2, angles: 16, tileset: "compact",
})

/** Reads checked-in 16-byte Int32LE gate records without regenerating shared assets. */
function readTrackGates(source) {
    const namespaces = Array.from(source.matchAll(/\bnamespace trackWaypoints\s*\{([^}]*)\}/g))
    if (namespaces.length !== 1) throw new Error("Expected exactly one trackWaypoints namespace")
    const body = namespaces[0][1].replace(/\/\/[^\r\n]*/g, "").trim()
    const gates = new Map()
    let end = 0
    for (const match of body.matchAll(/\s*export const ([a-zA-Z_]\w*)\s*=\s*hex`([^`]*)`;\s*/gy)) {
        const [, id, hex] = match
        if (gates.has(id)) throw new Error(`Duplicate trackWaypoints track: ${id}`)
        if (!/^(?:[0-9a-fA-F]{32})+$/.test(hex)) {
            throw new Error(`${id}: gates must be non-empty 16-byte Int32LE records`)
        }
        gates.set(id, Buffer.from(hex, "hex"))
        end = match.index + match[0].length
    }
    if (end !== body.length) throw new Error("Malformed trackWaypoints declaration")
    if (!gates.size) throw new Error("No checked-in trackWaypoints gates found")
    return gates
}

/** Returns metadata only when the finish gate and every ordered turn pair match. */
function trackMetadata(map, checkedInGates) {
    const roadWidth = map.roadWidth * 16
    if (!Number.isFinite(map.roadWidth) || !Number.isFinite(roadWidth) || roadWidth <= 0) {
        throw new Error("Road width must be a positive finite number of tiles")
    }
    const vertices = makeWaypoints(map, true)
    const centerline = Buffer.alloc(vertices.length * 4)
    for (let i = 0; i < vertices.length; i++) {
        const { x, y } = vertices[i]
        if (!Number.isInteger(x) || !Number.isInteger(y) ||
            x < 0 || x > 65535 || y < 0 || y > 65535) {
            throw new Error("Centerline pixel coordinates must be finite UInt16 values")
        }
        centerline.writeUInt16LE(x, i * 4)
        centerline.writeUInt16LE(y, i * 4 + 2)
    }
    if (!Buffer.isBuffer(checkedInGates) || !checkedInGates.length || checkedInGates.length % 16) {
        throw new Error("Expected checked-in gates as non-empty 16-byte Int32LE records")
    }
    if (checkedInGates.length !== (vertices.length * 2 + 1) * 16) {
        throw new Error("Checked-in gates must contain a finish gate followed by two gates per centerline vertex")
    }
    const gates = makeGates(map)
    for (let i = 0; i < gates.length; i++) {
        const values = [gates[i].start.x, gates[i].start.y, gates[i].end.x, gates[i].end.y]
        if (!values.every(value => Number.isInteger(value) && value >= -2147483648 && value <= 2147483647)) {
            throw new Error("Gate pixel coordinates must be finite Int32 values")
        }
        if (values.some((value, k) => value !== checkedInGates.readInt32LE(i * 16 + k * 4))) {
            throw new Error(`Generated gates do not match checked-in trackWaypoints at gate ${i}; check the SVG and geometry configuration`)
        }
    }
    return { centerline, roadWidth }
}

/** Builds TypeScript geometry declarations; only the CLI writes geometry.g.ts. */
function generateGeometry(projectRoot = path.dirname(__dirname), config = DEFAULT_CONFIG) {
    const gates = readTrackGates(fs.readFileSync(path.join(projectRoot, "tilemap.g.ts"), "utf8"))
    const directory = path.join(projectRoot, "tracks")
    const files = fs.readdirSync(directory).filter(name => name.toLowerCase().endsWith(".svg")).sort()
    if (!files.length) throw new Error("No SVG files found in tracks/")
    const usedNames = new Set()
    const entries = files.map(name => {
        try {
            const id = path.parse(name).name.replace(/[^a-zA-Z0-9_]+/g, "_")
            if (!/^[a-zA-Z_]/.test(id) || usedNames.has(id)) {
                throw new Error(`Invalid or duplicate track name: ${name}`)
            }
            usedNames.add(id)
            if (!gates.has(id)) throw new Error(`No checked-in trackWaypoints gates for ${id}`)
            const map = makeTilemap(fs.readFileSync(path.join(directory, name), "utf8"), config)
            return { id, ...trackMetadata(map, gates.get(id)) }
        } catch (error) {
            throw new Error(`${name}: ${error.message}`, { cause: error })
        }
    })
    for (const id of gates.keys()) {
        if (!usedNames.has(id)) throw new Error(`No SVG found for checked-in trackWaypoints track: ${id}`)
    }
    const centerlines = entries.map(item => `    //% whenUsed
    export const ${item.id} = hex\`${item.centerline.toString("hex")}\`;`).join("\n")
    const roadWidths = entries.map(item => `    //% whenUsed
    export const ${item.id} = ${item.roadWidth};`).join("\n")
    return `// Auto-generated code. Do not edit.

// Each vertex is X/Y as UInt16LE pixels, four bytes per vertex.
// Shared gates are 16-byte Int32LE records: gate 0 crosses the finish on the last-to-first segment,
// and gates 2*i+1 and 2*i+2 bracket vertex i.
// Vertices follow gate traversal order; connect the last vertex back to the first.
namespace trackCenterlines {
${centerlines}
}

// Road width in pixels.
namespace trackRoadWidths {
${roadWidths}
}
// Auto-generated code. Do not edit.
`
}

if (require.main === module) {
    try {
        if (process.argv.length > 2) {
            throw new Error("This command does not accept arguments; run node ai\\generate-geometry.js")
        }
        const source = generateGeometry()
        fs.writeFileSync(path.join(__dirname, "geometry.g.ts"), source)
    } catch (error) {
        console.error(`generate-geometry.js: ${error.message}`)
        process.exitCode = 1
    }
}

module.exports = { DEFAULT_CONFIG, readTrackGates, trackMetadata, generateGeometry }
