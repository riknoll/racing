const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const { test } = require("node:test");
const { root, loadRacing } = require("./test-host");

function lessonHost() {
    const source = ts.createSourceFile("activity.ts", fs.readFileSync(path.join(root, "ai", "activity.ts"), "utf8"), ts.ScriptTarget.Latest, true);
    const functions = [];
    function visit(node) {
        if (ts.isFunctionDeclaration(node) && ["teachDriver", "testDriver", "addRacer", "disposeActivity"].includes(node.name.text)) functions.push(node.getText(source));
        ts.forEachChild(node, visit);
    }
    visit(source);
    assert.equal(functions.length, 4);
    const destroyed = [];
    const oldCars = [0, 1, 2].map(id => ({ destroy: () => destroyed.push(id) }));
    const context = vm.createContext({
        exports: {},
        MIN_EXAMPLES: 40,
        cars: oldCars, player: oldCars[0],
        driver: undefined, watchedCar: undefined, status: "",
        teachingMillis: 0, teachingOffRoadMillis: 0,
        initialized: true, showingMessage: false,
        track: { gates: Array(50).fill({}) },
        initialize: () => {}, releaseButtons: () => {}, showMessage: () => {}, showTrainingSummary: () => {},
        cleanPercent: () => 100, SpriteFlag: { Invisible: 1 },
        controller: { A: { isPressed: () => true }, up: { isPressed: () => false } },
        scene: { cameraFollowSprite: () => {} },
        pause: () => { context.watchedCar.completedGates = 50; },
        racing: { RacerStats: loadRacing().racing.RacerStats, getCarFrames: color => [color], colorMap: { height: 7 } },
        Driver: class { constructor() { this.actionCounts = [0, 0, 0, 0, 0]; } count() { return 40; } },
        LearningCar: class {
            constructor(stats, frames) {
                this.stats = stats;
                this.frames = frames;
                this.completedGates = 0;
                this.elapsedMillis = this.offRoadMillis = 0;
            }
            stop() { this.paused = true; }
            setFlag() {}
            destroy() { this.destroyed = true; }
        }
    });
    vm.runInContext(ts.transpileModule(functions.join("\n"), {
        compilerOptions: { target: ts.ScriptTarget.ES2017, module: ts.ModuleKind.CommonJS }
    }).outputText, context);
    return { context, destroyed };
}

test("a new lesson removes its previous cars and starts a fresh model", () => {
    const { context, destroyed } = lessonHost();
    context.teachDriver();
    assert.deepEqual(destroyed, [0, 1, 2]);
    assert.equal(context.cars.length, 1);
    assert.equal(context.cars[0], context.player);
    assert.equal(context.player.driver, context.driver);
    assert.equal(context.player.paused, true);
    assert.equal(context.status, "TAUGHT");
});

test("the lesson uses upstream's full stats, including the faster grass speed", () => {
    const { context } = lessonHost();
    context.teachDriver();
    const stats = context.player.stats;
    assert.deepEqual([
        stats.speedStat, stats.accelerationStat, stats.handlingStat,
        stats.brakingStat, stats.frictionStat, stats.offRoadSpeedStat
    ], [100, 100, 100, 100, 100, 100]);
    assert.equal(stats.offRoadSpeed, 20);
    assert.equal(stats.friction, 50);
    assert.equal(context.addRacer(1).stats, stats);
});

test("additional racers share the model and reject invalid colors", () => {
    const { context } = lessonHost();
    context.teachDriver();
    const racer = context.addRacer(1);
    assert.equal(racer.driver, context.driver);
    assert.equal(racer.stats, context.player.stats);
    assert.equal(context.cars.length, 2);
    for (const color of [-1, 7, 0.5]) assert.throws(() => context.addRacer(color), /valid racing car color/);
    assert.equal(context.cars.length, 2);
});

test("holding Up does not end teaching or the AI attempt early", () => {
    const { context } = lessonHost();
    context.controller.up.isPressed = () => true;
    context.teachDriver();
    assert.equal(context.player.completedGates, 50);
    context.testDriver();
    assert.equal(context.watchedCar.completedGates, 50);
    assert.equal(context.status, "FINISHED");
});

test("an incomplete AI attempt runs until its time limit, not an Up press", () => {
    const { context } = lessonHost();
    context.teachDriver();
    context.controller.up.isPressed = () => true;
    context.pause = () => { context.watchedCar.elapsedMillis += 60000; };
    context.testDriver();
    assert.equal(context.watchedCar.elapsedMillis, 120000);
    assert.equal(context.watchedCar.completedGates, 0);
    assert.equal(context.status, "STOPPED");
});

test("disposing a lesson releases its cars and state without touching the base demo", () => {
    const { context } = lessonHost();
    context.teachDriver();
    const player = context.player;
    const racer = context.addRacer(1);
    context.disposeActivity();
    assert(player.destroyed && racer.destroyed);
    assert.equal(context.cars.length, 0);
    assert.equal(context.driver, undefined);
    assert.equal(context.track, undefined);
    assert.equal(context.watchedCar, undefined);
    assert.equal(context.initialized, false);
});
