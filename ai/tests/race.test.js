const assert = require("node:assert/strict");
const { test } = require("node:test");
const { loadRacing, loadMonaco } = require("./test-host");

test("one full Monaco teaching lap trains a driver that can attempt the same course", t => {
    const host = loadRacing();
    const track = loadMonaco(host);
    const car = host.makeCar();
    const driver = new host.ai.Driver();
    const F = host.racing.ControlStateFlag;
    track.reset(car);
    car.driver = driver;
    car.controlEnabled = true;
    car.teaching = true;
    car.isOffRoad = () => {
        const road = track.nearestRoadPosition(car);
        return Math.hypot(car.x - road.x, car.y - road.y) > track.roadWidth / 2;
    };
    const step = () => {
        car.x += car.vx * 0.05;
        car.y += car.vy * 0.05;
        car.update(50);
    };
    // A test-only demonstrator supplies button presses. It is never shipped as
    // an AI fallback: the second run uses only the recorded neighbor votes.
    const readControls = car.updateControls;
    car.updateControls = function () {
        const road = track.nearestRoadPosition(car);
        let segment = road.segment;
        let remaining = Math.max(24, Math.abs(car.speed) * 0.4);
        let fraction = road.fraction;
        while (remaining > track.segmentLength(segment) * (1 - fraction)) {
            remaining -= track.segmentLength(segment) * (1 - fraction);
            segment = (segment + 1) % track.centers.length;
            fraction = 0;
        }
        fraction += remaining / track.segmentLength(segment);
        const a = track.centers[segment];
        const b = track.centers[(segment + 1) % track.centers.length];
        const targetHeading = Math.atan2(a.y + (b.y - a.y) * fraction - car.y, a.x + (b.x - a.x) * fraction - car.x);
        const error = host.ai.angleDifference(targetHeading, car.heading);
        const steering = error < -0.04 ? F.TurnLeftOn : error > 0.04 ? F.TurnRightOn : 0;
        const observation = track.observe(car);
        const desiredSpeed = Math.abs(observation.bend) > 0.05 || Math.abs(observation.nearBend) > 0.05 ? 40 : car.stats.topSpeed;
        const pedal = car.speed < desiredSpeed - 2 ? F.AccelerationOn : car.speed > desiredSpeed + 2 ? F.BrakingOn : 0;
        host.setControls(steering | pedal);
        readControls.call(this);
    };
    for (let tick = 0; tick < 6000 && car.completedGates < track.gates.length; tick++) step();
    assert.equal(car.completedGates, track.gates.length, "test demonstration must finish its lap");
    assert(driver.count() >= 40);
    assert(driver.count() <= host.ai.SAMPLE_LIMIT);
    const count = driver.count();
    const timeLimit = Math.max(host.ai.MIN_ATTEMPT_TIME_MS, car.elapsedMillis * 1.5);
    t.diagnostic(`Teaching: ${car.elapsedMillis / 1000}s, ${count} examples, ${car.offRoadMillis / 1000}s off-road`);
    track.reset(car);
    car.controlEnabled = false;
    car.teaching = false;
    while (car.elapsedMillis < timeLimit && car.completedGates < track.gates.length) step();
    t.diagnostic(`AI: ${car.elapsedMillis / 1000}s, ${car.offRoadMillis / 1000}s off-road, ${car.completedGates}/${track.gates.length} gates`);
    assert.equal(driver.count(), count, "AI attempt must not modify training data");
    assert.equal(car.completedGates, track.gates.length, "learned driver should complete the demonstrated course: " + JSON.stringify({
        x: car.x, y: car.y, speed: car.speed, controls: car.controlState, observation: track.observe(car),
        nearest: driver.indices.map(index => ({ observation: driver.examples[index].observation, action: driver.examples[index].action }))
    }));
});
