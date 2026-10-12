const assert = require("node:assert/strict");
const { test } = require("node:test");
const { loadRacing, loadCourses } = require("./test-host");

function displayHost() {
    const renderables = [];
    const sprites = [];
    const timers = [];
    const lapTimes = [];
    const instruments = [];
    const host = loadRacing({
        SpriteFlag: { Invisible: 1 },
        scene: { createRenderable: (z, handler, visible) => {
            const item = { z, handler, visible: visible || (() => true), destroy() { this.destroyed = true; } };
            renderables.push(item);
            return item;
        } },
        drawing: { shiftedByCamera: point => point, drawThickLine: () => {}, drawLine: () => {} },
        screen: { fillRect: () => {}, fillCircle: () => {} }
    });
    const sprite = () => ({
        flags: {},
        setFlag(flag, value) { this.flags[flag] = value; },
        setPosition(x, y) { this.x = x; this.y = y; },
        destroy() { this.destroyed = true; }
    });
    host.context.sprites.create = () => { const item = sprite(); sprites.push(item); return item; };
    host.racing.finishLine = {};
    host.racing.createTimer = style => {
        const item = Object.assign(sprite(), {
            style, setRunning(value) { this.running = value; }, setElapsedTime(value) { this.time = value; }
        });
        timers.push(item);
        return item;
    };
    host.racing.createLapTime = (...args) => {
        const item = Object.assign(sprite(), { args });
        lapTimes.push(item);
        return item;
    };
    host.racing.drawLapIndicator = (...args) => instruments.push(["lap", ...args]);
    host.racing.drawSpeedometer = (...args) => instruments.push(["speed", ...args]);
    const courses = loadCourses(host);
    const track = courses[3].createTrack();
    const car = host.makeCar();
    track.reset(car);
    const display = new host.racing.DrivingDisplay(track.gates, car, 3);
    return { host, car, track, display, renderables, sprites, timers, lapTimes, instruments };
}

test("shared display uses Richard's minimap, speedometer, finish line, timer, and lap indicator", () => {
    const host = displayHost();
    assert.equal(host.renderables.length, 2);
    const dots = [];
    const finishMarkers = [];
    host.host.context.screen.fillCircle = (...args) => dots.push(args);
    host.host.context.screen.fillRect = (...args) => finishMarkers.push(args);
    host.renderables.forEach(item => item.handler({}, {}));
    assert.equal(dots.length, 1, "the upstream minimap must mark the actual car position");
    assert.equal(finishMarkers.length, 1);
    assert.deepEqual(host.instruments.find(args => args[0] === "speed").slice(1, 4), [19, 20, 99]);
    assert.deepEqual(host.instruments.find(args => args[0] === "lap"), ["lap", 135, 0, 0, 3]);
    assert.equal(host.timers[0].style, "compact");
    assert.equal(host.timers[0].top, 0);
    assert.equal(host.timers[0].running, false);
    const gate = host.track.gates[0];
    assert.equal(host.sprites[0].x, (gate.start.x + gate.end.x) / 2);
    assert.equal(host.sprites[0].y, (gate.start.y + gate.end.y) / 2);
    assert(host.sprites[0].z < host.car.z, "the finish line must not cover the training car");
});

test("lap-time panels update once per lap and the finished timer shows total elapsed time", () => {
    const host = displayHost();
    host.display.update(12000, 0, false);
    assert.equal(host.timers[0].time, 12000);
    host.display.update(45000, 1, false);
    host.display.update(45000, 1, false);
    assert.equal(host.lapTimes.length, 1);
    assert.deepEqual(host.lapTimes[0].args, [0, 3, 45000]);
    host.display.update(52000, 1, false);
    assert.equal(host.timers[0].time, 7000);
    host.display.update(90000, 2, false);
    host.display.update(140000, 3, true);
    assert.deepEqual(host.lapTimes.map(timer => timer.args), [[0, 3, 45000], [1, 3, 45000], [2, 3, 50000]]);
    assert.equal(host.timers[0].time, 140000);
});

test("dialogs hide every shared instrument and sprite, and disposing cleans up the scene objects", () => {
    const host = displayHost();
    host.display.update(45000, 1, false);
    host.display.setVisible(false);
    assert(host.renderables.every(item => !item.visible()));
    assert(host.sprites.concat(host.timers, host.lapTimes).every(item => item.flags[1]));
    host.display.setVisible(true);
    assert(host.renderables.every(item => item.visible()));
    assert(host.sprites.concat(host.timers, host.lapTimes).every(item => !item.flags[1]));
    host.display.destroy();
    assert(host.renderables.concat(host.sprites, host.timers, host.lapTimes).every(item => item.destroyed));
});
