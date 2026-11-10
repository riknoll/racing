const assert = require("node:assert/strict")
const { spawnSync } = require("node:child_process")
const fs = require("node:fs")
const os = require("node:os")
const path = require("node:path")
const test = require("node:test")
const { parseEditorTrack, makeTilemap, makeWaypoints, makeGates, formatTilemap, formatBatch } = require("./create-tilemap")

const rectangle = { version: 1, points: [[0, 0], [20, 0], [20, 20], [0, 20]] }

test("JSON rejects malformed, out-of-grid, incomplete and invalid closed tracks", () => {
    for (const data of [
        null, [], {}, { version: 2, points: rectangle.points },
        { version: 1, points: [[0, 0], [8, 0]] },
        { version: 1, points: [[-1, 0], [8, 0], [0, 8]] },
        { version: 1, points: [[0, 0], [21, 0], [0, 8]] },
        { version: 1, points: [[0, 0], [8.5, 0], [0, 8]] },
        { version: 1, points: [[0, 0], ["8", 0], [0, 8]] },
        { version: 1, points: [[0, 0], [8, 0, 0], [0, 8]] },
        { version: 1, points: [[0, 0], [8, 0], [8, 3]] },
        { version: 1, points: [[0, 0], [8, 8], [0, 8], [8, 0]] },
    ]) assert.throws(() => parseEditorTrack(data), /Editor/)
})

for (const name of ["birmingham", "hanover", "monclava", "strasbourg", "vancouver", "seattle", "sydney"]) {
    test(`${name} generates a closed road, matching geometry and forward checkpoints`, () => {
        const definition = JSON.parse(fs.readFileSync(path.join(__dirname, `${name}.json`), "utf8"))
        for (const tileset of ["compact", "detailed"]) {
            const map = makeTilemap(definition, { size: 200, width: 4, tileset })
            assert.equal(map.points.length, definition.points.length)
            const gates = makeGates(map)
            assert.equal(gates.length, map.points.length * 2 + 1)
            const center = gate => ({ x: (gate.start.x + gate.end.x) / 2, y: (gate.start.y + gate.end.y) / 2 })
            const finish = center(gates[0])
            assert.ok(Math.hypot(finish.x - map.finish.x * 16, finish.y - map.finish.y * 16) < 1)
            const next = center(gates[1])
            const a = map.points[0], b = map.points[1]
            assert.ok((next.x - finish.x) * (b.x - a.x) + (next.y - finish.y) * (b.y - a.y) > 0)
            const source = formatTilemap(map)
            const bytes = Buffer.from(source.match(/hex`([0-9a-f]+)`/)[1], "hex")
            assert.equal(bytes.readUInt16LE(0), map.width)
            assert.equal(bytes.readUInt16LE(2), map.height)
            assert.equal(bytes.length, map.width * map.height + 4)
            if (tileset === "detailed") assert.deepEqual(bytes.subarray(4), Buffer.from(map.tiles))
            const gateData = Buffer.from(source.match(/trackWaypoints = hex`([0-9a-f]+)`/)[1], "hex")
            assert.equal(gateData.length, gates.length * 16)
            gates.forEach((gate, i) => {
                assert.equal(gateData.readInt32LE(i * 16), gate.start.x)
                assert.equal(gateData.readInt32LE(i * 16 + 4), gate.start.y)
                assert.equal(gateData.readInt32LE(i * 16 + 8), gate.end.x)
                assert.equal(gateData.readInt32LE(i * 16 + 12), gate.end.y)
            })
            assert.match(source, /trackWaypoints = hex`[0-9a-f]+`/)
        }
    })
}

test("batch shares tiles and rejects mismatched colors and duplicate names", () => {
    const map = makeTilemap(rectangle, { size: 80, width: 4, tileset: "compact" })
    const output = formatBatch([{ name: "one.json", map }, { name: "two.json", map }])
    const resources = JSON.parse(output.jres)
    assert.deepEqual(resources.one.tileset, resources.two.tileset)
    assert.equal(resources.one.data, resources.two.data)
    assert.match(output.geometry, /export const one = hex`[0-9a-f]+`/)
    assert.throws(() => formatBatch([{ name: "one.json", map }, { name: "one.json", map }]), /duplicate track name/)
    assert.throws(() => formatBatch([{ name: "one.json", map },
        { name: "two.json", map: { ...map, roadColor: 3 } }]), /same grass, road, and outline colors/)
})

test("CLI consumes JSON and generates editor definitions, gates and AI centerlines", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "editor-track-"))
    const tracks = path.join(root, "tracks")
    const output = path.join(root, "output")
    try {
        fs.mkdirSync(tracks)
        const script = path.join(tracks, "create-tilemap.js")
        fs.copyFileSync(path.join(__dirname, "create-tilemap.js"), script)
        const file = path.join(tracks, "handmade.json")
        fs.writeFileSync(file, JSON.stringify(rectangle))
        const svg = path.join(tracks, "ignored.svg")
        fs.writeFileSync(svg, "<svg/>")
        const run = args => spawnSync(process.execPath, [script, ...args], { encoding: "utf8" })
        const single = run([file, "--tileset", "compact"])
        assert.equal(single.status, 0, single.stderr)
        assert.match(single.stdout, /trackWaypoints = hex`[0-9a-f]+`/)
        const batch = run(["--batch", "--output", output])
        assert.equal(batch.status, 0, batch.stderr)
        const resources = JSON.parse(fs.readFileSync(path.join(output, "tilemap.g.jres"), "utf8"))
        assert.ok(resources.handmade)
        assert.equal(resources.ignored, undefined)
        const editor = fs.readFileSync(path.join(output, "track-editor-tracks.g.ts"), "utf8")
        assert.match(editor, /name: "handmade"/)
        assert.deepEqual([...editor.matchAll(/\{ x: (\d+), y: (\d+) \}/g)]
            .map(match => [Number(match[1]), Number(match[2])]), rectangle.points)
        const geometry = fs.readFileSync(path.join(output, "ai/geometry.g.ts"), "utf8")
        const vertices = Buffer.from(geometry.match(/export const handmade = hex`([0-9a-f]+)`/)[1], "hex")
        const points = makeWaypoints(makeTilemap(rectangle, { size: 200, width: 4, tileset: "compact" }))
        assert.equal(vertices.length, points.length * 4)
        points.forEach((point, i) => {
            assert.equal(vertices.readUInt16LE(i * 4), point.x)
            assert.equal(vertices.readUInt16LE(i * 4 + 2), point.y)
        })
        assert.match(geometry, /export const handmade = 64;/)
        const wrongFormat = run([svg])
        assert.equal(wrongFormat.status, 1)
        assert.match(wrongFormat.stderr, /must be a JSON file/)
        fs.writeFileSync(file, '{"version":1,"points":')
        const broken = run(["--batch", "--output", path.join(root, "broken")])
        assert.equal(broken.status, 1)
        assert.match(broken.stderr, /handmade\.json:/)
        assert.equal(fs.existsSync(path.join(root, "broken", "tilemap.g.ts")), false)
    } finally {
        fs.rmSync(root, { recursive: true, force: true })
    }
})
