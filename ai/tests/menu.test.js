const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const { test } = require("node:test");
const { root } = require("./test-host");

function menuHost(buttons = []) {
    let tick = 0;
    const drawings = [];
    let scenes = 0;
    const context = vm.createContext({
        image: {
            font5: { charWidth: 6, charHeight: 5 },
            font8: { charWidth: 6, charHeight: 8 },
            scaledFont: (font, scale) => ({ charWidth: font.charWidth * scale, charHeight: font.charHeight * scale }),
            create: () => ({
                fill: () => {},
                fillRect: (x, y, width, height) => drawings.push({ x, y, width, height }),
                drawRect: (x, y, width, height) => drawings.push({ x, y, width, height }),
                setPixel: () => {},
                drawTransparentImage: (image, x, y) => drawings.push({ x, y, width: 17, height: 17 }),
                print: (text, x, y, color, font) => drawings.push({ text, x, y, width: text.length * font.charWidth, height: font.charHeight })
            })
        },
        controller: Object.fromEntries(["A", "B", "up", "down", "left", "right"].map(key =>
            [key, { isPressed: () => buttons[tick] === key }])),
        game: { pushScene: () => scenes++, popScene: () => scenes-- },
        scene: { setBackgroundColor: () => {}, setBackgroundImage: () => {} },
        console,
        pause: () => { assert(++tick < 100, "menu input test timed out"); }
    });
    const source = fs.readFileSync(path.join(root, "menu-debug.ts"), "utf8") + fs.readFileSync(path.join(root, "menu.ts"), "utf8");
    vm.runInContext(ts.transpileModule(source, {
        compilerOptions: { target: ts.ScriptTarget.ES2017 }
    }).outputText, context);
    return { context, drawings, scenes: () => scenes };
}

test("main, track, and lap menus fit the Arcade screen and use a visible selection marker", () => {
    const host = menuHost();
    const cases = [
        ["RACING", ["Race", "Train AI", "View AI"], "AI READY: 2400 EXAMPLES", [{}, {}, {}]],
        ["Choose track", ["Australia", "Great Britain", "Italy", "Monaco", "Netherlands", "USA"], "Six race courses"],
        ["Choose laps", ["1 lap", "2 laps", "3 laps", "4 laps"], "Great Britain"],
        ["Training track", ["Test Track", "Australia", "Great Britain", "Italy", "Monaco", "Netherlands", "USA"], "Practice or full lap"]
    ];
    for (const [title, choices, subtitle, icons] of cases) {
        host.drawings.length = 0;
        const menu = new host.context.racing.MenuScreen(title, choices, subtitle, true, icons);
        menu.draw();
        assert(host.drawings.some(item => item.text === ">"));
        for (const drawing of host.drawings) {
            assert(drawing.x >= 0 && drawing.y >= 0, JSON.stringify(drawing));
            assert(drawing.x + drawing.width <= 160 && drawing.y + drawing.height <= 120, JSON.stringify(drawing));
        }
        menu.move(-1);
        assert.equal(menu.selected, choices.length - 1);
        menu.move(1);
        assert.equal(menu.selected, 0);
        menu.move(-1);
        host.drawings.length = 0;
        menu.draw();
        for (const drawing of host.drawings) {
            assert(drawing.x >= 0 && drawing.y >= 0 && drawing.x + drawing.width <= 160 && drawing.y + drawing.height <= 120);
        }
    }
});

test("selection waits for held buttons and then returns the chosen row", () => {
    const host = menuHost([undefined, "down", undefined, "A", undefined]);
    assert.equal(host.context.racing.chooseMenu("Menu", ["Race", "Train AI", "View AI"]), 1);
    assert.equal(host.scenes(), 0);
});

test("B cancels a selector without selecting or leaking a scene", () => {
    const host = menuHost([undefined, "B", undefined]);
    assert.equal(host.context.racing.chooseMenu("Menu", ["One", "Two"]), -1);
    assert.equal(host.scenes(), 0);
});

test("B leaves the starting menu open until an option is selected", () => {
    const host = menuHost([undefined, "B", undefined, "A", undefined]);
    assert.equal(host.context.racing.chooseMenu("RACING", ["Race", "Train AI", "View AI"], "", false), 0);
    assert.equal(host.scenes(), 0);
    assert(!host.drawings.some(item => item.text && item.text.includes("B back")));
});

test("the training lap picker initially selects three laps without changing the available labels", () => {
    const host = menuHost([undefined, "A", undefined]);
    assert.equal(host.context.racing.chooseMenu("Training laps", ["1 lap", "2 laps", "3 laps", "4 laps"],
        "Test Track", true, undefined, 2), 2);
    assert.equal(host.scenes(), 0);
    assert.throws(() => new host.context.racing.MenuScreen("Laps", ["1 lap"], "", true, undefined, 2), /initial/);
});

test("menu test sequences cover changing bot labels, Back, manual steps, and repetition", () => {
    const host = menuHost();
    const api = host.context.racing;
    api.configureMenuTest(["Race", "Bot 1", "back", "manual"], false, true);
    assert.equal(api.scriptedMenuChoice("Main", ["Race", "Train AI", "View AI"], true), 0);
    assert.equal(api.scriptedMenuChoice("Bots", ["Bot 1: Monaco", "Bot 2: Empty"], true), 0);
    assert.equal(api.scriptedMenuChoice("Track", ["Monaco"], true), -1);
    assert.equal(api.scriptedMenuChoice("Main", ["Race"], true), undefined);
    assert.equal(api.scriptedMenuChoice("Main", ["Race"], true), undefined);
    assert.equal(api.skipTestPrompts(), true);
    api.configureMenuTest(["Race"], true, false);
    assert.equal(api.scriptedMenuChoice("Main", ["Race"], true), 0);
    assert.equal(api.scriptedMenuChoice("Main", ["Race"], true), 0);
    api.configureMenuTest(["Bad choice"], false, false);
    assert.throws(() => api.scriptedMenuChoice("Main", ["Race"], true), /not in Main/);
    api.configureMenuTest(["Back"], false, false);
    assert.throws(() => api.scriptedMenuChoice("RACING", ["Race"], false), /Back is not available/);
});
