const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const { stripTypeScriptTypes } = require("node:module")
const test = require("node:test")
const vm = require("node:vm")
const { makeTilemap, makeWaypoints, makeGates } = require("./create-tilemap")

function loadTrack(map) {
    const gates = makeGates(map)
    const points = makeWaypoints(map)
    const context = vm.createContext({
        racing: { readGates: () => gates,
            gateCenter: gate => ({ x: (gate.start.x + gate.end.x) / 2, y: (gate.start.y + gate.end.y) / 2 }) },
        util: { Point: class { constructor(x, y) { this.x = x; this.y = y } } },
        NumberFormat: { UInt16LE: 0 },
    })
    vm.runInContext(stripTypeScriptTypes(fs.readFileSync(path.join(__dirname, "../ai/track.ts"), "utf8"),
        { mode: "transform" }), context)
    const centers = {
        length: points.length * 4,
        getNumber(format, offset) {
            const point = points[Math.floor(offset / 4)]
            return offset % 4 ? point.y : point.x
        },
    }
    return new context.aiRacing.Track({ length: gates.length * 16 }, centers, map.roadWidth * 16)
}

for (const reversed of [false, true]) {
    test(`JSON checkpoints start beyond the finish and end on its approach (${reversed ? "reversed" : "forward"})`, () => {
        const points = [[0, 0], [20, 0], [20, 20], [0, 20]]
        if (reversed) points.reverse()
        const track = loadTrack(makeTilemap({ version: 1, points },
            { size: 200, width: 4, simplify: 2, tileset: "compact" }))
        const gate = track.gates[0]
        const finish = { x: (gate.start.x + gate.end.x) / 2, y: (gate.start.y + gate.end.y) / 2 }
        const previous = track.centers[track.centers.length - 1]
        const forward = { x: finish.x - previous.x, y: finish.y - previous.y }
        const next = track.gates[1]
        const outgoing = { x: track.centers[1].x - finish.x, y: track.centers[1].y - finish.y }
        const after = { x: (next.start.x + next.end.x) / 2 - finish.x,
            y: (next.start.y + next.end.y) / 2 - finish.y }
        assert.ok(after.x * outgoing.x + after.y * outgoing.y > 0,
            "first checkpoint must lie beyond the finish along the outgoing road")
        const final = track.gates[track.gates.length - 1]
        assert.ok(((final.start.x + final.end.x) / 2 - finish.x) * forward.x
            + ((final.start.y + final.end.y) / 2 - finish.y) * forward.y < 0)
        assert.equal(track.segmentForGate(0), track.centers.length - 1)
        for (let i = 1; i < track.gates.length; i++) {
            assert.equal(track.segmentForGate(i), Math.floor((i - 1) / 2))
        }
        assert.ok(Math.cos(track.startHeading) * forward.x + Math.sin(track.startHeading) * forward.y > 0)
        const car = {}
        track.reset(car)
        assert.equal(car.heading, track.startHeading)
        for (const behind of [30, 60]) {
            const x = finish.x - behind * Math.cos(track.startHeading)
            const y = finish.y - behind * Math.sin(track.startHeading)
            assert.ok((x - finish.x) * forward.x + (y - finish.y) * forward.y < 0)
        }
    })
}

test("Birmingham start heading agrees with forward traversal", () => {
    const definition = JSON.parse(fs.readFileSync(path.join(__dirname, "birmingham.json"), "utf8"))
    const track = loadTrack(makeTilemap(definition, { size: 200, width: 4, tileset: "compact" }))
    const car = {}
    track.reset(car)
    const previous = track.centers[track.centers.length - 1]
    const first = track.centers[0]
    assert.equal(car.heading, Math.atan2(first.y - previous.y, first.x - previous.x))
})
