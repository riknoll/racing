#!/usr/bin/env node
const fs = require("node:fs")
const path = require("node:path")
const zlib = require("node:zlib")
const { encodeImage } = require("../tracks/create-tilemap")

const root = path.resolve(__dirname, "..")
const palette = [
    "#000000", "#ffffff", "#ff2121", "#ff93c4", "#ff8135", "#fff609", "#249ca3", "#78dc52",
    "#003fad", "#87f2ff", "#8e2ec4", "#a4839f", "#5c406c", "#e5cdc4", "#91463d", "#000000",
].map(hex => [1, 3, 5].map(offset => parseInt(hex.slice(offset, offset + 2), 16)))

function readPng(file) {
    const bytes = fs.readFileSync(file)
    if (!bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
        throw new Error(`${file}: Not a PNG image`)
    }
    let width, height
    const chunks = []
    let ended = false
    for (let offset = 8; offset + 12 <= bytes.length;) {
        const length = bytes.readUInt32BE(offset)
        const type = bytes.toString("ascii", offset + 4, offset + 8)
        if (offset + length + 12 > bytes.length) throw new Error(`${file}: Truncated PNG chunk`)
        const data = bytes.subarray(offset + 8, offset + 8 + length)
        if (type === "IHDR") {
            if (length !== 13 || data[8] !== 8 || data[9] !== 6 || data[10] || data[11] || data[12]) {
                throw new Error(`${file}: Export a non-interlaced, 8-bit RGBA PNG`)
            }
            width = data.readUInt32BE(0)
            height = data.readUInt32BE(4)
        } else if (type === "IDAT") chunks.push(data)
        else if (type === "IEND") ended = true
        offset += length + 12
    }
    if (!ended || !width || !height || width * height > 1000000) throw new Error(`${file}: Invalid PNG dimensions or data`)
    const raw = zlib.inflateSync(Buffer.concat(chunks), { maxOutputLength: height * (width * 4 + 1) })
    const stride = width * 4
    if (raw.length !== height * (stride + 1)) throw new Error(`${file}: Invalid PNG scanlines`)
    const pixels = Buffer.alloc(width * height * 4)
    for (let y = 0; y < height; y++) {
        const filter = raw[y * (stride + 1)]
        if (filter > 4) throw new Error(`${file}: Unsupported PNG filter ${filter}`)
        for (let x = 0; x < stride; x++) {
            const left = x >= 4 ? pixels[y * stride + x - 4] : 0
            const up = y ? pixels[(y - 1) * stride + x] : 0
            const upperLeft = y && x >= 4 ? pixels[(y - 1) * stride + x - 4] : 0
            const estimate = left + up - upperLeft
            const distances = [Math.abs(estimate - left), Math.abs(estimate - up), Math.abs(estimate - upperLeft)]
            const paeth = distances[0] <= distances[1] && distances[0] <= distances[2] ? left
                : distances[1] <= distances[2] ? up : upperLeft
            const prediction = [0, left, up, Math.floor((left + up) / 2), paeth][filter]
            pixels[y * stride + x] = raw[y * (stride + 1) + x + 1] + prediction
        }
    }
    return { width, height, pixels }
}

function indexed(image) {
    const pixels = new Uint8Array(image.width * image.height)
    for (let i = 0; i < pixels.length; i++) {
        const rgba = image.pixels.subarray(i * 4, i * 4 + 4)
        if (!rgba[3]) continue
        if (rgba[3] !== 255) throw new Error("Artwork must have fully transparent or fully opaque pixels")
        let best = 1, distance = Infinity
        for (let color = 1; color < palette.length; color++) {
            const error = palette[color].reduce((sum, channel, j) => sum + (rgba[j] - channel) ** 2, 0)
            if (error < distance) {
                best = color
                distance = error
            }
        }
        pixels[i] = best
    }
    return { width: image.width, height: image.height, pixels }
}

function crop(image, x, y, width, height) {
    if (x < 0 || y < 0 || x + width > image.width || y + height > image.height) {
        throw new Error("Image crop exceeds source dimensions")
    }
    const pixels = new Uint8Array(width * height)
    for (let row = 0; row < height; row++) {
        pixels.set(image.pixels.subarray((y + row) * image.width + x, (y + row) * image.width + x + width), row * width)
    }
    return { width, height, pixels }
}

function generate() {
    const resources = {}, declarations = []
    function add(name, image) {
        resources[name] = { mimeType: "image/x-mkcd-f4",
            data: encodeImage(image.pixels, image.width, image.height).toString("base64") }
        declarations.push(`    //% fixedInstance jres blockIdentity=images._image\n    export const ${name} = image.ofBuffer(hex\`\`);`)
    }
    const load = name => indexed(readPng(path.join(__dirname, name)))
    const sheet = load("F1racing-cars-sprite-sheet.png")
    if (sheet.width !== 352 || sheet.height !== 256) throw new Error("Expected eleven columns of eight 32x32 car poses")
    const colors = [[2, 10], [4, 2], [5, 4], [7, 6], [6, 8], [9, 6],
        [10, 12], [3, 10], [1, 13], [14, 12], [15, 8]]
    const directions = ["East", "Southeast", "South", "Southwest", "West", "Northwest", "North", "Northeast"]
    const shapes = directions.map(() => [])
    const cars = colors.map(([body, shadow], column) => directions.map((direction, frame) => {
        const source = crop(sheet, column * 32, ((frame + 2) % 8) * 32, 32, 32)
        const matches = candidate => candidate.pixels.every((pixel, i) =>
            (pixel === 2 ? body : pixel === 10 ? shadow : pixel) === source.pixels[i])
        let shape = shapes[frame].find(matches)
        if (!shape) {
            const pixels = source.pixels.map(pixel => pixel === body ? 2 : pixel === shadow ? 10 : pixel)
            shape = { ...source, pixels, name: "car" + direction + (shapes[frame].length || "") }
            if (!matches(shape)) throw new Error(`Cannot remap car livery ${column}, pose ${frame}`)
            shapes[frame].push(shape)
            add(shape.name, shape)
        }
        return shape.name
    }))
    add("carColors", { width: 2, height: colors.length, pixels: Uint8Array.from(colors.flat()) })

    const mercedesSheet = load("Mercedes-car-sprite-sheet.png")
    if (mercedesSheet.width !== 32 || mercedesSheet.height !== 256) throw new Error("Expected eight 32x32 Mercedes car poses")
    const mercedes = directions.map((direction, frame) => {
        const source = crop(mercedesSheet, 0, ((frame + 2) % 8) * 32, 32, 32)
        const pixels = source.pixels.map(pixel => pixel === 1 ? 2 : pixel === 6 ? 10 : pixel)
        const name = "mercedes" + direction
        add(name, { ...source, pixels })
        return name
    })
    add("mercedesPreview", crop(mercedesSheet, 0, 64, 32, 32))

    const lights = load("f1racing-lights1.png")
    add("startLights", lights)
    const firstLit = load("f1racing-lights2.png")
    const red = Uint8Array.from(firstLit.pixels, (pixel, i) => pixel !== lights.pixels[i] ? pixel : 0)
    const xs = [], ys = []
    red.forEach((pixel, i) => {
        if (pixel) { xs.push(i % lights.width); ys.push(Math.floor(i / lights.width)) }
    })
    if (!xs.length) throw new Error("No red lamp found in f1racing-lights2.png")
    const x = Math.min(...xs), y = Math.min(...ys)
    const lamp = crop({ ...lights, pixels: red }, x, y, Math.max(...xs) - x + 1, Math.max(...ys) - y + 1)
    add("redLamp", lamp)
    const positions = [x, x + 18, x + 36, x + 54, x + 72]
    for (let count = 1; count <= positions.length; count++) {
        const reference = load(`f1racing-lights${count + 1}.png`)
        const composed = lights.pixels.slice()
        for (const left of positions.slice(0, count)) {
            lamp.pixels.forEach((pixel, i) => {
                if (pixel) composed[(y + Math.floor(i / lamp.width)) * lights.width + left + i % lamp.width] = pixel
            })
        }
        if (reference.width !== lights.width || reference.height !== lights.height
            || !composed.every((pixel, i) => pixel === reference.pixels[i])) {
            throw new Error(`Composed starting lights do not match frame ${count + 1}`)
        }
    }
    add("splash", load("F1racing-splash-screen.png"))
    add("menuLogo", load("small-logo.png"))
    resources["*"] = { mimeType: "image/x-mkcd-f4", dataEncoding: "base64", namespace: "racingArt" }
    const cases = cars.map((frames, color) =>
        `            case ${color}: return [${frames.join(", ")}];`).join("\n")
    return {
        resources,
        cars,
        colors,
        ts: `// Generated by node assets/create-assets.js. Do not edit.
namespace racingArt {
${declarations.join("\n")}

    export const lightPositions: number[] = [${positions.join(", ")}];
    export const lightY = ${y};

    export function carFrames(colorIndex: number): Image[] {
        switch (colorIndex) {
${cases}
            default: throw "Choose a valid racing car color";
        }
    }

    export function mercedesCarFrames(): Image[] {
        return [${mercedes.join(", ")}];
    }
}
`,
    }
}

if (require.main === module) {
    try {
        const args = process.argv.slice(2)
        if (args.some(arg => arg !== "--check")) throw new Error("Usage: node assets/create-assets.js [--check]")
        const output = generate()
        const files = { "racing-art.g.jres": JSON.stringify(output.resources, null, 4) + "\n", "racing-art.g.ts": output.ts }
        for (const [name, content] of Object.entries(files)) {
            const file = path.join(root, name)
            if (args.includes("--check")) {
                if (!fs.existsSync(file) || fs.readFileSync(file, "utf8") !== content) {
                    throw new Error(`${name} is stale; run node assets/create-assets.js`)
                }
            } else fs.writeFileSync(file, content)
        }
        console.log(args.includes("--check") ? "Racing artwork is up to date" : "Generated racing-art.g.ts and racing-art.g.jres")
    } catch (error) {
        console.error(error.message)
        process.exitCode = 1
    }
}

module.exports = { readPng, indexed, crop, palette, generate }
