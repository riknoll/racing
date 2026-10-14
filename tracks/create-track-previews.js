#!/usr/bin/env node
const fs = require("node:fs")
const path = require("node:path")
const { encodeImage } = require("./create-tilemap")

const root = path.resolve(__dirname, "..")
const size = 72
const padding = 4
const frameSize = size + padding * 2
const dilation = 6
const frameCount = 8
const interval = 50
const vectors = { N: [0, -1], E: [1, 0], S: [0, 1], W: [-1, 0],
    NE: [1, -1], NW: [-1, -1], SE: [1, 1], SW: [-1, 1] }
const read = file => fs.readFileSync(path.join(root, file), "utf8")

function readCourses() {
    const source = read("courses.ts")
    const geometry = read("ai/geometry.g.ts")
    const training = read("ai/training-track.g.ts")
    const constructor = /new Course\(\s*(Track\.(\w+)|undefined)\s*,\s*("(?:[^"\\]|\\.)*")\s*,\s*(?:tilemap`[^`]+`|aiRacing\.getTestTrackMap\(\))\s*,\s*[\w.]+\s*,\s*([\w.]+)\s*,\s*([\w.]+)\s*,\s*(\[[^\]]*\])\s*(?:,\s*(\d+)\s*)?(?:,\s*PreviewScrollDirection\.(\w+)\s*)?\)/g
    const courses = [...source.matchAll(constructor)].map(match => {
        const [, , track, name, centerSymbol, widthSymbol, colors, pattern, direction] = match
        const symbol = centerSymbol.split(".").at(-1)
        const data = centerSymbol.startsWith("aiRacing.") ? training : geometry
        const centerMatch = data.match(new RegExp(`export const ${symbol}(?:\\s*:\\s*Buffer)?\\s*=\\s*hex\`([\\da-f\\s]+)\``, "i"))
        const widthName = widthSymbol.split(".").at(-1)
        const widthMatch = data.match(new RegExp(`export const ${widthName}(?:\\s*:\\s*number)?\\s*=\\s*(\\d+)\\s*;`))
        if (!centerMatch || !widthMatch) throw new Error(`Cannot read geometry for ${name}`)
        const centers = Buffer.from(centerMatch[1].replace(/\s/g, ""), "hex")
        if (centers.length < 12 || centers.length % 4) throw new Error(`Invalid centerline for ${name}`)
        const points = []
        for (let i = 0; i < centers.length; i += 4) {
            points.push({ x: centers.readUInt16LE(i), y: centers.readUInt16LE(i + 2) })
        }
        const course = { id: track ? symbol : "testtrack", track, name: JSON.parse(name),
            colors: JSON.parse(colors), pattern: Number(pattern || 0), direction: direction || "N",
            roadWidth: Number(widthMatch[1]), centers: centers.toString("hex"), points }
        if (!vectors[course.direction] || !course.roadWidth || course.colors.length !== 3 ||
            course.colors.some(color => !Number.isInteger(color) || color < 0 || color > 15)) {
            throw new Error(`Invalid preview settings for ${course.name}`)
        }
        return course
    })
    if (!courses.length || courses.length !== (source.match(/new Course\s*\(/g) || []).length) {
        throw new Error("Cannot read every Course constructor; preview settings must use literal colors, pattern indices and directions")
    }
    if (new Set(courses.map(course => course.id)).size !== courses.length) throw new Error("Duplicate preview resource names")
    return courses
}

function readPatterns() {
    const source = read("ui.ts")
    const start = source.indexOf("export let patterns")
    if (start < 0) throw new Error("Cannot find UI patterns")
    return [...source.slice(start).matchAll(/img`([^`]+)`/g)].map(match => {
        const rows = match[1].trim().split("\n").map(row => row.trim().split(/\s+/))
        if (rows.length !== 8 || rows.some(row => row.length !== 8 || row.some(pixel => !/^[.0-9a-f]$/i.test(pixel)))) {
            throw new Error("Preview patterns must be 8x8 images")
        }
        return rows.flat().map(pixel => pixel !== "." && pixel !== "0" ? 1 : 0)
    })
}

function bitmap(width, height) {
    return { width, height, pixels: new Uint8Array(width * height) }
}

function get(image, x, y) {
    return x >= 0 && y >= 0 && x < image.width && y < image.height ? image.pixels[y * image.width + x] : 0
}

function set(image, x, y, color) {
    if (x >= 0 && y >= 0 && x < image.width && y < image.height) image.pixels[y * image.width + x] = color
}

function circle(image, cx, cy, radius) {
    let x = radius - 1, y = 0, dx = 1, dy = 1, error = 1 - radius * 2
    while (x >= y) {
        for (let row = cy - y; row <= cy + y; row++) {
            set(image, cx + x, row, 1)
            set(image, cx - x, row, 1)
        }
        for (let row = cy - x; row <= cy + x; row++) {
            set(image, cx + y, row, 1)
            set(image, cx - y, row, 1)
        }
        if (error <= 0) { y++; error += dy; dy += 2 }
        else { x--; dx += 2; error += dx - radius * 2 }
    }
}

function thickLine(image, start, end, radius) {
    const angle = Math.atan2(end.y - start.y, end.x - start.x) - Math.PI / 2
    const ox = Math.cos(angle) * radius, oy = Math.sin(angle) * radius
    const points = [[start.x + ox, start.y + oy], [start.x - ox, start.y - oy],
        [end.x - ox, end.y - oy], [end.x + ox, end.y + oy]].map(point => point.map(Math.trunc))
    const ranges = new Map()
    for (let i = 0; i < points.length; i++) {
        let [x, y] = points[i]
        const [endX, endY] = points[(i + 1) % points.length]
        const dx = Math.abs(endX - x), dy = -Math.abs(endY - y)
        const sx = x < endX ? 1 : -1, sy = y < endY ? 1 : -1
        let error = dx + dy
        while (true) {
            const range = ranges.get(x) || [y, y]
            range[0] = Math.min(range[0], y)
            range[1] = Math.max(range[1], y)
            ranges.set(x, range)
            if (x === endX && y === endY) break
            const twice = error * 2
            if (twice >= dy) { error += dy; x += sx }
            if (twice <= dx) { error += dx; y += sy }
        }
    }
    for (const [x, [minY, maxY]] of ranges) {
        for (let y = minY; y <= maxY; y++) set(image, x, y, 1)
    }
}

function createFrames(course, pattern) {
    if (!pattern) throw new Error(`Invalid pattern index for ${course.name}`)
    let seed = [...course.id].reduce((hash, char) => (Math.imul(hash, 31) + char.charCodeAt(0)) >>> 0, 1)
    const jitter = () => {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
        return (seed % 3 - 1) * 0.5
    }
    const minX = Math.min(...course.points.map(point => point.x))
    const maxX = Math.max(...course.points.map(point => point.x))
    const minY = Math.min(...course.points.map(point => point.y))
    const maxY = Math.max(...course.points.map(point => point.y))
    const scale = (size - 8) / Math.max(maxX - minX + course.roadWidth, maxY - minY + course.roadWidth)
    const left = (size - 1 - (maxX - minX) * scale) / 2
    const top = (size - 1 - (maxY - minY) * scale) / 2
    const radius = Math.max(1, Math.round(course.roadWidth * scale / 4))
    const poses = Array.from({ length: 4 }, () => course.points.map(point => ({
        x: left + (point.x - minX) * scale + jitter(),
        y: top + (point.y - minY) * scale + jitter(),
    })))
    const [scrollX, scrollY] = vectors[course.direction]
    return Array.from({ length: frameCount }, (_, frame) => {
        const points = poses[Math.floor(frame / 2)]
        const road = bitmap(size, size)
        points.forEach((point, i) => {
            thickLine(road, point, points[(i + 1) % points.length], radius)
            circle(road, Math.round(point.x), Math.round(point.y), radius)
        })
        const background = bitmap(frameSize, frameSize)
        for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
            if (get(road, x, y)) circle(background, x + padding, y + padding, dilation)
        }
        const picture = bitmap(frameSize, frameSize)
        for (let y = 0; y < frameSize; y++) for (let x = 0; x < frameSize; x++) {
            if (!get(background, x, y)) continue
            const px = ((x - padding - scrollX * frame) % 8 + 8) % 8
            const py = ((y - padding - scrollY * frame) % 8 + 8) % 8
            set(picture, x, y, pattern[py * 8 + px] ? course.colors[0] : course.colors[1])
        }
        for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
            if (!get(road, x, y)) continue
            set(picture, x + padding, y + padding, course.colors[2])
            for (let ny = Math.max(0, y - 1); ny <= Math.min(size - 1, y + 1); ny++) {
                for (let nx = Math.max(0, x - 1); nx <= Math.min(size - 1, x + 1); nx++) {
                    if (!get(road, nx, ny)) set(picture, nx + padding, ny + padding, course.colors[0])
                }
            }
        }
        return picture.pixels
    })
}

function encodeAnimation(frames) {
    const length = frameSize * frameSize / 2
    const bytes = Buffer.alloc(8 + frames.length * length)
    ;[interval, frameSize, frameSize, frames.length].forEach((value, i) => bytes.writeUInt16LE(value, i * 2))
    frames.forEach((pixels, frame) => {
        for (let i = 0; i < pixels.length; i++) bytes[8 + frame * length + (i >> 1)] |= pixels[i] << ((i & 1) * 4)
    })
    return Buffer.from(bytes.toString("hex")).toString("base64")
}

function generate() {
    const courses = readCourses(), patterns = readPatterns(), resources = {}, declarations = []
    for (const course of courses) {
        const frames = createFrames(course, patterns[course.pattern])
        frames.forEach((pixels, frame) => {
            const id = course.id + frame
            resources[id] = { data: encodeImage(pixels, frameSize, frameSize).toString("base64"), mimeType: "image/x-mkcd-f4" }
            declarations.push(`    //% fixedInstance jres blockIdentity=images._image\n    export const ${id} = image.ofBuffer(hex\`\`);`)
        })
        resources[course.id] = { namespace: "trackPreviewAnimations", mimeType: "application/mkcd-animation",
            data: encodeAnimation(frames), displayName: course.name + " preview" }
    }
    resources["*"] = { mimeType: "image/x-mkcd-f4", dataEncoding: "base64", namespace: "trackPreviewFrames" }
    const cases = courses.map(course => `            case ${JSON.stringify(course.id)}:\n            case ${JSON.stringify(course.name + " preview")}:\n                return [${Array.from({ length: frameCount }, (_, frame) => `trackPreviewFrames.${course.id}${frame}`).join(", ")}];`).join("\n")
    const routes = courses.map(course => {
        const condition = course.track ? `course.trackId === racing.Track.${course.track}` : `course.trackId === undefined && course.name === ${JSON.stringify(course.name)}`
        return `        if (${condition}) {
            checkSettings(course, [${course.colors.join(", ")}], ${course.pattern}, racing.PreviewScrollDirection.${course.direction}, ${JSON.stringify(course.centers)}, ${course.roadWidth});
            return getAnimation(${JSON.stringify(course.id)});
        }`
    }).join("\n")
    const source = `// Auto-generated by node tracks/create-track-previews.js. Do not edit.
namespace trackPreviewFrames {
${declarations.join("\n")}
}

namespace trackPreviewAnimations {
    export const FRAME_SIZE = ${frameSize};
    export const FRAME_COUNT = ${frameCount};
    export const INTERVAL = ${interval};

    export function forCourse(course: racing.Course): Image[] {
${routes}
        throw "No compiled preview for " + course.name + "; regenerate track previews";
    }

    function checkSettings(course: racing.Course, colors: number[], pattern: number, direction: racing.PreviewScrollDirection, centers: string, roadWidth: number): void {
        if (course.patternIndex !== pattern || course.patternScrollDirection !== direction
            || course.roadWidth !== roadWidth || course.centers.toHex() !== centers
            || course.previewColors.length !== 3 || colors.some((color, i) => course.previewColors[i] !== color)) {
            throw "Preview settings changed for " + course.name + "; run node tracks/create-track-previews.js";
        }
    }

    function getAnimation(name: string): Image[] {
        switch (helpers.stringTrim(name)) {
${cases}
        }
        return null;
    }

    helpers._registerFactory("animation", getAnimation);
}
`
    return { "track-previews.g.jres": JSON.stringify(resources, null, 4) + "\n", "track-previews.g.ts": source }
}

if (require.main === module) {
    try {
        const args = process.argv.slice(2)
        if (args.includes("--help")) {
            console.log("Usage: node tracks/create-track-previews.js [--check]\nRegenerate compiled preview images and animations from courses.ts, UI patterns and track geometry.")
        } else {
            if (args.some(arg => arg !== "--check")) throw new Error("Unknown option; use --help")
            for (const [file, content] of Object.entries(generate())) {
                const target = path.join(root, file)
                if (args.includes("--check")) {
                    if (!fs.existsSync(target) || fs.readFileSync(target, "utf8") !== content) {
                        throw new Error(`${file} is stale; run node tracks/create-track-previews.js`)
                    }
                } else fs.writeFileSync(target, content)
            }
            console.log(args.includes("--check") ? "Track previews are up to date" : "Generated track-previews.g.jres and track-previews.g.ts")
        }
    } catch (error) {
        console.error(`create-track-previews.js: ${error.message}`)
        process.exitCode = 1
    }
}

module.exports = { generate }
