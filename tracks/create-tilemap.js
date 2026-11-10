#!/usr/bin/env node
const fs = require("node:fs")
const path = require("node:path")

const usage = `Usage: node tracks/create-tilemap.js <track.json> [--size 200] [--width 4] [--tileset detailed|compact] [--grass-color 0] [--road-color 11] [--outline-color 2] [--output track.ts]
       node tracks/create-tilemap.js --batch [--size 200] [--width 4] [--tileset compact] [--grass-color 0] [--road-color 11] [--outline-color 2] [--output directory]

Writes a standalone MakeCode Arcade TypeScript tilemap (16-pixel tiles).
--batch reads track JSON files in tracks/ and writes tilemap.g.ts, tilemap.g.jres,
ai/geometry.g.ts, and track-editor-tracks.g.ts
to the project root (or --output directory), sharing tile artwork with a palette per map.
Editor JSON is {"version":1,"points":[[x,y],...]}, with integer coordinates from 0 to 20.
It must have at least three nodes, no crossings or overlapping segments, and only
horizontal, vertical, 1:1, 1:2, or 2:1 slopes. The loop closes automatically;
the first point is the finish and node order is the travel direction.
Editor geometry is scaled to --size without repositioning nodes.
Batch mode defaults to the compact tileset and includes per-track road gates.
--size is the longest track dimension in tiles; --width is road width in tiles;
--tileset compact uses horizontal, vertical, diagonal, 1:2 and 2:1 slopes,
and a fixed 26-image road palette:
grass, full road, four diagonal corners, sixteen shallow edges, and four half tiles.
Compact mode adds an approximately four-pixel outline without changing road pixels.
Significant turns have red/white striped edging, starting nine tiles
before the turn and continuing through its exit. Gradual bends keep the normal outline.
Warnings include turns of at least 45 degrees and nearby bends totaling 67.5 degrees.
Each outlined shape has solid and striped versions. Striped edges have a red
first quarter, white middle half, and red final quarter; corner fillers are red.
Angled outcroppings with no road bordering any flat edge are removed after tile selection.
Road tiles must have matching sides, except a full road tile can meet a
half-width slope when its edge follows the rasterized road. Removed outcroppings
leave flat caps; other half-width edges cannot end in grass.
Increase road width or map size if a layout cannot fit.
The default detailed tileset retains the exact pixel-art edges where possible.
Grass, road, and generated edge tiles draw straight road edges at 16 pixels per tile.
--grass-color and --road-color accept distinct palette indices from 0 to 15.
In compact mode, --outline-color must also differ from both colors. Grass defaults
to transparent (0), road to 11, and the compact outline to red (2). Detailed mode
ignores --outline-color and does not add an outline.
The output includes
trackWaypoints: pairs of gate endpoints (start X/Y, end X/Y as Int32LE pixels).
The first gate crosses the start/finish line, followed by one gate before and
one after each generated turn in the travel direction. Gates span about
six times the road width and may cross other roads or extend beyond any map edge.`

function paletteColors(config) {
    const grassColor = config.grassColor ?? 0
    const roadColor = config.roadColor ?? 11
    for (const [name, value] of [["grass", grassColor], ["road", roadColor]]) {
        if (!Number.isInteger(value) || value < 0 || value > 15) {
            throw new Error(`--${name}-color must be an integer from 0 to 15`)
        }
    }
    if (grassColor === roadColor) throw new Error("--grass-color and --road-color must differ")
    if (config.tileset !== "compact") return { grassColor, roadColor }
    const outlineColor = config.outlineColor ?? 2
    if (!Number.isInteger(outlineColor) || outlineColor < 0 || outlineColor > 15) {
        throw new Error("--outline-color must be an integer from 0 to 15")
    }
    if (new Set([grassColor, roadColor, outlineColor]).size !== 3) {
        throw new Error("--grass-color, --road-color, and --outline-color must differ")
    }
    return { grassColor, roadColor, outlineColor }
}

function options(argv) {
    const result = { size: 200, width: 4,
        tileset: "detailed", grassColor: 0, roadColor: 11, outlineColor: 2 }
    let input
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i]
        if (arg === "--help" || arg === "-h") return { help: true }
        if (arg === "--batch") {
            result.batch = true
            continue
        }
        if (["--size", "--width", "--tileset", "--output",
            "--grass-color", "--road-color", "--outline-color"].includes(arg)) {
            if (++i >= argv.length) throw new Error(`Missing value for ${arg}`)
            const key = arg.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())
            result[key] = argv[i]
        } else if (arg.startsWith("-") || input) {
            throw new Error(`Unexpected argument: ${arg}`)
        } else input = arg
    }
    if (result.batch && input) throw new Error("--batch does not accept a track file")
    if (!result.batch && !input) throw new Error("Missing track JSON file")
    if (result.batch && !argv.includes("--tileset")) result.tileset = "compact"
    if (!["detailed", "compact"].includes(result.tileset)) {
        throw new Error("--tileset must be detailed or compact")
    }
    for (const key of ["size", "width"]) {
        if (result[key] === "") throw new Error(`Invalid --${key}`)
        result[key] = Number(result[key])
        if (!Number.isFinite(result[key]) || result[key] < 0.1) {
            throw new Error(`Invalid --${key}`)
        }
    }
    if (!Number.isInteger(result.size) || result.size > 65000) {
        throw new Error("--size must be an integer below 65001")
    }
    for (const key of ["grassColor", "roadColor"]) {
        if (result[key] === "") throw new Error(`Invalid --${key.replace("Color", "")}-color`)
        result[key] = Number(result[key])
    }
    if (result.tileset === "compact") {
        if (result.outlineColor === "") throw new Error("Invalid --outline-color")
        result.outlineColor = Number(result.outlineColor)
    }
    paletteColors(result)
    result.input = input
    return result
}

function distanceSquared(p, a, b) {
    const dx = b.x - a.x
    const dy = b.y - a.y
    const length = dx * dx + dy * dy
    const t = length ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / length)) : 0
    return (p.x - a.x - t * dx) ** 2 + (p.y - a.y - t * dy) ** 2
}

function parseEditorTrack(data) {
    if (!data || data.version !== 1 || !Array.isArray(data.points)) {
        throw new Error('Editor track must be {"version":1,"points":[[x,y],...]}')
    }
    if (data.points.length < 3) throw new Error("Editor track needs at least three nodes")
    const points = data.points.map((point, i) => {
        if (!Array.isArray(point) || point.length !== 2 ||
            point.some(value => !Number.isInteger(value) || value < 0 || value > 20)) {
            throw new Error(`Editor node ${i + 1} must contain two integer coordinates from 0 to 20`)
        }
        return { x: point[0], y: point[1] }
    })
    for (let i = 0; i < points.length; i++) {
        const a = points[i]
        const b = points[(i + 1) % points.length]
        const dx = Math.abs(b.x - a.x)
        const dy = Math.abs(b.y - a.y)
        if (!dx && !dy) throw new Error(`Editor segment ${i + 1} has zero length`)
        if (!(dx === 0 || dy === 0 || dx === dy || dx === 2 * dy || dy === 2 * dx)) {
            throw new Error(`Editor segment ${i + 1} has an invalid slope`)
        }
        for (let j = i + 1; j < points.length; j++) {
            const c = points[j]
            const d = points[(j + 1) % points.length]
            if (closestSegments(a, b, c, d).squared > 1e-10) continue
            const adjacent = j === i + 1 || i === 0 && j === points.length - 1
            const turn = (b.x - a.x) * (d.y - c.y) - (b.y - a.y) * (d.x - c.x)
            const dot = (b.x - a.x) * (d.x - c.x) + (b.y - a.y) * (d.y - c.y)
            if (adjacent && (turn !== 0 || dot > 0)) continue
            throw new Error(`Editor segments ${i + 1} and ${j + 1} intersect or overlap`)
        }
    }
    return points
}

function simplifyOpen(points, toleranceSquared) {
    const keep = new Uint8Array(points.length)
    keep[0] = keep[points.length - 1] = 1
    const stack = [[0, points.length - 1]]
    while (stack.length) {
        const [a, b] = stack.pop()
        let furthest = toleranceSquared
        let index = -1
        for (let i = a + 1; i < b; i++) {
            const distance = distanceSquared(points[i], points[a], points[b])
            if (distance > furthest) {
                furthest = distance
                index = i
            }
        }
        if (index >= 0) {
            keep[index] = 1
            stack.push([a, index], [index, b])
        }
    }
    return points.filter((_, i) => keep[i])
}

function simplifyLoop(points, tolerance) {
    if (!tolerance) return points
    let opposite = 1
    for (let i = 2; i < points.length; i++) {
        if (distanceSquared(points[i], points[0], points[0]) >
            distanceSquared(points[opposite], points[0], points[0])) opposite = i
    }
    return simplifyOpen(points.slice(0, opposite + 1), tolerance ** 2)
        .concat(simplifyOpen(points.slice(opposite).concat(points[0]), tolerance ** 2).slice(1, -1))
}

function closestSegments(a, b, c, d) {
    const candidates = []
    const projection = (p, start, end) => {
        const dx = end.x - start.x
        const dy = end.y - start.y
        const length = dx * dx + dy * dy
        return length ? Math.max(0, Math.min(1,
            ((p.x - start.x) * dx + (p.y - start.y) * dy) / length)) : 0
    }
    for (const [p, t] of [[a, 0], [b, 1]]) candidates.push({ t, u: projection(p, c, d) })
    for (const [p, u] of [[c, 0], [d, 1]]) candidates.push({ t: projection(p, a, b), u })
    const cross = (x, y, z) => (y.x - x.x) * (z.y - x.y) - (y.y - x.y) * (z.x - x.x)
    const denominator = cross({ x: 0, y: 0 }, { x: b.x - a.x, y: b.y - a.y },
        { x: d.x - c.x, y: d.y - c.y })
    if (Math.abs(denominator) > 1e-10) {
        const t = cross(a, c, d) / denominator
        const u = cross(a, c, b) / denominator
        if (t >= 0 && t <= 1 && u >= 0 && u <= 1) candidates.push({ t, u })
    }
    let best
    for (const candidate of candidates) {
        const x = a.x + (b.x - a.x) * candidate.t - c.x - (d.x - c.x) * candidate.u
        const y = a.y + (b.y - a.y) * candidate.t - c.y - (d.y - c.y) * candidate.u
        const squared = x * x + y * y
        if (!best || squared < best.squared) best = { ...candidate, x, y, squared }
    }
    return best
}

function gridAlignedSegment(a, b, maxShift, compact = false) {
    const heading = Math.atan2(b.y - a.y, b.x - a.x)
    let best
    for (let dx = -12; dx <= 12; dx++) {
        for (let dy = -12; dy <= 12; dy++) {
            if (!dx && !dy) continue
            const angle = Math.atan2(dy, dx)
            const error = Math.abs(Math.atan2(Math.sin(heading - angle), Math.cos(heading - angle)))
            if (!best || error < best.error - 1e-10 ||
                (Math.abs(error - best.error) < 1e-10 && dx * dx + dy * dy < best.length)) {
                best = { dx, dy, error, length: dx * dx + dy * dy }
            }
        }
    }
    const nx = -best.dy
    const ny = best.dx
    const averageOffset = (nx * (a.x + b.x) + ny * (a.y + b.y)) / 2
    const shallow = compact && ((Math.abs(best.dx) === 2 && Math.abs(best.dy) === 1) ||
        (Math.abs(best.dx) === 1 && Math.abs(best.dy) === 2))
    // The half-integer normal phase makes shallow edges repeat across tile boundaries.
    const lowerPhase = Math.floor(averageOffset - 0.5) + 0.5
    const offset = shallow
        ? (Math.abs(averageOffset - lowerPhase) <= Math.abs(averageOffset - lowerPhase - 1)
            ? lowerPhase : lowerPhase + 1)
        : Math.round(averageOffset)
    const project = p => {
        const delta = (offset - nx * p.x - ny * p.y) / best.length
        return { x: p.x + nx * delta, y: p.y + ny * delta }
    }
    const start = project(a)
    const end = project(b)
    if (Math.hypot(start.x - a.x, start.y - a.y) > maxShift ||
        Math.hypot(end.x - b.x, end.y - b.y) > maxShift) return [a, b]
    return [start, end]
}

function rasterizePixels(points, width, height, roadWidth, gridAligned = true, compact = false) {
    if (compact) return rasterizeJoinedPixels(points, width, height, roadWidth)
    const masks = new Map()
    const radius = roadWidth / 2
    const radiusSquared = radius * radius
    for (let i = 0; i < points.length; i++) {
        const [a, b] = gridAligned
            ? gridAlignedSegment(points[i], points[(i + 1) % points.length],
                Math.min(0.75, roadWidth / 4), compact)
            : [points[i], points[(i + 1) % points.length]]
        const dx = b.x - a.x
        const dy = b.y - a.y
        const lengthSquared = dx * dx + dy * dy
        const left = Math.max(0, Math.floor(Math.min(a.x, b.x) - radius))
        const right = Math.min(width - 1, Math.ceil(Math.max(a.x, b.x) + radius))
        const top = Math.max(0, Math.floor(Math.min(a.y, b.y) - radius))
        const bottom = Math.min(height - 1, Math.ceil(Math.max(a.y, b.y) + radius))
        for (let y = top; y <= bottom; y++) {
            for (let x = left; x <= right; x++) {
                const index = y * width + x
                const mask = masks.get(index) || new Uint32Array(8)
                for (let py = 0; py < 16; py++) {
                    for (let px = 0; px < 16; px++) {
                        const word = py >> 1
                        const bit = 1 << ((py & 1) * 16 + px)
                        if (mask[word] & bit) continue
                        const vx = x + (px + 0.5) / 16 - a.x
                        const vy = y + (py + 0.5) / 16 - a.y
                        const t = lengthSquared ? Math.max(0, Math.min(1, (vx * dx + vy * dy) / lengthSquared)) : 0
                        if ((vx - t * dx) ** 2 + (vy - t * dy) ** 2 <= radiusSquared) {
                            mask[word] |= bit
                        }
                    }
                }
                masks.set(index, mask)
            }
        }
    }
    return masks
}

function rasterizeJoinedPixels(points, width, height, roadWidth) {
    const radius = roadWidth / 2
    const segments = points.map((point, i) => {
        const [a, b] = gridAlignedSegment(point, points[(i + 1) % points.length],
            Math.min(0.75, roadWidth / 4), true)
        const length = Math.hypot(b.x - a.x, b.y - a.y)
        return {
            a, b, dx: (b.x - a.x) / length, dy: (b.y - a.y) / length,
            nx: -(b.y - a.y) / length, ny: (b.x - a.x) / length,
        }
    })
    const cross = (a, b) => a.x * b.y - a.y * b.x
    const joins = points.map((point, i) => {
        const prev = segments[(i + segments.length - 1) % segments.length]
        const next = segments[i]
        const determinant = cross({ x: prev.dx, y: prev.dy }, { x: next.dx, y: next.dy })
        if (Math.abs(determinant) < 1e-8 ||
            prev.dx * next.dx + prev.dy * next.dy < 0) return null
        const join = side => {
            const a = { x: prev.b.x + prev.nx * radius * side, y: prev.b.y + prev.ny * radius * side }
            const b = { x: next.a.x + next.nx * radius * side, y: next.a.y + next.ny * radius * side }
            const t = cross({ x: b.x - a.x, y: b.y - a.y },
                { x: next.dx, y: next.dy }) / determinant
            return { x: a.x + prev.dx * t, y: a.y + prev.dy * t }
        }
        const left = join(1)
        const right = join(-1)
        if (Math.max(Math.hypot(left.x - point.x, left.y - point.y),
            Math.hypot(right.x - point.x, right.y - point.y)) > 2 * radius) return null
        return { left, right }
    })
    const masks = new Map()
    const paint = (vertices, inside) => {
        const left = Math.max(0, Math.floor(Math.min(...vertices.map(p => p.x))))
        const right = Math.min(width - 1, Math.ceil(Math.max(...vertices.map(p => p.x))))
        const top = Math.max(0, Math.floor(Math.min(...vertices.map(p => p.y))))
        const bottom = Math.min(height - 1, Math.ceil(Math.max(...vertices.map(p => p.y))))
        for (let y = top; y <= bottom; y++) {
            for (let x = left; x <= right; x++) {
                const index = y * width + x
                const mask = masks.get(index) || new Uint32Array(8)
                for (let py = 0; py < 16; py++) {
                    for (let px = 0; px < 16; px++) {
                        const word = py >> 1
                        const bit = 1 << ((py & 1) * 16 + px)
                        if (mask[word] & bit) continue
                        if (inside({ x: x + (px + 0.5) / 16, y: y + (py + 0.5) / 16 })) mask[word] |= bit
                    }
                }
                masks.set(index, mask)
            }
        }
    }
    const triangle = (p, a, b, c) => {
        const ab = cross({ x: b.x - a.x, y: b.y - a.y }, { x: p.x - a.x, y: p.y - a.y })
        const bc = cross({ x: c.x - b.x, y: c.y - b.y }, { x: p.x - b.x, y: p.y - b.y })
        const ca = cross({ x: a.x - c.x, y: a.y - c.y }, { x: p.x - c.x, y: p.y - c.y })
        return (ab >= -1e-9 && bc >= -1e-9 && ca >= -1e-9) ||
            (ab <= 1e-9 && bc <= 1e-9 && ca <= 1e-9)
    }
    for (let i = 0; i < segments.length; i++) {
        const { a, b, nx, ny } = segments[i]
        const next = joins[(i + 1) % joins.length]
        const prev = joins[i]
        const polygon = [
            prev?.left || { x: a.x + nx * radius, y: a.y + ny * radius },
            next?.left || { x: b.x + nx * radius, y: b.y + ny * radius },
            next?.right || { x: b.x - nx * radius, y: b.y - ny * radius },
            prev?.right || { x: a.x - nx * radius, y: a.y - ny * radius },
        ]
        paint(polygon, p => triangle(p, polygon[0], polygon[1], polygon[2]) ||
            triangle(p, polygon[0], polygon[2], polygon[3]))
    }
    for (let i = 0; i < joins.length; i++) {
        if (joins[i]) continue
        for (const point of [segments[i].a, segments[(i + joins.length - 1) % joins.length].b]) {
            paint([
                { x: point.x - radius, y: point.y - radius },
                { x: point.x + radius, y: point.y + radius },
            ], p => (p.x - point.x) ** 2 + (p.y - point.y) ** 2 <= radius ** 2)
        }
    }
    return masks
}

function bitCount(value) {
    value -= (value >>> 1) & 0x55555555
    value = (value & 0x33333333) + ((value >>> 2) & 0x33333333)
    return (((value + (value >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24
}

const borderBits = Uint32Array.from({ length: 8 }, (_, i) =>
    i === 0 ? 0x8001ffff : i === 7 ? 0xffff8001 : 0x80018001)

function difference(a, b) {
    let count = 0
    for (let i = 0; i < 8; i++) {
        const mismatch = a[i] ^ b[i]
        // Tile borders have to match more closely than the interior to avoid visible seams.
        count += bitCount(mismatch) + 8 * bitCount(mismatch & borderBits[i])
    }
    return count
}

function maskImage(mask) {
    const rows = []
    for (let y = 0; y < 16; y++) {
        let row = ""
        for (let x = 0; x < 16; x++) {
            row += mask[y >> 1] & (1 << ((y & 1) * 16 + x)) ? "1" : "7"
        }
        rows.push(row)
    }
    return rows.join("\n")
}

function addEdgeTiles(masks, width, height) {
    const grass = new Uint32Array(8)
    const road = new Uint32Array(8).fill(0xffffffff)
    const palette = [grass, road]
    const patterns = new Map()
    const emptyKey = Buffer.from(grass.buffer).toString("base64")
    const keyAt = new Array(width * height)
    for (let i = 0; i < keyAt.length; i++) {
        const mask = masks.get(i) || grass
        const key = mask === grass ? emptyKey : Buffer.from(mask.buffer).toString("base64")
        keyAt[i] = key
        const item = patterns.get(key)
        if (item) item.count++
        else patterns.set(key, { mask, count: 1, index: 0, error: Infinity })
    }
    for (const item of patterns.values()) {
        item.index = item.mask[4] & (1 << 8) ? 1 : 0
        item.error = difference(item.mask, palette[item.index])
    }
    while (palette.length < 256) {
        let worst
        let priority = 0
        for (const item of patterns.values()) {
            const score = item.error * Math.sqrt(item.count)
            if (score > priority) {
                priority = score
                worst = item
            }
        }
        if (!worst) break
        worst.index = palette.length
        palette.push(worst.mask)
        for (const item of patterns.values()) {
            if (Boolean(item.mask[4] & (1 << 8)) !== Boolean(worst.mask[4] & (1 << 8))) continue
            const error = difference(item.mask, worst.mask)
            if (error < item.error) {
                item.error = error
                item.index = worst.index
            }
        }
    }
    const tiles = Uint8Array.from(keyAt, key => patterns.get(key).index)
    const terrain = Uint8Array.from(keyAt, key => {
        const mask = patterns.get(key).mask
        return (mask[4] & (1 << 8)) ? 1 : 0
    })
    return { tiles, images: palette.map(maskImage), terrain }
}

function compactPalette() {
    const pixels = (predicate) => {
        const mask = new Uint32Array(8)
        for (let y = 0; y < 16; y++) {
            for (let x = 0; x < 16; x++) {
                if (predicate(x, y)) mask[y >> 1] |= 1 << ((y & 1) * 16 + x)
            }
        }
        return mask
    }
    const rotate = (mask) => pixels((x, y) =>
        Boolean(mask[(15 - x) >> 1] & (1 << (((15 - x) & 1) * 16 + y))))
    const palette = [new Uint32Array(8), new Uint32Array(8).fill(0xffffffff)]
    const variants = (mask) => {
        for (let i = 0; i < 4; i++) {
            palette.push(mask)
            mask = rotate(mask)
        }
    }
    // Fill corner pixels on road-facing sides so these tiles can meet a full-road tile.
    variants(pixels((x, y) => x + y >= 15))
    for (const [left, right] of [[16, 8], [8, 0], [8, 16], [0, 8]]) {
        variants(pixels((x, y) => y === 15 || y + 0.5 >= left + (right - left) * (x + 0.5) / 16))
    }
    variants(pixels((x, y) => y >= 8))
    return palette
}

function compactEdge(mask) {
    let left = 0
    let right = 0
    for (let y = 0; y < 16; y++) {
        const bits = mask[y >> 1] >>> ((y & 1) * 16)
        left |= (bits & 1) << y
        right |= ((bits >>> 15) & 1) << y
    }
    return [mask[0] & 0xffff, mask[7] >>> 16, left, right]
}

function compactBordersMatch(a, b) {
    if (a && b) return a === b
    // Full edges form straight boundaries against grass; one-pixel ends meet at tile corners.
    const pixels = bitCount(a || b)
    return pixels <= 1 || pixels >= 15
}

class CompactBordersError extends Error {}

function addCompactTiles(masks, width, height, waypoints) {
    const palette = compactPalette()
    const edges = palette.map(compactEdge)
    const empty = palette[0]
    const tiles = new Uint8Array(width * height)
    const costs = new Map()
    const partial = new Uint8Array(tiles.length)
    const full = new Uint8Array(tiles.length)
    const reference = Array.from({ length: tiles.length }, (_, i) => masks.get(i) || empty)
    const referenceEdges = reference.map(compactEdge)
    const route = new Map()
    for (let i = 0; i < waypoints.length; i++) {
        const a = waypoints[i]
        const b = waypoints[(i + 1) % waypoints.length]
        const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 4))
        for (let j = 0; j <= steps; j++) {
            const x = Math.round(a.x + (b.x - a.x) * j / steps)
            const y = Math.round(a.y + (b.y - a.y) * j / steps)
            const index = Math.floor(y / 16) * width + Math.floor(x / 16)
            const bits = route.get(index) || new Uint32Array(8)
            bits[(y % 16) >> 1] |= 1 << (((y % 16) & 1) * 16 + x % 16)
            route.set(index, bits)
        }
    }
    const pixelCost = (mask) => {
        const key = Buffer.from(mask.buffer).toString("base64")
        if (!costs.has(key)) {
            const center = Boolean(mask[4] & (1 << 8))
            costs.set(key, palette.map((tile, index) => {
                let error = 0
                for (let i = 0; i < 8; i++) error += bitCount(mask[i] ^ tile[i])
                // A diagonal can cover the corner even when the reference tile center is grass.
                return error + (index >= 2 && index < 6 ? 32 : 46) *
                    (center !== Boolean(tile[4] & (1 << 8)))
            }))
        }
        return costs.get(key)
    }
    const scores = reference.map((mask, index) => {
        const base = pixelCost(mask)
        const required = route.get(index)
        if (!required && !(mask[4] & (1 << 8))) return base
        return base.map((score, tile) => {
            if (tile === 0 && (mask[4] & (1 << 8))) return Infinity
            if (!required) return score
            let missing = 0
            for (let i = 0; i < 8; i++) missing += bitCount(required[i] & ~palette[tile][i])
            return missing ? Infinity : score
        })
    })
    for (let i = 0; i < tiles.length; i++) {
        let best = Infinity
        for (let tile = 0; tile < palette.length; tile++) {
            if (scores[i][tile] < best) {
                best = scores[i][tile]
                tiles[i] = tile
            }
        }
        const pixels = reference[i].reduce((sum, word) => sum + bitCount(word), 0)
        if (pixels > 0 && pixels < 256) partial[i] = 1
        if (pixels === 256) full[i] = 1
    }
    const border = (index, tile, neighbor, adjacent, side) => {
        const a = edges[tile][side]
        const b = edges[adjacent][side ^ 1]
        if (!tile || !adjacent) return compactBordersMatch(a, b)
        if (a === b) return true
        // Only extend a truly full raster cell to a half-width edge that matches its neighbor's raster.
        return (tile === 1 && full[index] && bitCount(b) === 8 &&
            bitCount(b ^ referenceEdges[neighbor][side ^ 1]) <= 2) ||
            (adjacent === 1 && full[neighbor] && bitCount(a) === 8 &&
            bitCount(a ^ referenceEdges[index][side]) <= 2)
    }
    const active = []
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const i = y * width + x
            if (route.has(i) || partial[i] || (x && partial[i - 1]) || (x + 1 < width && partial[i + 1]) ||
                (y && partial[i - width]) || (y + 1 < height && partial[i + width])) active.push(i)
        }
    }
    for (let pass = 0; pass < 24; pass++) {
        let changed = 0
        for (const i of pass % 2 ? active.slice().reverse() : active) {
            const x = i % width
            const y = Math.floor(i / width)
            let best = Infinity
            let selected = tiles[i]
            for (let tile = 0; tile < palette.length; tile++) {
                let cost = scores[i][tile]
                if (x && !border(i, tile, i - 1, tiles[i - 1], 2)) cost += 4096
                if (x + 1 < width &&
                    !border(i, tile, i + 1, tiles[i + 1], 3)) cost += 4096
                if (y && !border(i, tile, i - width, tiles[i - width], 0)) cost += 4096
                if (y + 1 < height &&
                    !border(i, tile, i + width, tiles[i + width], 1)) cost += 4096
                if (cost < best) {
                    best = cost
                    selected = tile
                }
            }
            if (selected !== tiles[i]) {
                tiles[i] = selected
                changed++
            }
        }
        if (!changed) break
    }
    // A corner tile may need its neighbors to change at the same time to keep every edge matched.
    const weightedScore = (index, tile) => scores[index][tile] * (partial[index] ? 4 : 1)
    const improveCorner = (x, y) => {
        if (x < 0 || y < 0 || x + 1 >= width || y + 1 >= height) return false
        const indices = [y * width + x, y * width + x + 1,
            (y + 1) * width + x, (y + 1) * width + x + 1]
        const choices = indices.map((index, position) => {
            const best = Math.min(...scores[index])
            return palette.map((_, tile) => tile).filter(tile => {
                if (scores[index][tile] > best + 200) return false
                return (position % 2 || x === 0 ||
                    border(index - 1, tiles[index - 1], index, tile, 3)) &&
                    (!(position % 2) || x + 2 >= width ||
                    border(index, tile, index + 1, tiles[index + 1], 3)) &&
                    (position >= 2 || y === 0 ||
                    border(index - width, tiles[index - width], index, tile, 1)) &&
                    (position < 2 || y + 2 >= height ||
                    border(index, tile, index + width, tiles[index + width], 1))
            })
        })
        let best = indices.reduce((sum, index) => sum + weightedScore(index, tiles[index]), 0)
        let selected
        for (const a of choices[0]) {
            for (const b of choices[1]) {
                if (!border(indices[0], a, indices[1], b, 3)) continue
                for (const c of choices[2]) {
                    if (!border(indices[0], a, indices[2], c, 1)) continue
                    for (const d of choices[3]) {
                        if (!border(indices[1], b, indices[3], d, 1) ||
                            !border(indices[2], c, indices[3], d, 3)) continue
                        const cost = weightedScore(indices[0], a) + weightedScore(indices[1], b) +
                            weightedScore(indices[2], c) + weightedScore(indices[3], d)
                        if (cost < best) {
                            best = cost
                            selected = [a, b, c, d]
                        }
                    }
                }
            }
        }
        if (!selected) return false
        indices.forEach((index, position) => { tiles[index] = selected[position] })
        return true
    }
    for (let pass = 0; pass < 2; pass++) {
        let changed = 0
        for (const index of active) {
            if (!partial[index] || scores[index][tiles[index]] <= Math.min(...scores[index]) + 32) continue
            const x = index % width
            const y = Math.floor(index / width)
            for (let dy = -1; dy <= 0; dy++) {
                for (let dx = -1; dx <= 0; dx++) {
                    if (improveCorner(x + dx, y + dy)) changed++
                }
            }
        }
        if (!changed) break
    }
    for (const [index, required] of route) {
        for (let i = 0; i < 8; i++) {
            if (required[i] & ~palette[tiles[index]][i]) {
                throw new Error("Compact tileset cannot cover the AI route; increase --width or --size")
            }
        }
    }
    let unmatched = 0
    let first
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const index = y * width + x
            const tile = tiles[index]
            if ((x + 1 < width &&
                !border(index, tile, index + 1, tiles[index + 1], 3)) ||
                (y + 1 < height &&
                !border(index, tile, index + width, tiles[index + width], 1))) {
                unmatched++
                first ||= { x, y }
            }
        }
    }
    if (unmatched) {
        throw new CompactBordersError(
            `Compact tileset cannot match ${unmatched} road edges (first at ${first.x},${first.y}); increase --width or --size`
        )
    }
    const outcroppings = []
    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            const index = y * width + x
            const tile = tiles[index]
            if (tile < 2 || tile >= 22 || route.has(index)) continue
            const flatSides = edges[tile].map((edge, side) => edge === 0xffff ? side : -1)
                .filter(side => side >= 0)
            if (flatSides.length && flatSides.every(side =>
                edges[tiles[index + [-width, width, -1, 1][side]]][side ^ 1] === 0)) {
                outcroppings.push(index)
            }
        }
    }
    for (const index of outcroppings) tiles[index] = 0
    const terrain = Uint8Array.from(tiles, tile => palette[tile][4] & (1 << 8) ? 1 : 0)
    return { tiles, images: palette.map(maskImage), terrain }
}

function makeTilemap(source, config) {
    if (config.tileset !== undefined && !["detailed", "compact"].includes(config.tileset)) {
        throw new Error("Tileset must be detailed or compact")
    }
    const colors = paletteColors(config)
    const track = parseEditorTrack(source)
    const finish = { point: track[0], forward: true }
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    for (const point of track) {
        minX = Math.min(minX, point.x)
        minY = Math.min(minY, point.y)
        maxX = Math.max(maxX, point.x)
        maxY = Math.max(maxY, point.y)
    }
    const spanX = maxX - minX
    const spanY = maxY - minY
    if (!spanX || !spanY) throw new Error("Track must have nonzero width and height")
    const scale = config.size / Math.max(spanX, spanY)
    const margin = Math.ceil(config.width / 2) + 2
    const points = track.map(p => ({ x: (p.x - minX) * scale + margin, y: (p.y - minY) * scale + margin }))
    const centerlineVertices = points
    const minSnappedX = Math.min(...centerlineVertices.map(p => p.x))
    const minSnappedY = Math.min(...centerlineVertices.map(p => p.y))
    const render = (phaseX, phaseY) => {
        const offsetX = margin - minSnappedX + phaseX
        const offsetY = margin - minSnappedY + phaseY
        const centerline = centerlineVertices.map(p => ({ x: p.x + offsetX, y: p.y + offsetY }))
        const width = Math.ceil(Math.max(...centerline.map(p => p.x))) + margin
        const height = Math.ceil(Math.max(...centerline.map(p => p.y))) + margin
        if (width > 65535 || height > 65535 || width * height > 1000000) {
            throw new Error("Tilemap exceeds supported dimensions (maximum 1,000,000 tiles)")
        }
        const transformedFinish = {
            x: (finish.point.x - minX) * scale + margin + offsetX,
            y: (finish.point.y - minY) * scale + margin + offsetY,
            forward: finish.forward,
        }
        const masks = rasterizePixels(centerline, width, height, config.width, true, config.tileset === "compact")
        const { tiles, images, terrain } = config.tileset === "compact"
            ? addCompactTiles(masks, width, height, makeWaypoints({
                points: centerline, finish: transformedFinish, roadWidth: config.width,
                tileset: config.tileset,
            }))
            : addEdgeTiles(masks, width, height)
        return {
            width, height, tiles, images, terrain, points: centerline,
            finish: transformedFinish,
            roadWidth: config.width,
            tileset: config.tileset,
            ...colors,
        }
    }
    if (config.tileset !== "compact") return render(0, 0)
    let lastError
    const phases = [0, 0.125, 0.25, 0.375, 0.5]
    const offsets = phases.flatMap(x => phases.map(y => [x, y]))
        .sort((a, b) => a[0] + a[1] - b[0] - b[1] || a[0] - b[0])
    for (const [x, y] of offsets) {
        try {
            return render(x, y)
        } catch (error) {
            if (!(error instanceof CompactBordersError)) throw error
            lastError = error
        }
    }
    throw lastError
}

function makeWaypoints(map, everyVertex = map.tileset === "compact") {
    const vertices = map.finish.forward ? map.points : map.points.slice().reverse()
    let closest
    for (let i = 0; i < vertices.length; i++) {
        const a = vertices[i]
        const b = vertices[(i + 1) % vertices.length]
        const dx = b.x - a.x
        const dy = b.y - a.y
        const length = dx * dx + dy * dy
        const t = length ? Math.max(0, Math.min(1,
            ((map.finish.x - a.x) * dx + (map.finish.y - a.y) * dy) / length)) : 0
        const point = { x: a.x + dx * t, y: a.y + dy * t }
        const distance = distanceSquared(map.finish, point, point)
        if (!closest || distance < closest.distance) closest = { i, t, point, distance }
    }
    if (closest.distance > (map.roadWidth / 2) ** 2) {
        throw new Error("Finish line moved off the road")
    }
    const { i, t, point } = closest
    const startIndex = t < 1e-6 ? i : (i + 1) % vertices.length
    const loop = everyVertex || t < 1e-6 || t >= 1 - 1e-6
        ? Array.from({ length: vertices.length }, (_, k) => vertices[(startIndex + k) % vertices.length])
        : [point, ...Array.from({ length: vertices.length }, (_, k) =>
            vertices[(i + k + 1) % vertices.length])]
    const reduced = everyVertex ? loop : simplifyLoop(loop, Math.min(0.75, map.roadWidth / 4))
    if (reduced.length < 3) throw new Error("Not enough turns remain for AI waypoints")
    return reduced.map(p => {
        const x = Math.round(p.x * 16)
        const y = Math.round(p.y * 16)
        if (x < 0 || x > 65535 || y < 0 || y > 65535) {
            throw new Error("Waypoint pixel coordinates exceed UInt16; reduce --size")
        }
        return { x, y }
    })
}

function tilemapHex(map, tiles = map.tiles) {
    const header = Buffer.alloc(4)
    header.writeUInt16LE(map.width, 0)
    header.writeUInt16LE(map.height, 2)
    return Buffer.concat([header, Buffer.from(tiles)]).toString("hex")
}

function makeGates(map) {
    const vertices = makeWaypoints(map, true)
    const roadAt = (x, y) => {
        const px = Math.floor(x)
        const py = Math.floor(y)
        if (px < 0 || py < 0 || px >= map.width * 16 || py >= map.height * 16) return false
        const index = Math.floor(py / 16) * map.width + Math.floor(px / 16)
        return map.images[map.tiles[index]][(py % 16) * 17 + px % 16] === "1"
    }
    const gateOnSegment = (start, end, distance, index) => {
        const dx = end.x - start.x
        const dy = end.y - start.y
        const length = Math.hypot(dx, dy)
        if (!length) throw new Error("Cannot generate a gate across a zero-length road segment")
        const t = distance / length
        const center = { x: start.x + t * dx, y: start.y + t * dy }
        const normal = { x: -dy / length, y: dx / length }
        if (!roadAt(center.x, center.y)) {
            throw new Error(`Gate ${index} does not cross the rendered road; increase --width or --size`)
        }
        const extent = side => {
            const limit = Math.ceil(map.roadWidth * 8 + 16)
            let lastRoad = 0
            let grass = 0
            for (let distance = 1; distance <= limit; distance++) {
                if (roadAt(center.x + side * normal.x * distance,
                    center.y + side * normal.y * distance)) {
                    lastRoad = distance
                    grass = 0
                } else if (++grass === 2) {
                    return lastRoad + 2
                }
            }
            // A joining segment may keep this ray on the road beyond the current segment's width.
            return limit
        }
        const roadRadius = Math.max(extent(-1), extent(1))
        const radius = Math.max(roadRadius, map.roadWidth * 8) * 6
        const endpoint = side => {
            const x = Math.round(center.x + normal.x * radius * side)
            const y = Math.round(center.y + normal.y * radius * side)
            if (!Number.isInteger(x) || x < -2147483648 || x > 2147483647 ||
                !Number.isInteger(y) || y < -2147483648 || y > 2147483647) {
                throw new Error("Gate pixel coordinates exceed Int32; reduce --size or --width")
            }
            return { x, y }
        }
        return { start: endpoint(-1), end: endpoint(1) }
    }
    const last = vertices[vertices.length - 1]
    const first = vertices[0]
    const dx = first.x - last.x
    const dy = first.y - last.y
    const length = Math.hypot(dx, dy)
    if (!length) throw new Error("Cannot generate a finish gate on a zero-length road segment")
    const finishX = map.finish.x * 16
    const finishY = map.finish.y * 16
    const finishDistance = Math.max(0, Math.min(length,
        ((finishX - last.x) * dx + (finishY - last.y) * dy) / length))
    const gates = [gateOnSegment(last, first, finishDistance, 0)]
    for (let i = 0; i < vertices.length; i++) {
        const previous = vertices[(i + vertices.length - 1) % vertices.length]
        const turn = vertices[i]
        const next = vertices[(i + 1) % vertices.length]
        const incoming = Math.hypot(turn.x - previous.x, turn.y - previous.y)
        const outgoing = Math.hypot(next.x - turn.x, next.y - turn.y)
        const clearance = map.roadWidth * 8 + 12
        gates.push(gateOnSegment(previous, turn,
            incoming - Math.min(clearance, incoming / 3), gates.length))
        gates.push(gateOnSegment(turn, next,
            Math.min(clearance, outgoing / 3), gates.length))
    }
    if (length - finishDistance <= 1) {
        gates.push(gates.splice(1, 1)[0])
    }
    return gates
}

function gateHex(map) {
    const gates = makeGates(map)
    const data = Buffer.alloc(gates.length * 16)
    for (let i = 0; i < gates.length; i++) {
        data.writeInt32LE(gates[i].start.x, i * 16)
        data.writeInt32LE(gates[i].start.y, i * 16 + 4)
        data.writeInt32LE(gates[i].end.x, i * 16 + 8)
        data.writeInt32LE(gates[i].end.y, i * 16 + 12)
    }
    return data.toString("hex")
}

function colorizeTile(image, colors) {
    return image.replaceAll(/[17fyk]/g, pixel => {
        if (pixel === "y") return "2"
        if (pixel === "k") return "1"
        return (pixel === "7" ? colors.grassColor :
            pixel === "1" ? colors.roadColor : colors.outlineColor).toString(16)
    })
}

const outlineOffsets = []
for (let dy = -4; dy <= 4; dy++) {
    for (let dx = -4; dx <= 4; dx++) {
        if (dx * dx + dy * dy <= 16 && (dx || dy)) outlineOffsets.push([dx, dy])
    }
}

function outlineMap(map) {
    const { width, height } = map
    const images = [...map.images]
    const tiles = Uint8Array.from(map.tiles)
    const indices = new Map(images.map((image, index) => [image, index]))
    const hasRoad = images.map(image => image.includes("1"))
    for (let ty = 0; ty < height; ty++) {
        for (let tx = 0; tx < width; tx++) {
            let nearRoad = false
            for (let y = Math.max(0, ty - 1); y <= Math.min(height - 1, ty + 1); y++) {
                for (let x = Math.max(0, tx - 1); x <= Math.min(width - 1, tx + 1); x++) {
                    if (hasRoad[map.tiles[y * width + x]]) nearRoad = true
                }
            }
            if (!nearRoad) continue
            const index = ty * width + tx
            const original = map.images[map.tiles[index]]
            const rows = original.split("\n").map(row => row.split(""))
            let outlined = false
            for (let y = 0; y < 16; y++) {
                for (let x = 0; x < 16; x++) {
                    if (rows[y][x] !== "7") continue
                    for (const [dx, dy] of outlineOffsets) {
                        const px = tx * 16 + x + dx
                        const py = ty * 16 + y + dy
                        if (px < 0 || py < 0 || px >= width * 16 || py >= height * 16) continue
                        const neighbor = map.tiles[Math.floor(py / 16) * width + Math.floor(px / 16)]
                        if (map.images[neighbor][(py % 16) * 17 + px % 16] === "1") {
                            // Keep the outline separate from road and grass until output coloring.
                            rows[y][x] = "f"
                            outlined = true
                            break
                        }
                    }
                }
            }
            if (!outlined) continue
            const image = rows.map(row => row.join("")).join("\n")
            if (!indices.has(image)) {
                if (images.length === 256) {
                    throw new Error("Outlined tileset needs more than 256 images; use --tileset compact")
                }
                indices.set(image, images.length)
                images.push(image)
            }
            tiles[index] = indices.get(image)
        }
    }
    return { ...map, images, tiles }
}

function stripeSharpTurns(map) {
    const points = map.finish.forward ? map.points : map.points.slice().reverse()
    const segments = []
    let length = 0
    for (let i = 0; i < points.length; i++) {
        const a = points[i], b = points[(i + 1) % points.length]
        const dx = b.x - a.x, dy = b.y - a.y
        const size = Math.hypot(dx, dy)
        segments.push({ a, dx, dy, size, start: length })
        length += size
    }
    const angles = segments.map((segment, i) => {
        const previous = segments[(i + segments.length - 1) % segments.length]
        return Math.atan2(previous.dx * segment.dy - previous.dy * segment.dx,
            previous.dx * segment.dx + previous.dy * segment.dy)
    })
    const warnings = []
    for (let i = 0; i < angles.length; i++) {
        let angle = angles[i]
        let span = 0
        let end = i
        // A hairpin can be split into several smaller, closely spaced turns.
        for (let j = 1; j < angles.length && Math.abs(angle) < Math.PI - 1e-8; j++) {
            const next = (i + j) % angles.length
            const distance = span + segments[end].size
            if (distance > map.roadWidth * 4 || angles[next] * angles[i] <= 0) break
            span = distance
            angle += angles[next]
            end = next
        }
        if (Math.abs(angles[i]) < Math.PI / 4 - 1e-8 && Math.abs(angle) < Math.PI * 3 / 8 - 1e-8) continue
        const lead = 9 + map.roadWidth / 2
        warnings.push({ start: segments[i].start - lead,
            size: lead + span + map.roadWidth / 2 + 1 })
    }
    const images = [...map.images]
    const tiles = Array.from(map.tiles)
    const variants = new Map()
    for (let tile = 0; tile < map.images.length; tile++) {
        const image = map.images[tile]
        if (!image.includes("f")) continue
        variants.set(tile, images.length)
        images.push(stripeTile(image))
    }
    for (let y = 0; y < map.height; y++) {
        for (let x = 0; x < map.width; x++) {
            const index = y * map.width + x
            const tile = map.tiles[index]
            if (!map.images[tile].includes("f")) continue
            let nearest = Infinity
            let position = 0
            for (const segment of segments) {
                const dx = x + 0.5 - segment.a.x, dy = y + 0.5 - segment.a.y
                const t = Math.max(0, Math.min(1, (dx * segment.dx + dy * segment.dy) / segment.size ** 2))
                const distance = (dx - t * segment.dx) ** 2 + (dy - t * segment.dy) ** 2
                if (distance < nearest) {
                    nearest = distance
                    position = segment.start + t * segment.size
                }
            }
            if (!warnings.some(warning => warning.size >= length ||
                ((position - warning.start) % length + length) % length <= warning.size)) continue
            tiles[index] = variants.get(tile)
        }
    }
    return { ...map, images, tiles }
}

function stripeTile(image) {
    const points = []
    for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
            if (image[y * 17 + x] === "f") points.push({ x, y })
        }
    }
    const cx = points.reduce((sum, point) => sum + point.x, 0) / points.length
    const cy = points.reduce((sum, point) => sum + point.y, 0) / points.length
    let xx = 0, yy = 0, xy = 0
    for (const point of points) {
        xx += (point.x - cx) ** 2
        yy += (point.y - cy) ** 2
        xy += (point.x - cx) * (point.y - cy)
    }
    const angle = Math.atan2(2 * xy, xx - yy) / 2
    const dx = Math.cos(angle), dy = Math.sin(angle)
    const positions = points.map(point => point.x * dx + point.y * dy)
    const min = Math.min(...positions), max = Math.max(...positions)
    const spansTile = (points.some(point => point.x === 0) && points.some(point => point.x === 15)) ||
        (points.some(point => point.y === 0) && points.some(point => point.y === 15))
    const corner = !image.includes("1") && !spansTile
    const pixels = [...image]
    for (let i = 0; i < points.length; i++) {
        const portion = Math.min(3, Math.floor((positions[i] - min) / (max - min + 1) * 4))
        pixels[points[i].y * 17 + points[i].x] = corner || portion === 0 || portion === 3 ? "y" : "k"
    }
    return pixels.join("")
}

function formatTilemap(map) {
    let outlined = map.tileset === "compact" ? stripeSharpTurns(outlineMap(map)) : map
    if (map.tileset === "compact") {
        const palette = [...new Set([...Array.from({ length: 26 }, (_, i) => i), ...outlined.tiles])]
        if (palette.length > 256) throw new Error("Tilemap needs more than 256 tiles")
        const local = new Map(palette.map((index, i) => [index, i]))
        outlined = { ...outlined, images: palette.map(index => outlined.images[index]),
            tiles: Uint8Array.from(outlined.tiles, index => local.get(index)) }
    }
    const hex = tilemapHex(outlined)
    const colors = paletteColors(map)
    const images = outlined.images.map(image => `        img\`
            ${colorizeTile(image, colors).replaceAll("\n", "\n            ")}
        \``).join(",\n")
    return `tiles.setCurrentTilemap(tiles.createTilemap(
    hex\`${hex}\`,
    img\`
        ${Array.from({ length: map.height }, () => ".".repeat(map.width)).join("\n        ")}
    \`,
    [
${images},
    ],
    TileScale.Sixteen
))

// Each gate is start X/Y, end X/Y as Int32LE pixels; gate 0 crosses the finish.
// Wrap after the last gate.
//% whenUsed
const trackWaypoints = hex\`${gateHex(map)}\`
`
}

const compactTileNames = [
    "grass", "road",
    "roadDiagonalSouthEast", "roadDiagonalSouthWest",
    "roadDiagonalNorthWest", "roadDiagonalNorthEast",
    ...["SouthEast", "SouthWest", "NorthWest", "NorthEast"].map(side =>
        `roadShallow${side}NarrowA`),
    ...["SouthEast", "SouthWest", "NorthWest", "NorthEast"].map(side =>
        `roadShallow${side}WideA`),
    ...["SouthWest", "NorthWest", "NorthEast", "SouthEast"].map(side =>
        `roadShallow${side}NarrowB`),
    ...["SouthWest", "NorthWest", "NorthEast", "SouthEast"].map(side =>
        `roadShallow${side}WideB`),
    "roadHalfSouth", "roadHalfWest", "roadHalfNorth", "roadHalfEast",
]

function jresImage(image, colors) {
    const pixels = colorizeTile(image, colors)
    return encodeImage([...pixels.replace(/\n/g, "")].map(color => Number.parseInt(color, 16)), 16, 16).toString("base64")
}

function encodeImage(pixels, width, height) {
    if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 ||
        width > 65535 || height > 65535 || pixels.length !== width * height) {
        throw new Error("Invalid image dimensions")
    }
    const stride = Math.ceil(height / 8) * 4
    const bytes = Buffer.alloc(8 + width * stride)
    bytes[0] = 0x87
    bytes[1] = 4
    bytes.writeUInt16LE(width, 2)
    bytes.writeUInt16LE(height, 4)
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const color = pixels[y * width + x]
            if (!Number.isInteger(color) || color < 0 || color > 15) throw new Error("Invalid image color")
            bytes[8 + x * stride + (y >> 1)] |= color << ((y & 1) * 4)
        }
    }
    return bytes
}

function withTrackContext(name, action) {
    try {
        return action()
    } catch (error) {
        throw new Error(`${name}: ${error.message}`, { cause: error })
    }
}

function formatBatch(entries, compact = true) {
    if (!entries.length) throw new Error("No track JSON files found in tracks/")
    const colors = withTrackContext(entries[0].name, () => paletteColors(entries[0].map))
    const transparent = Array.from({ length: 16 }, () => "0".repeat(16)).join("\n")
    const images = [transparent]
    const imageIndices = new Map([[transparent, 0]])
    const usedNames = new Set()
    const prepared = entries.map(({ name, map }) => withTrackContext(name, () => {
        const trackColors = paletteColors(map)
        if (trackColors.grassColor !== colors.grassColor || trackColors.roadColor !== colors.roadColor ||
            trackColors.outlineColor !== colors.outlineColor) {
            throw new Error("Batch tracks must use the same grass, road, and outline colors")
        }
        const id = path.parse(name).name.replace(/[^a-zA-Z0-9_]+/g, "_")
        if (!/^[a-zA-Z_]/.test(id) || usedNames.has(id)) {
            throw new Error(`Invalid or duplicate track name: ${name}`)
        }
        usedNames.add(id)
        for (const image of map.images) {
            if (!imageIndices.has(image)) {
                imageIndices.set(image, images.length)
                images.push(image)
            }
        }
        if (images.length > 256) {
            throw new Error(`Shared tileset needs ${images.length} images (maximum 256); use --tileset compact`)
        }
        return { id, name: path.parse(name).name.replace(/[_-]+/g, " "),
            file: name, map }
    }))
    const baseCount = images.length
    const maps = prepared.map(item => withTrackContext(item.file, () => {
        const outlined = item.map.tileset === "compact"
            ? stripeSharpTurns(outlineMap(item.map)) : item.map
        for (const image of outlined.images) {
            if (!imageIndices.has(image)) {
                imageIndices.set(image, images.length)
                images.push(image)
            }
        }
        return { ...item, outlined, gates: gateHex(item.map) }
    }))
    const baseNames = images.slice(0, baseCount).map((image, i) =>
        i === 0 ? "transparency16" :
            compact ? compactTileNames[i - 1] :
                i === 1 ? "grass" : i === 2 ? "road" : `roadEdge${i - 2}`)
    const variants = new Map()
    const names = images.map((image, i) => {
        if (i < baseCount) return baseNames[i]
        const base = baseNames[imageIndices.get(image.replaceAll(/[fyk]/g, "7"))]
        const kind = /[yk]/.test(image) ? "StripedOutline" : "Outline"
        const key = `${base}${kind}`
        const count = (variants.get(key) || 0) + 1
        variants.set(key, count)
        return `${key}${count}`
    })
    for (const item of maps) {
        const palette = Array.from({ length: baseCount }, (_, i) => i)
        const local = new Map(palette.map((index, i) => [index, i]))
        const tiles = Uint8Array.from(item.outlined.tiles, index => {
            const shared = imageIndices.get(item.outlined.images[index])
            if (!local.has(shared)) {
                local.set(shared, palette.length)
                palette.push(shared)
            }
            return local.get(shared)
        })
        if (palette.length > 256) throw new Error(`${item.file}: Tilemap needs more than 256 tiles`)
        item.hex = tilemapHex(item.outlined, tiles)
        item.tileset = palette.map(index => `myTiles.${names[index]}`)
    }
    const resources = {}
    images.forEach((image, i) => {
        resources[names[i]] = {
            data: jresImage(image, colors), mimeType: "image/x-mkcd-f4", tilemapTile: true,
            displayName: names[i].replace(/([a-z])([A-Z])/g, "$1 $2"),
        }
    })
    for (const item of maps) {
        withTrackContext(item.file, () => {
            if (resources[item.id]) throw new Error(`Track name conflicts with tile name: ${item.id}`)
            resources[item.id] = {
                id: item.id,
                mimeType: "application/mkcd-tilemap",
                data: Buffer.from(`10${item.hex}${"00".repeat(item.map.width * Math.ceil(item.map.height / 2))}`,
                    "utf8").toString("base64"),
                tileset: item.tileset,
                displayName: item.name,
            }
        })
    }
    resources["*"] = { mimeType: "image/x-mkcd-f4", dataEncoding: "base64", namespace: "myTiles" }
    const tileDeclarations = names.map(name => `    //% fixedInstance jres blockIdentity=images._tile
    export const ${name} = image.ofBuffer(hex\`\`);`).join("\n")
    const factories = maps.map(item => {
        const { map, hex } = item
        const walls = Array.from({ length: map.height }, () => ".".repeat(map.width)).join("\n                ")
        return `            case ${JSON.stringify(item.id)}:
                return tiles.createTilemap(hex\`${hex}\`, img\`
                ${walls}
                \`, [${item.tileset.join(", ")}], TileScale.Sixteen);`
    }).join("\n")
    const tileFactories = names.map(name =>
        `            case ${JSON.stringify(name)}: return ${name};`).join("\n")
    const routes = maps.map(item =>
        `    //% whenUsed
    export const ${item.id} = hex\`${item.gates}\`;`).join("\n")
    const ts = `// Auto-generated code. Do not edit.
namespace myTiles {
${tileDeclarations}

    helpers._registerFactory("tilemap", function(name: string) {
        switch (helpers.stringTrim(name)) {
${factories}
        }
        return null;
    });
    helpers._registerFactory("tile", function(name: string) {
        switch (helpers.stringTrim(name)) {
${tileFactories}
        }
        return null;
    });
}

// Each gate is start X/Y, end X/Y as Int32LE pixels; gate 0 crosses the finish.
// Wrap after the last gate.
namespace trackWaypoints {
${routes}
}
// Auto-generated code. Do not edit.
`
    const centers = prepared.map(item => {
        const points = makeWaypoints(item.map)
        const data = Buffer.alloc(points.length * 4)
        points.forEach((point, i) => {
            data.writeUInt16LE(point.x, i * 4)
            data.writeUInt16LE(point.y, i * 4 + 2)
        })
        return `    //% whenUsed
    export const ${item.id} = hex\`${data.toString("hex")}\`;`
    }).join("\n")
    const widths = prepared.map(item => `    //% whenUsed
    export const ${item.id} = ${Math.round(item.map.roadWidth * 16)};`).join("\n")
    const geometry = `// Auto-generated code. Do not edit.

// Each vertex is X/Y as UInt16LE pixels, four bytes per vertex.
// Shared gates are 16-byte Int32LE records: gate 0 crosses the finish on the last-to-first segment,
// Turn gates follow traversal order; when the finish is at vertex zero,
// its approach gate is last, so the first checkpoint lies beyond the finish.
// Vertices follow gate traversal order; connect the last vertex back to the first.
namespace trackCenterlines {
${centers}
}

// Road width in pixels.
namespace trackRoadWidths {
${widths}
}
// Auto-generated code. Do not edit.
`
    return { ts, jres: `${JSON.stringify(resources, null, 4)}\n`, geometry }
}

function readTrack(file) {
    if (!file.toLowerCase().endsWith(".json")) throw new Error("Track input must be a JSON file")
    const source = fs.readFileSync(file, "utf8")
    const data = JSON.parse(source)
    if (!data || typeof data !== "object" || Array.isArray(data)) {
        throw new Error('Editor track must be {"version":1,"points":[[x,y],...]}')
    }
    return data
}

function formatEditorTracks(entries) {
    const definitions = entries.filter(entry => entry.definition).map(({ name, definition }) => {
        const points = parseEditorTrack(definition)
        const label = path.parse(name).name.replace(/[_-]+/g, " ")
        return `        { name: ${JSON.stringify(label)}, points: [${points.map(point =>
            `{ x: ${point.x}, y: ${point.y} }`).join(", ")}] }`
    })
    return `// Auto-generated code. Do not edit.
namespace racing.trackEditor {
    export function getTracks(): Definition[] {
        return [
${definitions.join(",\n")}
        ];
    }
}
`
}

if (require.main === module) {
    try {
        const config = options(process.argv.slice(2))
        if (config.help) {
            console.log(usage)
        } else if (config.batch) {
            const tracks = fs.readdirSync(__dirname).filter(name => /\.json$/i.test(name)).sort()
            const entries = tracks.map(name => withTrackContext(name, () => {
                const source = readTrack(path.join(__dirname, name))
                return { name, map: makeTilemap(source, config), definition: source }
            }))
            const output = formatBatch(entries, config.tileset === "compact")
            const editorTracks = formatEditorTracks(entries)
            const directory = config.output || path.dirname(__dirname)
            fs.mkdirSync(directory, { recursive: true })
            fs.writeFileSync(path.join(directory, "tilemap.g.ts"), output.ts)
            fs.writeFileSync(path.join(directory, "tilemap.g.jres"), output.jres)
            fs.mkdirSync(path.join(directory, "ai"), { recursive: true })
            fs.writeFileSync(path.join(directory, "ai/geometry.g.ts"), output.geometry)
            fs.writeFileSync(path.join(directory, "track-editor-tracks.g.ts"), editorTracks)
        } else {
            const output = formatTilemap(makeTilemap(readTrack(config.input), config))
            if (config.output) fs.writeFileSync(config.output, output)
            else process.stdout.write(output)
        }
    } catch (error) {
        console.error(`${path.basename(process.argv[1])}: ${error.message}\nRun with --help for usage.`)
        process.exitCode = 1
    }
}

module.exports = {
    parseEditorTrack, simplifyLoop,
    rasterizePixels, addCompactTiles, outlineMap, makeTilemap, makeWaypoints, makeGates,
    formatTilemap, formatBatch, formatEditorTracks, encodeImage,
}
