const assert = require("node:assert/strict")
const { spawnSync } = require("node:child_process")
const fs = require("node:fs")
const path = require("node:path")
const test = require("node:test")
const { makeTilemap, makeWaypoints, makeGates } = require("../../tracks/create-tilemap")
const { DEFAULT_CONFIG, readTrackGates, trackMetadata, generateGeometry } = require("../generate-geometry")

const projectRoot = path.resolve(__dirname, "..", "..")
const script = path.join(projectRoot, "ai", "generate-geometry.js")
const geometryFile = path.join(projectRoot, "ai", "geometry.g.ts")
const sharedFiles = [
    path.join("tracks", "create-tilemap.js"), path.join("tracks", "create-tilemap.test.js"),
    "tilemap.g.ts", "tilemap.g.jres",
]
const svg = `<svg><path d="M0 0 L100 0 L100 70 L0 70 Z"/>
    <path stroke="red" d="M0 0 L100 0"/>
    <path stroke="yellow" d="M0 70 L0 0"/></svg>`

function gateBuffer(map) {
    const gates = makeGates(map)
    const data = Buffer.alloc(gates.length * 16)
    for (let i = 0; i < gates.length; i++) {
        data.writeInt32LE(gates[i].start.x, i * 16)
        data.writeInt32LE(gates[i].start.y, i * 16 + 4)
        data.writeInt32LE(gates[i].end.x, i * 16 + 8)
        data.writeInt32LE(gates[i].end.y, i * 16 + 12)
    }
    return data
}

function readCenterline(data) {
    assert.equal(data.length % 4, 0)
    return Array.from({ length: data.length / 4 }, (_, i) => ({
        x: data.readUInt16LE(i * 4),
        y: data.readUInt16LE(i * 4 + 2),
    }))
}

function assertGateOnSegment(gate, from, to, fraction) {
    const dx = to.x - from.x, dy = to.y - from.y
    const center = { x: (gate.start.x + gate.end.x) / 2, y: (gate.start.y + gate.end.y) / 2 }
    for (const axis of ["x", "y"]) {
        const expected = from[axis] + fraction * (to[axis] - from[axis])
        assert.ok(Math.abs(center[axis] - expected) <= 0.5 + 1e-9, `${axis}: gate midpoint matches endpoint rounding`)
    }
    const gateDx = gate.end.x - gate.start.x, gateDy = gate.end.y - gate.start.y
    assert.ok(Math.abs(dx * gateDx + dy * gateDy) / Math.hypot(dx, dy) <= Math.SQRT2 + 1e-9)
    assert.ok(dx * (gate.start.y - center.y) - dy * (gate.start.x - center.x) < 0)
    assert.ok(dx * (gate.end.y - center.y) - dy * (gate.end.x - center.x) > 0)
}

function withFixture(action) {
    const root = fs.mkdtempSync(path.join(__dirname, ".geometry-"))
    try {
        fs.mkdirSync(path.join(root, "tracks"))
        fs.mkdirSync(path.join(root, "ai"))
        fs.copyFileSync(path.join(projectRoot, "tracks", "create-tilemap.js"),
            path.join(root, "tracks", "create-tilemap.js"))
        fs.copyFileSync(script, path.join(root, "ai", "generate-geometry.js"))
        fs.writeFileSync(path.join(root, "tracks", "sample.svg"), svg)
        const gates = gateBuffer(makeTilemap(svg, DEFAULT_CONFIG))
        fs.writeFileSync(path.join(root, "tilemap.g.ts"),
            `namespace trackWaypoints {\n    //% whenUsed\n    export const sample = hex\`${gates.toString("hex")}\`;\n}\n`)
        return action(root, gates)
    } finally {
        fs.rmSync(root, { recursive: true, force: true })
    }
}

test("metadata retains every vertex in both directions with exact pixel widths", () => {
    const map = makeTilemap(svg, { size: 100, width: 3.2, simplify: 2, angles: 0 })
    map.points.splice(1, 0, { x: map.points[0].x + 12.25, y: map.points[0].y })
    map.finish.x = (map.points[0].x + map.points[1].x) / 2
    const pixels = point => ({ x: Math.round(point.x * 16), y: Math.round(point.y * 16) })
    for (const forward of [true, false]) {
        map.finish.forward = forward
        const vertices = (forward
            ? [map.points[1], map.points[2], map.points[3], map.points[4], map.points[0]]
            : [map.points[0], map.points[4], map.points[3], map.points[2], map.points[1]]).map(pixels)
        assert.notDeepEqual(makeWaypoints(map), vertices)
        const metadata = trackMetadata(map, gateBuffer(map))
        assert.deepEqual(readCenterline(metadata.centerline), vertices)
        assert.equal(metadata.roadWidth, 51.2)
        map.finish.x = map.points[0].x
        assert.deepEqual(readCenterline(trackMetadata(map, gateBuffer(map)).centerline)[0], pixels(map.points[0]))
        map.finish.x = (map.points[0].x + map.points[1].x) / 2
    }
})

test("metadata rejects missing, nonnumeric, nonfinite, or nonpositive road widths", () => {
    const map = makeTilemap(svg, DEFAULT_CONFIG)
    const gates = gateBuffer(map)
    for (const roadWidth of [undefined, null, "4", 0, -1, NaN, Infinity, Number.MAX_VALUE]) {
        assert.throws(() => trackMetadata({ ...map, roadWidth }, gates),
            /Road width must be a positive finite number/)
    }
})

test("metadata rejects out-of-range and nonfinite centerline coordinates on either axis", () => {
    const map = makeTilemap(svg, DEFAULT_CONFIG)
    const gates = gateBuffer(map)
    for (const coordinate of [-1, 4100, NaN, Infinity]) {
        for (const axis of ["x", "y"]) {
            const invalid = { ...map,
                points: map.points.map(point => ({ ...point, [axis]: point[axis] + coordinate })),
                finish: { ...map.finish, [axis]: map.finish[axis] + coordinate } }
            if (coordinate < 0) invalid.points[2] = { ...invalid.points[2], [axis]: coordinate }
            assert.throws(() => trackMetadata(invalid, gates), /coordinates.*UInt16/)
        }
    }
})

test("metadata requires complete gates and rejects changed coordinates or traversal order", () => {
    const map = makeTilemap(svg, DEFAULT_CONFIG)
    const gates = gateBuffer(map)
    for (const invalid of [undefined, null, Buffer.alloc(0), Buffer.alloc(7), Buffer.alloc(8),
        Buffer.alloc(15), Buffer.alloc(17), Buffer.alloc(gates.length / 2)]) {
        assert.throws(() => trackMetadata(map, invalid), /non-empty 16-byte Int32LE records/)
    }
    for (const invalid of [gates.subarray(16), gates.subarray(32),
        Buffer.concat([gates, gates.subarray(0, 16)]), Buffer.concat([gates, gates.subarray(0, 32)])]) {
        assert.throws(() => trackMetadata(map, invalid), /finish gate followed by two gates per centerline vertex/)
    }
    const changed = Buffer.from(gates)
    changed[0] ^= 1
    const swapped = Buffer.concat([gates.subarray(16, 32), gates.subarray(0, 16), gates.subarray(32)])
    for (const invalid of [changed, swapped]) {
        assert.throws(() => trackMetadata(map, invalid), /do not match checked-in trackWaypoints at gate 0/)
    }
    const swappedTurnPair = Buffer.concat([gates.subarray(0, 16), gates.subarray(32, 48),
        gates.subarray(16, 32), gates.subarray(48)])
    assert.throws(() => trackMetadata(map, swappedTurnPair), /do not match checked-in trackWaypoints at gate 1/)
})

test("metadata accepts negative extended endpoints and validates every signed coordinate", () => {
    const map = makeTilemap(svg, DEFAULT_CONFIG)
    const gates = gateBuffer(map)
    const values = Array.from({ length: gates.length / 4 }, (_, i) => gates.readInt32LE(i * 4))
    assert.ok(values.some(value => value < 0))
    assert.doesNotThrow(() => trackMetadata(map, gates))
    for (let offset = 0; offset < gates.length; offset += 4) {
        const changed = Buffer.from(gates)
        changed.writeInt32LE(gates.readInt32LE(offset) + 65536, offset)
        assert.throws(() => trackMetadata(map, changed),
            new RegExp(`do not match checked-in trackWaypoints at gate ${Math.floor(offset / 16)};`))
    }
    assert.throws(() => trackMetadata({ ...map, roadWidth: 2 ** 30 }, gates), /Gate pixel coordinates exceed Int32/)
})

test("gate parsing rejects missing, duplicate, malformed, and unsupported declarations", () => {
    const hex = "ffffffff0000008000000100ffffff7f"
    const valid = `namespace trackWaypoints {\n//% whenUsed\nexport const sample = hex\`${hex}\`;\n}`
    const parsed = readTrackGates(valid).get("sample")
    assert.deepEqual(parsed, Buffer.from(hex, "hex"))
    assert.deepEqual(Array.from({ length: 4 }, (_, i) => parsed.readInt32LE(i * 4)),
        [-1, -2147483648, 65536, 2147483647])
    assert.throws(() => readTrackGates(""), /exactly one trackWaypoints namespace/)
    assert.throws(() => readTrackGates(valid + valid), /exactly one trackWaypoints namespace/)
    assert.throws(() => readTrackGates("namespace trackWaypoints {}"), /No checked-in/)
    assert.throws(() => readTrackGates(`namespace trackWaypoints {
        export const sample = hex\`${hex}\`;
        export const sample = hex\`${hex}\`;
    }`), /Duplicate trackWaypoints/)
    for (const invalid of ["", "gg", "0000", "0100020003000400", "0".repeat(30), "0".repeat(34)]) {
        assert.throws(() => readTrackGates(valid.replace(hex, invalid)), /16-byte Int32LE records/)
    }
    assert.throws(() => readTrackGates(valid.replace(`hex\`${hex}\``, "1")), /Malformed trackWaypoints/)
    assert.throws(() => readTrackGates(valid.replace("\n}", "\nexport const ignored = 1;\n}")),
        /Malformed trackWaypoints/)
})

test("checked-in AI geometry matches shared finish gates, ordered turn pairs, and centerline vertices", () => {
    const source = fs.readFileSync(geometryFile, "utf8")
    assert.equal(source, generateGeometry())
    assert.doesNotMatch(source, /namespace myTiles|trackWaypoints|createTilemap|image\.|img`/)
    const centers = source.match(/namespace trackCenterlines \{([^}]+)\}/)[1]
    const widths = source.match(/namespace trackRoadWidths \{([^}]+)\}/)[1]
    const gates = readTrackGates(fs.readFileSync(path.join(projectRoot, "tilemap.g.ts"), "utf8"))
    const names = Array.from(gates.keys()).sort()
    for (const namespace of [centers, widths]) {
        assert.deepEqual(Array.from(namespace.matchAll(/export const (\w+) =/g), match => match[1]).sort(), names)
    }
    let vertexCount = 0
    for (const name of names) {
        const map = makeTilemap(fs.readFileSync(path.join(projectRoot, "tracks", `${name}.svg`), "utf8"), DEFAULT_CONFIG)
        const hex = centers.match(new RegExp(`//% whenUsed\\s+export const ${name} = hex\`([0-9a-f]+)\`;`))[1]
        const centerline = Buffer.from(hex, "hex")
        assert.deepEqual(readCenterline(centerline), makeWaypoints(map, true))
        assert.deepEqual(centerline, trackMetadata(map, gates.get(name)).centerline)
        const generatedGates = makeGates(map)
        assert.equal(gates.get(name).length, centerline.length * 8 + 16)
        assert.equal(generatedGates.length, readCenterline(centerline).length * 2 + 1)
        generatedGates.forEach((gate, i) => {
            assert.deepEqual(Array.from({ length: 4 }, (_, k) => gates.get(name).readInt32LE(i * 16 + k * 4)),
                [gate.start.x, gate.start.y, gate.end.x, gate.end.y])
        })
        const finish = generatedGates[0]
        const vertices = readCenterline(centerline), last = vertices.at(-1), first = vertices[0]
        const dx = first.x - last.x, dy = first.y - last.y
        const finishX = map.finish.x * 16, finishY = map.finish.y * 16
        const t = ((finishX - last.x) * dx + (finishY - last.y) * dy) / (dx * dx + dy * dy)
        assert.ok(t > 0 && t < 1, `${name}: finish marker projects inside the closing segment`)
        assertGateOnSegment(finish, last, first, t)
        const gateDx = finish.end.x - finish.start.x, gateDy = finish.end.y - finish.start.y
        const markerPosition = ((finishX - finish.start.x) * gateDx + (finishY - finish.start.y) * gateDy) /
            (gateDx * gateDx + gateDy * gateDy)
        assert.ok(markerPosition > 0 && markerPosition < 1, `${name}: gate spans the finish marker`)
        assert.ok(Math.abs((finishX - finish.start.x) * gateDy - (finishY - finish.start.y) * gateDx) /
            Math.hypot(gateDx, gateDy) < 1, `${name}: gate crosses the finish marker within pixel rounding`)
        const clearance = map.roadWidth * 8 + 12
        vertices.forEach((vertex, i) => {
            const previous = vertices[(i + vertices.length - 1) % vertices.length]
            const next = vertices[(i + 1) % vertices.length]
            const incoming = Math.hypot(vertex.x - previous.x, vertex.y - previous.y)
            const outgoing = Math.hypot(next.x - vertex.x, next.y - vertex.y)
            assertGateOnSegment(generatedGates[2 * i + 1], previous, vertex,
                1 - Math.min(clearance, incoming / 3) / incoming)
            assertGateOnSegment(generatedGates[2 * i + 2], vertex, next,
                Math.min(clearance, outgoing / 3) / outgoing)
        })
        assert.match(widths, new RegExp(`//% whenUsed\\s+export const ${name} = ${map.roadWidth * 16};`))
        vertexCount += centerline.length / 4
    }
    assert.equal(names.length, 6)
    assert.equal(vertexCount, 160)
})

test("generation reports configuration mismatches instead of guessing metadata", () => {
    withFixture(root => {
        assert.throws(() => generateGeometry(root, { ...DEFAULT_CONFIG, size: 180 }),
            /sample\.svg: Generated gates do not match checked-in trackWaypoints/)
        assert.equal(fs.existsSync(path.join(root, "ai", "geometry.g.ts")), false)
    })
})

test("generation requires matching SVG and gate track sets", () => {
    withFixture(root => {
        fs.copyFileSync(path.join(root, "tracks", "sample.svg"), path.join(root, "tracks", "extra.svg"))
        assert.throws(() => generateGeometry(root), /extra\.svg: No checked-in trackWaypoints gates/)
    })
    withFixture((root, gates) => {
        const file = path.join(root, "tilemap.g.ts")
        fs.writeFileSync(file, fs.readFileSync(file, "utf8").replace("\n}",
            `\nexport const missing = hex\`${gates.toString("hex")}\`;\n}`))
        assert.throws(() => generateGeometry(root), /No SVG found for checked-in trackWaypoints track: missing/)
    })
})

test("generation rejects invalid and duplicate normalized track identifiers", () => {
    withFixture(root => {
        fs.renameSync(path.join(root, "tracks", "sample.svg"), path.join(root, "tracks", "1-invalid.svg"))
        assert.throws(() => generateGeometry(root), /Invalid or duplicate track name/)
    })
    withFixture(root => {
        fs.renameSync(path.join(root, "tracks", "sample.svg"), path.join(root, "tracks", "sample-name.svg"))
        fs.copyFileSync(path.join(root, "tracks", "sample-name.svg"), path.join(root, "tracks", "sample_name.svg"))
        const file = path.join(root, "tilemap.g.ts")
        fs.writeFileSync(file, fs.readFileSync(file, "utf8").replace("export const sample ", "export const sample_name "))
        assert.throws(() => generateGeometry(root), /Invalid or duplicate track name/)
    })
})

test("CLI generation is deterministic, cwd-independent, and leaves shared files unchanged", () => {
    const before = sharedFiles.map(name => fs.readFileSync(path.join(projectRoot, name)))
    const expected = fs.readFileSync(geometryFile)
    for (const cwd of [projectRoot, __dirname]) {
        const result = spawnSync(process.execPath, [script], { cwd, encoding: "utf8" })
        assert.equal(result.status, 0, result.stderr)
        assert.deepEqual(fs.readFileSync(geometryFile), expected)
    }
    sharedFiles.forEach((name, i) => assert.deepEqual(fs.readFileSync(path.join(projectRoot, name)), before[i], name))
    const invalid = spawnSync(process.execPath, [script, "--size", "180"], { encoding: "utf8" })
    assert.equal(invalid.status, 1)
    assert.match(invalid.stderr, /does not accept arguments/)
    assert.deepEqual(fs.readFileSync(geometryFile), expected)
})

test("CLI failure preserves prior geometry and surfaces the offending track", () => {
    withFixture((root, gates) => {
        const changed = Buffer.from(gates)
        changed[0] ^= 1
        const shared = path.join(root, "tilemap.g.ts")
        fs.writeFileSync(shared, fs.readFileSync(shared, "utf8").replace(gates.toString("hex"), changed.toString("hex")))
        const output = path.join(root, "ai", "geometry.g.ts")
        fs.writeFileSync(output, "previous geometry\n")
        const result = spawnSync(process.execPath, [path.join(root, "ai", "generate-geometry.js")], { encoding: "utf8" })
        assert.equal(result.status, 1)
        assert.match(result.stderr, /sample\.svg: Generated gates do not match checked-in trackWaypoints/)
        assert.equal(fs.readFileSync(output, "utf8"), "previous geometry\n")
    })
})
