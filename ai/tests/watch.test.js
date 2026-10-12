const assert = require("node:assert/strict");
const { test } = require("node:test");
const { loadRacing, loadCourses } = require("./test-host");

function watchHost() {
    const host = loadRacing();
    const courses = loadCourses(host);
    host.context.aiRacing.getTestTrackMap = () => ({ name: "Test Track" });
    host.context.aiRacing.TEST_TRACK_GATES = courses[3].gates;
    host.context.aiRacing.TEST_TRACK_CENTERS = courses[3].centers;
    host.context.aiRacing.TEST_TRACK_WIDTH = 64;
    const bot = new host.ai.BotSlot(1);
    bot.courseIndex = 3;
    bot.teachingMillis = 90000;
    for (let i = 0; i < 40; i++) bot.driver.learn(new host.ai.Observation(0, 0, 0, 0, 0, 0), 1);
    return { host, courses, bot };
}

test("watching uses the selected bot and its training track, with no human control or recording", () => {
    const { host, courses, bot } = watchHost();
    const watch = new host.ai.LapWatch(bot);
    assert.equal(watch.course, courses[3]);
    assert.equal(watch.car.driver, bot.driver);
    assert.equal(watch.car.controlEnabled, false);
    assert.equal(watch.car.teaching, false);
    assert.equal(watch.car.frames[0].color, 2);
    assert.equal(watch.timeLimit, 180000);
    watch.update(false);
    assert.equal(watch.ended, false);
    watch.car.completedGates = watch.track.gates.length;
    watch.update(false);
    assert.equal(watch.ended, true);
    assert.equal(watch.car.paused, true);
    assert.match(watch.summary(), /finished the lap/);
    assert.equal(bot.driver.count(), 40);
});

test("a cancelled or timed-out watch does not claim a completed lap", () => {
    const { host, bot } = watchHost();
    const cancelled = new host.ai.LapWatch(bot);
    cancelled.update(true);
    assert.match(cancelled.summary(), /watch stopped/);
    assert.doesNotMatch(cancelled.summary(), /finished the lap/);
    const timeout = new host.ai.LapWatch(bot);
    timeout.car.elapsedMillis = 179999;
    timeout.update(false);
    assert.equal(timeout.ended, false);
    timeout.car.elapsedMillis = 180000;
    timeout.update(false);
    assert.match(timeout.summary(), /time limit/);
    assert.equal(timeout.ended, true);
    assert.equal(timeout.car.paused, true);
    assert.equal(bot.driver.count(), 40);
});

test("longer teaching durations retain a watch allowance above three minutes", () => {
    const { host, bot } = watchHost();
    bot.teachingMillis = 160000;
    const watch = new host.ai.LapWatch(bot);
    assert.equal(watch.timeLimit, 240000);
    watch.car.elapsedMillis = 239999;
    watch.update(false);
    assert.equal(watch.ended, false);
    watch.car.elapsedMillis = 240000;
    watch.update(false);
    assert.equal(watch.ended, true);
});

test("watching a Test Track bot selects the practice map and empty bots fail explicitly", () => {
    const { host, bot } = watchHost();
    bot.courseIndex = 6;
    const watch = new host.ai.LapWatch(bot);
    assert.equal(watch.course.name, "Test Track");
    assert.throws(() => new host.ai.LapWatch(new host.ai.BotSlot(0)), /Train this bot/);
});

test("a selected watch track supplies the geometry and lap goal without altering training provenance or examples", () => {
    const { host, bot } = watchHost();
    const driver = bot.driver;
    const counts = Array.from(driver.actionCounts);
    bot.courseIndex = 6;
    bot.saved = true;
    for (const course of host.racing.getTrainingCourses()) {
        const watch = new host.ai.LapWatch(bot, course);
        assert.equal(watch.course, course);
        assert.equal(watch.car.track, watch.track);
        assert.equal(watch.car.driver, driver);
        assert.equal(watch.car.controlEnabled, false);
        assert.equal(watch.car.teaching, false);
        assert.equal(watch.timeLimit, 180000);
        watch.car.completedGates = watch.track.gates.length - 1;
        watch.update(false);
        assert.equal(watch.ended, false);
        watch.car.completedGates++;
        watch.update(false);
        assert.equal(watch.ended, true);
        assert(watch.summary().includes(course.name));
    }
    assert.equal(bot.courseIndex, 6);
    assert.equal(bot.saved, true);
    assert.equal(driver.count(), 40);
    assert.deepEqual(Array.from(driver.actionCounts), counts);
});

test("watching rejects unregistered tracks and unavailable default tracks explicitly", () => {
    const { host, courses, bot } = watchHost();
    const unknown = new host.racing.Course("Unknown", courses[0].tilemap,
        courses[0].gates, courses[0].centers, courses[0].roadWidth);
    assert.throws(() => new host.ai.LapWatch(bot, unknown), /valid watch track/);
    assert.throws(() => new host.ai.LapWatch(new host.ai.BotSlot(0), courses[0]), /Train this bot/);
    bot.courseIndex = -1;
    assert.throws(() => new host.ai.LapWatch(bot), /training track is unavailable/);
});

test("the watch scene uses the selected tilemap and display, then releases its car without saving or training", () => {
    const { host, courses, bot } = watchHost();
    host.ai.getBotSlots()[bot.index] = bot;
    const selected = courses[0];
    let tilemap, displayGates, car, update, pushed = 0, popped = 0;
    const messages = [];
    host.context.tiles = { setCurrentTilemap: value => { tilemap = value; } };
    host.context.scene = { setBackgroundImage: () => {}, centerCameraAt: () => {}, createRenderable: () => {} };
    host.context.scroller = { scrollBackgroundWithCamera: () => {}, CameraScrollMode: { BothDirections: 0 } };
    host.racing.generateBackground = () => ({});
    host.racing.skipTestPrompts = () => false;
    host.racing.releaseMenuButtons = () => {};
    host.racing.DrivingDisplay = class {
        constructor(gates, watched) { displayGates = gates; car = watched; }
        update() {}
        setVisible() {}
        destroy() {}
    };
    host.context.game.pushScene = () => { pushed++; };
    host.context.game.popScene = () => { popped++; };
    host.context.game.onUpdate = value => { update = value; };
    host.context.game.showLongText = text => messages.push(text);
    host.context.DialogLayout = { Full: 0 };
    host.context.pause = () => { car.completedGates = car.track.gates.length; update(); };
    host.context.__writeBot = () => { throw new Error("watching must not save"); };
    host.ai.watchBotLap(bot.index, selected);
    assert.equal(tilemap, selected.tilemap);
    assert.equal(displayGates, car.track.gates);
    assert.equal(car.driver, bot.driver);
    assert.equal(car.teaching, false);
    assert.equal(car.destroyed, true);
    assert.equal(pushed, 1);
    assert.equal(popped, 1);
    assert(messages[0].includes(selected.name));
    assert.equal(bot.courseIndex, 3);
    assert.equal(bot.driver.count(), 40);
});
