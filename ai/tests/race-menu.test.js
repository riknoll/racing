const assert = require("node:assert/strict");
const { test } = require("node:test");
const { loadRacing, loadCourses } = require("./test-host");

function trainedBots(host, index = 0) {
    const driver = new host.ai.Driver();
    for (let i = 0; i < 40; i++) driver.learn(new host.ai.Observation(0, 0, 0, 0, 0, 0), 1);
    const bot = new host.ai.BotSlot(index);
    bot.driver = driver;
    return [bot];
}

test("all six map choices create valid independent tracks for one to four laps", () => {
    const host = loadRacing();
    const courses = loadCourses(host);
    assert.equal(courses.length, 6);
    for (const course of courses) {
        for (let laps = 1; laps <= 4; laps++) {
            const race = new host.racing.RaceSession(course, laps, []);
            assert.equal(race.gateGoal, laps * race.track.gates.length);
            assert.equal(race.opponent, undefined);
            assert.equal(race.player.controlEnabled, true);
            assert.equal(race.player.paused, true);
        }
    }
});

test("a trained model adds a different-color opponent with its own progress but no recording", () => {
    const host = loadRacing();
    const bots = trainedBots(host);
    const driver = bots[0].driver;
    const race = new host.racing.RaceSession(loadCourses(host)[3], 2, bots);
    assert.equal(race.player.frames[0].color, 0);
    assert.equal(race.opponent.frames[0].color, 1);
    assert.equal(race.opponent.driver, driver);
    assert.equal(race.player.driver, undefined);
    assert.equal(race.player.teaching, false);
    assert.equal(race.opponent.teaching, false);
    assert.equal(race.player.stats, race.opponent.stats);
    assert.notEqual(race.player.x, race.opponent.x);
    assert(race.player.x > 0 && race.opponent.x > 0);
    race.start();
    race.opponent.completedGates = race.gateGoal;
    race.opponent.elapsedMillis = 100;
    race.update();
    assert.equal(race.opponent.paused, true);
    assert.equal(race.finished, false, "the player must still finish their laps");
    race.player.completedGates = race.gateGoal;
    race.player.elapsedMillis = 200;
    race.update();
    assert.equal(race.finished, true);
    assert.match(race.summary(), /You placed 2\/2/);
    assert.equal(driver.count(), 40);
});

test("player completion ends the selected lap count and reports an unfinished AI honestly", () => {
    const host = loadRacing();
    const race = new host.racing.RaceSession(loadCourses(host)[0], 4, trainedBots(host));
    race.start();
    race.player.completedGates = race.gateGoal - 1;
    race.update();
    assert.equal(race.finished, false);
    race.player.completedGates++;
    race.opponent.completedGates = 3;
    race.update();
    assert.equal(race.finished, true);
    assert.match(race.summary(), /YOU WIN/);
    assert.match(race.summary(), /Bot 1: 3\/\d+ checkpoints/);
    race.destroy();
    assert(race.player.destroyed && race.opponent.destroyed);
});

test("a race rejects lap counts outside the requested range", () => {
    const host = loadRacing();
    const course = loadCourses(host)[0];
    for (const laps of [0, 5, 1.5]) {
        assert.throws(() => new host.racing.RaceSession(course, laps, []), /one to four/);
    }
});

test("a full race contains both independently trained bots without recording new samples", () => {
    const host = loadRacing();
    const bots = [0, 1].map(index => trainedBots(host, index)[0]);
    const race = new host.racing.RaceSession(loadCourses(host)[3], 1, bots);
    assert.equal(race.opponents.length, 2);
    assert.deepEqual(Array.from(race.opponents, car => car.frames[0].color), [1, 2]);
    assert.deepEqual(Array.from(race.botNumbers), [1, 2]);
    assert(race.opponents.every(car => !car.teaching));
    race.start();
    race.player.completedGates = race.gateGoal;
    race.update();
    assert(bots.every(bot => bot.driver.count() === 40));
    assert(race.opponents.every(car => car.paused));
});

test("race-specific overlays add only car labels and bot minimap dots, leaving instruments to the shared display", () => {
    const host = loadRacing({ image: {
        font5: { charWidth: 6, charHeight: 5 }, font8: { charWidth: 6, charHeight: 8 },
        scaledFont: font => font
    } });
    host.context.drawing = { shiftedByCamera: point => point, drawThickLine: () => {}, drawLine: () => {} };
    const race = new host.racing.RaceSession(loadCourses(host)[3], 1, trainedBots(host));
    race.start();
    const rectangles = [];
    const dots = [];
    const target = { width: 160, height: 120, fillCircle: (...values) => dots.push(values), print: () => {},
        fillRect: (x, y, width, height) => rectangles.push({ x, y, width, height }) };
    const display = { drawMinimapDot: (target, car, color) => target.fillCircle(car.x, car.y, 2, color) };
    race.drawWorld(target, { drawOffsetX: 0, drawOffsetY: 0 }, display);
    race.drawHud(target);
    assert.equal(dots.length, 1);
    assert(!rectangles.some(rect => rect.width === 160));
});

test("starting-grid car labels do not overlap one another", () => {
    const host = loadRacing({ image: { font5: { charWidth: 6, charHeight: 5 }, font8: { charWidth: 6, charHeight: 8 } } });
    host.context.drawing = { shiftedByCamera: point => point, drawThickLine: () => {}, drawLine: () => {} };
    const race = new host.racing.RaceSession(loadCourses(host)[3], 1,
        [0, 1].map(index => trainedBots(host, index)[0]));
    const labels = [];
    const target = { width: 160, height: 120, fillCircle: () => {}, fillRect: () => {},
        print: (label, x, y) => labels.push({ label, x, y, width: label.length * 6, height: 5 }) };
    race.drawWorld(target, { drawOffsetX: race.player.x - 70, drawOffsetY: race.player.y - 75 });
    for (let i = 0; i < labels.length; i++) {
        for (let j = i + 1; j < labels.length; j++) {
            const a = labels[i], b = labels[j];
            const overlaps = a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
            assert(!overlaps, JSON.stringify({ a, b }));
        }
    }
});
