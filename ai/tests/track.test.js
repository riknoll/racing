const assert = require("node:assert/strict");
const { test } = require("node:test");
const { loadRacing, buffer } = require("./test-host");

function square(host) {
    const centers = buffer([200, 100, 200, 200, 100, 200, 100, 100]);
    const gates = buffer([
        180, 80, 180, 120, 180, 120, 220, 120,
        180, 180, 220, 180, 180, 180, 180, 220,
        120, 180, 120, 220, 80, 180, 120, 180,
        80, 120, 120, 120, 120, 80, 120, 120
    ], 1);
    return new host.ai.Track(gates, centers, 40);
}

test("track reset starts before the first turn, pointing along the road", () => {
    const host = loadRacing();
    const track = square(host);
    const car = host.makeCar();
    track.reset(car);
    assert.equal(car.x, 180);
    assert.equal(car.y, 100);
    assert.equal(car.heading, 0);
    assert.equal(car.completedGates, 0);
    assert.equal(car.track, track);
});

test("observations use road-relative position, signed speed, and upcoming turns", () => {
    const host = loadRacing();
    const track = square(host);
    const car = host.makeCar();
    track.reset(car);
    car.x = 150;
    car.y = 110;
    car.speed = -20;
    const observation = track.observe(car);
    assert.equal(observation.offset, 0.5);
    assert.equal(observation.heading, 0);
    assert.equal(observation.speed, -20 / host.racing.TOP_SPEED_MAX);
    car.speed = host.racing.TOP_SPEED_MAX;
    assert.notEqual(track.observe(car).bend, 0);
});

test("gate progress is per-car, ordered, and includes swept crossings", () => {
    const host = loadRacing();
    const track = square(host);
    const a = host.makeCar();
    const b = host.makeCar();
    track.reset(a);
    track.reset(b);
    a.lastTrackX = 200;
    a.lastTrackY = 100;
    a.x = 200;
    a.y = 145;
    track.updateProgress(a);
    assert.equal(a.currentGateIndex, 1);
    assert.equal(a.completedGates, 1);
    assert.equal(b.currentGateIndex, 0);
    assert.equal(b.completedGates, 0);
    track.updateProgress(a);
    assert.equal(a.completedGates, 1);
});

test("bad geometry reports an error instead of guessing a road", () => {
    const host = loadRacing();
    assert.throws(() => new host.ai.Track(buffer([]), buffer([]), 40));
    assert.throws(() => new host.ai.Track(buffer(Array(24).fill(100)), buffer(Array(12).fill(100)), 0));
    assert.throws(() => new host.ai.Track(buffer(Array(24).fill(100)), buffer(Array(12).fill(100)), 40));
});

test("a missed corner gate can advance to the second gate ahead, matching the base race", () => {
    const host = loadRacing();
    const track = square(host);
    const car = host.makeCar();
    track.reset(car);
    car.x = car.lastTrackX = 200;
    car.y = car.lastTrackY = 180;
    track.updateProgress(car);
    assert.equal(car.currentGateIndex, 2);
    assert.equal(car.completedGates, 2);
});

test("missing both upcoming gates does not permanently block a later forward crossing", () => {
    const host = loadRacing();
    const track = square(host);
    const car = host.makeCar();
    track.reset(car);
    car.lastTrackX = 195;
    car.lastTrackY = 200;
    car.x = 165;
    car.y = 200;
    track.updateProgress(car);
    assert.equal(car.currentGateIndex, 3);
    assert.equal(car.completedGates, 3);
});

test("catch-up crossings require road contact and forward travel", () => {
    const host = loadRacing();
    const track = square(host);
    const car = host.makeCar();
    track.reset(car);
    car.lastTrackX = 165;
    car.lastTrackY = 200;
    car.x = 195;
    car.y = 200;
    track.updateProgress(car);
    assert.equal(car.completedGates, 0);
    car.lastTrackX = 195;
    car.x = 165;
    car.isOffRoad = () => true;
    track.updateProgress(car);
    assert.equal(car.completedGates, 0);
});

test("reversing through the next gate does not count forward training progress", () => {
    const host = loadRacing();
    const track = square(host);
    const car = host.makeCar();
    track.reset(car);
    car.lastTrackX = 200;
    car.lastTrackY = 145;
    car.x = 200;
    car.y = 105;
    track.updateProgress(car);
    assert.equal(car.completedGates, 0);
});

test("upstream's extra finish gate does not shift the road segment used by AI observations", () => {
    const host = loadRacing();
    const track = new host.ai.Track(buffer([
        150, 80, 150, 120,
        180, 80, 180, 120, 180, 120, 220, 120,
        180, 180, 220, 180, 180, 180, 180, 220,
        120, 180, 120, 220, 80, 180, 120, 180,
        80, 120, 120, 120, 120, 80, 120, 120
    ], 1), buffer([200, 100, 200, 200, 100, 200, 100, 100]), 40);
    const car = host.makeCar();
    track.reset(car);
    assert.equal(car.x, 150);
    assert.equal(car.y, 100);
    assert.equal(car.heading, 0);
    assert.equal(track.observe(car).offset, 0);
    car.currentGateIndex = 2;
    car.x = 200;
    car.y = 150;
    car.heading = Math.PI / 2;
    assert.equal(track.observe(car).offset, 0);
    assert.equal(track.observe(car).heading, 0);
});

test("the gate reader preserves signed coordinates used by widened upstream checkpoints", () => {
    const host = loadRacing();
    const values = [-20, -10, 180, 100];
    const gates = host.racing.readGates(buffer(values, 1));
    assert.deepEqual([gates[0].start.x, gates[0].start.y, gates[0].end.x, gates[0].end.y], values);
});
