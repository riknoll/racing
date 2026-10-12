#!/usr/bin/env node
const fs = require("node:fs")
const path = require("node:path")
const { makeTilemap, makeWaypoints, formatBatch } = require("../tracks/create-tilemap")

function sharedRoadColor() {
    const resources = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "tilemap.g.jres"), "utf8"))
    if (!resources.road || typeof resources.road.data !== "string") {
        throw new Error("The checked-in myTiles.road image is missing")
    }
    const data = Buffer.from(resources.road.data, "base64")
    if (data.length !== 136 || data[0] !== 0x87 || data[1] !== 4 ||
        data.readUInt16LE(2) !== 16 || data.readUInt16LE(4) !== 16) {
        throw new Error("The checked-in myTiles.road must be a 16-pixel MakeCode image")
    }
    return data[8] & 15
}

const CONFIG = Object.freeze({
    size: 74, width: 4, simplify: 0, angles: 16, tileset: "compact",
    grassColor: 0, roadColor: sharedRoadColor(), outlineColor: 12,
})
function gateCenter(gate) {
    return { x: (gate.start.x + gate.end.x) / 2, y: (gate.start.y + gate.end.y) / 2 }
}

function gateSegment(track, index) {
    const vertex = Math.floor(index / 2)
    const points = track.centers
    return index % 2
        ? [points[vertex], points[(vertex + 1) % points.length]]
        : [points[(vertex + points.length - 1) % points.length], points[vertex]]
}

function roadAt(track, x, y) {
    const px = Math.floor(x), py = Math.floor(y)
    if (px < 0 || py < 0 || px >= track.map.width * 16 || py >= track.map.height * 16) return false
    const tile = track.map.tiles[Math.floor(py / 16) * track.map.width + Math.floor(px / 16)]
    return track.map.images[tile][(py % 16) * 17 + px % 16] === "1"
}

function routeLength(track) {
    return track.centers.reduce((total, point, i) => {
        const next = track.centers[(i + 1) % track.centers.length]
        return total + Math.hypot(next.x - point.x, next.y - point.y)
    }, 0)
}

function gateDistance(track, index) {
    const vertex = Math.floor(index / 2)
    let distance = 0
    for (let i = 0; i < vertex; i++) {
        distance += Math.hypot(track.centers[i + 1].x - track.centers[i].x,
            track.centers[i + 1].y - track.centers[i].y)
    }
    const [a, b] = gateSegment(track, index)
    const length = Math.hypot(b.x - a.x, b.y - a.y)
    const center = gateCenter(track.gates[index])
    return distance + ((center.x - track.centers[vertex].x) * (b.x - a.x) +
        (center.y - track.centers[vertex].y) * (b.y - a.y)) / length
}

function pointSegmentDistanceSquared(p, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy)))
    return (p.x - a.x - t * dx) ** 2 + (p.y - a.y - t * dy) ** 2
}

function segmentDistance(a, b, c, d) {
    const vx = b.x - a.x, vy = b.y - a.y, wx = d.x - c.x, wy = d.y - c.y
    const cross = vx * wy - vy * wx
    if (cross) {
        const t = ((c.x - a.x) * wy - (c.y - a.y) * wx) / cross
        const u = ((c.x - a.x) * vy - (c.y - a.y) * vx) / cross
        if (t >= 0 && t <= 1 && u >= 0 && u <= 1) return 0
    }
    return Math.sqrt(Math.min(
        pointSegmentDistanceSquared(a, c, d), pointSegmentDistanceSquared(b, c, d),
        pointSegmentDistanceSquared(c, a, b), pointSegmentDistanceSquared(d, a, b)))
}

function turnDegrees(track, index) {
    const points = track.centers
    const a = points[(index + points.length - 1) % points.length], b = points[index]
    const c = points[(index + 1) % points.length]
    return Math.atan2((b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x),
        (b.x - a.x) * (c.x - b.x) + (b.y - a.y) * (c.y - b.y)) * 180 / Math.PI
}

function encodePoints(points) {
    const data = Buffer.alloc(points.length * 4)
    points.forEach((point, i) => {
        if (![point.x, point.y].every(value => Number.isInteger(value) && value >= 0 && value <= 65535)) {
            throw new Error("Training coordinates must be UInt16 pixels")
        }
        data.writeUInt16LE(point.x, i * 4)
        data.writeUInt16LE(point.y, i * 4 + 2)
    })
    return data
}

/** Encodes signed pixel endpoints in the 16-byte format used by racing.readGates. */
function encodeGates(gates) {
    const data = Buffer.alloc(gates.length * 16)
    gates.forEach((gate, i) => {
        const values = [gate.start.x, gate.start.y, gate.end.x, gate.end.y]
        if (!values.every(value => Number.isInteger(value) && value >= -2147483648 && value <= 2147483647)) {
            throw new Error("Training gate coordinates must be finite Int32 pixels")
        }
        values.forEach((value, k) => data.writeInt32LE(value, i * 16 + k * 4))
    })
    return data
}

/**
 * Keeps Test Track's original bounded, three-road-width gates and 24-gate ordering.
 * Shared tracks instead have a separate finish gate and extended endpoints.
 */
function makeTrainingGates(track) {
    const gates = []
    const vertices = track.centers
    const gateOnSegment = (start, end, distance) => {
        const dx = end.x - start.x, dy = end.y - start.y
        const length = Math.hypot(dx, dy)
        if (!length) throw new Error("Cannot generate a training gate across a zero-length road segment")
        const center = { x: start.x + distance / length * dx, y: start.y + distance / length * dy }
        const normal = { x: -dy / length, y: dx / length }
        if (!roadAt(track, center.x, center.y)) throw new Error(`Training gate ${gates.length} does not cross the road`)
        const extent = side => {
            const limit = Math.ceil(track.width / 2 + 16)
            let lastRoad = 0, grass = 0
            for (let distance = 1; distance <= limit; distance++) {
                if (roadAt(track, center.x + side * normal.x * distance, center.y + side * normal.y * distance)) {
                    lastRoad = distance
                    grass = 0
                } else if (++grass === 2) {
                    return lastRoad + 2
                }
            }
            return limit
        }
        const roadRadius = Math.max(extent(-1), extent(1))
        const desiredRadius = roadRadius * 3
        const safeRadius = side => {
            let grass = 0, leftRoad = false
            for (let distance = 1; distance <= desiredRadius; distance++) {
                const x = center.x + side * normal.x * distance
                const y = center.y + side * normal.y * distance
                if (x < 0.5 || y < 0.5 ||
                    x > track.map.width * 16 - 1.5 || y > track.map.height * 16 - 1.5) {
                    return distance - 1
                }
                if (roadAt(track, x, y)) {
                    if (leftRoad) return distance - 1
                    grass = 0
                } else if (++grass >= 2) {
                    leftRoad = true
                }
            }
            return desiredRadius
        }
        const safeLeft = safeRadius(-1), safeRight = safeRadius(1)
        const sharedRadius = Math.min(desiredRadius, safeLeft, safeRight)
        const endpoint = side => {
            const safe = side < 0 ? safeLeft : safeRight
            const distance = Math.max(sharedRadius, Math.min(roadRadius, safe)) * side
            return { x: Math.round(center.x + normal.x * distance), y: Math.round(center.y + normal.y * distance) }
        }
        return { start: endpoint(-1), end: endpoint(1) }
    }
    for (let i = 0; i < vertices.length; i++) {
        const previous = vertices[(i + vertices.length - 1) % vertices.length]
        const turn = vertices[i], next = vertices[(i + 1) % vertices.length]
        const incoming = Math.hypot(turn.x - previous.x, turn.y - previous.y)
        const outgoing = Math.hypot(next.x - turn.x, next.y - turn.y)
        const clearance = track.width / 2 + 12
        gates.push(gateOnSegment(previous, turn, incoming - Math.min(clearance, incoming / 3)))
        gates.push(gateOnSegment(turn, next, Math.min(clearance, outgoing / 3)))
    }
    return gates
}

function validateTrack(track) {
    if (track.centers.length !== 12 || track.gates.length !== 24) {
        throw new Error("The practice design must retain 12 vertices and two gates per vertex")
    }
    for (const [index, min, max] of [
        [1, 20, 35], [2, -35, -20], [3, 89, 91], [4, -91, -89],
        [5, 89, 91], [6, 89, 91], [7, -91, -89], [8, -91, -89],
    ]) {
        const angle = turnDegrees(track, index)
        if (angle < min || angle > max) throw new Error(`Turn ${index} no longer matches the Test Track design`)
    }
    for (let i = 0; i < track.centers.length; i++) {
        const a = track.centers[i], b = track.centers[(i + 1) % track.centers.length]
        if (Math.hypot(b.x - a.x, b.y - a.y) < 112) throw new Error("Practice road segments must be at least 112 pixels")
        if (a.x < 48 || a.y < 48 || a.x > track.map.width * 16 - 48 || a.y > track.map.height * 16 - 48) {
            throw new Error("Practice road needs a safe map margin")
        }
        for (let j = i + 2; j < track.centers.length; j++) {
            if (i === 0 && j === track.centers.length - 1) continue
            if (segmentDistance(a, b, track.centers[j], track.centers[(j + 1) % track.centers.length]) < track.width + 32) {
                throw new Error("Nonadjacent practice road legs must leave at least 32 pixels of grass")
            }
        }
    }
    for (let i = 0; i < track.gates.length; i++) {
        const center = gateCenter(track.gates[i])
        if (!roadAt(track, center.x, center.y)) throw new Error(`Training gate ${i} does not cross the road`)
        if (i && gateDistance(track, i) <= gateDistance(track, i - 1)) throw new Error("Training gate order is ambiguous")
    }
}

function buildTrainingTrack(svg = fs.readFileSync(path.join(__dirname, "training-track.svg"), "utf8")) {
    const map = makeTilemap(svg, CONFIG)
    const centers = makeWaypoints(map, true)
    const track = { map, centers, width: map.roadWidth * 16 }
    const gates = track.gates = makeTrainingGates(track)
    validateTrack(track)
    const resources = JSON.parse(formatBatch([{ name: "training_course.svg", map }]).jres)
    const resource = resources.training_course
    const data = Buffer.from(Buffer.from(resource.data, "base64").toString("utf8").slice(2), "hex")
    return {
        ...track,
        tileData: data.subarray(0, 4 + map.width * map.height),
        images: resource.tileset.map(name => Buffer.from(resources[name.slice("myTiles.".length)].data, "base64")),
        gateData: encodeGates(gates),
        centerData: encodePoints(centers),
    }
}

function formatTrainingTrack(track = buildTrainingTrack()) {
    const images = track.images.map((data, i) =>
        `    const tile${i}: Image = image.ofBuffer(hex\`${data.toString("hex")}\`);`).join("\n")
    const walls = Array.from({ length: track.map.height }, () => ".".repeat(track.map.width)).join("\n            ")
    return `// Auto-generated from the hand-designed training-track.svg.
// Regenerate with node ai\\generate-training-track.js.
// Transparent grass (0), road (${track.map.roadColor}) matching myTiles.road, and the four-pixel outline (12).
namespace trainingTiles {
${images}
    const palette: Image[] = [${track.images.map((_, i) => `tile${i}`).join(", ")}];

    export function createMap(): tiles.TileMapData {
        return tiles.createTilemap(hex\`${track.tileData.toString("hex")}\`, img\`
            ${walls}
        \`, palette, TileScale.Sixteen);
    }
}

namespace aiRacing {
    // Gates: start X/Y, end X/Y as Int32LE pixels, sixteen bytes per gate.
    export const TEST_TRACK_GATES: Buffer = hex\`${track.gateData.toString("hex")}\`;
    // Loop vertices: X/Y as UInt16LE pixels; gates 2*i and 2*i+1 bracket vertex i.
    export const TEST_TRACK_CENTERS: Buffer = hex\`${track.centerData.toString("hex")}\`;
    export const TEST_TRACK_WIDTH: number = ${track.width};

    export function getTestTrackMap(): tiles.TileMapData {
        return trainingTiles.createMap();
    }
}
`
}

if (require.main === module) {
    try {
        if (process.argv.length > 2) throw new Error("Run node ai\\generate-training-track.js without arguments")
        fs.writeFileSync(path.join(__dirname, "training-track.g.ts"), formatTrainingTrack())
    } catch (error) {
        console.error(`generate-training-track.js: ${error.message}`)
        process.exitCode = 1
    }
}

module.exports = {
    CONFIG, buildTrainingTrack, formatTrainingTrack, gateCenter, gateSegment,
    encodeGates, roadAt, routeLength, segmentDistance, turnDegrees,
}
