const assert = require("node:assert/strict");
const { test } = require("node:test");
const { loadRacing, loadCourses } = require("./test-host");

function watchHost() {
    const host = loadRacing();
    const courses = loadCourses(host);
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
    const { host, courses, bot } = watchHost();
    host.context.aiRacing.getTestTrackMap = () => ({ name: "Test Track" });
    host.context.aiRacing.TEST_TRACK_GATES = courses[3].gates;
    host.context.aiRacing.TEST_TRACK_CENTERS = courses[3].centers;
    host.context.aiRacing.TEST_TRACK_WIDTH = 64;
    bot.courseIndex = 6;
    const watch = new host.ai.LapWatch(bot);
    assert.equal(watch.course.name, "Test Track");
    assert.throws(() => new host.ai.LapWatch(new host.ai.BotSlot(0)), /Train this bot/);
});
