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
        if (ts.isFunctionDeclaration(node) && ["teachDriver", "teachLesson", "testDriver", "addRacer", "disposeActivity", "getTrainingDriver"].includes(node.name.text)) functions.push(node.getText(source));
        ts.forEachChild(node, visit);
    }
    visit(source);
    assert.equal(functions.length, 6);
    const destroyed = [];
    const oldCars = [0, 1, 2].map(id => ({ destroy: () => destroyed.push(id) }));
    const courses = ["Australia", "Great Britain", "Italy", "Monaco", "Netherlands", "USA"].map(name => ({ name }));
    const testTrack = { name: "Test Track" };
    const host = loadRacing();
    const slots = Array.from({ length: host.ai.BOT_SLOT_COUNT }, () => ({}));
    const saved = [];
    const prompts = [];
    let stops = 0;
    const context = vm.createContext({
        exports: {},
        MIN_EXAMPLES: 40,
        MIN_ATTEMPT_TIME_MS: host.ai.MIN_ATTEMPT_TIME_MS,
        cars: oldCars, player: oldCars[0],
        driver: undefined, watchedCar: undefined, status: "",
        teachingMillis: 0, teachingOffRoadMillis: 0,
        selectedBot: 0, trainingLaps: 1, drivingDisplay: undefined,
        initialized: true, showingMessage: false,
        track: { gates: Array(50).fill({}) },
        initialize: () => {}, releaseButtons: () => {}, showMessage: text => prompts.push(text), showTrainingSummary: () => {},
        botSlot: index => slots[index],
        rememberBot: (index, driver, courseIndex) => {
            saved.push({ index, driver, courseIndex });
            slots[index].driver = driver;
            return slots[index];
        },
        cleanPercent: () => 100, SpriteFlag: { Invisible: 1 },
        controller: { A: { isPressed: () => true }, up: { isPressed: () => false } },
        scene: { cameraFollowSprite: () => {} },
        pause: () => { context.watchedCar.completedGates += 50; },
        racing: { RacerStats: host.racing.RacerStats, getCarFrames: color => [color], colorMap: { height: 7 },
            getCourses: () => courses, getTrainingCourses: () => [testTrack].concat(courses), skipTestPrompts: () => false,
            DrivingDisplay: class { update() {} setVisible() {} destroy() {} } },
        Driver: class { constructor() { this.actionCounts = [0, 0, 0, 0, 0]; } count() { return 40; } },
        LearningCar: class {
            constructor(stats, frames) {
                this.stats = stats;
                this.frames = frames;
                this.completedGates = 0;
                this.elapsedMillis = this.offRoadMillis = 0;
            }
            stop() { this.paused = true; stops++; }
            setFlag() {}
            destroy() { this.destroyed = true; }
        }
    });
    vm.runInContext(ts.transpileModule(functions.join("\n"), {
        compilerOptions: { target: ts.ScriptTarget.ES2017, module: ts.ModuleKind.CommonJS }
    }).outputText, context);
    return { context, destroyed, courses, testTrack, saved, prompts, stops: () => stops };
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
    assert.equal(context.watchedCar.elapsedMillis, 180000);
    assert.equal(context.watchedCar.completedGates, 0);
    assert.equal(context.status, "STOPPED");
});

test("longer lessons still give AI attempts one and a half times the teaching duration", () => {
    const { context } = lessonHost();
    context.teachDriver();
    context.teachingMillis = 160000;
    context.pause = () => { context.watchedCar.elapsedMillis += 60000; };
    context.testDriver();
    assert.equal(context.watchedCar.elapsedMillis, 240000);
    assert.equal(context.status, "STOPPED");
});

test("player training remains lap-based without a three-minute cutoff", () => {
    const { context } = lessonHost();
    context.pause = () => {
        context.watchedCar.elapsedMillis += 60000;
        context.watchedCar.completedGates += 5;
    };
    context.teachDriver();
    assert.equal(context.player.completedGates, 50);
    assert.equal(context.player.elapsedMillis, 600000);
    assert.equal(context.status, "TAUGHT");
});

test("disposing a lesson releases scene objects but retains its current training for the menu", () => {
    const { context } = lessonHost();
    context.teachDriver();
    const player = context.player;
    const racer = context.addRacer(1);
    const driver = context.driver;
    context.disposeActivity();
    assert(player.destroyed && racer.destroyed);
    assert.equal(context.cars.length, 0);
    assert.equal(context.getTrainingDriver(), driver);
    assert.equal(context.track, undefined);
    assert.equal(context.watchedCar, undefined);
    assert.equal(context.initialized, false);
});

test("Test Track training drives all three laps without intermediate stops, prompts, or model resets", () => {
    const host = lessonHost();
    let updates = 0;
    host.context.pause = () => {
        assert.equal(host.context.player.paused, false);
        assert.equal(host.stops(), 0);
        assert.equal(host.saved.length, 0, "save only after all laps");
        updates++;
        host.context.player.completedGates += 25;
    };
    host.context.teachLesson("back", host.testTrack, 1, 3);
    assert.equal(updates, 6);
    assert.equal(host.context.player.completedGates, 150);
    assert.equal(host.stops(), 1);
    assert.equal(host.prompts.length, 1);
    assert.match(host.prompts[0], /3 laps/);
    assert.deepEqual(host.saved.map(save => [save.index, save.courseIndex]), [[1, 6]]);
    assert.equal(host.saved[0].driver, host.context.player.driver);
});

test("all training lap choices use the requested checkpoint goal and reject invalid counts", () => {
    for (const laps of [1, 2, 3, 4]) {
        const host = lessonHost();
        host.context.teachLesson("back", host.courses[0], 0, laps);
        assert.equal(host.context.player.completedGates, 50 * laps);
        assert.equal(host.saved[0].courseIndex, 0);
    }
    for (const laps of [0, 5, 1.5]) {
        const host = lessonHost();
        assert.throws(() => host.context.teachLesson("back", host.testTrack, 0, laps), /one to four/);
        assert.equal(host.saved.length, 0);
        assert.equal(host.destroyed.length, 0);
    }
});
