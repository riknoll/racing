const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const { test } = require("node:test");
const { root } = require("./test-host");

test("training has no wide HUD bars, preserves camera look-ahead, and hides instruments during dialogs", () => {
    const text = fs.readFileSync(path.join(root, "ai", "activity.ts"), "utf8");
    const source = ts.createSourceFile("activity.ts", text, ts.ScriptTarget.Latest, true);
    const functions = [];
    function visit(node) {
        if (ts.isFunctionDeclaration(node) && ["initialize", "showMessage"].includes(node.name.text)) functions.push(node.getText(source));
        ts.forEachChild(node, visit);
    }
    visit(source);
    const renderables = [];
    const updates = [];
    const rectangles = [];
    const prints = [];
    const visibility = [];
    const camera = [];
    const target = {
        width: 160,
        fillRect: (x, y, width, height) => rectangles.push({ x, y, width, height }),
        print: (text, x, y, color, font) => prints.push({ text, x, y, font })
    };
    const context = vm.createContext({
        initialized: false, showingMessage: false, status: "TEACH",
        watchedCar: { x: 100, y: 200, heading: 0, currentLap: 1, elapsedMillis: 1234, paused: false },
        drivingDisplay: { update: (...args) => updates.push(args), setVisible: value => visibility.push(value) },
        image: { font8: { charWidth: 6, charHeight: 8 } },
        tiles: { setCurrentTilemap: () => {} },
        racing: { generateBackground: () => ({}), skipTestPrompts: () => false },
        scroller: { CameraScrollMode: { BothDirections: 0 }, scrollBackgroundWithCamera: () => {} },
        scene: {
            createRenderable: (_, handler) => renderables.push(handler),
            setBackgroundImage: () => {},
            centerCameraAt: (...args) => camera.push(args)
        },
        DialogLayout: { Full: 0 },
        game: {
            onUpdate: handler => { context.frameUpdate = handler; },
            showLongText: () => {
                assert.equal(context.showingMessage, true);
                assert.equal(visibility.at(-1), false);
                renderables.forEach(handler => handler(target, {}));
                assert.equal(prints.length, 0);
            }
        }
    });
    vm.runInContext(ts.transpileModule(functions.join("\n"), {
        compilerOptions: { target: ts.ScriptTarget.ES2017 }
    }).outputText, context);
    context.initialize({ tilemap: {}, createTrack: () => ({}) });
    context.frameUpdate();
    assert.deepEqual(camera[0], [130, 200]);
    assert.deepEqual(updates[0], [1234, 1, false]);
    renderables.forEach(handler => handler(target, {}));
    assert.equal(prints.length, 0, "the driving scene should only use shared instruments");
    context.status = "READY";
    renderables.forEach(handler => handler(target, {}));
    assert.equal(prints[0].text, "A: start teaching");
    assert(prints[0].x + prints[0].text.length * prints[0].font.charWidth <= 160);
    assert(rectangles.every(rect => rect.width < 160));
    prints.length = 0;
    context.showMessage("Instructions");
    assert.deepEqual(visibility, [false, true]);
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
