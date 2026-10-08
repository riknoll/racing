const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const { test } = require("node:test");
const { root } = require("./test-host");

function entryHost() {
    const events = [];
    const originalScene = { car: { x: 100, y: 200 }, minimap: [1, 2, 3] };
    const scenes = [originalScene];
    const context = vm.createContext({
        __teach: () => events.push("teach"),
        __test: () => events.push("test"),
        __dispose: () => events.push("dispose"),
        game: {
            pushScene: () => { scenes.push({}); events.push("push"); },
            popScene: () => { scenes.pop(); events.push("pop"); }
        },
        controller: Object.fromEntries(["A", "B", "up"].map(key => [key, { isPressed: () => false }])),
        pause: () => { throw new Error("Buttons should be released"); }
    });
    const declarations = `namespace aiRacing {
        export const teachDriver = __teach;
        export const testDriver = __test;
        export const disposeActivity = __dispose;
    }`;
    const source = declarations + fs.readFileSync(path.join(root, "ai", "entry.ts"), "utf8");
    vm.runInContext(ts.transpileModule(source, {
        compilerOptions: { target: ts.ScriptTarget.ES2017 }
    }).outputText, context);
    return { context, events, scenes, originalScene };
}

test("the small startup hook runs the AI scene and restores the untouched original demo", () => {
    const host = entryHost();
    host.context.aiRacing.runActivity();
    assert.deepEqual(host.events, ["push", "teach", "test", "dispose", "pop"]);
    assert.equal(host.scenes.length, 1);
    assert.equal(host.scenes[0], host.originalScene);
    assert.deepEqual(host.originalScene, { car: { x: 100, y: 200 }, minimap: [1, 2, 3] });
});

test("a failed lesson still restores the original scene and can be started again", () => {
    const host = entryHost();
    host.context.aiRacing.teachDriver = () => { throw new Error("lesson failed"); };
    assert.throws(() => host.context.aiRacing.runActivity(), /lesson failed/);
    assert.equal(host.scenes[0], host.originalScene);
    assert.deepEqual(host.events, ["push", "dispose", "pop"]);
    host.context.aiRacing.teachDriver = () => host.events.push("teach");
    host.context.aiRacing.runActivity();
    assert.equal(host.scenes.length, 1);
});

test("a running activity rejects a second launch instead of nesting lessons", () => {
    const host = entryHost();
    host.context.aiRacing.teachDriver = () => host.context.aiRacing.runActivity();
    assert.throws(() => host.context.aiRacing.runActivity(), /already running/);
    assert.deepEqual(host.events, ["push", "dispose", "pop"]);
    assert.equal(host.scenes.length, 1);
});
