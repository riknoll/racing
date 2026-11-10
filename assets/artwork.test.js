const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const { stripTypeScriptTypes } = require("node:module")
const test = require("node:test")
const vm = require("node:vm")
const { readPng, indexed, crop, generate } = require("./create-assets")

const root = path.resolve(__dirname, "..")

class TestImage {
    constructor(width, height, pixels = new Uint8Array(width * height)) {
        this.width = width
        this.height = height
        this.pixels = pixels
    }
    getPixel(x, y) {
        return x >= 0 && x < this.width && y >= 0 && y < this.height ? this.pixels[y * this.width + x] : 0
    }
    setPixel(x, y, color) {
        if (x >= 0 && x < this.width && y >= 0 && y < this.height) this.pixels[y * this.width + x] = color
    }
    fill(color) { this.pixels.fill(color) }
    fillRect(x, y, width, height, color) {
        for (let dy = 0; dy < height; dy++) {
            for (let dx = 0; dx < width; dx++) this.setPixel(x + dx, y + dy, color)
        }
    }
    clone() { return new TestImage(this.width, this.height, this.pixels.slice()) }
    replace(from, to) { this.pixels = this.pixels.map(pixel => pixel === from ? to : pixel) }
    drawTransparentImage(image, x, y) {
        for (let dy = 0; dy < image.height; dy++) {
            for (let dx = 0; dx < image.width; dx++) {
                const color = image.getPixel(dx, dy)
                if (color) this.setPixel(x + dx, y + dy, color)
            }
        }
    }
}

function decode(resource) {
    const bytes = Buffer.from(resource.data, "base64")
    assert.equal(bytes.readUInt16LE(0), 0x0487)
    const width = bytes.readUInt16LE(2), height = bytes.readUInt16LE(4)
    const image = new TestImage(width, height)
    const stride = Math.ceil(height / 8) * 4
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            image.setPixel(x, y, bytes[8 + x * stride + (y >> 1)] >> ((y & 1) * 4) & 15)
        }
    }
    return image
}

function runTs(context, file, replace = source => source) {
    const source = replace(fs.readFileSync(path.join(root, file), "utf8"))
    vm.runInContext(stripTypeScriptTypes(source, { mode: "transform" }), context)
}

function loadArtwork(extra = {}) {
    const resources = JSON.parse(fs.readFileSync(path.join(root, "racing-art.g.jres"), "utf8"))
    const decodedAssets = Object.fromEntries(Object.entries(resources).filter(([name]) => name !== "*")
        .map(([name, value]) => [name, decode(value)]))
    const context = vm.createContext({
        decodedAssets,
        image: { create: (width, height) => new TestImage(width, height) },
        ...extra,
    })
    runTs(context, "racing-art.g.ts", source => source.replace(
        /export const (\w+) = image\.ofBuffer\(hex``\);/g, 'export const $1 = decodedAssets["$1"];'))
    runTs(context, "carImages.ts")
    Object.assign(context, { getCarFrames: context.racing.getCarFrames, colorMap: context.racing.colorMap })
    runTs(context, "race-lights.ts")
    return context
}

const load = name => indexed(readPng(path.join(__dirname, name)))

test("palette-swapped JRES cars reproduce every sheet pose and livery", () => {
    const { racing, racingArt } = loadArtwork()
    const sheet = load("F1racing-cars-sprite-sheet.png")
    const { resources } = generate()
    assert.ok(Object.keys(resources).filter(name => /^car(East|South|West|North)/.test(name)).length < 88)
    for (let color = 0; color < racing.colorMap.height; color++) {
        const frames = racing.getCarFrames(color)
        assert.equal(frames.length, 8)
        for (let frame = 0; frame < frames.length; frame++) {
            const expected = crop(sheet, color * 32, ((frame + 2) % 8) * 32, 32, 32)
            assert.deepEqual(frames[frame].pixels, expected.pixels, `livery ${color}, pose ${frame}`)
        }
    }
    const original = racingArt.carEast.pixels.slice()
    racing.getCarFrames(0)[0].setPixel(0, 0, 7)
    assert.deepEqual(racingArt.carEast.pixels, original, "even stock frames must be independent of resource images")
    assert.deepEqual(racing.getCarFrames(11)[0].pixels, racing.getCarFrames(0)[0].pixels)
})

test("one reusable lamp reproduces all six supplied light panels", () => {
    const { racing } = loadArtwork()
    for (let count = 0; count <= 5; count++) {
        const expected = load(`f1racing-lights${count + 1}.png`)
        assert.deepEqual(racing.createRaceLightImage(count).pixels, expected.pixels)
    }
    assert.throws(() => racing.createRaceLightImage(-1), /valid starting light count/)
    assert.throws(() => racing.createRaceLightImage(6), /valid starting light count/)
    assert.throws(() => racing.createRaceLightImage(1.5), /valid starting light count/)
    for (const [resource, source] of [["splash", "F1racing-splash-screen.png"], ["menuLogo", "small-logo.png"]]) {
        const context = loadArtwork()
        assert.deepEqual(context.racingArt[resource].pixels, load(source).pixels)
    }
})

test("race begins only when all five red lights extinguish together", () => {
    let now = 0, starts = 0, destroyedAt
    const frames = []
    const { racing } = loadArtwork({ pause: millis => { now += millis } })
    const sprite = {
        setImage(image) { frames.push({ time: now, red: image.pixels.filter(pixel => pixel === 2).length }) },
        destroy() { destroyedAt = now },
    }
    racing.animateRaceStartLights(sprite, () => false, () => {
        starts++
        assert.equal(now, 3000)
        assert.equal(frames.at(-1).red, 0)
    })
    assert.equal(starts, 1)
    assert.deepEqual(frames.map(frame => frame.red), [0, 112, 224, 336, 448, 560, 0])
    assert.deepEqual(frames.map(frame => frame.time), [0, 500, 1000, 1500, 2000, 2500, 3000])
    assert.equal(destroyedAt, 4000)
})

test("cancelling anywhere in the countdown cannot start a race", () => {
    for (const cancelAt of [0, 500, 1500, 3000]) {
        let now = 0, started = false, writes = 0
        const { racing } = loadArtwork({ pause: millis => { now += millis } })
        racing.animateRaceStartLights({ setImage() { writes++ } }, () => now >= cancelAt, () => { started = true })
        assert.equal(started, false, `cancel at ${cancelAt}`)
        assert.equal(writes, cancelAt / 500)
    }
})

test("sponsor badges rotate through eight poses without changing silhouettes or stock images", () => {
    const context = loadArtwork()
    runTs(context, "player-logo.ts")
    const { racing } = context
    const stock = racing.getCarFrames(0)
    const badge = new TestImage(8, 8, Uint8Array.from({ length: 64 }, (_, i) => i < 32 ? 11 : 13))
    racing.setPlayerLogo(badge)
    badge.pixels.fill(7)
    const frames = racing.getPlayerCarFrames()
    assert.equal(frames.length, 8)
    for (let frame = 0; frame < frames.length; frame++) {
        const top = [], bottom = []
        frames[frame].pixels.forEach((pixel, i) => {
            assert.equal(!!pixel, !!stock[frame].pixels[i], `silhouette, pose ${frame}`)
            if (pixel === 11) top.push([i % 32, Math.floor(i / 32)])
            if (pixel === 13) bottom.push([i % 32, Math.floor(i / 32)])
        })
        assert.ok(top.length && bottom.length, `badge visible, pose ${frame}`)
        const average = (points, axis) => points.reduce((sum, point) => sum + point[axis], 0) / points.length
        const dx = average(top, 0) - average(bottom, 0)
        const dy = average(top, 1) - average(bottom, 1)
        assert.ok(dx * Math.cos(frame * Math.PI / 4) + dy * Math.sin(frame * Math.PI / 4) > 0,
            `badge top faces forward, pose ${frame}`)
    }
    racing.setPlayerLogo(new TestImage(8, 8))
    racing.getPlayerCarFrames().forEach((frame, i) => assert.deepEqual(frame.pixels, stock[i].pixels))
    racing.getCarFrames(0).forEach((frame, i) => assert.deepEqual(frame.pixels, stock[i].pixels))
})

test("startup shows a one-second splash only once and keeps the main-menu script identity", () => {
    let now = 0, draws = 0, destroyedAt, depth = 0
    const menus = []
    const context = loadArtwork({
        img(strings) {
            const rows = strings[0].trim().split("\n").map(row => row.trim().split(/\s+/))
            return new TestImage(rows[0].length, rows.length,
                Uint8Array.from(rows.flat(), pixel => pixel === "." ? 0 : parseInt(pixel, 16)))
        },
        pause: millis => { now += millis },
        game: { pushScene() { depth++ }, popScene() { depth-- } },
        scene: { createRenderable(z, render) {
            render({ drawImage(picture, x, y) {
                assert.equal(picture.width, 160)
                assert.equal(picture.height, 120)
                assert.equal(x, 0)
                assert.equal(y, 0)
                draws++
            } })
            return { destroy() { destroyedAt = now } }
        } },
        configureMenuTest() {},
        chooseMenu(...args) { menus.push(args); return -1 },
        memoryMenuIcon() {},
        startMenuRaceBackground() {},
        aiRacing: { loadBots() {}, getTrainingDriver() {}, disposeActivity() {} },
    })
    runTs(context, "player-logo.ts")
    runTs(context, "startup.ts")
    context.racing.runGameMenu()
    context.racing.runGameMenu()
    assert.equal(draws, 1)
    assert.equal(destroyedAt, 1000)
    assert.equal(now, 1000)
    assert.equal(depth, 0)
    assert.equal(menus.length, 2)
    for (const args of menus) {
        assert.equal(args[0], "RACING")
        assert.deepEqual(Array.from(args[1]), ["Race", "Train AI", "View AI", "TUTORIAL"])
        assert.equal(args[6], context.racingArt.menuLogo)
        for (const index of [0, 1, 3]) {
            assert.equal(args[3][index].width, 17, "menu car icons stay compact")
            assert.equal(args[3][index].height, 17)
        }
        assert.notDeepEqual(args[3][0].pixels, args[3][1].pixels, "training retains its alternate car color")
    }
    runTs(context, "startup.ts", source => source.replace(
        "const DEBUG_TRACK_EDITOR = false;", "const DEBUG_TRACK_EDITOR = true;"))
    context.racing.runGameMenu()
    assert.deepEqual(Array.from(menus.at(-1)[1]), ["Race", "Train AI", "View AI", "TUTORIAL", "Track Editor"])
})

test("main-menu selection frame clips at both viewport edges while scrolling", () => {
    let menu, render
    const font = { lineHeight: 8, wordSpacing: 2 }
    const button = { isPressed: () => false }
    const icon = new TestImage(1, 1)
    const context = vm.createContext({
        Math: Object.assign(Object.create(Math), { idiv: (a, b) => Math.trunc(a / b) }),
        trackPreviewAnimations: { FRAME_SIZE: 40 },
        outlinedRacingFont: font,
        fancyText: { getTextWidth: (font, text) => text.length * 4, draw() {}, geometric_sans_7: font,
            twoToneColor: () => 1 },
        drivingControls: { up: icon, down: icon, a: icon },
        image: { create: (width, height) => new TestImage(width, height) },
        screen: { width: 160, height: 120 },
        SpriteFlag: {},
        sprites: { create(picture) {
            return { width: picture.width, height: picture.height, setFlag() {}, destroy() {},
                get left() { return this.x - this.width / 2 },
                get bottom() { return this.top + this.height } }
        } },
        game: { pushScene() {}, popScene() {} },
        scene: { createRenderable(z, callback) { render = callback; return { destroy() {} } } },
        scriptedMenuChoice() {},
        controller: { A: button, B: button, up: button, down: button, left: button, right: button },
        miniMenu: {
            MenuItem: class {
                constructor(text, icon) { this.text = text; this.icon = icon }
                getHeight() { return 24 }
            },
            MenuSprite: class {
                constructor() {
                    menu = this
                    this.defaultStyle = {}
                    this.selectedStyle = { margin: 0 }
                    this.selectedIndex = 0
                    this.yScroll = 0
                }
                setMenuItems(items) { this.items = items }
                setFlag() {}
            },
            Button: { A: "A" }, StyleKind: {}, StyleProperty: {}, MenuStyleProperty: {}, MoveDirection: {},
            createBorderBox() {}, unpackMargin: () => 1,
            setStyleProperty() {}, setMenuStyleProperty() {}, close() {},
            setDimensions(menu, width, height) { Object.assign(menu, { width, height }) },
            onButtonPressed(menu, button, callback) { if (button === "A") menu.onA = callback },
            setButtonEventsEnabled(menu, enabled) { if (enabled) menu.onA("", 0) },
        },
        drawRoundedBackground(target, left, top, width, height, color = 15) {
            target.fillRect(left + 2, top, width - 4, height, color)
            target.fillRect(left + 1, top + 1, width - 2, height - 2, color)
            target.fillRect(left, top + 2, width, height - 4, color)
        },
    })
    runTs(context, "menu.ts")
    context.racing.chooseMenu("RACING", ["Race", "Train AI", "View AI", "Tutorial", "Track Editor"],
        false, undefined, 0, () => () => {}, new TestImage(139, 22))
    menu.yScroll = 1000
    const baseline = new TestImage(160, 120)
    render(baseline)
    for (const [selectedIndex, yScroll] of [[0, 8.75], [4, 25.75], [1, 0], [0, 24], [4, 0]]) {
        Object.assign(menu, { selectedIndex, yScroll })
        const target = new TestImage(160, 120)
        render(target)
        const rowTop = menu.top + selectedIndex * 24 - (yScroll | 0)
        const rowBottom = rowTop + 23
        let changed = 0
        target.pixels.forEach((pixel, i) => {
            if (pixel === baseline.pixels[i]) return
            changed++
            const x = i % 160, y = Math.floor(i / 160)
            assert.ok(x >= menu.left && x < menu.left + menu.width)
            assert.ok(y >= menu.top && y < menu.top + menu.height, "frame must stay inside the menu viewport")
            assert.ok(y >= rowTop && y < rowBottom, "old frame pixels must be cleared")
        })
        const visible = rowBottom > menu.top && rowTop < menu.top + menu.height
        assert.equal(changed > 0, visible)
        if (visible && rowTop < menu.top) {
            assert.equal(target.getPixel(menu.left, menu.top), 9, "clip the frame instead of rounding its cropped edge")
        }
        if (visible && rowBottom > menu.top + menu.height) {
            assert.equal(target.getPixel(menu.left, menu.top + menu.height - 1), 9)
        }
    }
})
