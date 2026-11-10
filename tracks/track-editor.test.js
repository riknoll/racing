const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const { stripTypeScriptTypes } = require("node:module")
const test = require("node:test")
const vm = require("node:vm")
const { parseEditorTrack, makeTilemap, makeGates } = require("./create-tilemap")

function loadEditor(globals = {}) {
    const context = vm.createContext(globals)
    vm.runInContext("Array.prototype.removeAt = function(i) { return this.splice(i, 1)[0] }", context)
    vm.runInContext("Array.prototype.insertAt = function(i, value) { this.splice(i, 0, value) }", context)
    const source = fs.readFileSync(path.join(__dirname, "../track-editor-model.ts"), "utf8")
    vm.runInContext(stripTypeScriptTypes(source, { mode: "transform" }), context)
    return context
}

const fixtures = [
    { name: "rectangle", points: [[0, 0], [20, 0], [20, 20], [0, 20]], invalid: [false, false, false, false] },
    { name: "diagonal", points: [[0, 0], [8, 0], [0, 8]], invalid: [false, false, false] },
    { name: "1:2 slopes", points: [[0, 0], [8, 4], [8, 12], [0, 8]], invalid: [false, false, false, false] },
    { name: "2:1 slopes", points: [[0, 0], [4, 8], [12, 8], [8, 0]], invalid: [false, false, false, false] },
    { name: "collinear continuation", points: [[0, 0], [4, 0], [8, 0], [8, 8], [0, 8]],
        invalid: [false, false, false, false, false] },
    { name: "crossing", points: [[0, 0], [8, 8], [0, 8], [8, 0]], invalid: [true, false, true, false] },
    { name: "closing crossing", points: [[0, 0], [8, 0], [0, 8], [8, 8]], invalid: [false, true, false, true] },
    { name: "invalid closing slope", points: [[0, 0], [8, 0], [8, 6]], invalid: [false, false, true] },
    { name: "overlap", points: [[0, 0], [8, 0], [4, 0], [4, 8], [0, 8]], invalid: [true, true, true, false, false] },
    { name: "nonadjacent touch", points: [[0, 0], [8, 0], [8, 8], [4, 0], [0, 8]],
        invalid: [true, false, true, true, false] },
    { name: "duplicate node", points: [[0, 0], [8, 0], [8, 0], [0, 8]], invalid: [true, true, true, false] },
]

for (const fixture of fixtures) {
    test(`editor and importer agree on ${fixture.name}`, () => {
        const { racing } = loadEditor()
        const points = fixture.points.map(([x, y]) => ({ x, y }))
        assert.deepEqual(Array.from(racing.trackEditor.invalidSegments(points)), fixture.invalid)
        const data = { version: 1, points: fixture.points }
        if (fixture.invalid.some(Boolean)) assert.throws(() => parseEditorTrack(data), /slope|intersect|overlap|zero length/)
        else {
            assert.deepEqual(parseEditorTrack(data), points)
            for (const ordered of [fixture.points, fixture.points.slice().reverse()]) {
                const map = makeTilemap({ version: 1, points: ordered },
                    { size: 200, width: 4, simplify: 2, tileset: "compact" })
                assert.equal(map.points.length, ordered.length)
                assert.ok(makeGates(map).length >= 1)
            }
        }
    })
}

test("placing, dragging, dropping and deleting preserve node order and reach every grid edge", () => {
    const { racing } = loadEditor()
    const model = new racing.trackEditor.Model()
    model.pressA()
    model.releaseA()
    model.move(20, 0)
    model.pressA()
    model.releaseA()
    model.move(0, 20)
    model.pressA()
    model.releaseA()
    assert.equal(model.canSave(), true)
    model.move(0, -20)
    model.pressA()
    assert.equal(model.dragging, 1)
    assert.equal(model.canSave(), false)
    model.move(-10, 0)
    model.releaseA()
    model.move(10, 0)
    assert.deepEqual(JSON.parse(model.serialize()).points, [[0, 0], [10, 0], [20, 20]])
    model.move(-10, 0)
    model.deleteNode()
    assert.equal(model.points.length, 2)
    assert.equal(model.canSave(), false)
    assert.throws(() => model.serialize(), error => String(error).includes("at least three"))
    model.move(-100, 100)
    assert.equal(model.cursorX, 0)
    assert.equal(model.cursorY, 20)
})

test("dropping onto another node is visibly invalid, not silently reordered or discarded", () => {
    const { racing } = loadEditor()
    const model = new racing.trackEditor.Model()
    for (const [x, y] of [[0, 0], [8, 0], [8, 8], [0, 8]]) {
        model.move(x - model.cursorX, y - model.cursorY)
        model.pressA()
        model.releaseA()
    }
    model.pressA()
    model.move(8, 0)
    model.releaseA()
    assert.equal(model.points.length, 4)
    assert.equal(model.canSave(), false)
    assert.ok(racing.trackEditor.invalidSegments(model.points).some(Boolean))
    model.pressA()
    model.deleteNode()
    model.releaseA()
    assert.equal(model.points.length, 3)
    assert.equal(model.canSave(), true)
})

test("editing a loaded track copies original nodes and starts the cursor at the first node", () => {
    const context = loadEditor()
    const { racing } = context
    const points = vm.runInContext('[{ x: 2, y: 7 }, { x: 12, y: 7 }, { x: 12, y: 17 }]', context)
    const model = new racing.trackEditor.Model(points)
    assert.equal(model.cursorX, 2)
    assert.equal(model.cursorY, 7)
    model.pressA()
    model.move(1, 0)
    model.releaseA()
    assert.equal(points[0].x, 2)
    assert.equal(model.points[0].x, 3)
    model.deleteNode()
    assert.equal(points.length, 3)
})

for (const fixture of [
    { name: "horizontal", points: [[0, 0], [8, 0], [8, 8], [0, 8]], cursor: [4, 0], index: 1 },
    { name: "vertical", points: [[0, 0], [8, 0], [8, 8], [0, 8]], cursor: [8, 4], index: 2 },
    { name: "diagonal", points: [[0, 0], [8, 8], [0, 8]], cursor: [4, 4], index: 1 },
    { name: "1:2", points: [[0, 0], [8, 4], [8, 12], [0, 8]], cursor: [4, 2], index: 1 },
    { name: "2:1", points: [[0, 0], [4, 8], [12, 8], [8, 0]], cursor: [2, 4], index: 1 },
    { name: "closing", points: [[0, 0], [8, 0], [8, 8], [0, 8]], cursor: [0, 4], index: 4 },
]) {
    test(`A subdivides a ${fixture.name} segment without changing traversal or finish`, () => {
        const context = loadEditor()
        const points = vm.runInContext(JSON.stringify(fixture.points.map(([x, y]) => ({ x, y }))), context)
        const model = new context.racing.trackEditor.Model(points)
        model.move(fixture.cursor[0] - model.cursorX, fixture.cursor[1] - model.cursorY)
        model.pressA()
        model.releaseA()
        const expected = fixture.points.slice()
        expected.splice(fixture.index, 0, fixture.cursor)
        assert.deepEqual(JSON.parse(model.serialize()).points, expected)
        model.pressA()
        assert.equal(model.dragging, fixture.index, "a subsequent press grabs the new node")
        assert.equal(model.points.length, expected.length, "existing endpoints must not be duplicated")
    })
}

test("A appends off-segment nodes instead of splitting the nearest line", () => {
    const context = loadEditor()
    const model = new context.racing.trackEditor.Model(
        vm.runInContext('[{x:0,y:0},{x:8,y:0},{x:8,y:8}]', context))
    model.move(4, 1)
    model.pressA()
    assert.deepEqual(Array.from(model.points, point => [point.x, point.y]), [[0, 0], [8, 0], [8, 8], [4, 1]])
})

test("shifting translates every node and cursor without changing node order or validity", () => {
    const context = loadEditor()
    const points = vm.runInContext('[{x:2,y:2},{x:8,y:2},{x:8,y:8},{x:2,y:8}]', context)
    const model = new context.racing.trackEditor.Model(points)
    for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
        const before = JSON.parse(model.serialize()).points
        assert.equal(model.shift(dx, dy), true)
        assert.deepEqual(JSON.parse(model.serialize()).points, before.map(([x, y]) => [x + dx, y + dy]))
        assert.equal(model.cursorX, model.points[0].x)
        assert.equal(model.cursorY, model.points[0].y)
        assert.equal(model.canSave(), true)
    }
    assert.deepEqual(Array.from(points, point => [point.x, point.y]), [[2, 2], [8, 2], [8, 8], [2, 8]])
})

test("Reverse preserves the start, reverses traversal and restores the original on a second use", () => {
    const context = loadEditor()
    const model = new context.racing.trackEditor.Model(
        vm.runInContext('[{x:2,y:2},{x:8,y:2},{x:8,y:8},{x:2,y:8}]', context))
    const before = model.serialize()
    model.reverse()
    assert.deepEqual(JSON.parse(model.serialize()).points, [[2, 2], [2, 8], [8, 8], [8, 2]])
    model.reverse()
    assert.equal(model.serialize(), before)
    const empty = new context.racing.trackEditor.Model()
    empty.reverse()
    assert.equal(empty.points.length, 0)
})

for (const fixture of [
    { method: "flipHorizontal", apply: ([x, y]) => [20 - x, y], repeats: 2 },
    { method: "flipVertical", apply: ([x, y]) => [x, 20 - y], repeats: 2 },
    { method: "rotate", apply: ([x, y]) => [20 - y, x], repeats: 4 },
]) {
    test(`${fixture.method} transforms the grid, cursor and ordered nodes without modifying the source`, () => {
        const context = loadEditor()
        const original = [[0, 0], [20, 0], [20, 10], [0, 10]]
        const points = vm.runInContext(JSON.stringify(original.map(([x, y]) => ({ x, y }))), context)
        const model = new context.racing.trackEditor.Model(points)
        const before = model.serialize()
        model[fixture.method]()
        assert.deepEqual(JSON.parse(model.serialize()).points, original.map(fixture.apply))
        assert.deepEqual([model.cursorX, model.cursorY], fixture.apply(original[0]))
        assert.deepEqual(Array.from(points, point => [point.x, point.y]), original)
        for (let i = 1; i < fixture.repeats; i++) model[fixture.method]()
        assert.equal(model.serialize(), before)
        const empty = new context.racing.trackEditor.Model()
        empty[fixture.method]()
        assert.equal(empty.points.length, 0)
    })
}

test("quick double-tap selects a new start without reordering the circuit", () => {
    const context = loadEditor()
    const model = new context.racing.trackEditor.Model(
        vm.runInContext('[{x:2,y:2},{x:8,y:2},{x:8,y:8},{x:2,y:8}]', context))
    model.move(6, 6)
    model.pressA(100)
    model.releaseA(150)
    model.pressA(300)
    model.releaseA(350)
    assert.deepEqual(JSON.parse(model.serialize()).points, [[8, 8], [2, 8], [2, 2], [8, 2]])
    assert.equal(model.cursorX, 8)
    assert.equal(model.cursorY, 8)
})

test("slow taps, long holds and dragging do not select a new start", () => {
    for (const mode of ["slow", "hold", "drag"]) {
        const context = loadEditor()
        const model = new context.racing.trackEditor.Model(
            vm.runInContext('[{x:2,y:2},{x:8,y:2},{x:8,y:8},{x:2,y:8}]', context))
        model.move(6, 0)
        model.pressA(100)
        if (mode === "drag") {
            model.move(0, 1)
            model.move(0, -1)
        }
        model.releaseA(mode === "hold" ? 600 : 150)
        model.pressA(mode === "slow" ? 600 : mode === "hold" ? 700 : 250)
        assert.equal(model.dragging, 1)
        assert.equal(model.points[0].x, 2)
        assert.equal(model.points[0].y, 2)
    }
})

test("shifting blocks the whole move at each grid boundary, while dragging, or with an empty map", () => {
    const context = loadEditor()
    const model = new context.racing.trackEditor.Model(
        vm.runInContext('[{x:0,y:0},{x:20,y:0},{x:20,y:20},{x:0,y:20}]', context))
    const before = model.serialize()
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        assert.equal(model.shift(dx, dy), false)
        assert.equal(model.serialize(), before)
        assert.equal(model.cursorX, 0)
        assert.equal(model.cursorY, 0)
    }
    const editable = new context.racing.trackEditor.Model(
        vm.runInContext('[{x:2,y:2},{x:8,y:2},{x:8,y:8}]', context))
    editable.pressA()
    assert.equal(editable.shift(1, 0), false)
    assert.equal(editable.points[0].x, 2)
    assert.equal(new context.racing.trackEditor.Model().shift(1, 0), false)
})

test("console export makes a closed tilemap without moving or simplifying authored nodes", () => {
    const { racing } = loadEditor()
    const model = new racing.trackEditor.Model()
    for (const [x, y] of [[0, 0], [10, 0], [20, 0], [20, 20], [0, 20]]) {
        model.move(x - model.cursorX, y - model.cursorY)
        model.pressA()
        model.releaseA()
    }
    const data = JSON.parse(model.serialize())
    const map = makeTilemap(data, { size: 100, width: 4, simplify: 50, angles: 16, tileset: "compact" })
    assert.equal(map.points.length, data.points.length, "even a collinear authored node is retained")
    const origin = map.points[0]
    data.points.forEach(([x, y], i) => {
        assert.equal(map.points[i].x - origin.x, x * 5)
        assert.equal(map.points[i].y - origin.y, y * 5)
    })
    assert.equal(map.finish.forward, true)
    const finish = makeGates(map)[0]
    assert.equal((finish.start.x + finish.end.x) / 2, Math.round(map.finish.x * 16))
    assert.equal((finish.start.y + finish.end.y) / 2, Math.round(map.finish.y * 16))
})

test("in-game controls reject invalid saves, drag while A is held, delete with B, save JSON and return", () => {
    const frames = []
    const tap = (button, count = 1) => {
        for (let i = 0; i < count; i++) frames.push([button], [])
    }
    tap("right", 21)
    tap("A")
    tap("left", 21)
    tap("A")
    tap("right", 20)
    tap("A")
    tap("down", 20)
    tap("A")
    tap("left", 20)
    tap("A")
    tap("right", 21)
    tap("A")
    tap("left")
    frames.push(["A"], ["A", "left"], [])
    tap("right", 2)
    tap("A")
    tap("left", 2)
    tap("B")
    tap("right", 2)
    tap("A")
    tap("down", 6)
    tap("A")
    let frame = 0
    let depth = 0
    let render
    const output = []
    const statuses = []
    const lines = []
    const target = {
        fill() {},
        fillRect() {},
        drawRect() {},
        drawLine(...args) { lines.push(args) },
        print(text) { statuses.push(text) },
    }
    const context = loadEditor({
        console: { log: data => output.push(JSON.parse(data)) },
        controller: Object.fromEntries(["A", "B", "up", "down", "left", "right"]
            .map(button => [button, { isPressed: () => (frames[frame] || []).includes(button) }])),
        game: { pushScene() { depth++ }, popScene() { depth-- }, runtime: () => frame * 20 },
        scene: { setBackgroundColor() {}, createRenderable(z, draw) { render = draw } },
        image: { font5: {} },
        releaseMenuButtons() {},
        pause() {
            render(target)
            assert.ok(frame++ < frames.length, "editor must return when Back is activated")
        },
    })
    context.trackEditor = context.racing.trackEditor
    context.racing.trackEditor.getTracks = () => []
    let menuCalls = 0
    context.chooseMenu = () => menuCalls++ === 0 ? 0 : -1
    vm.runInContext(stripTypeScriptTypes(fs.readFileSync(path.join(__dirname, "../track-editor.ts"), "utf8"),
        { mode: "transform" }), context)
    context.racing.editTrack()
    assert.equal(depth, 0)
    assert.ok(statuses.includes("NOT SAVED"))
    assert.ok(statuses.includes("FIX RED"))
    assert.deepEqual(output, [
        { version: 1, points: [[0, 0], [20, 0], [20, 20], [0, 20]] },
        { version: 1, points: [[0, 0], [20, 0], [0, 20]] },
    ])
    assert.ok(lines.some(line => line[4] === 2), "invalid segments are red")
    assert.ok(lines.some(line => line.join(",") === "4,12,104,12,5"),
        "first outgoing segment is highlighted yellow")
    assert.ok(lines.some(line => line.join(",") === "104,12,104,112,11"), "grid has twenty five-pixel cells")
})

test("picker loads JSON tracks, Shift moves the map, and Back returns to the picker", () => {
    const points = [{ x: 2, y: 2 }, { x: 18, y: 2 }, { x: 18, y: 18 }, { x: 2, y: 18 }]
    const frames = []
    const tap = (button, count = 1) => {
        for (let i = 0; i < count; i++) frames.push([button], [])
    }
    tap("right", 21)
    tap("down")
    tap("A")
    tap("right")
    tap("down")
    tap("left")
    tap("up")
    tap("right")
    tap("B")
    tap("up")
    tap("down", 2)
    tap("A")
    tap("down")
    tap("A")
    tap("down")
    tap("A")
    tap("down")
    tap("A")
    tap("up", 5)
    tap("A")
    tap("down", 6)
    tap("A")
    let frame = 0
    let menuCalls = 0
    const output = []
    const context = loadEditor({
        console: { log: data => output.push(JSON.parse(data)) },
        controller: Object.fromEntries(["A", "B", "up", "down", "left", "right"]
            .map(button => [button, { isPressed: () => (frames[frame] || []).includes(button) }])),
        game: { pushScene() {}, popScene() {}, runtime: () => frame * 20 },
        scene: { setBackgroundColor() {}, createRenderable() {} },
        pause() { assert.ok(frame++ < frames.length, "Back must close the loaded editor") },
    })
    context.trackEditor = context.racing.trackEditor
    context.racing.trackEditor.getTracks = () => [{ name: "monclava", points }]
    context.releaseMenuButtons = () => {}
    context.chooseMenu = (title, choices) => {
        assert.equal(title, "TRACK EDITOR")
        assert.deepEqual(Array.from(choices), ["New Track", "monclava"])
        return menuCalls++ === 0 ? 1 : -1
    }
    vm.runInContext(stripTypeScriptTypes(fs.readFileSync(path.join(__dirname, "../track-editor.ts"), "utf8"),
        { mode: "transform" }), context)
    context.racing.editTrack()
    assert.equal(menuCalls, 2)
    const reversed = [points[0], ...points.slice(1).reverse()]
    assert.deepEqual(output, [{ version: 1, points: reversed.map(point => [point.y, 19 - point.x]) }])
})
