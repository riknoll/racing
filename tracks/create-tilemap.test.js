const assert = require("node:assert/strict")
const { spawnSync } = require("node:child_process")
const fs = require("node:fs")
const os = require("node:os")
const path = require("node:path")
const test = require("node:test")
const {
    parsePath,
    extractTrack,
    extractFinish,
    simplifyLoop,
    separateTrack,
    rasterizePixels,
    makeTilemap,
    makeWaypoints,
    makeGates,
    formatTilemap,
    formatBatch,
} = require("./create-tilemap")

function edgeError(map) {
    const masks = rasterizePixels(map.points, map.width, map.height, map.roadWidth)
    let maxDifference = 0
    let totalDifference = 0
    let borderDifference = 0
    let edgeCount = 0
    for (const [index, mask] of masks) {
        let roadPixels = 0
        let difference = 0
        const image = map.images[map.tiles[index]]
        for (let y = 0; y < 16; y++) {
            for (let x = 0; x < 16; x++) {
                const expected = Boolean(mask[y >> 1] & (1 << ((y & 1) * 16 + x)))
                roadPixels += expected
                if (expected !== (image[y * 17 + x] === "1")) {
                    difference++
                    if (x === 0 || x === 15 || y === 0 || y === 15) borderDifference++
                }
            }
        }
        if (roadPixels && roadPixels < 256) {
            edgeCount++
            totalDifference += difference
            maxDifference = Math.max(maxDifference, difference)
        }
    }
    return { edgeCount, maxDifference, totalDifference, borderDifference }
}

function assertCompactBorders(map) {
    const raster = rasterizePixels(map.points, map.width, map.height, map.roadWidth, true, true)
    const full = index => raster.get(index)?.every(word => word === 0xffffffff)
    const referenceEdge = (index, side) => {
        const mask = raster.get(index)
        return Array.from({ length: 16 }, (_, k) => {
            const x = side === "left" ? 0 : side === "right" ? 15 : k
            const y = side === "top" ? 0 : side === "bottom" ? 15 : k
            return mask?.[y >> 1] & (1 << ((y & 1) * 16 + x)) ? "1" : "7"
        }).join("")
    }
    const edge = (image, side) => Array.from({ length: 16 }, (_, i) => {
        if (side === "left") return image[i * 17]
        if (side === "right") return image[i * 17 + 15]
        if (side === "top") return image[i]
        return image[15 * 17 + i]
    }).join("")
    for (let y = 0; y < map.height; y++) {
        for (let x = 0; x < map.width; x++) {
            const i = y * map.width + x
            const tile = map.tiles[i]
            for (const [neighbor, first, second, present] of [
                [i + 1, "right", "left", x + 1 < map.width],
                [i + map.width, "bottom", "top", y + 1 < map.height],
            ]) {
                if (!present) continue
                const adjacent = map.tiles[neighbor]
                const a = edge(map.images[tile], first)
                const b = edge(map.images[adjacent], second)
                if (tile && adjacent) {
                    const halfRoad = (tile === 1 && full(i) &&
                        b.replaceAll("7", "").length === 8 &&
                        Array.from(b).filter((bit, k) => bit !== referenceEdge(neighbor, second)[k]).length <= 2) ||
                        (adjacent === 1 && full(neighbor) &&
                            a.replaceAll("7", "").length === 8 &&
                            Array.from(a).filter((bit, k) => bit !== referenceEdge(i, first)[k]).length <= 2)
                    assert.ok(a === b || halfRoad,
                        `road tiles disagree at ${x},${y} on their ${first} border`)
                } else {
                    const count = (a + b).replaceAll("7", "").length
                    assert.ok(count <= 1 || count >= 15,
                        `partial road edge ends in grass at ${x},${y} on its ${first} border`)
                }
            }
        }
    }
}

test("parses relative, implicit, smooth, quadratic and arc SVG segments", () => {
    const lines = parsePath("M 10 10 h 10 v 10 l -10 0 z M0 0 10 0 10 10 Z")
    assert.equal(lines.length, 2)
    assert.deepEqual(lines[0].points, [
        { x: 10, y: 10 }, { x: 20, y: 10 },
        { x: 20, y: 20 }, { x: 10, y: 20 },
    ])
    assert.equal(lines[1].points[2].x, 10)
    assert.ok(lines.every(line => line.closed))

    for (const data of [
        "M0 0 C0 10 10 10 10 0 S20 -10 20 0 Z",
        "M0 0 Q10 10 20 0 T40 0 Z",
        "M0 0 A10 10 0 0 1 20 0 L20 20 Z",
    ]) {
        const points = parsePath(data)[0].points
        assert.ok(points.length > 4, data)
        assert.ok(points.every(p => Number.isFinite(p.x) && Number.isFinite(p.y)))
    }
    assert.throws(() => parsePath("M0 0 X10 10"), /Unsupported/)
})

test("selects the longest closed path, ignoring overlay paths", () => {
    const svg = `<svg><path d="M0 0 L10 0 L10 10 Z"/>
        <path d="M0 0 L50 0 L50 50 L0 50 Z"/>
        <path d="M0 0 L1000 0 L1000 1000"/></svg>`
    assert.equal(extractTrack(svg).length, 4)
    assert.deepEqual(extractTrack(svg)[2], { x: 50, y: 50 })
    assert.throws(() => extractTrack('<svg><path d="M0 0 L1 1"/></svg>'), /closed/)
    assert.throws(() => extractTrack('<svg><g transform="scale(2)"><path d="M0 0 L5 0 L5 5 Z"/></g></svg>'), /transforms/)
})

test("finds the yellow-to-red finish and its direction, including reversed centerlines", () => {
    const svg = `<svg>
        <style>.hot{stroke:#EF4444}.last{stroke:#FBBF24}</style>
        <path d="M0 0 L0 20 L20 20 L20 0 Z"/>
        <path class="hot" d="M0 0 L20 0"/>
        <path class="last" d="M0 20 L0 0"/>
    </svg>`
    assert.deepEqual(extractFinish(svg, extractTrack(svg)), {
        point: { x: 0, y: 0 }, forward: false,
    })
    const map = makeTilemap(svg, { size: 80, width: 4, simplify: 2 })
    const waypoints = makeWaypoints(map)
    assert.ok(waypoints[1].x > waypoints[0].x, "first leg must follow the red path")
    assert.throws(() => makeTilemap('<svg><path d="M0 0 L20 0 L20 20 Z"/></svg>',
        { size: 50, width: 4, simplify: 2 }), /red path and one open yellow path/)
    assert.throws(() => extractFinish(svg.replace('M0 20 L0 0', 'M0 20 L10 10'), extractTrack(svg)),
        /yellow path must end/)
})

test("simplifies straight sections without losing the closed circuit", () => {
    const points = [
        { x: 0, y: 0 }, { x: 5, y: 0.1 }, { x: 10, y: 0 },
        { x: 10, y: 10 }, { x: 0, y: 10 },
    ]
    assert.deepEqual(simplifyLoop(points, 0.2), [
        points[0], points[2], points[3], points[4],
    ])
})

test("rasterizes constant-width straight and rounded road segments at pixel resolution", () => {
    const points = [
        { x: 10, y: 10 }, { x: 30, y: 10 },
        { x: 30, y: 30 }, { x: 10, y: 30 },
    ]
    const masks = rasterizePixels(points, 40, 40, 4)
    const at = (x, y) => Boolean(masks.get(y * 40 + x)?.[4] & (1 << 8))
    for (const x of [13, 20, 27]) {
        assert.deepEqual([7, 8, 9, 10, 11, 12].map(y => at(x, y)), [false, true, true, true, true, false])
    }
    assert.equal(at(30, 30), true)
    assert.equal(at(25, 25), false)
    assert.equal(at(0, 0), false)
})

test("compact road edges meet at mitered corners instead of rounded segment ends", () => {
    const points = [
        { x: 10, y: 10 }, { x: 30, y: 10 },
        { x: 30, y: 30 }, { x: 10, y: 30 },
    ]
    const joined = rasterizePixels(points, 40, 40, 4, true, true)
    const rounded = rasterizePixels(points, 40, 40, 4)
    const at = (masks, x, y) => Boolean(masks.get(y * 40 + x)?.[4] & (1 << 8))
    assert.equal(at(joined, 31, 8), true, "offset edges intersect at the outer corner")
    assert.equal(at(rounded, 31, 8), false, "the same pixel is outside a rounded end")
    assert.equal(at(joined, 25, 25), false)
})

test("moves nearby parallel track legs apart instead of narrowing the road", () => {
    const points = [
        { x: 0, y: 0 }, { x: 30, y: 0 },
        { x: 36, y: 2.5 }, { x: 30, y: 5 }, { x: 0, y: 5 },
        { x: 0, y: 20 }, { x: 40, y: 20 },
        { x: 40, y: -10 }, { x: -10, y: -10 },
    ]
    const separated = separateTrack(points, 4)
    const midpoint = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })
    const a = midpoint(separated[0], separated[1])
    const b = midpoint(separated[3], separated[4])
    assert.ok(Math.hypot(a.x - b.x, a.y - b.y) >= 5.9)
})

test("encodes valid dimensions, cells, tileset, and wall layer for MakeCode", () => {
    const svg = `<svg><path d="M0 0 L100 0 L100 70 L0 70 Z"/>
        <path stroke="red" d="M0 0 L100 0"/>
        <path stroke="yellow" d="M0 70 L0 0"/></svg>`
    const map = makeTilemap(svg, { size: 100, width: 4, simplify: 2 })
    assert.equal(map.points.length, 4, "closing Z must not discard the last corner")
    const source = formatTilemap(map)
    const bytes = Buffer.from(source.match(/hex`([0-9a-f]+)`/)[1], "hex")
    assert.equal(bytes.readUInt16LE(0), map.width)
    assert.equal(bytes.readUInt16LE(2), map.height)
    assert.deepEqual(bytes.subarray(4), Buffer.from(map.tiles))
    assert.match(source, /tiles\.setCurrentTilemap\(tiles\.createTilemap\(/)
    assert.match(source, /TileScale\.Sixteen/)
    assert.equal((source.match(/img`/g) || []).length, map.images.length + 1)
    const renderedImages = Array.from(source.matchAll(/img`([^`]+)`/g), match => match[1])
    assert.ok(renderedImages.every(image => !/[17]/.test(image)),
        "grass and road in every emitted tile image must use their output colors")
    assert.ok(!renderedImages[1].includes("1"), "the grass tile is fully transparent")
    assert.match(renderedImages[2], /b{16}/, "full road uses color 11")
    assert.ok(renderedImages.every(image => !image.includes("c")), "detailed mode has no outline")
    assert.ok(map.terrain.includes(0) && map.terrain.includes(1))
    assert.ok(map.images.length > 2 && map.images.length <= 256)
    assert.ok(map.images.slice(2).some(image => image.includes("7") && image.includes("1")))
    assert.ok(map.images.every(image => image.split("\n").length === 16 &&
        image.split("\n").every(row => row.length === 16)))
    assert.ok(map.tiles.every((tile, i) => (map.images[tile][8 * 17 + 8] === "1") === Boolean(map.terrain[i])))
    const gates = makeGates(map)
    const gateHex = source.match(/trackWaypoints = hex`([0-9a-f]+)`/)[1]
    const gateData = Buffer.from(gateHex, "hex")
    assert.equal(gateData.length, gates.length * 16)
    for (let i = 0; i < gates.length; i++) {
        assert.equal(gateData.readInt32LE(i * 16), gates[i].start.x)
        assert.equal(gateData.readInt32LE(i * 16 + 4), gates[i].start.y)
        assert.equal(gateData.readInt32LE(i * 16 + 8), gates[i].end.x)
        assert.equal(gateData.readInt32LE(i * 16 + 12), gates[i].end.y)
    }
    assert.match(source, /Each gate is start X\/Y, end X\/Y as Int32LE pixels/)
    assert.match(source, /\/\/% whenUsed\s+const trackWaypoints = hex`/)
})

test("compact outline is four pixels outside the road without changing road pixels", () => {
    const svg = `<svg><path d="M0 0 L100 0 L100 70 L0 70 Z"/>
        <path stroke="red" d="M0 0 L100 0"/>
        <path stroke="yellow" d="M0 70 L0 0"/></svg>`
    const map = makeTilemap(svg, { size: 100, width: 4, simplify: 2, tileset: "compact" })
    const source = formatTilemap(map)
    const bytes = Buffer.from(source.match(/hex`([0-9a-f]+)`/)[1], "hex")
    const images = Array.from(source.matchAll(/img`([^`]+)`/g), match =>
        match[1].trim().split(/\s+/).join("")).slice(1)
    assert.ok(images.length > map.images.length)
    const pixelAt = (x, y) => {
        const tile = Math.floor(y / 16) * map.width + Math.floor(x / 16)
        return images[bytes[4 + tile]][(y % 16) * 16 + x % 16]
    }
    const roadAt = (x, y) => {
        const tile = Math.floor(y / 16) * map.width + Math.floor(x / 16)
        return map.images[map.tiles[tile]][(y % 16) * 17 + x % 16] === "1"
    }
    for (let y = 0; y < map.height * 16; y++) {
        for (let x = 0; x < map.width * 16; x++) {
            assert.equal(pixelAt(x, y) === "b", roadAt(x, y),
                `outline changed road at pixel ${x},${y}`)
        }
    }
    const x = Math.floor((map.points[0].x + map.points[1].x) * 8)
    let edge
    for (let y = 5; y < map.height * 16 - 5; y++) {
        if (roadAt(x, y) && !roadAt(x, y - 1)) {
            edge = y
            break
        }
    }
    assert.ok(edge !== undefined)
    for (let delta = 1; delta <= 4; delta++) {
        assert.equal(pixelAt(x, edge - delta), "c", `missing outline at depth ${delta}`)
    }
    assert.equal(pixelAt(x, edge - 5), "0")
})

test("generates recognizable closed roads from the included tracks", () => {
    for (const name of ["monaco", "usa"]) {
        const svg = fs.readFileSync(path.join(__dirname, `${name}.svg`), "utf8")
        const map = makeTilemap(svg, { size: 200, width: 4, simplify: 2 })
        assert.ok(map.points.length >= 20 && map.points.length <= 45)
        assert.ok(map.terrain.reduce((sum, tile) => sum + tile, 0) > 1500)
        assert.ok(map.terrain.reduce((sum, tile) => sum + tile, 0) < map.tiles.length / 4)
        assert.ok(map.images.length <= 256)
        assert.ok(map.tiles.every((tile, i) => (map.images[tile][8 * 17 + 8] === "1") === Boolean(map.terrain[i])))
        for (let i = 0; i < map.points.length; i++) {
            const a = map.points[i]
            const b = map.points[(i + 1) % map.points.length]
            const direction = Math.atan2(b.y - a.y, b.x - a.x) / (Math.PI / 16)
            assert.ok(Math.abs(direction - Math.round(direction)) < 1e-8,
                `${name} segment ${i} has a non-PI/16 direction`)
        }
        const cleared = separateTrack(map.points.map(point => ({ ...point })), 4)
        assert.ok(cleared.every((point, i) =>
            Math.hypot(point.x - map.points[i].x, point.y - map.points[i].y) < 0.04))

        const original = makeTilemap(svg, { size: 200, width: 4, simplify: 2, angles: 0 })
        assert.ok(map.images.length <= original.images.length)
        const waypoints = makeWaypoints(map)
        assert.ok(waypoints.length <= map.points.length + 1)
        assert.ok(waypoints.length >= 10)
        assert.ok(Math.hypot(waypoints[0].x / 16 - map.finish.x,
            waypoints[0].y / 16 - map.finish.y) < map.roadWidth / 2)
        const redData = /class="st1"\s+d="([^"]+)"/s.exec(svg)[1]
        const redPoints = parsePath(redData)[0].points
        const redHeading = {
            x: redPoints[1].x - redPoints[0].x,
            y: redPoints[1].y - redPoints[0].y,
        }
        assert.ok((waypoints[1].x - waypoints[0].x) * redHeading.x +
            (waypoints[1].y - waypoints[0].y) * redHeading.y > 0,
        `${name} waypoints must start in the red direction`)
        assert.notDeepEqual(waypoints[0], waypoints.at(-1))
        for (const point of waypoints) {
            assert.ok(point.x < map.width * 16 && point.y < map.height * 16)
        }
        for (let i = 0; i < waypoints.length; i++) {
            const a = waypoints[i]
            const b = waypoints[(i + 1) % waypoints.length]
            const steps = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 8)
            for (let j = 0; j <= steps; j++) {
                const x = Math.round(a.x + (b.x - a.x) * j / steps)
                const y = Math.round(a.y + (b.y - a.y) * j / steps)
                const tile = map.tiles[Math.floor(y / 16) * map.width + Math.floor(x / 16)]
                assert.equal(map.images[tile][(y % 16) * 17 + x % 16], "1",
                    `${name} AI segment ${i} leaves the road`)
            }
        }
        let bestOverlap = 0
        for (let dy = -2; dy <= 2; dy++) {
            for (let dx = -2; dx <= 2; dx++) {
                let shared = 0
                let covered = 0
                for (let y = 0; y < original.height; y++) {
                    for (let x = 0; x < original.width; x++) {
                        const bx = x + dx
                        const by = y + dy
                        const before = original.terrain[y * original.width + x]
                        const after = bx >= 0 && bx < map.width && by >= 0 && by < map.height
                            ? map.terrain[by * map.width + bx] : 0
                        shared += before && after ? 1 : 0
                        covered += before || after ? 1 : 0
                    }
                }
                bestOverlap = Math.max(bestOverlap, shared / covered)
            }
        }
        assert.ok(bestOverlap > 0.62, `${name} should remain recognizable after angle snapping`)

        const pi8 = makeTilemap(svg, { size: 200, width: 4, simplify: 2, angles: 16 })
        for (let i = 0; i < pi8.points.length; i++) {
            const a = pi8.points[i]
            const b = pi8.points[(i + 1) % pi8.points.length]
            const direction = Math.atan2(b.y - a.y, b.x - a.x) / (Math.PI / 8)
            assert.ok(Math.abs(direction - Math.round(direction)) < 1e-8)
        }

        const { edgeCount, maxDifference, totalDifference, borderDifference } = edgeError(map)
        assert.ok(edgeCount > 1000)
        assert.ok(maxDifference <= 16, `${name} edge tile must stay within 16 pixels of exact rasterization`)
        assert.ok(totalDifference / edgeCount < 0.5, `${name} average edge error must stay below half a pixel`)
        assert.ok(borderDifference <= 100,
            `${name} palette should preserve the road shape at tile borders`)
    }
})

test("Monaco's upper hairpin keeps grass between both legs", () => {
    const svg = fs.readFileSync(path.join(__dirname, "monaco.svg"), "utf8")
    const map = makeTilemap(svg, { size: 200, width: 4, simplify: 2 })
    for (const y of [11, 14, 17, 20]) {
        const runs = []
        let start
        for (let x = 132; x < 153; x++) {
            const value = map.terrain[y * map.width + x]
            if (value && start === undefined) start = x
            if (!value && start !== undefined) {
                runs.push([start, x - 1])
                start = undefined
            }
        }
        if (start !== undefined) runs.push([start, 152])
        assert.equal(runs.length, 2, `two separate road legs at row ${y}`)
        for (let x = runs[0][1] + 1; x < runs[1][0]; x++) {
            const gap = map.images[map.tiles[y * map.width + x]]
            assert.equal(gap[8 * 17 + 8], "7", `grass at row ${y}, column ${x}`)
        }
        assert.ok(runs[1][0] - runs[0][1] > 1, `visible grass gap at row ${y}`)
    }
})

test("draws a long diagonal as a straight pixel-scale edge across tile seams", () => {
    const svg = `<svg><path d="M0 0 L120 30 L120 55 L0 25 Z"/>
        <path stroke="red" d="M0 0 L120 30"/>
        <path stroke="yellow" d="M0 25 L0 0"/></svg>`
    const map = makeTilemap(svg, { size: 120, width: 4, simplify: 2 })
    const a = map.points[0]
    const b = map.points[1]
    const slope = (b.y - a.y) / (b.x - a.x)
    const edge = []
    for (let x = Math.ceil((a.x + 15) * 16); x < (b.x - 15) * 16; x++) {
        const ideal = (a.y + slope * ((x + 0.5) / 16 - a.x) - 2 * Math.sqrt(1 + slope ** 2)) * 16
        let firstRoad
        for (let y = Math.floor(ideal) - 4; y < Math.ceil(ideal) + 5; y++) {
            const image = map.images[map.tiles[Math.floor(y / 16) * map.width + Math.floor(x / 16)]]
            if (image[(y % 16) * 17 + x % 16] === "1") {
                firstRoad = y
                break
            }
        }
        assert.ok(firstRoad !== undefined)
        assert.ok(Math.abs(firstRoad - ideal) < 3, `edge offset at pixel ${x}`)
        edge.push(firstRoad)
    }
    for (let i = 1; i < edge.length; i++) {
        assert.ok(Math.abs(edge[i] - edge[i - 1]) <= 1, `stair step at pixel ${i}`)
    }
    const runs = []
    let start = 0
    for (let i = 1; i < edge.length; i++) {
        if (edge[i] !== edge[i - 1]) {
            runs.push(i - start)
            start = i
        }
    }
    assert.ok(runs.length > 200)
    assert.ok(runs.slice(1, -1).every(length => length === 5),
        "diagonal must advance one vertical pixel every five horizontal pixels")
})

test("compact shallow edges keep a straight 1:2 pixel slope in all four orientations", () => {
    const base = [[0, 0], [100, 50], [200, 100], [200, 130], [0, 30]]
    for (let turn = 0; turn < 4; turn++) {
        const rotate = ([x, y]) => [[x, y], [-y, x], [-x, -y], [y, -x]][turn]
        const vertices = base.map(rotate)
        const point = ([x, y]) => `${x} ${y}`
        const svg = `<svg><path d="M${point(vertices[0])} ${vertices.slice(1)
            .map(vertex => `L${point(vertex)}`).join(" ")} Z"/>
            <path stroke="red" d="M${point(vertices[1])} L${point(vertices[2])}"/>
            <path stroke="yellow" d="M${point(vertices[0])} L${point(vertices[1])}"/></svg>`
        const map = makeTilemap(svg, { size: 120, width: 4, simplify: 2, tileset: "compact" })
        assert.equal(map.images.length, 26)
        assertCompactBorders(map)
        const [a, b] = map.points
        const horizontal = turn % 2 === 0
        const along = p => horizontal ? p.x : p.y
        const across = p => horizontal ? p.y : p.x
        const slope = (across(b) - across(a)) / (along(b) - along(a))
        assert.ok(Math.abs(Math.abs(slope) - 0.5) < 1e-8)
        const edge = []
        const first = Math.ceil((Math.min(along(a), along(b)) + 15) * 16)
        const last = Math.floor((Math.max(along(a), along(b)) - 15) * 16)
        for (let coordinate = first; coordinate < last; coordinate++) {
            const ideal = (across(a) + (coordinate / 16 - along(a)) * slope -
                map.roadWidth / 2 * Math.sqrt(1 + slope ** 2)) * 16
            let road
            for (let pixel = Math.floor(ideal) - 24; pixel <= Math.ceil(ideal) + 24; pixel++) {
                const x = horizontal ? coordinate : pixel
                const y = horizontal ? pixel : coordinate
                const image = map.images[map.tiles[Math.floor(y / 16) * map.width + Math.floor(x / 16)]]
                if (image[(y % 16) * 17 + x % 16] === "1") {
                    road = pixel
                    break
                }
            }
            assert.ok(road !== undefined && Math.abs(road - ideal) < 6)
            edge.push(road)
        }
        let runStart = 0
        let regular = 0
        let runs = 0
        for (let i = 1; i < edge.length; i++) {
            assert.ok(Math.abs(edge[i] - edge[i - 1]) <= 1, `discontinuity in orientation ${turn}`)
            if (edge[i] === edge[i - 1]) continue
            const length = i - runStart
            assert.ok(length <= 3, `tile-sized stair step in orientation ${turn}`)
            regular += length === 2
            runs++
            runStart = i
        }
        assert.ok(regular / runs > 0.85)
        for (let i = 16; i < edge.length; i += 16) {
            assert.ok(Math.abs(Math.abs(edge[i] - edge[i - 16]) - 8) <= 1,
                `tile-scale edge drift in orientation ${turn}`)
        }
    }
})

test("compact diagonal edges advance one pixel per column in all four orientations", () => {
    const base = [[0, 0], [80, 80], [160, 160], [160, 180], [0, 20]]
    for (let turn = 0; turn < 4; turn++) {
        const rotate = ([x, y]) => [[x, y], [-y, x], [-x, -y], [y, -x]][turn]
        const vertices = base.map(rotate)
        const point = ([x, y]) => `${x} ${y}`
        const svg = `<svg><path d="M${point(vertices[0])} ${vertices.slice(1)
            .map(vertex => `L${point(vertex)}`).join(" ")} Z"/>
            <path stroke="red" d="M${point(vertices[1])} L${point(vertices[2])}"/>
            <path stroke="yellow" d="M${point(vertices[0])} L${point(vertices[1])}"/></svg>`
        const map = makeTilemap(svg, { size: 120, width: 4, simplify: 2, tileset: "compact" })
        assertCompactBorders(map)
        const [a, b] = map.points
        const slope = (b.y - a.y) / (b.x - a.x)
        assert.ok(Math.abs(Math.abs(slope) - 1) < 1e-8)
        let previous
        for (let x = Math.ceil((Math.min(a.x, b.x) + 12) * 16);
            x < Math.floor((Math.max(a.x, b.x) - 12) * 16); x++) {
            const ideal = (a.y + (x / 16 - a.x) * slope - map.roadWidth / 2 * Math.sqrt(2)) * 16
            let road
            for (let y = Math.floor(ideal) - 40; y <= Math.ceil(ideal) + 40; y++) {
                const image = map.images[map.tiles[Math.floor(y / 16) * map.width + Math.floor(x / 16)]]
                if (image[(y % 16) * 17 + x % 16] === "1") {
                    road = y
                    break
                }
            }
            assert.ok(road !== undefined && Math.abs(road - ideal) < 10)
            if (previous !== undefined) assert.equal(road - previous, Math.sign(slope))
            previous = road
        }
    }
})

test("compact mode uses exactly the reusable corner, shallow, and half-width tiles", () => {
    const svg = fs.readFileSync(path.join(__dirname, "usa.svg"), "utf8")
    const map = makeTilemap(svg, { size: 200, width: 4, simplify: 2, tileset: "compact" })
    const detailed = makeTilemap(svg, { size: 200, width: 4, simplify: 2, angles: 16 })
    assert.equal(map.images.length, 26)
    assert.equal(new Set(map.images).size, 26)
    assert.equal(map.images[0].includes("1"), false)
    assert.equal(map.images[1].includes("7"), false)
    assert.ok(Math.abs(map.width - detailed.width) <= 4)
    assert.ok(Math.abs(map.height - detailed.height) <= 4)
    const isRoad = (image, x, y) => image[y * 17 + x] === "1"
    for (const image of map.images.slice(2, 6)) {
        assert.equal([0, 15].flatMap(y => [0, 15].map(x => isRoad(image, x, y)))
            .filter(Boolean).length, 3, "diagonal edge crosses opposite corners")
    }
    for (const [i, left, right] of [[6, 15, 8], [10, 8, 0], [14, 8, 15], [18, 0, 8]]) {
        const image = map.images[i]
        const firstRoad = x => {
            for (let y = 0; y < 16; y++) if (isRoad(image, x, y)) return y
            return 16
        }
        assert.equal(firstRoad(0), left)
        assert.equal(firstRoad(15), right)
    }
    for (const image of map.images.slice(22)) {
        assert.equal(image.replaceAll(/[^1]/g, "").length, 128, "half tile covers eight rows or columns")
    }
    let expectedRoad = 0
    let different = 0
    for (const [index, mask] of rasterizePixels(map.points, map.width, map.height, map.roadWidth, true, true)) {
        const image = map.images[map.tiles[index]]
        for (let y = 0; y < 16; y++) {
            for (let x = 0; x < 16; x++) {
                const expected = Boolean(mask[y >> 1] & (1 << ((y & 1) * 16 + x)))
                expectedRoad += expected
                different += expected !== isRoad(image, x, y)
            }
        }
    }
    assert.ok(different / expectedRoad < 0.05, "compact road stays within 5% pixel error")
    assertCompactBorders(map)
    const waypoints = makeWaypoints(map)
    for (let i = 0; i < waypoints.length; i++) {
        const a = waypoints[i]
        const b = waypoints[(i + 1) % waypoints.length]
        const steps = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 8)
        for (let j = 0; j <= steps; j++) {
            const x = Math.round(a.x + (b.x - a.x) * j / steps)
            const y = Math.round(a.y + (b.y - a.y) * j / steps)
            const image = map.images[map.tiles[Math.floor(y / 16) * map.width + Math.floor(x / 16)]]
            assert.ok(isRoad(image, x % 16, y % 16), `compact AI segment ${i} leaves the road`)
        }
    }
    assert.throws(() => makeTilemap(svg, { size: 200, width: 4, simplify: 2,
        tileset: "compact", angles: 32 }), /requires --angles 16/)
})

test("compact Monaco retains a grass gap in its upper hairpin", () => {
    const svg = fs.readFileSync(path.join(__dirname, "monaco.svg"), "utf8")
    const map = makeTilemap(svg, { size: 200, width: 4, simplify: 2, tileset: "compact" })
    assert.ok(map.points.length <= 27 && map.points.length >= 20,
        "short curve segments should remain combined after direction snapping")
    assert.ok(map.points.every((point, i) => Math.hypot(
        point.x - map.points[(i + 1) % map.points.length].x,
        point.y - map.points[(i + 1) % map.points.length].y
    ) > 3), "no short zigzags remain at the simplified turns")
    const angles = [0, Math.atan(1 / 2), Math.PI / 4, Math.atan(2)]
    for (let i = 0; i < map.points.length; i++) {
        const a = map.points[i]
        const b = map.points[(i + 1) % map.points.length]
        const heading = Math.atan2(b.y - a.y, b.x - a.x)
        assert.ok(Array.from({ length: 16 }, (_, direction) => {
            const allowed = Math.floor(direction / 4) * Math.PI / 2 + angles[direction % 4]
            return Math.abs(Math.atan2(Math.sin(heading - allowed), Math.cos(heading - allowed)))
        }).some(error => error < 1e-8), `segment ${i} must follow one of 16 pixel-art directions`)
    }
    const cleared = separateTrack(map.points.map(point => ({ ...point })), 4)
    assert.ok(cleared.every((point, i) =>
        Math.hypot(point.x - map.points[i].x, point.y - map.points[i].y) < 0.05))
    assertCompactBorders(map)
    for (const y of [14, 17]) {
        const runs = []
        for (let x = 133; x < 151; x++) {
            if (map.terrain[y * map.width + x]) {
                if (!runs.length || runs.at(-1)[1] < x - 1) runs.push([x, x])
                else runs.at(-1)[1] = x
            }
        }
        assert.equal(runs.length, 2)
        assert.ok(runs[1][0] - runs[0][1] >= 3, `visible grass gap at row ${y}`)
    }
})

test("compact Monaco corners preserve full-road cells alongside half-width slopes", () => {
    const svg = fs.readFileSync(path.join(__dirname, "monaco.svg"), "utf8")
    const map = makeTilemap(svg, { size: 200, width: 4, simplify: 2,
        angles: 16, tileset: "compact" })
    const tile = (x, y) => map.tiles[y * map.width + x]
    for (const [x, y, straightX, straightY] of [
        [16, 107, 15, 109],
        [6, 110, 8, 109],
        [116, 24, 117, 23],
        [115, 25, 117, 23],
    ]) {
        assert.notEqual(tile(x, y), 0, `corner ${x},${y} must not become grass`)
        assert.equal(tile(x, y), tile(straightX, straightY),
            `the straight edge must continue through corner ${x},${y}`)
    }
    for (const [x, y] of [[154, 5], [155, 5], [5, 110], [5, 111]]) {
        assert.equal(tile(x, y), 1, `${x},${y} is full road alongside the corner slope`)
    }
    assert.equal(tile(154, 6), 0, "the grass outside the upper corner remains clear")
    assert.equal(map.images[tile(6, 110)].split("\n").filter(row => row[0] === "1").length, 8,
        "the half-width slope meets the full road at 5,110")
    assertCompactBorders(map)
})

test("compact tiles keep a narrow road under the AI route", () => {
    for (const name of ["monaco", "usa"]) {
        const svg = fs.readFileSync(path.join(__dirname, `${name}.svg`), "utf8")
        const map = makeTilemap(svg, { size: 200, width: 1, simplify: 2, tileset: "compact" })
        assert.equal(map.images.length, 26)
        assert.ok(makeWaypoints(map).length >= 10)
        assertCompactBorders(map)
    }
})

test("compact waypoints contain every generated polyline vertex in finish-line order", () => {
    const points = [
        { x: 10, y: 10 }, { x: 20, y: 10 }, { x: 30, y: 10 },
        { x: 30, y: 30 }, { x: 10, y: 30 },
    ]
    const map = {
        points, finish: { x: 15, y: 10, forward: true },
        roadWidth: 4, tileset: "compact",
    }
    const pixels = point => ({ x: point.x * 16, y: point.y * 16 })
    assert.deepEqual(makeWaypoints(map), [points[1], points[2], points[3], points[4], points[0]].map(pixels))
    map.finish.forward = false
    assert.deepEqual(makeWaypoints(map), [points[0], points[4], points[3], points[2], points[1]].map(pixels))
    map.finish.x = 10
    assert.deepEqual(makeWaypoints(map)[0], pixels(points[0]), "a finish exactly at a vertex keeps it first")
    map.tileset = "detailed"
    map.finish.x = 15
    assert.deepEqual(makeWaypoints(map)[0], { x: 240, y: 160 },
        "detailed mode still inserts the finish point")

    for (const name of ["monaco", "usa"]) {
        const svg = fs.readFileSync(path.join(__dirname, `${name}.svg`), "utf8")
        const generated = makeTilemap(svg, { size: 200, width: 4, simplify: 2, tileset: "compact" })
        const waypoints = makeWaypoints(generated)
        const vertices = generated.finish.forward ? generated.points : generated.points.slice().reverse()
        const first = vertices.findIndex(point =>
            Math.round(point.x * 16) === waypoints[0].x && Math.round(point.y * 16) === waypoints[0].y)
        assert.notEqual(first, -1, "the first waypoint must be a generated vertex")
        assert.equal(waypoints.length, generated.points.length)
        assert.deepEqual(waypoints, vertices.map((_, i) => {
            const point = vertices[(first + i) % vertices.length]
            return { x: Math.round(point.x * 16), y: Math.round(point.y * 16) }
        }))
    }
})

test("wide gates bracket turns and reach off-road without clipping to the map", () => {
    for (const name of ["monaco", "usa"]) {
        for (const width of [1, 4]) {
            const svg = fs.readFileSync(path.join(__dirname, `${name}.svg`), "utf8")
            const map = makeTilemap(svg, { size: 200, width, simplify: 2, tileset: "compact" })
            const vertices = makeWaypoints(map)
            const gates = makeGates(map)
            let crossedOtherRoad = false
            assert.equal(gates.length, map.points.length * 2 + 1)
            assert.ok(gates.every(gate => Math.hypot(
                gate.end.x - gate.start.x, gate.end.y - gate.start.y
            ) >= width * 16 * 5.9),
            `${name} should widen every gate to about six times the road width`)
            assert.ok(gates.some(gate => [gate.start, gate.end].some(point =>
                point.x < 0 || point.y < 0)),
            `${name} must allow gates past the top or left map edge`)
            assert.ok(gates.some(gate => [gate.start, gate.end].some(point =>
                point.x >= map.width * 16 || point.y >= map.height * 16)),
            `${name} must allow gates past the right or bottom map edge`)
            const roadAt = (x, y) => {
                const px = Math.floor(x)
                const py = Math.floor(y)
                if (px < 0 || py < 0 || px >= map.width * 16 || py >= map.height * 16) return false
                const tile = map.tiles[Math.floor(py / 16) * map.width + Math.floor(px / 16)]
                return map.images[tile][(py % 16) * 17 + px % 16] === "1"
            }
            const last = vertices[vertices.length - 1]
            const first = vertices[0]
            const dx = first.x - last.x
            const dy = first.y - last.y
            const length = Math.hypot(dx, dy)
            const t = Math.max(0, Math.min(1,
                ((map.finish.x * 16 - last.x) * dx + (map.finish.y * 16 - last.y) * dy) /
                (length * length)))
            const finishCenter = {
                x: (gates[0].start.x + gates[0].end.x) / 2,
                y: (gates[0].start.y + gates[0].end.y) / 2,
            }
            assert.ok(Math.hypot(
                finishCenter.x - (last.x + t * dx), finishCenter.y - (last.y + t * dy)
            ) < 2, `${name} finish gate must cross the projected start/finish line`)
            assert.ok(roadAt(finishCenter.x, finishCenter.y),
                `${name} finish gate center must be on the road`)
            for (let i = 0; i < vertices.length; i++) {
                const prev = vertices[(i + vertices.length - 1) % vertices.length]
                const turn = vertices[i]
                const next = vertices[(i + 1) % vertices.length]
                for (const [gate, a, b] of [
                    ...(i === 0 ? [[gates[0], last, first]] : []),
                    [gates[i * 2 + 1], prev, turn],
                    [gates[i * 2 + 2], turn, next],
                ]) {
                    const center = { x: (gate.start.x + gate.end.x) / 2,
                        y: (gate.start.y + gate.end.y) / 2 }
                    const dx = b.x - a.x
                    const dy = b.y - a.y
                    const length = Math.hypot(dx, dy)
                    assert.ok(Math.abs((center.x - a.x) * dy - (center.y - a.y) * dx) / length < 2.5,
                        `${name} gate ${i} must cross its approach or exit segment`)
                    assert.ok(roadAt(center.x, center.y), `${name} gate ${i} center lies on the road`)
                    const normal = { x: (gate.end.x - gate.start.x) /
                        Math.hypot(gate.end.x - gate.start.x, gate.end.y - gate.start.y),
                    y: (gate.end.y - gate.start.y) /
                        Math.hypot(gate.end.x - gate.start.x, gate.end.y - gate.start.y) }
                    for (const side of [-1, 1]) {
                        const endpoint = side < 0 ? gate.start : gate.end
                        const radius = Math.hypot(endpoint.x - center.x, endpoint.y - center.y)
                        let grass = 0
                        for (let distance = 0; distance <= width * 8; distance++) {
                            if (!roadAt(center.x + normal.x * distance * side,
                                center.y + normal.y * distance * side)) {
                                if (++grass === 2) break
                                continue
                            }
                            grass = 0
                            assert.ok(distance <= radius + 1,
                                `${name} gate ${i} misses painted road ${distance}px from its center`)
                        }
                        assert.ok(radius >= width * 8 * 5.9,
                            `${name} gate ${i} must extend well beyond the road`)
                        let offRoad = 0
                        for (let distance = 0; distance < radius; distance++) {
                            if (roadAt(center.x + normal.x * distance * side,
                                center.y + normal.y * distance * side)) {
                                if (offRoad >= 2) crossedOtherRoad = true
                            } else {
                                offRoad++
                            }
                        }
                    }
                }
                assert.ok(Math.hypot(
                    (gates[2 * i + 1].start.x + gates[2 * i + 1].end.x) / 2 - turn.x,
                    (gates[2 * i + 1].start.y + gates[2 * i + 1].end.y) / 2 - turn.y
                ) <= width * 8 + 13)
            }
            if (width === 4) {
                assert.ok(crossedOtherRoad, `${name} gates may cross neighboring road segments`)
            }
        }
    }
})

test("the first gate crosses the finish marker in both tileset modes", () => {
    for (const name of ["australia", "greatbritain", "italy", "monaco", "netherlands", "usa"]) {
        for (const tileset of ["compact", "detailed"]) {
            const svg = fs.readFileSync(path.join(__dirname, `${name}.svg`), "utf8")
            const map = makeTilemap(svg, { size: 200, width: 4, simplify: 2, tileset })
            const { start, end } = makeGates(map)[0]
            const finishX = map.finish.x * 16
            const finishY = map.finish.y * 16
            const dx = end.x - start.x
            const dy = end.y - start.y
            const length = Math.hypot(dx, dy)
            const t = ((finishX - start.x) * dx + (finishY - start.y) * dy) /
                (length * length)
            assert.ok(t >= 0 && t <= 1, `${name} ${tileset}: gate spans finish marker`)
            assert.ok(Math.abs((finishX - start.x) * dy - (finishY - start.y) * dx) /
                length < 1, `${name} ${tileset}: gate crosses finish marker`)
        }
    }
})

test("rejects AI waypoints outside the UInt16 pixel range", () => {
    assert.throws(() => makeWaypoints({
        points: [
            { x: 4100, y: 1 }, { x: 4200, y: 1 },
            { x: 4200, y: 3 }, { x: 4100, y: 3 },
        ],
        finish: { x: 4100, y: 1, forward: true },
        roadWidth: 4,
    }), /exceed UInt16/)
})

test("CLI generates a map and road gates with twelve directions", () => {
    const script = path.join(__dirname, "create-tilemap.js")
    const usa = path.join(__dirname, "usa.svg")
    const result = spawnSync(process.execPath, [script, "--angles", "12", usa], { encoding: "utf8" })
    assert.equal(result.status, 0, result.stderr)
    assert.match(result.stdout, /^tiles\.setCurrentTilemap\(/)
    assert.match(result.stdout, /const trackWaypoints = hex`[0-9a-f]+`/)
    const map = makeTilemap(fs.readFileSync(usa, "utf8"), { size: 200, width: 4, simplify: 2, angles: 12 })
    assert.ok(map.images.length <= 200)
    assert.equal(edgeError(map).borderDifference, 0)
    assert.equal(edgeError(map).maxDifference, 0)
    const invalid = spawnSync(process.execPath, [script, "--angles", "15", usa], { encoding: "utf8" })
    assert.equal(invalid.status, 1)
    assert.match(invalid.stderr, /--angles must be/)
    assert.doesNotMatch(invalid.stderr, /Usage:/)
})

test("CLI selects compact output without changing the detailed default", () => {
    const script = path.join(__dirname, "create-tilemap.js")
    const usa = path.join(__dirname, "usa.svg")
    const compact = spawnSync(process.execPath, [script, usa, "--tileset", "compact"], { encoding: "utf8" })
    assert.equal(compact.status, 0, compact.stderr)
    assert.ok((compact.stdout.match(/img`/g) || []).length > 27)
    assert.match(compact.stdout, /trackWaypoints = hex`[0-9a-f]+`/)
    const detailed = spawnSync(process.execPath,
        [script, usa, "--outline-color", "ignored"], { encoding: "utf8" })
    assert.equal(detailed.status, 0, detailed.stderr)
    assert.doesNotMatch(detailed.stdout, /c{16}/)
    const invalid = spawnSync(process.execPath,
        [script, usa, "--tileset", "compact", "--angles", "32"], { encoding: "utf8" })
    assert.equal(invalid.status, 1)
    assert.match(invalid.stderr, /requires --angles 16/)
})

test("CLI accepts distinct grass, road, and outline palette colors", () => {
    const script = path.join(__dirname, "create-tilemap.js")
    const usa = path.join(__dirname, "usa.svg")
    const result = spawnSync(process.execPath,
        [script, "--tileset", "compact", "--grass-color", "5", "--road-color", "14",
            "--outline-color", "3", usa],
        { encoding: "utf8" })
    assert.equal(result.status, 0, result.stderr)
    const images = Array.from(result.stdout.matchAll(/img`([^`]+)`/g), match => match[1])
    assert.match(images[1], /5{16}/, "grass uses the requested color")
    assert.match(images[2], /e{16}/, "road uses the requested color")
    assert.ok(images.some(image => image.includes("3")), "outline uses the requested color")
    for (const [flag, value, message, tileset] of [
        ["--grass-color", "-1", /--grass-color must be an integer from 0 to 15/],
        ["--road-color", "16", /--road-color must be an integer from 0 to 15/],
        ["--road-color", "nope", /--road-color must be an integer from 0 to 15/],
        ["--outline-color", "2.5", /--outline-color must be an integer from 0 to 15/, "compact"],
        ["--road-color", "0", /--grass-color and --road-color must differ/],
        ["--outline-color", "11", /--grass-color, --road-color, and --outline-color must differ/, "compact"],
    ]) {
        const invalid = spawnSync(process.execPath,
            [script, ...(tileset ? ["--tileset", tileset] : []), flag, value, usa], { encoding: "utf8" })
        assert.equal(invalid.status, 1)
        assert.match(invalid.stderr, message)
    }
    assert.throws(() => makeTilemap("", { grassColor: 7, roadColor: 7 }),
        /--grass-color and --road-color must differ/)
})

test("CLI renders the angle-aligned Monaco loop in compact mode", () => {
    const script = path.join(__dirname, "create-tilemap.js")
    const monaco = path.join(__dirname, "monaco.svg")
    const result = spawnSync(process.execPath,
        [script, "--angles", "16", "--tileset", "compact", monaco], { encoding: "utf8" })
    assert.equal(result.status, 0, result.stderr)
    const bytes = Buffer.from(result.stdout.match(/hex`([0-9a-f]+)`/)[1], "hex")
    const map = makeTilemap(fs.readFileSync(monaco, "utf8"),
        { size: 200, width: 4, simplify: 2, angles: 16, tileset: "compact" })
    assert.equal(bytes.readUInt16LE(0), map.width)
    assert.equal(bytes.readUInt16LE(2), map.height)
    assert.equal(bytes.length, 4 + map.tiles.length)
    assert.notDeepEqual(bytes.subarray(4), Buffer.from(map.tiles))
})

test("batch resources share named tiles and preserve both maps and their gates", () => {
    const entries = ["monaco", "usa"].map(name => ({
        name: `${name}.svg`,
        map: makeTilemap(fs.readFileSync(path.join(__dirname, `${name}.svg`), "utf8"),
            { size: 200, width: 4, simplify: 2, tileset: "compact" }),
    }))
    const { ts, jres } = formatBatch(entries)
    const resources = JSON.parse(jres)
    const names = resources.monaco.tileset
    assert.ok(names.length > 27 && names.length <= 256)
    assert.deepEqual(resources.usa.tileset, names)
    assert.equal(new Set(names).size, names.length)
    assert.deepEqual(names.slice(0, 3),
        ["myTiles.transparency16", "myTiles.grass", "myTiles.road"])
    const transparency = Buffer.from(resources.transparency16.data, "base64")
    assert.deepEqual([...transparency.subarray(0, 8)], [0x87, 4, 16, 0, 16, 0, 0, 0])
    assert.ok(transparency.subarray(8).every(byte => byte === 0))
    assert.ok(Buffer.from(resources.grass.data, "base64").subarray(8).every(byte => byte === 0),
        "grass tiles must be fully transparent")
    assert.ok(Buffer.from(resources.road.data, "base64").subarray(8).every(byte => byte === 0xbb),
        "road tiles must use color 11")
    assert.ok(names.some(name => name.includes("Shallow")))
    assert.ok(names.some(name => name.startsWith("myTiles.grassOutline")))
    assert.match(ts, /helpers\._registerFactory\("tilemap"/)
    assert.match(ts, /helpers\._registerFactory\("tile"/)
    assert.match(ts, /namespace trackWaypoints/)
    for (const { name, map } of entries) {
        const id = path.parse(name).name
        const data = Buffer.from(resources[id].data, "base64").toString("utf8")
        const length = (4 + map.width * map.height) * 2
        assert.equal(data.slice(0, 2), "10")
        assert.equal(data.length, 2 + length + 2 * map.width * Math.ceil(map.height / 2))
        const bytes = Buffer.from(data.slice(2, 2 + length), "hex")
        assert.equal(bytes.readUInt16LE(0), map.width)
        assert.equal(bytes.readUInt16LE(2), map.height)
        for (let tile = 0; tile < map.tiles.length; tile++) {
            const original = map.images[map.tiles[tile]].replaceAll("\n", "")
            const imageName = names[bytes[4 + tile]].slice("myTiles.".length)
            const image = Buffer.from(resources[imageName].data, "base64")
            for (let pixel = 0; pixel < 256; pixel++) {
                const x = pixel % 16
                const y = pixel >> 4
                const color = image[8 + x * 8 + (y >> 1)] >> ((y & 1) * 4) & 15
                assert.equal(color === 11, original[pixel] === "1")
            }
        }
        assert.match(ts, new RegExp(`case "${id}":`))
        const route = ts.match(new RegExp(`//% whenUsed\\s+export const ${id} = hex\`([0-9a-f]+)\``))
        assert.ok(route)
        const gates = makeGates(map)
        assert.equal(gates.length, map.points.length * 2 + 1)
        assert.equal(route[1].length, gates.length * 32)
        const values = Buffer.from(route[1], "hex")
        for (let i = 0; i < gates.length; i++) {
            assert.equal(values.readInt32LE(i * 16), gates[i].start.x)
            assert.equal(values.readInt32LE(i * 16 + 4), gates[i].start.y)
            assert.equal(values.readInt32LE(i * 16 + 8), gates[i].end.x)
            assert.equal(values.readInt32LE(i * 16 + 12), gates[i].end.y)
        }
    }
    const image = Buffer.from(resources.roadDiagonalSouthEast.data, "base64")
    assert.deepEqual([...image.subarray(0, 8)], [0x87, 4, 16, 0, 16, 0, 0, 0])
    for (const name of names) {
        const pixels = Buffer.from(resources[name.slice("myTiles.".length)].data, "base64").subarray(8)
        assert.ok(pixels.every(byte => (byte & 15) !== 7 && (byte >> 4) !== 7),
            `${name} must not contain green pixels`)
    }
    for (const [x, y] of [[0, 0], [15, 0], [0, 15], [15, 15], [5, 9]]) {
        const color = image[8 + x * 8 + (y >> 1)] >> ((y & 1) * 4) & 15
        const original = entries[0].map.images[2][y * 17 + x]
        assert.equal(color, original === "7" ? 0 : 11)
    }
    const broken = { ...entries[0].map,
        finish: { ...entries[0].map.finish, x: entries[0].map.width + 100 } }
    assert.throws(() => formatBatch([{ name: "broken.svg", map: broken }]),
        /broken\.svg: Finish line moved off the road/)
    const crowded = { ...entries[0].map,
        images: [...entries[0].map.images, ...Array.from({ length: 230 }, (_, i) => `extra-${i}`)] }
    assert.throws(() => formatBatch([{ name: "crowded.svg", map: crowded }]),
        /crowded\.svg: Shared tileset needs 257 images/)
    assert.throws(() => formatBatch([{ name: "road.svg", map: entries[0].map }]),
        /road\.svg: Track name conflicts with tile name/)
    assert.throws(() => formatBatch([
        entries[0], { ...entries[1], map: { ...entries[1].map, roadColor: 1 } },
    ]), /usa\.svg: Batch tracks must use the same grass, road, and outline colors/)
    assert.throws(() => formatBatch([
        entries[0], { ...entries[1], map: { ...entries[1].map, outlineColor: 2 } },
    ]), /usa\.svg: Batch tracks must use the same grass, road, and outline colors/)
})

test("CLI batch writes shared generated assets without changing single-map CLI", () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "tilemap-batch-"))
    const tracks = path.join(directory, "tracks")
    const output = path.join(directory, "output")
    const script = path.join(tracks, "create-tilemap.js")
    try {
        fs.mkdirSync(tracks)
        fs.copyFileSync(path.join(__dirname, "create-tilemap.js"), script)
        for (const name of ["monaco", "usa"]) {
            fs.copyFileSync(path.join(__dirname, `${name}.svg`), path.join(tracks, `${name}.svg`))
        }
        const result = spawnSync(process.execPath,
            [script, "--batch", "--output", output], { encoding: "utf8" })
        assert.equal(result.status, 0, result.stderr)
        const assets = JSON.parse(fs.readFileSync(path.join(output, "tilemap.g.jres"), "utf8"))
        const source = fs.readFileSync(path.join(output, "tilemap.g.ts"), "utf8")
        assert.deepEqual(Object.keys(assets).slice(-3), ["monaco", "usa", "*"])
        assert.match(source, /\/\/% whenUsed\s+export const monaco = hex`[0-9a-f]+`/)
        assert.match(source, /\/\/% whenUsed\s+export const usa = hex`[0-9a-f]+`/)
        const customOutput = path.join(directory, "custom")
        const recolored = spawnSync(process.execPath,
            [script, "--batch", "--grass-color", "5", "--road-color", "14",
                "--outline-color", "3",
                "--output", customOutput], { encoding: "utf8" })
        assert.equal(recolored.status, 0, recolored.stderr)
        const custom = JSON.parse(fs.readFileSync(path.join(customOutput, "tilemap.g.jres"), "utf8"))
        assert.ok(Buffer.from(custom.grass.data, "base64").subarray(8).every(byte => byte === 0x55))
        assert.ok(Buffer.from(custom.road.data, "base64").subarray(8).every(byte => byte === 0xee))
        const outlinedName = Object.keys(custom).find(name => name.startsWith("grassOutline"))
        assert.ok(outlinedName)
        assert.ok(Buffer.from(custom[outlinedName].data, "base64").subarray(8).includes(0x33))
        assert.ok(Buffer.from(custom.transparency16.data, "base64").subarray(8).every(byte => byte === 0))
        assert.equal(custom.monaco.data, assets.monaco.data)
        assert.equal(custom.usa.data, assets.usa.data)
    } finally {
        fs.rmSync(directory, { recursive: true, force: true })
    }
    const invalid = spawnSync(process.execPath,
        [path.join(__dirname, "create-tilemap.js"), "--batch", path.join(__dirname, "usa.svg")],
        { encoding: "utf8" })
    assert.equal(invalid.status, 1)
    assert.match(invalid.stderr, /--batch does not accept an SVG file/)
})

test("CLI batch identifies the SVG that failed after earlier tracks succeeded", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "tilemap-error-"))
    const tracks = path.join(root, "tracks")
    try {
        fs.mkdirSync(tracks)
        fs.copyFileSync(path.join(__dirname, "create-tilemap.js"), path.join(tracks, "create-tilemap.js"))
        fs.copyFileSync(path.join(__dirname, "usa.svg"), path.join(tracks, "a-valid.svg"))
        fs.writeFileSync(path.join(tracks, "z-broken.svg"), '<svg><path d="M0 0 L20 0"/></svg>')
        const result = spawnSync(process.execPath,
            [path.join(tracks, "create-tilemap.js"), "--batch"], { encoding: "utf8" })
        assert.equal(result.status, 1)
        assert.match(result.stderr, /z-broken\.svg: .*closed/i)
        assert.doesNotMatch(result.stderr, /a-valid\.svg:/)
        assert.equal(fs.existsSync(path.join(root, "tilemap.g.ts")), false)
        assert.equal(fs.existsSync(path.join(root, "tilemap.g.jres")), false)
    } finally {
        fs.rmSync(root, { recursive: true, force: true })
    }
})
