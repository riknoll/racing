const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

const root = path.resolve(__dirname, "../..");

function intersection(a, b, c, d) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const ex = d.x - c.x;
    const ey = d.y - c.y;
    const denominator = dx * ey - dy * ex;
    if (!denominator) return null;
    const t = ((c.x - a.x) * ey - (c.y - a.y) * ex) / denominator;
    const u = ((c.x - a.x) * dy - (c.y - a.y) * dx) / denominator;
    return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? { x: a.x + t * dx, y: a.y + t * dy } : null;
}

function loadRacing(overrides = {}) {
    let controls = 0;
    class Sprite {
        constructor(image) {
            this.image = image;
            this.x = this.y = this.vx = this.vy = 0;
        }
        get left() { return this.x - 8; }
        get right() { return this.x + 8; }
        get top() { return this.y - 8; }
        get bottom() { return this.y + 8; }
        setImage(image) { this.image = image; }
        draw() {}
    }
    const scene = { tileMap: { data: {
        scale: 4, width: 100, height: 100,
        getTile: () => 0, getTileset: () => [{ getPixel: () => 1 }]
    } } };
    const context = vm.createContext({
        sprites: { ExtendableSprite: Sprite },
        util: { Point: class { constructor(x, y) { this.x = x; this.y = y; } } },
        mathUtils: {
            degreesToRadians: degrees => degrees * Math.PI / 180,
            clampRadians: angle => ((angle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI),
            lineIntersectsLine: intersection
        },
        NumberFormat: { UInt16LE: 0 },
        controller: Object.fromEntries(Object.entries({ A: 1, B: 2, left: 4, right: 8, down: 16, up: 32 })
            .map(([name, flag]) => [name, { isPressed: () => !!(controls & flag) }])),
        myTiles: { road: { getPixel: () => 1 } },
        game: { currentScene: () => scene },
        console,
        ...overrides
    });
    const source = ["racer.ts", "ai/track.ts", "ai/driver.ts", "ai/car.ts", "ai/visualization.ts"]
        .map(name => fs.readFileSync(path.join(root, name), "utf8")).join("\n");
    const output = ts.transpileModule(source, {
        compilerOptions: { target: ts.ScriptTarget.ES2017 }
    }).outputText;
    vm.runInContext(output, context, { filename: "racing-tests.js" });
    return {
        racing: context.racing,
        ai: context.aiRacing,
        context,
        scene,
        setControls: value => { controls = value; },
        makeCar: () => new context.aiRacing.LearningCar(new context.racing.RacerStats(100, 100, 100, 100, 100, 100), [{}]),
        makeBaseCar: () => new context.racing.Car(new context.racing.RacerStats(100, 100, 100, 100, 100, 100), [{}])
    };
}

function buffer(values) {
    const data = Buffer.alloc(values.length * 2);
    values.forEach((value, index) => data.writeUInt16LE(value, index * 2));
    return { length: data.length, getNumber: (_, offset) => data.readUInt16LE(offset) };
}

function loadMonaco(host) {
    const gates = fs.readFileSync(path.join(root, "tilemap.g.ts"), "utf8");
    const metadata = fs.readFileSync(path.join(root, "ai", "geometry.g.ts"), "utf8");
    const geometry = name => {
        const source = name === "trackWaypoints" ? gates : metadata;
        const block = source.match(new RegExp(`namespace ${name} \\{([\\s\\S]*?)\\n\\}`));
        if (!block) throw new Error(`Missing ${name} metadata`);
        return block[1];
    };
    const readBuffer = name => {
        const hex = geometry(name).match(/export const monaco = hex`([0-9a-f]+)`/)[1];
        const bytes = Buffer.from(hex, "hex");
        return { length: bytes.length, getNumber: (_, offset) => bytes.readUInt16LE(offset) };
    };
    const width = Number(geometry("trackRoadWidths").match(/export const monaco = (\d+)/)[1]);
    return new host.ai.Track(readBuffer("trackWaypoints"), readBuffer("trackCenterlines"), width);
}

module.exports = { root, loadRacing, buffer, loadMonaco };
