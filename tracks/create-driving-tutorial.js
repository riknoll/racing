#!/usr/bin/env node
const fs = require("node:fs")
const path = require("node:path")
const { outlineMap, encodeImage } = require("./create-tilemap")

const root = path.resolve(__dirname, "..")
const output = path.join(root, "driving-tutorial.g.ts")

function readTrack(resources) {
    const source = JSON.parse(fs.readFileSync(path.join(__dirname, "driving-tutorial.jres"), "utf8")).tutorialtrack1
    if (source?.mimeType !== "application/mkcd-tilemap" || !Array.isArray(source.tileset)) {
        throw new Error("Missing tutorialtrack1 tilemap in tracks/driving-tutorial.jres")
    }
    const hex = Buffer.from(source.data, "base64").toString("utf8")
    if (!/^10(?:[0-9a-f]{2})+$/i.test(hex)) throw new Error("Invalid tutorial tilemap encoding")
    const data = Buffer.from(hex, "hex")
    const width = data.readUInt16LE(1), height = data.readUInt16LE(3)
    if (!width || !height || data.length !== 5 + width * height + width * Math.ceil(height / 2)) {
        throw new Error("Invalid tutorial tilemap dimensions")
    }
    if (data.subarray(5 + width * height).some(value => value !== 0)) {
        throw new Error("Tutorial track must allow driving off-road without tile walls")
    }
    const images = source.tileset.map(name => {
        const resource = resources[name.replace(/^myTiles\./, "")]
        if (resource?.mimeType !== "image/x-mkcd-f4" || typeof resource.data !== "string") {
            throw new Error(`Missing tutorial tile: ${name}`)
        }
        const image = Buffer.from(resource.data, "base64")
        if (image[0] !== 0x87 || image[1] !== 4 || image.readUInt16LE(2) !== 16 ||
            image.readUInt16LE(4) !== 16 || image.length !== 136) {
            throw new Error(`Tutorial tile must be a 16x16 image: ${name}`)
        }
        return Array.from({ length: 16 }, (_, y) => Array.from({ length: 16 }, (_, x) => {
            const color = (image[8 + x * 8 + (y >> 1)] >> ((y & 1) * 4)) & 15
            if (color !== 0 && color !== 11 && color !== 12) throw new Error(`Unexpected color in tutorial tile: ${name}`)
            return color === 11 ? "1" : color === 12 ? "f" : "7"
        }).join("")).join("\n")
    })
    const tiles = data.subarray(5, 5 + width * height)
    if (tiles.some(index => index >= images.length)) throw new Error("Tutorial tile index is outside its tileset")
    return { width, height, images, tiles }
}

function generate() {
    const resources = JSON.parse(fs.readFileSync(path.join(root, "tilemap.g.jres"), "utf8"))
    const original = readTrack(resources)
    const { width, height } = original
    const baseline = 512, roadWidth = 64, cornerWidth = 64
    const gapStart = 1952, gapEnd = 2016, finishX = 3904, finishY = baseline
    const curve = [
        { x: 608, y: 512 }, { x: 656, y: 488 }, { x: 704, y: 448 },
        { x: 832, y: 320 }, { x: 880, y: 296 }, { x: 928, y: 288 },
        { x: 976, y: 296 }, { x: 1024, y: 320 }, { x: 1088, y: 384 },
        { x: 1128, y: 432 }, { x: 1152, y: 480 }, { x: 1152, y: 560 },
        { x: 1176, y: 608 }, { x: 1216, y: 656 }, { x: 1280, y: 704 },
        { x: 1328, y: 736 }, { x: 1408, y: 736 }, { x: 1456, y: 712 },
        { x: 1504, y: 672 }, { x: 1632, y: 544 }, { x: 1680, y: 520 },
        { x: 1728, y: baseline }, { x: 1824, y: baseline }
    ]
    const wave = [curve[0]]
    for (let i = 1; i < curve.length; i++) {
        const a = curve[i - 1], b = curve[i]
        const steps = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 16)
        for (let j = 1; j <= steps; j++) wave.push({
            x: Math.round(a.x + (b.x - a.x) * j / steps),
            y: Math.round(a.y + (b.y - a.y) * j / steps)
        })
    }
    const turns = [
        { x: 2624, y: baseline }, { x: 2624, y: 944 }, { x: 3056, y: 944 },
        { x: 3056, y: 80 }, { x: 3472, y: 80 }, { x: 3472, y: baseline }
    ]
    const map = outlineMap(original)
    const warningLength = 11 * 16
    const approaches = turns.map((turn, i) => {
        const previous = i ? turns[i - 1] : { x: gapEnd, y: baseline }
        const length = Math.hypot(turn.x - previous.x, turn.y - previous.y)
        if (length < warningLength) throw new Error("Turn approach is shorter than its warning stripes")
        return { turn, dx: (turn.x - previous.x) / length, dy: (turn.y - previous.y) / length }
    })
    const imageIndices = new Map(map.images.map((image, i) => [image, i]))
    for (let ty = 0; ty < height; ty++) {
        for (let tx = 0; tx < width; tx++) {
            const index = ty * width + tx
            const image = map.images[map.tiles[index]]
            if (!image.includes("f")) continue
            const striped = [...image].map((color, pixel) => {
                if (color !== "f") return color
                const x = tx * 16 + pixel % 17, y = ty * 16 + Math.floor(pixel / 17)
                const approaching = approaches.some(({ turn, dx, dy }) => {
                    const before = (turn.x - x) * dx + (turn.y - y) * dy
                    const sideways = Math.abs((x + 0.5 - turn.x) * dy - (y + 0.5 - turn.y) * dx)
                    return before > 0 && before <= warningLength && sideways < cornerWidth / 2 + 4
                })
                return approaching ? (Math.floor((x + y) / 8) % 2 ? "5" : "k") : color
            }).join("")
            if (!imageIndices.has(striped)) {
                if (map.images.length === 256) throw new Error("Tutorial warning tiles exceed the tileset limit")
                imageIndices.set(striped, map.images.length)
                map.images.push(striped)
            }
            map.tiles[index] = imageIndices.get(striped)
        }
    }
    for (let i = 0; i < original.tiles.length; i++) {
        const before = original.images[original.tiles[i]], after = map.images[map.tiles[i]]
        for (let pixel = 0; pixel < before.length; pixel++) {
            if ((before[pixel] === "1") !== (after[pixel] === "1")) {
                throw new Error(`Outline changed authored road geometry at tile ${i % width},${Math.floor(i / width)}`)
            }
        }
    }
    const shared = new Map(Object.entries(resources)
        .filter(([, resource]) => resource.mimeType === "image/x-mkcd-f4" && typeof resource.data === "string")
        .map(([name, resource]) => [resource.data, name]))
    const tiles = [], palette = [], indices = new Map()
    for (const original of map.tiles) {
        if (!indices.has(original)) {
            const pixels = [...map.images[original].replace(/\n/g, "")].map(pixel =>
                pixel === "1" ? 11 : pixel === "f" ? 12 : pixel === "5" ? 5 : pixel === "k" ? 15 : 0)
            const data = encodeImage(pixels, 16, 16)
            const name = shared.get(data.toString("base64"))
            indices.set(original, palette.length)
            palette.push(name ? `myTiles.${name}` : `image.ofBuffer(hex\`${data.toString("hex")}\`)`)
        }
        tiles.push(indices.get(original))
    }
    const colorAt = (x, y) => map.images[map.tiles[Math.floor(y / 16) * width + Math.floor(x / 16)]]
        [(Math.floor(y) % 16) * 17 + Math.floor(x) % 16]
    for (const points of [
        [{ x: 28, y: baseline }, ...wave, { x: gapStart - 1, y: baseline }],
        [{ x: gapEnd, y: baseline }, ...turns, { x: finishX + 96, y: finishY }]
    ]) {
        for (let i = 1; i < points.length; i++) {
            const a = points[i - 1], b = points[i]
            const steps = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y))
            for (let j = 0; j <= steps; j++) {
                const x = a.x + (b.x - a.x) * j / steps, y = a.y + (b.y - a.y) * j / steps
                if (x < 0 || y < 0 || x >= width * 16 || y >= height * 16 || colorAt(x, y) !== "1") {
                    throw new Error(`Tutorial checkpoint route leaves the authored road at ${x},${y}`)
                }
            }
        }
    }
    const data = Buffer.alloc(4 + tiles.length)
    data.writeUInt16LE(width, 0)
    data.writeUInt16LE(height, 2)
    Buffer.from(tiles).copy(data, 4)
    const pointsHex = points => {
        const buffer = Buffer.alloc(points.length * 4)
        points.forEach((point, i) => {
            buffer.writeUInt16LE(Math.round(point.x), i * 4)
            buffer.writeUInt16LE(Math.round(point.y), i * 4 + 2)
        })
        return buffer.toString("hex")
    }
    return `// Generated by node tracks/create-driving-tutorial.js. Do not edit.
namespace drivingTutorialTrack {
    export const baseline = ${baseline};
    export const roadWidth = ${roadWidth};
    export const cornerWidth = ${cornerWidth};
    export const gapStart = ${gapStart};
    export const gapEnd = ${gapEnd};
    export const finishX = ${finishX};
    export const finishY = ${finishY};
    export const wave: Buffer = hex\`${pointsHex(wave)}\`;
    export const turns: Buffer = hex\`${pointsHex(turns)}\`;

    export function createMap(): tiles.TileMapData {
        return tiles.createTilemap(hex\`${data.toString("hex")}\`,
            image.create(${width}, ${height}),
            [${palette.join(",\n                ")}], TileScale.Sixteen);
    }
}
`
}

if (require.main === module) {
    try {
        const args = process.argv.slice(2)
        if (args.some(arg => arg !== "--check")) throw new Error("Usage: node tracks/create-driving-tutorial.js [--check]")
        const content = generate()
        if (args.includes("--check")) {
            if (!fs.existsSync(output) || fs.readFileSync(output, "utf8") !== content) {
                throw new Error("Tutorial track is stale; run node tracks/create-driving-tutorial.js")
            }
        } else fs.writeFileSync(output, content)
        console.log(args.includes("--check") ? "Tutorial track is up to date" : "Generated driving-tutorial.g.ts")
    } catch (error) {
        console.error(`create-driving-tutorial.js: ${error.message}`)
        process.exitCode = 1
    }
}

module.exports = { generate }
