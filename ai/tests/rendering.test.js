const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const { test } = require("node:test");
const { root } = require("./test-host");

test("HUD lines fit the screen and overlays are hidden throughout a dialog", () => {
    const text = fs.readFileSync(path.join(root, "ai", "activity.ts"), "utf8");
    const source = ts.createSourceFile("activity.ts", text, ts.ScriptTarget.Latest, true);
    const functions = [];
    const names = ["initialize", "showMessage"];
    function visit(node) {
        if (ts.isFunctionDeclaration(node) && names.includes(node.name.text)) functions.push(node.getText(source));
        ts.forEachChild(node, visit);
    }
    visit(source);
    assert.equal(functions.length, names.length);
    const renderables = [];
    const prints = [];
    let gateDraws = 0;
    const target = { width: 160, fillRect: () => {}, print: (text, x, y, color, font) => prints.push({ text, x, y, font }) };
    const context = vm.createContext({
        initialized: false, showingMessage: false,
        watchedCar: { currentGateIndex: 0, completedGates: 49, elapsedMillis: 239999 },
        status: "TEACH", driver: { count: () => 2400 },
        image: { font5: { charWidth: 6, charHeight: 5 } },
        Track: class { constructor() { this.gates = Array(50).fill({ start: {}, end: {} }); } },
        trackWaypoints: {}, trackCenterlines: {}, trackRoadWidths: {},
        tilemap: () => {}, tiles: { setCurrentTilemap: () => {} },
        racing: { generateBackground: () => ({}) },
        scroller: { CameraScrollMode: { BothDirections: 0 }, scrollBackgroundWithCamera: () => {} },
        scene: { createRenderable: (_, handler) => renderables.push(handler), setBackgroundImage: () => {} },
        drawing: { shiftedByCamera: point => point, drawThickLine: () => gateDraws++ },
        DialogLayout: { Full: 0 },
        game: { showLongText: () => {
            assert.equal(context.showingMessage, true);
            renderables.forEach(handler => handler(target, {}));
            assert.equal(prints.length, 0);
            assert.equal(gateDraws, 0);
        } }
    });
    vm.runInContext(ts.transpileModule(functions.join("\n"), {
        compilerOptions: { target: ts.ScriptTarget.ES2017 }
    }).outputText, context);
    context.initialize();
    for (const status of ["READY", "TEACH", "AI", "FINISHED"]) {
        context.status = status;
        prints.length = 0;
        renderables[1](target, {});
        assert.equal(prints.length, 2);
        assert(prints[0].y + prints[0].font.charHeight < prints[1].y);
        for (const line of prints) assert(line.x + line.text.length * line.font.charWidth <= target.width);
    }
    prints.length = 0;
    context.showMessage("Teaching instructions");
    assert.equal(context.showingMessage, false);
});

test("dialog copy avoids consecutive newlines that overlap in the shipped dialog paginator", () => {
    function visit(node) {
        if (ts.isStringLiteral(node)) assert(!node.text.includes("\n\n"));
        ts.forEachChild(node, visit);
    }
    for (const name of ["activity.ts", "visualization.ts"]) {
        visit(ts.createSourceFile(name, fs.readFileSync(path.join(root, "ai", name), "utf8"), ts.ScriptTarget.Latest, true));
    }
});
