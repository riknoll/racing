const assert = require("node:assert/strict")
const { spawnSync } = require("node:child_process")
const { createHash } = require("node:crypto")
const fs = require("node:fs")
const path = require("node:path")
const { stripTypeScriptTypes } = require("node:module")
const vm = require("node:vm")
const test = require("node:test")
const { makeWaypoints } = require("../../tracks/create-tilemap")
const {
    CONFIG, buildTrainingTrack, formatTrainingTrack, gateCenter, gateSegment,
    encodeGates, routeLength, segmentDistance, turnDegrees,
} = require("../generate-training-track")

const root = path.resolve(__dirname, "..", "..")
const sourceFile = path.join(root, "ai", "training-track.svg")
const generatedFile = path.join(root, "ai", "training-track.g.ts")
const sharedRoad = JSON.parse(fs.readFileSync(path.join(root, "tilemap.g.jres"), "utf8")).road
const roadColor = Buffer.from(sharedRoad.data, "base64")[8] & 15
const track = buildTrainingTrack()

function hash(data) {
    return createHash("sha256").update(data).digest("hex")
}

function readRuntimeGates(data) {
    const context = vm.createContext({
        util: { Point: class { constructor(x, y) { this.x = x; this.y = y } } },
        NumberFormat: { Int32LE: 0 },
    })
    const code = stripTypeScriptTypes(fs.readFileSync(path.join(root, "util.ts"), "utf8"), { mode: "transform" })
    vm.runInContext(code, context)
    const gates = context.racing.readGates({
        length: data.length,
        getNumber: (format, offset) => {
            assert.equal(format, context.NumberFormat.Int32LE)
            return data.readInt32LE(offset)
        },
    })
    return Array.from(gates, gate => ({
        start: { x: gate.start.x, y: gate.start.y },
        end: { x: gate.end.x, y: gate.end.y },
    }))
}

function imagePixel(data, x, y) {
    return data[8 + x * 8 + (y >> 1)] >> ((y & 1) * 4) & 15
}

function renderedPixel(x, y) {
    const tile = track.tileData[4 + Math.floor(y / 16) * track.map.width + Math.floor(x / 16)]
    return imagePixel(track.images[tile], x % 16, y % 16)
}

function runtime() {
    const context = vm.createContext({
        hex: strings => Buffer.from(strings[0], "hex"),
        img: strings => strings[0].trim().split("\n").map(row => row.trim()),
        image: { ofBuffer: data => ({ data, getPixel: (x, y) => imagePixel(data, x, y) }) },
        TileScale: { Sixteen: 4 },
        tiles: { createTilemap: (data, walls, palette, scale) => ({ data, walls, palette, scale }) },
    })
    const code = stripTypeScriptTypes(fs.readFileSync(generatedFile, "utf8"), { mode: "transform" })
    vm.runInContext(code, context)
    return context.aiRacing
}

test("self-contained generated map has valid MakeCode dimensions, tiles, images, and wall layer", () => {
    assert.equal(track.map.width, 82)
    assert.equal(track.map.height, 65)
    assert.equal(track.tileData.readUInt16LE(0), track.map.width)
    assert.equal(track.tileData.readUInt16LE(2), track.map.height)
    assert.equal(track.tileData.length, 4 + track.map.width * track.map.height)
    assert.ok(track.images.length > 26 && track.images.length <= 256)
    assert.ok(track.tileData.subarray(4).every(tile => tile < track.images.length))
    for (const data of track.images) {
        assert.equal(data.length, 136)
        assert.deepEqual([...data.subarray(0, 8)], [0x87, 4, 16, 0, 16, 0, 0, 0])
        assert.ok(data.subarray(8).every(byte => [0, 12, roadColor].includes(byte & 15) && [0, 12, roadColor].includes(byte >> 4)))
    }
    assert.ok(track.images[0].subarray(8).every(byte => byte === 0))
    const api = runtime()
    const map = api.getTestTrackMap()
    assert.deepEqual(map.data, track.tileData)
    assert.equal(map.scale, 4)
    assert.equal(map.walls.length, track.map.height)
    assert.ok(map.walls.every(row => row.length === track.map.width && /^\.+$/.test(row)))
    assert.equal(map.palette.length, track.images.length)
    assert.notEqual(api.getTestTrackMap(), map)
})

test("road matches the checked-in collision color; grass is transparent and the outline is four pixels", () => {
    assert.equal(roadColor, 11)
    assert.equal(CONFIG.roadColor, roadColor)
    assert.equal(runtime().getTestTrackMap().palette[2].getPixel(0, 0), roadColor)
    for (let cell = 0; cell < track.map.tiles.length; cell++) {
        const original = track.map.images[track.map.tiles[cell]]
        const rendered = track.images[track.tileData[4 + cell]]
        for (let y = 0; y < 16; y++) {
            for (let x = 0; x < 16; x++) {
                assert.equal(imagePixel(rendered, x, y) === roadColor, original[y * 17 + x] === "1")
            }
        }
    }
    const x = (track.centers[0].x + track.centers[1].x) / 2
    const roadRows = []
    for (let y = 0; y < track.centers[0].y + track.width; y++) {
        if (renderedPixel(x, y) === roadColor) roadRows.push(y)
    }
    assert.equal(roadRows.length, 64)
    for (const [edge, direction] of [[roadRows[0], -1], [roadRows.at(-1), 1]]) {
        for (let depth = 1; depth <= 4; depth++) assert.equal(renderedPixel(x, edge + direction * depth), 12)
        assert.equal(renderedPixel(x, edge + direction * 5), 0)
    }
})

test("hand-designed turns, segment lengths, and road separation are safe and nondegenerate", () => {
    assert.deepEqual(track.centers, makeWaypoints(track.map, true))
    assert.equal(track.centers.length, 12)
    assert.ok(Math.abs(routeLength(track) - 5278.2167) < 0.1)
    assert.ok(turnDegrees(track, 1) > 20 && turnDegrees(track, 1) < 35)
    assert.ok(turnDegrees(track, 2) < -20 && turnDegrees(track, 2) > -35)
    for (const i of [3, 5, 6]) assert.equal(turnDegrees(track, i), 90)
    for (const i of [4, 7, 8]) assert.equal(turnDegrees(track, i), -90)
    let clearance = Infinity
    for (let i = 0; i < track.centers.length; i++) {
        const a = track.centers[i], b = track.centers[(i + 1) % track.centers.length]
        assert.ok(Math.hypot(b.x - a.x, b.y - a.y) >= 128)
        assert.ok(Math.abs(turnDegrees(track, i)) <= 90)
        assert.ok(a.x >= 48 && a.y >= 48 && a.x <= track.map.width * 16 - 48 && a.y <= track.map.height * 16 - 48)
        for (let j = i + 2; j < track.centers.length; j++) {
            if (i === 0 && j === track.centers.length - 1) continue
            clearance = Math.min(clearance, segmentDistance(a, b, track.centers[j], track.centers[(j + 1) % track.centers.length]))
        }
    }
    assert.equal(clearance, 128)
    assert.equal(clearance - track.width - 8, 56, "hairpins retain grass beyond both four-pixel outlines")
})

test("metadata contains UInt16LE centers and 24 ordered Int32LE gates read by racing.readGates", () => {
    assert.equal(track.gates.length, 24)
    assert.equal(track.centerData.length, 12 * 4)
    assert.equal(track.gateData.length, 24 * 16)
    assert.deepEqual(readRuntimeGates(track.gateData), track.gates)
    const api = runtime()
    assert.deepEqual(api.TEST_TRACK_CENTERS, track.centerData)
    assert.deepEqual(api.TEST_TRACK_GATES, track.gateData)
    assert.equal(api.TEST_TRACK_WIDTH, 64)
    track.centers.forEach((point, i) => {
        assert.equal(track.centerData.readUInt16LE(i * 4), point.x)
        assert.equal(track.centerData.readUInt16LE(i * 4 + 2), point.y)
    })
    track.gates.forEach((gate, i) => {
        const [a, b] = gateSegment(track, i)
        const center = gateCenter(gate)
        const length = Math.hypot(b.x - a.x, b.y - a.y)
        assert.ok(Math.abs((center.x - a.x) * (b.y - a.y) - (center.y - a.y) * (b.x - a.x)) / length < 1)
        const vertex = track.centers[Math.floor(i / 2)]
        const signedDistance = ((center.x - vertex.x) * (b.x - a.x) + (center.y - vertex.y) * (b.y - a.y)) / length
        assert.ok(i % 2 ? signedDistance > 0 : signedDistance < 0)
        assert.equal(renderedPixel(Math.floor(center.x), Math.floor(center.y)), roadColor)
        for (const [point, offset] of [[gate.start, 0], [gate.end, 8]]) {
            assert.equal(track.gateData.readInt32LE(i * 16 + offset), point.x)
            assert.equal(track.gateData.readInt32LE(i * 16 + offset + 4), point.y)
            assert.ok(point.x >= 0 && point.y >= 0 && point.x < track.map.width * 16 && point.y < track.map.height * 16)
        }
    })
})

test("regeneration preserves the prior Test Track pixels, centers, and bounded gate coordinates", () => {
    assert.equal(hash(Buffer.concat([track.tileData, ...track.images])),
        "9afebdf064b3c2776c4eebb0ed1c35b8527de2415bafb3791a1577709d5a84d0")
    assert.equal(hash(track.centerData), "e23e93282438f6ec951de6795deb62b4c9ab8c2f3298e9409ed20114862c2b42")
    const priorEncoding = Buffer.alloc(track.gates.length * 8)
    track.gates.forEach((gate, i) => {
        const values = [gate.start.x, gate.start.y, gate.end.x, gate.end.y]
        values.forEach((value, k) => priorEncoding.writeUInt16LE(value, i * 8 + k * 2))
    })
    assert.equal(hash(priorEncoding), "6c1e8bedb0a740359ee010fbb62e070c2e30170b63881e2cd6d312ee392d7a2f")
})

test("gate encoding supports negative Int32 limits and rejects invalid signed coordinates on each axis", () => {
    const gate = { start: { x: -2147483648, y: -1 }, end: { x: 65536, y: 2147483647 } }
    const data = encodeGates([gate])
    assert.equal(data.length, 16)
    assert.equal(data.toString("hex"), "00000080ffffffff00000100ffffff7f")
    assert.deepEqual(readRuntimeGates(data), [gate])
    for (const point of ["start", "end"]) {
        for (const axis of ["x", "y"]) {
            for (const value of [-2147483649, 2147483648, -0.5, 0.5, NaN, Infinity, -Infinity, undefined, null, "1"]) {
                const changed = { start: { ...gate.start }, end: { ...gate.end } }
                changed[point][axis] = value
                assert.throws(() => encodeGates([changed]), /gate coordinates must be finite Int32/)
            }
        }
    }
})

test("every bend admits a smooth steering arc inside the rendered road", () => {
    const radius = 40
    track.centers.forEach((point, i) => {
        const previous = track.centers[(i + track.centers.length - 1) % track.centers.length]
        const next = track.centers[(i + 1) % track.centers.length]
        const incoming = Math.hypot(point.x - previous.x, point.y - previous.y)
        const outgoing = Math.hypot(next.x - point.x, next.y - point.y)
        const dx = (point.x - previous.x) / incoming, dy = (point.y - previous.y) / incoming
        const turn = turnDegrees(track, i) * Math.PI / 180
        const sign = Math.sign(turn)
        const tangent = radius * Math.tan(Math.abs(turn) / 2)
        assert.ok(tangent * 2 < Math.min(incoming, outgoing))
        const entry = { x: point.x - dx * tangent, y: point.y - dy * tangent }
        const center = { x: entry.x - dy * radius * sign, y: entry.y + dx * radius * sign }
        const startAngle = Math.atan2(entry.y - center.y, entry.x - center.x)
        for (let step = 0; step <= 20; step++) {
            const angle = startAngle + turn * step / 20
            for (const offset of [-8, 0, 8]) {
                const x = Math.floor(center.x + (radius + offset) * Math.cos(angle))
                const y = Math.floor(center.y + (radius + offset) * Math.sin(angle))
                assert.equal(renderedPixel(x, y), roadColor, `turn ${i} has steering room at sample ${step}`)
            }
        }
    })
})

test("the Test Track is one continuous loop without generated exercise prompts or reset definitions", () => {
    const api = runtime()
    assert.equal(api.getTrainingExercises, undefined)
    assert.equal(api.TrainingExercise, undefined)
    const start = gateCenter(track.gates[0])
    assert.equal(renderedPixel(Math.floor(start.x), Math.floor(start.y)), roadColor)
    const source = fs.readFileSync(generatedFile, "utf8")
    assert.doesNotMatch(source, /Retry|TrainingExercise|instructions|startOffset|headingOffset/)
})

test("invalid or changed designs fail rather than silently losing the intended curve variety", () => {
    const source = fs.readFileSync(sourceFile, "utf8")
    assert.throws(() => buildTrainingTrack(source.replace('stroke="red"', 'stroke="blue"')), /red path/)
    assert.throws(() => buildTrainingTrack(source.replace("L84 42", "L84 38")), /practice|training|Compact|road|turn|Turn|gate|Gate/)
})

test("CLI emits the deterministic standalone artifact without changing shared files", () => {
    const source = fs.readFileSync(generatedFile, "utf8")
    assert.equal(source, formatTrainingTrack(track))
    assert.doesNotMatch(source.replace(/\/\/[^\r\n]*/g, ""), /myTiles|trackWaypoints|_registerFactory|setCurrentTilemap/)
    const shared = [
        path.join("tracks", "create-tilemap.js"), path.join("tracks", "create-tilemap.test.js"),
        "tilemap.g.ts", "tilemap.g.jres", "pxt.json", path.join("ai", "training-track.svg"),
    ]
    const before = shared.map(file => fs.readFileSync(path.join(root, file)))
    const script = path.join(root, "ai", "generate-training-track.js")
    for (const cwd of [root, __dirname]) {
        const result = spawnSync(process.execPath, [script], { cwd, encoding: "utf8" })
        assert.equal(result.status, 0, result.stderr)
        assert.equal(fs.readFileSync(generatedFile, "utf8"), source)
    }
    const invalid = spawnSync(process.execPath, [script, "--random"], { encoding: "utf8" })
    assert.equal(invalid.status, 1)
    assert.match(invalid.stderr, /without arguments/)
    assert.equal(fs.readFileSync(generatedFile, "utf8"), source)
    shared.forEach((file, i) => assert.deepEqual(fs.readFileSync(path.join(root, file)), before[i], file))
})
