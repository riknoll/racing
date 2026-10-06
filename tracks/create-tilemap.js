#!/usr/bin/env node
const fs = require("node:fs")
const path = require("node:path")

const usage = `Usage: node tracks/create-tilemap.js <track.svg> [--size 200] [--width 4] [--simplify 2] [--angles 32] [--tileset detailed|compact] [--output track.ts]
       node tracks/create-tilemap.js --batch [--size 200] [--width 4] [--simplify 2] [--tileset compact] [--output directory]

Writes a standalone MakeCode Arcade TypeScript tilemap (16-pixel tiles).
--batch reads every SVG in tracks/ and writes tilemap.g.ts and tilemap.g.jres
to the project root (or --output directory), using a shared tile palette.
Batch mode defaults to the compact tileset and includes per-track road gates.
--size is the longest track dimension in tiles; --width is road width in tiles;
--simplify is the maximum centerline deviation in tiles (0 disables simplification).
--angles divides a full turn into allowed directions (32 means increments of PI/16;
16 means increments of PI/8; 0 disables angle snapping).
--tileset compact uses 16 directions, nudging shallow PI/8 angles to the
tiles' 1:2 pixel slope (about 26.6 degrees), and a fixed 26-image palette:
grass, full road, four diagonal corners, sixteen shallow edges, and four half tiles.
Short adjacent corners are combined when they stay within --simplify deviation.
Road tiles must have matching sides, except a full road tile can meet a
half-width slope when its edge follows the rasterized road. Half-width edges
cannot end in grass. Increase road width or map size if a layout cannot fit.
The default detailed tileset retains the exact pixel-art edges where possible.
The longest closed SVG path is used as the track centerline. Grass (0), road (1),
and generated edge tiles draw straight road edges at 16 pixels per tile.
The SVG must mark the finish with red and yellow paths. The output includes
trackWaypoints: pairs of gate endpoints (start X/Y, end X/Y as UInt16LE pixels),
one gate before and one after each generated turn in the yellow-to-red
direction. Gates are up to three times the road width, stopping short of
neighboring road segments or the map edge. The first gate precedes the first
turn after the finish.`

function options(argv) {
    const result = { size: 200, width: 4, simplify: 2, angles: 32, tileset: "detailed" }
    let input
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i]
        if (arg === "--help" || arg === "-h") return { help: true }
        if (arg === "--batch") {
            result.batch = true
            continue
        }
        if (["--size", "--width", "--simplify", "--angles", "--tileset", "--output"].includes(arg)) {
            if (++i >= argv.length) throw new Error(`Missing value for ${arg}`)
            result[arg.slice(2)] = argv[i]
        } else if (arg.startsWith("-") || input) {
            throw new Error(`Unexpected argument: ${arg}`)
        } else input = arg
    }
    if (result.batch && input) throw new Error("--batch does not accept an SVG file")
    if (!result.batch && !input) throw new Error("Missing SVG file")
    if (result.batch && !argv.includes("--tileset")) result.tileset = "compact"
    if (!["detailed", "compact"].includes(result.tileset)) {
        throw new Error("--tileset must be detailed or compact")
    }
    if (result.tileset === "compact" && !argv.includes("--angles")) result.angles = 16
    for (const key of ["size", "width", "simplify"]) {
        if (result[key] === "") throw new Error(`Invalid --${key}`)
        result[key] = Number(result[key])
        if (!Number.isFinite(result[key]) || result[key] < (key === "simplify" ? 0 : 0.1)) {
            throw new Error(`Invalid --${key}`)
        }
    }
    if (!Number.isInteger(result.size) || result.size > 65000) {
        throw new Error("--size must be an integer below 65001")
    }
    if (result.angles === "") throw new Error("Invalid --angles")
    result.angles = Number(result.angles)
    if (!Number.isInteger(result.angles) || result.angles < 0 || result.angles > 128 ||
        result.angles === 1 || result.angles % 2) {
        throw new Error("--angles must be 0 or an even integer from 2 to 128")
    }
    if (result.tileset === "compact" && result.angles !== 16) {
        throw new Error("--tileset compact requires --angles 16")
    }
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

function flattenCurve(start, controls, end, out, tolerance = 0.75, depth = 0) {
    if (depth === 14 || controls.every(p => distanceSquared(p, start, end) <= tolerance ** 2)) {
        out.push(end)
        return
    }
    let points = [start, ...controls, end]
    const levels = [points]
    while (points.length > 1) {
        points = points.slice(1).map((p, i) => ({
            x: (p.x + points[i].x) / 2,
            y: (p.y + points[i].y) / 2,
        }))
        levels.push(points)
    }
    const left = levels.map(level => level[0])
    const right = levels.map(level => level[level.length - 1]).reverse()
    flattenCurve(left[0], left.slice(1, -1), left.at(-1), out, tolerance, depth + 1)
    flattenCurve(right[0], right.slice(1, -1), right.at(-1), out, tolerance, depth + 1)
}

function flattenArc(start, rx, ry, rotation, large, sweep, end, out) {
    rx = Math.abs(rx)
    ry = Math.abs(ry)
    if (!rx || !ry || (start.x === end.x && start.y === end.y)) {
        out.push(end)
        return
    }
    const phi = rotation * Math.PI / 180
    const cos = Math.cos(phi)
    const sin = Math.sin(phi)
    const dx = (start.x - end.x) / 2
    const dy = (start.y - end.y) / 2
    const x = cos * dx + sin * dy
    const y = -sin * dx + cos * dy
    const scale = Math.sqrt(x * x / (rx * rx) + y * y / (ry * ry))
    if (scale > 1) {
        rx *= scale
        ry *= scale
    }
    const numerator = Math.max(0, (rx * ry) ** 2 - (rx * y) ** 2 - (ry * x) ** 2)
    const denominator = (rx * y) ** 2 + (ry * x) ** 2
    const factor = (large === sweep ? -1 : 1) * Math.sqrt(numerator / denominator)
    const cx = factor * rx * y / ry
    const cy = -factor * ry * x / rx
    const middleX = (start.x + end.x) / 2
    const middleY = (start.y + end.y) / 2
    const angle = (ux, uy, vx, vy) => Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy)
    const theta = angle(1, 0, (x - cx) / rx, (y - cy) / ry)
    let delta = angle((x - cx) / rx, (y - cy) / ry, (-x - cx) / rx, (-y - cy) / ry)
    if (sweep && delta < 0) delta += 2 * Math.PI
    if (!sweep && delta > 0) delta -= 2 * Math.PI
    const steps = Math.max(1, Math.ceil(Math.abs(delta) * Math.sqrt(Math.max(rx, ry) / 0.75)))
    for (let i = 1; i < steps; i++) {
        const a = theta + delta * i / steps
        const px = rx * Math.cos(a)
        const py = ry * Math.sin(a)
        out.push({
            x: middleX + cos * (px + cx) - sin * (py + cy),
            y: middleY + sin * (px + cx) + cos * (py + cy),
        })
    }
    out.push(end)
}

function parsePath(data) {
    const tokens = data.match(/[a-zA-Z]|[-+]?(?:\d*\.?\d+|\d+\.?)(?:[eE][-+]?\d+)?/g) || []
    const arity = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7 }
    const paths = []
    let points = []
    let current = { x: 0, y: 0 }
    let start = current
    let previous = ""
    let control
    let command
    let i = 0
    const isCommand = token => /^[a-zA-Z]$/.test(token)
    while (i < tokens.length) {
        if (isCommand(tokens[i])) {
            command = tokens[i++]
            if (command.toUpperCase() === "Z") {
                if (points.length > 2) paths.push({ points, closed: true })
                points = []
                current = start
                previous = "Z"
                command = undefined
                continue
            }
            if (!(command.toUpperCase() in arity)) throw new Error(`Unsupported SVG path command: ${command}`)
        }
        if (!command || i + arity[command.toUpperCase()] > tokens.length ||
            tokens.slice(i, i + arity[command.toUpperCase()]).some(isCommand)) {
            throw new Error("Malformed SVG path data")
        }
        const relative = command === command.toLowerCase()
        const kind = command.toUpperCase()
        const values = tokens.slice(i, i += arity[kind]).map(Number)
        const point = (x, y) => ({ x: x + (relative ? current.x : 0), y: y + (relative ? current.y : 0) })
        const end = kind === "H" ? { x: values[0] + (relative ? current.x : 0), y: current.y }
            : kind === "V" ? { x: current.x, y: values[0] + (relative ? current.y : 0) }
                : point(values.at(-2), values.at(-1))
        if (kind === "M") {
            if (points.length > 1) paths.push({ points, closed: false })
            points = [end]
            start = end
            command = relative ? "l" : "L"
        } else if (!points.length) {
            throw new Error("SVG path must start with M")
        } else if (kind === "C") {
            const c1 = point(values[0], values[1])
            const c2 = point(values[2], values[3])
            flattenCurve(current, [c1, c2], end, points)
            control = c2
        } else if (kind === "S") {
            const c1 = previous === "C" || previous === "S"
                ? { x: 2 * current.x - control.x, y: 2 * current.y - control.y } : current
            const c2 = point(values[0], values[1])
            flattenCurve(current, [c1, c2], end, points)
            control = c2
        } else if (kind === "Q" || kind === "T") {
            const c = kind === "Q" ? point(values[0], values[1])
                : previous === "Q" || previous === "T"
                    ? { x: 2 * current.x - control.x, y: 2 * current.y - control.y } : current
            flattenCurve(current, [c], end, points)
            control = c
        } else if (kind === "A") {
            if (![values[3], values[4]].every(flag => flag === 0 || flag === 1)) {
                throw new Error("SVG arc flags must be 0 or 1")
            }
            flattenArc(current, values[0], values[1], values[2], values[3], values[4], end, points)
        } else {
            points.push(end)
        }
        current = end
        previous = kind
    }
    if (points.length > 1) paths.push({ points, closed: false })
    return paths
}

function extractTrack(svg) {
    if (/<(?:svg|path|g)\b[^>]*\btransform\s*=/i.test(svg)) {
        throw new Error("SVG transforms are not supported; flatten transforms before exporting")
    }
    const paths = []
    for (const match of svg.matchAll(/<path\b[^>]*>/gi)) {
        const data = /\bd\s*=\s*(["'])(.*?)\1/is.exec(match[0])
        if (data) paths.push(...parsePath(data[2]))
    }
    const closed = paths.filter(p => p.closed)
    if (!closed.length) throw new Error("SVG must contain a closed <path> centerline")
    const length = points => points.reduce((sum, p, i) => {
        const q = points[(i + 1) % points.length]
        return sum + Math.hypot(q.x - p.x, q.y - p.y)
    }, 0)
    return closed.sort((a, b) => length(b.points) - length(a.points))[0].points
}

function extractFinish(svg, track) {
    const attribute = (tag, name) => {
        const match = new RegExp(`\\b${name}\\s*=\\s*(["'])(.*?)\\1`, "is").exec(tag)
        return match?.[2]
    }
    const strokeStyle = style => /(?:^|;)\s*stroke\s*:\s*([^;]+)/i.exec(style)?.[1]?.trim().toLowerCase()
    const styles = new Map()
    for (const match of svg.matchAll(/\.([a-zA-Z_][\w-]*)\s*\{([^}]*)\}/g)) {
        styles.set(match[1], strokeStyle(match[2]))
    }
    const colored = { red: [], yellow: [] }
    for (const match of svg.matchAll(/<path\b[^>]*>/gi)) {
        const tag = match[0]
        let stroke = attribute(tag, "stroke")?.toLowerCase()
        for (const cls of (attribute(tag, "class") || "").split(/\s+/)) {
            stroke = styles.get(cls) || stroke
        }
        stroke = strokeStyle(attribute(tag, "style") || "") || stroke
        const color = ["red", "#f00", "#ff0000", "#ef4444"].includes(stroke) ? "red"
            : ["yellow", "#ff0", "#ffff00", "#fbbf24"].includes(stroke) ? "yellow" : undefined
        if (color) {
            const data = attribute(tag, "d")
            if (!data) throw new Error(`The ${color} path has no SVG path data`)
            colored[color].push(...parsePath(data))
        }
    }
    if (colored.red.length !== 1 || colored.yellow.length !== 1 ||
        colored.red[0].closed || colored.yellow[0].closed) {
        throw new Error("SVG must have one open red path and one open yellow path marking the finish")
    }
    const finish = colored.red[0].points[0]
    const yellowEnd = colored.yellow[0].points.at(-1)
    if (Math.hypot(finish.x - yellowEnd.x, finish.y - yellowEnd.y) > 2) {
        throw new Error("The yellow path must end where the red path starts")
    }
    let nearest = 0
    for (let i = 1; i < track.length; i++) {
        if (distanceSquared(finish, track[i], track[i]) <
            distanceSquared(finish, track[nearest], track[nearest])) nearest = i
    }
    if (Math.hypot(finish.x - track[nearest].x, finish.y - track[nearest].y) > 2) {
        throw new Error("The colored finish does not lie on the closed centerline")
    }
    const tangent = colored.red[0].points[1]
    if (!tangent) throw new Error("The red path needs a direction after the finish")
    const next = track[(nearest + 1) % track.length]
    let previous = track[(nearest - 1 + track.length) % track.length]
    if (distanceSquared(previous, track[nearest], track[nearest]) < 1e-10) {
        previous = track[(nearest - 2 + track.length) % track.length]
    }
    const heading = { x: tangent.x - finish.x, y: tangent.y - finish.y }
    const alignment = p => {
        const dx = p.x - track[nearest].x
        const dy = p.y - track[nearest].y
        return (heading.x * dx + heading.y * dy) / Math.hypot(dx, dy)
    }
    const forwardScore = alignment(next)
    const backwardScore = alignment(previous)
    if (!Number.isFinite(forwardScore) || !Number.isFinite(backwardScore) ||
        Math.abs(forwardScore - backwardScore) < 1e-8) {
        throw new Error("Cannot determine the red path's direction at the finish")
    }
    return { point: finish, forward: forwardScore > backwardScore }
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

function separateTrack(points, roadWidth) {
    const target = roadWidth + 2
    const n = points.length
    for (let iteration = 0; iteration < 300; iteration++) {
        const movement = points.map(() => ({ x: 0, y: 0 }))
        let violations = 0
        const lengths = points.map((p, i) => Math.hypot(
            points[(i + 1) % n].x - p.x, points[(i + 1) % n].y - p.y
        ))
        const cumulative = [0]
        for (const length of lengths) cumulative.push(cumulative.at(-1) + length)
        for (let i = 0; i < n; i++) {
            for (let j = i + 2; j < n; j++) {
                if (i === 0 && j === n - 1) continue
                const along = cumulative[j] - cumulative[i + 1]
                if (Math.min(along, cumulative[n] - along - lengths[i] - lengths[j]) < target) continue
                const hit = closestSegments(points[i], points[(i + 1) % n], points[j], points[(j + 1) % n])
                const distance = Math.sqrt(hit.squared)
                if (distance >= target - 0.02) continue
                violations++
                let nx = hit.x / distance
                let ny = hit.y / distance
                if (distance < 1e-6) {
                    const edge = points[(i + 1) % n]
                    nx = -(edge.y - points[i].y) / lengths[i]
                    ny = (edge.x - points[i].x) / lengths[i]
                }
                const correction = Math.min(0.4, (target - distance) * 0.2)
                for (const [index, weight, sign] of [
                    [i, 1 - hit.t, 1], [(i + 1) % n, hit.t, 1],
                    [j, 1 - hit.u, -1], [(j + 1) % n, hit.u, -1],
                ]) {
                    movement[index].x += nx * correction * weight * sign
                    movement[index].y += ny * correction * weight * sign
                }
            }
        }
        if (!violations) return points
        for (let i = 0; i < n; i++) {
            points[i] = {
                x: points[i].x + movement[i].x,
                y: points[i].y + movement[i].y,
            }
        }
    }
    throw new Error("Cannot fit a road with a clear gap; decrease --width or increase --size")
}

function snapDirections(points, divisions, roadWidth, finish, compact = false) {
    if (compact && divisions !== 16) throw new Error("Compact directions require --angles 16")
    if (!divisions) return points
    const step = 2 * Math.PI / divisions
    const vertices = points.slice()
    const compactAngles = [0, Math.atan(1 / 2), Math.PI / 4, Math.atan(2)]
    const direction = (a, b) => {
        const angle = Math.atan2(b.y - a.y, b.x - a.x)
        return ((Math.round(angle / step) % divisions) + divisions) % divisions
    }
    for (let attempt = 0; attempt < points.length - 2; attempt++) {
        for (let i = 0; vertices.length > 3 && i < vertices.length;) {
            const before = direction(vertices[i], vertices[(i + 1) % vertices.length])
            const after = direction(vertices[(i + 1) % vertices.length], vertices[(i + 2) % vertices.length])
            if (before === after) {
                vertices.splice((i + 1) % vertices.length, 1)
                i = Math.max(0, i - 1)
            } else i++
        }
        const lines = vertices.map((p, i) => {
            const q = vertices[(i + 1) % vertices.length]
            const index = direction(p, q)
            const angle = compact
                ? Math.floor(index / 4) * Math.PI / 2 + compactAngles[index % 4]
                : index * step
            const nx = -Math.sin(angle)
            const ny = Math.cos(angle)
            return { nx, ny, offset: nx * (p.x + q.x) / 2 + ny * (p.y + q.y) / 2, angle }
        })
        const intersections = () => lines.map((line, i) => {
            const prev = lines[(i + lines.length - 1) % lines.length]
            const determinant = prev.nx * line.ny - prev.ny * line.nx
            if (Math.abs(determinant) < 1e-8) {
                throw new Error("Cannot join opposite snapped directions; increase --angles")
            }
            return {
                x: (prev.offset * line.ny - line.offset * prev.ny) / determinant,
                y: (prev.nx * line.offset - line.nx * prev.offset) / determinant,
            }
        })
        let result = intersections()
        let collapsed = -1
        for (let i = 0; i < lines.length; i++) {
            const a = result[i]
            const b = result[(i + 1) % lines.length]
            const projection = (b.x - a.x) * Math.cos(lines[i].angle) +
                (b.y - a.y) * Math.sin(lines[i].angle)
            if (projection < 0.2) {
                collapsed = i
                break
            }
        }
        if (collapsed < 0) {
            if (roadWidth === undefined) return result
            let anchoredLine = -1
            if (finish) {
                let nearest = Infinity
                for (let i = 0; i < result.length; i++) {
                    const squared = distanceSquared(finish, result[i], result[(i + 1) % result.length])
                    if (squared < nearest) {
                        nearest = squared
                        anchoredLine = i
                    }
                }
                if (nearest > (roadWidth / 2 - 0.5) ** 2) {
                    const line = lines[anchoredLine]
                    line.offset = line.nx * finish.x + line.ny * finish.y
                    result = intersections()
                } else anchoredLine = -1
            }
            for (let iteration = 0; iteration < 40; iteration++) {
                const separated = separateTrack(result.map(p => ({ ...p })), roadWidth)
                const shift = Math.max(...separated.map((p, i) =>
                    Math.hypot(p.x - result[i].x, p.y - result[i].y)))
                if (shift < 0.03) return result
                for (let i = 0; i < lines.length; i++) {
                    if (i === anchoredLine) continue
                    const line = lines[i]
                    const next = separated[(i + 1) % lines.length]
                    const a = separated[i]
                    const offset = line.nx * (a.x + next.x) / 2 + line.ny * (a.y + next.y) / 2
                    line.offset += (offset - line.offset) * 0.6
                }
                result = intersections()
            }
            throw new Error("Cannot maintain track clearance with snapped angles; increase --angles")
        }
        if (vertices.length === 3) break
        vertices.splice((collapsed + 1) % vertices.length, 1)
    }
    throw new Error("Angle snapping collapses a track segment; increase --angles")
}

function collapseShortCorners(points, roadWidth, tolerance) {
    if (!tolerance) return points
    let vertices = points
    const clearance = roadWidth + 2
    const clear = candidate => {
        const lengths = candidate.map((p, i) => Math.hypot(
            candidate[(i + 1) % candidate.length].x - p.x,
            candidate[(i + 1) % candidate.length].y - p.y
        ))
        const cumulative = [0]
        for (const length of lengths) cumulative.push(cumulative.at(-1) + length)
        for (let i = 0; i < candidate.length; i++) {
            for (let j = i + 2; j < candidate.length; j++) {
                if (i === 0 && j === candidate.length - 1) continue
                const along = cumulative[j] - cumulative[i + 1]
                if (Math.min(along, cumulative.at(-1) - along - lengths[i] - lengths[j]) < clearance) continue
                if (closestSegments(candidate[i], candidate[(i + 1) % candidate.length],
                    candidate[j], candidate[(j + 1) % candidate.length]).squared < (clearance - 0.1) ** 2) {
                    return false
                }
            }
        }
        return true
    }
    for (let attempt = 0; attempt < points.length - 3; attempt++) {
        let merged = false
        for (let i = 0; i < vertices.length; i++) {
            const n = vertices.length
            const a = vertices[(i - 1 + n) % n]
            const b = vertices[i]
            const c = vertices[(i + 1) % n]
            const d = vertices[(i + 2) % n]
            if (Math.hypot(c.x - b.x, c.y - b.y) >= roadWidth) continue
            const u = { x: b.x - a.x, y: b.y - a.y }
            const v = { x: d.x - c.x, y: d.y - c.y }
            const determinant = u.x * v.y - u.y * v.x
            if (Math.abs(determinant) < 1e-8) continue
            const t = ((c.x - a.x) * v.y - (c.y - a.y) * v.x) / determinant
            const corner = { x: a.x + u.x * t, y: a.y + u.y * t }
            if (Math.max(Math.hypot(corner.x - b.x, corner.y - b.y),
                Math.hypot(corner.x - c.x, corner.y - c.y)) > tolerance ||
                Math.hypot(corner.x - a.x, corner.y - a.y) < 0.2 ||
                Math.hypot(d.x - corner.x, d.y - corner.y) < 0.2 ||
                (corner.x - a.x) * u.x + (corner.y - a.y) * u.y <= 0 ||
                (d.x - corner.x) * v.x + (d.y - corner.y) * v.y <= 0) continue
            const candidate = vertices.slice()
            if (i === n - 1) {
                candidate[0] = corner
                candidate.pop()
            } else candidate.splice(i, 2, corner)
            if (!clear(candidate)) continue
            vertices = candidate
            merged = true
            break
        }
        if (!merged) break
    }
    return vertices
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
    const terrain = Uint8Array.from(tiles, tile => palette[tile][4] & (1 << 8) ? 1 : 0)
    return { tiles, images: palette.map(maskImage), terrain }
}

function makeTilemap(svg, config) {
    if (config.tileset !== undefined && !["detailed", "compact"].includes(config.tileset)) {
        throw new Error("Tileset must be detailed or compact")
    }
    const track = extractTrack(svg)
    const finish = extractFinish(svg, track)
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
    if (points.length > 1 && distanceSquared(points.at(-1), points[0], points[0]) < 1e-10) points.pop()
    const simplified = simplifyLoop(points, config.simplify)
    if (simplified.length < 3) throw new Error("Simplification removed too much of the track; lower --simplify")
    if (config.tileset === "compact" && config.angles !== undefined && config.angles !== 16) {
        throw new Error("Compact tileset requires --angles 16")
    }
    const divisions = config.angles ?? (config.tileset === "compact" ? 16 : 32)
    const finishPoint = {
        x: (finish.point.x - minX) * scale + margin,
        y: (finish.point.y - minY) * scale + margin,
    }
    let centerlineVertices = snapDirections(separateTrack(simplified, config.width),
        divisions, config.width, finishPoint)
    if (config.tileset === "compact") {
        // Remove tight kinks before adjusting shallow angles so the hairpin retains its clearance.
        centerlineVertices = collapseShortCorners(centerlineVertices, config.width, config.simplify)
        centerlineVertices = snapDirections(centerlineVertices, divisions, config.width, finishPoint, true)
        centerlineVertices = collapseShortCorners(centerlineVertices, config.width, config.simplify)
    }
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
        throw new Error("Finish line moved off the road; increase --angles or lower --simplify")
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
        const desiredRadius = roadRadius * 3
        const safeRadius = side => {
            let grass = 0
            let leftRoad = false
            for (let distance = 1; distance <= desiredRadius; distance++) {
                const x = center.x + side * normal.x * distance
                const y = center.y + side * normal.y * distance
                if (x < 0.5 || y < 0.5 ||
                    x > map.width * 16 - 1.5 || y > map.height * 16 - 1.5) {
                    return distance - 1
                }
                if (roadAt(x, y)) {
                    if (leftRoad) return distance - 1
                    grass = 0
                } else if (++grass >= 2) {
                    leftRoad = true
                }
            }
            return desiredRadius
        }
        const safeLeft = safeRadius(-1)
        const safeRight = safeRadius(1)
        const sharedRadius = Math.min(desiredRadius, safeLeft, safeRight)
        const endpoint = side => {
            const safe = side < 0 ? safeLeft : safeRight
            const distance = Math.max(sharedRadius, Math.min(roadRadius, safe)) * side
            const x = Math.round(center.x + normal.x * distance)
            const y = Math.round(center.y + normal.y * distance)
            if (x < 0 || x > 65535 || y < 0 || y > 65535) {
                throw new Error("Gate pixel coordinates exceed UInt16; reduce --size")
            }
            return { x, y }
        }
        return { start: endpoint(-1), end: endpoint(1) }
    }
    const gates = []
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
    return gates
}

function gateHex(map) {
    const gates = makeGates(map)
    const data = Buffer.alloc(gates.length * 8)
    for (let i = 0; i < gates.length; i++) {
        data.writeUInt16LE(gates[i].start.x, i * 8)
        data.writeUInt16LE(gates[i].start.y, i * 8 + 2)
        data.writeUInt16LE(gates[i].end.x, i * 8 + 4)
        data.writeUInt16LE(gates[i].end.y, i * 8 + 6)
    }
    return data.toString("hex")
}

function formatTilemap(map) {
    const hex = tilemapHex(map)
    const images = map.images.map(image => `        img\`
            ${image.replaceAll("\n", "\n            ")}
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

// Each gate is start X/Y, end X/Y as UInt16LE pixels; wrap after the last gate.
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

function jresImage(image) {
    const bytes = Buffer.alloc(8 + 16 * 8)
    bytes[0] = 0x87
    bytes[1] = 4
    bytes.writeUInt16LE(16, 2)
    bytes.writeUInt16LE(16, 4)
    for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
            const color = Number.parseInt(image[y * 17 + x], 16)
            bytes[8 + x * 8 + (y >> 1)] |= color << ((y & 1) * 4)
        }
    }
    return bytes.toString("base64")
}

function withTrackContext(name, action) {
    try {
        return action()
    } catch (error) {
        throw new Error(`${name}: ${error.message}`, { cause: error })
    }
}

function formatBatch(entries, compact = true) {
    if (!entries.length) throw new Error("No SVG files found in tracks/")
    const transparent = Array.from({ length: 16 }, () => "0".repeat(16)).join("\n")
    const images = [transparent]
    const imageIndices = new Map([[transparent, 0]])
    const usedNames = new Set()
    const maps = entries.map(({ name, map }) => withTrackContext(name, () => {
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
        const tiles = Uint8Array.from(map.tiles, index => {
            return imageIndices.get(map.images[index])
        })
        return { id, name: path.parse(name).name.replace(/[_-]+/g, " "),
            file: name, map, hex: tilemapHex(map, tiles), gates: gateHex(map) }
    }))
    const names = images.map((image, i) =>
        i === 0 ? "transparency16" :
            compact ? compactTileNames[i - 1] :
                i === 1 ? "grass" : i === 2 ? "road" : `roadEdge${i - 2}`)
    const tileset = names.map(name => `myTiles.${name}`)
    const resources = {}
    images.forEach((image, i) => {
        resources[names[i]] = {
            data: jresImage(image), mimeType: "image/x-mkcd-f4", tilemapTile: true,
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
                tileset,
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
                \`, sharedTileset, TileScale.Sixteen);`
    }).join("\n")
    const tileFactories = names.map(name =>
        `            case ${JSON.stringify(name)}: return ${name};`).join("\n")
    const routes = maps.map(item =>
        `    //% whenUsed
    export const ${item.id} = hex\`${item.gates}\`;`).join("\n")
    const ts = `// Auto-generated code. Do not edit.
namespace myTiles {
${tileDeclarations}

    const sharedTileset = [${tileset.join(", ")}];
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

// Each gate is start X/Y, end X/Y as UInt16LE pixels; wrap after the last gate.
namespace trackWaypoints {
${routes}
}
// Auto-generated code. Do not edit.
`
    return { ts, jres: `${JSON.stringify(resources, null, 4)}\n` }
}

if (require.main === module) {
    try {
        const config = options(process.argv.slice(2))
        if (config.help) {
            console.log(usage)
        } else if (config.batch) {
            const tracks = fs.readdirSync(__dirname).filter(name => name.toLowerCase().endsWith(".svg")).sort()
            const entries = tracks.map(name => withTrackContext(name, () => ({
                name, map: makeTilemap(fs.readFileSync(path.join(__dirname, name), "utf8"), config),
            })))
            const output = formatBatch(entries, config.tileset === "compact")
            const directory = config.output || path.dirname(__dirname)
            fs.mkdirSync(directory, { recursive: true })
            fs.writeFileSync(path.join(directory, "tilemap.g.ts"), output.ts)
            fs.writeFileSync(path.join(directory, "tilemap.g.jres"), output.jres)
        } else {
            const svg = fs.readFileSync(config.input, "utf8")
            const output = formatTilemap(makeTilemap(svg, config))
            if (config.output) fs.writeFileSync(config.output, output)
            else process.stdout.write(output)
        }
    } catch (error) {
        console.error(`${path.basename(process.argv[1])}: ${error.message}\nRun with --help for usage.`)
        process.exitCode = 1
    }
}

module.exports = {
    parsePath, extractTrack, extractFinish, simplifyLoop, separateTrack, snapDirections,
    rasterizePixels, makeTilemap, makeWaypoints, makeGates, formatTilemap, formatBatch,
}
