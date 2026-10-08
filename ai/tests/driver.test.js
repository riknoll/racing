const assert = require("node:assert/strict");
const { test } = require("node:test");
const { loadRacing } = require("./test-host");

test("steering combines with every pedal and normalizes competing controls", () => {
    const { racing, ai } = loadRacing();
    const F = racing.ControlStateFlag;
    for (const steering of [0, F.TurnLeftOn, F.TurnRightOn]) {
        for (const pedal of [0, F.AccelerationOn, F.BrakingOn, F.ReverseOn]) {
            const controls = steering | pedal;
            assert.equal(ai.Action.fromControls(controls).controls(), controls);
        }
    }
    assert.equal(ai.Action.fromControls(F.TurnLeftOn | F.TurnRightOn).steer, 0);
    assert.equal(ai.Action.fromControls(F.AccelerationOn | F.BrakingOn | F.ReverseOn).pedal, ai.Pedal.Accelerate);
    assert.equal(ai.Action.fromControls(F.BrakingOn | F.ReverseOn).pedal, ai.Pedal.Brake);
});

test("nearby heading angles match across a full-turn boundary", () => {
    const { ai } = loadRacing();
    const a = new ai.Observation(0, 179 / 180, 0, 0, 0, 0);
    const b = new ai.Observation(0, -179 / 180, 0, 0, 0, 0);
    assert(a.distanceSquaredTo(b) < 0.001);
    assert(Math.abs(ai.angleDifference(10 * Math.PI, 0)) < 1e-12);
});

test("five-neighbor voting learns left, right, acceleration, braking, and reverse", () => {
    const { racing, ai } = loadRacing();
    const F = racing.ControlStateFlag;
    const driver = new ai.Driver();
    const observations = [
        new ai.Observation(2, 0.3, 0.3, 0.3, 0.5, 0),
        new ai.Observation(-2, -0.3, -0.3, -0.3, 0.5, 0),
        new ai.Observation(0, 0, 0, 0, 0.5, 0),
        new ai.Observation(0, 0, 0.5, 0.5, 1, 0),
        new ai.Observation(2, 0.8, 0, 0, -0.1, 1)
    ];
    const actions = [F.TurnLeftOn | F.AccelerationOn, F.TurnRightOn | F.AccelerationOn,
        F.AccelerationOn, F.BrakingOn, F.ReverseOn | F.TurnRightOn];
    observations.forEach((observation, index) => {
        for (let i = 0; i < 5; i++) driver.learn(observation, actions[index]);
    });
    const counts = Array.from(driver.actionCounts);
    observations.forEach((observation, index) => assert.equal(driver.predict(observation), actions[index]));
    assert.equal(driver.count(), 25);
    assert.deepEqual(Array.from(driver.actionCounts), counts, "predictions must not retrain");
});

test("an empty model fails explicitly and buffer replacement updates stored action counts", () => {
    const { racing, ai } = loadRacing();
    const driver = new ai.Driver();
    const observation = new ai.Observation(0, 0, 0, 0, 0, 0);
    assert.throws(() => driver.predict(observation));
    for (let i = 0; i < ai.SAMPLE_LIMIT; i++) driver.learn(observation, racing.ControlStateFlag.AccelerationOn);
    for (let i = 0; i < 25; i++) driver.learn(observation, racing.ControlStateFlag.ReverseOn);
    assert.equal(driver.count(), ai.SAMPLE_LIMIT);
    assert.equal(driver.actionCounts[2], ai.SAMPLE_LIMIT - 25);
    assert.equal(driver.actionCounts[4], 25);
});

test("human and injected AI controls preserve the same physics for every button combination", () => {
    const host = loadRacing();
    for (const offRoad of [false, true]) {
        for (const speed of [-20, 0, 50, host.racing.TOP_SPEED_MAX]) {
            for (let controls = 0; controls < 64; controls++) {
                const human = host.makeBaseCar();
                const ai = host.makeCar();
                human.isOffRoad = ai.isOffRoad = () => offRoad;
                human.speed = ai.speed = speed;
                human.heading = ai.heading = 0.2;
                host.setControls(controls);
                human.controlEnabled = true;
                ai.controlState = (controls & 31) | (controls & 32 ? host.racing.ControlStateFlag.AccelerationOn : 0);
                human.update(50);
                ai.update(50);
                for (const name of ["speed", "heading", "vx", "vy"]) assert.equal(ai[name], human[name]);
            }
        }
    }
});

test("recording observes the controls before physics and only enabled teaching adds examples", () => {
    const host = loadRacing();
    const car = host.makeCar();
    const driver = new host.ai.Driver();
    car.track = {
        updateProgress: () => {},
        observe: () => new host.ai.Observation(0, 0, 0, 0, car.speed / host.racing.TOP_SPEED_MAX, 0)
    };
    car.driver = driver;
    car.teaching = true;
    car.controlEnabled = true;
    car.isOffRoad = () => false;
    let controlReads = 0;
    const readControls = car.updateControls;
    car.updateControls = function () {
        controlReads++;
        readControls.call(this);
    };
    host.setControls(host.racing.ControlStateFlag.AccelerationOn);
    car.update(50);
    assert.equal(driver.count(), 1);
    assert.equal(driver.examples[0].observation.speed, 0);
    assert.equal(controlReads, 1, "the subclass must not read buttons a second time");
    car.controlEnabled = false;
    car.teaching = false;
    for (let i = 0; i < 20; i++) car.update(50);
    assert.equal(driver.count(), 1);
});

test("stopping a learning car freezes its controls and timing", () => {
    const host = loadRacing();
    const car = host.makeCar();
    car.controlEnabled = true;
    host.setControls(host.racing.ControlStateFlag.AccelerationOn);
    car.update(50);
    const elapsed = car.elapsedMillis;
    car.stop();
    car.update(50);
    assert.equal(car.elapsedMillis, elapsed);
    assert.equal(car.controlState, 0);
    assert.equal(car.speed, 0);
    assert.equal(car.vx, 0);
    assert.equal(car.vy, 0);
});

test("the AI-specific car treats positions outside the map as off-road", () => {
    const host = loadRacing();
    const car = host.makeCar();
    assert.equal(car.isOffRoad(), false);
    car.x = -1;
    assert.equal(car.isOffRoad(), true);
    car.x = host.scene.tileMap.data.width * 16;
    assert.equal(car.isOffRoad(), true);
});

test("a model cannot run without a track", () => {
    const host = loadRacing();
    const car = host.makeCar();
    car.driver = new host.ai.Driver();
    assert.throws(() => car.update(50), /Set a track/);
});

test("Up is recorded as acceleration, using the upstream car controls", () => {
    const host = loadRacing();
    const car = host.makeCar();
    car.track = {
        updateProgress: () => {},
        observe: () => new host.ai.Observation(0, 0, 0, 0, car.speed / host.racing.TOP_SPEED_MAX, 0)
    };
    car.driver = new host.ai.Driver();
    car.controlEnabled = car.teaching = true;
    host.setControls(32);
    car.update(50);
    assert.equal(car.controlState, host.racing.ControlStateFlag.AccelerationOn);
    assert.equal(car.driver.actionCounts[2], 1);
    assert.equal(car.driver.examples[0].action.pedal, host.ai.Pedal.Accelerate);
});

test("off-road detection uses the current road color, not an old grass color", () => {
    const host = loadRacing();
    let pixel = 14;
    host.context.myTiles.road.getPixel = () => 14;
    host.scene.tileMap.data.getTileset = () => [{ getPixel: () => pixel }];
    const car = host.makeCar();
    assert.equal(car.isOffRoad(), false);
    for (const offRoadPixel of [0, 7, 11]) {
        pixel = offRoadPixel;
        assert.equal(car.isOffRoad(), true);
    }
});

test("accelerating on grass settles at upstream's 20 px/s rather than the old 4 px/s", () => {
    const host = loadRacing();
    const car = host.makeCar();
    car.isOffRoad = () => true;
    car.speed = 100;
    car.controlState = host.racing.ControlStateFlag.AccelerationOn;
    for (let i = 0; i < 40; i++) car.update(50);
    assert.equal(car.speed, 20);
    assert.equal(car.vx, 20);
});

test("reverse slows forward motion before backing up and mirrors steering", () => {
    const host = loadRacing();
    const car = host.makeCar();
    car.isOffRoad = () => false;
    car.speed = 50;
    car.controlState = host.racing.ControlStateFlag.ReverseOn | host.racing.ControlStateFlag.TurnLeftOn;
    car.update(1000);
    assert.equal(car.speed, 0);
    assert(car.heading > 0);
    car.update(1000);
    assert.equal(car.speed, -20);
});

test("brief pedal changes are recorded between regular samples", () => {
    const host = loadRacing();
    const car = host.makeCar();
    car.track = {
        updateProgress: () => {},
        observe: () => new host.ai.Observation(0, 0, 0, 0, car.speed / host.racing.TOP_SPEED_MAX, 0)
    };
    car.driver = new host.ai.Driver();
    car.controlEnabled = car.teaching = true;
    for (const controls of [1, 0, 1]) {
        host.setControls(controls);
        car.update(25);
    }
    assert.equal(car.driver.count(), 3);
    assert.deepEqual(Array.from(car.driver.examples, example => example.action.pedal),
        [host.ai.Pedal.Accelerate, host.ai.Pedal.Coast, host.ai.Pedal.Accelerate]);
    host.setControls(32);
    car.update(25);
    assert.equal(car.driver.count(), 3, "switching from A to Up is still the same pedal action");
});

test("stopped cars use low-speed pedal examples instead of matching rolling coast examples", () => {
    const host = loadRacing();
    const driver = new host.ai.Driver();
    driver.learn(new host.ai.Observation(0, 0, 0, 0, 0, 0), host.racing.ControlStateFlag.AccelerationOn);
    for (let i = 0; i < 5; i++) {
        driver.learn(new host.ai.Observation(0.2, -0.1, 0.2, 0.2, 0.2, 0, 0.02), 0);
    }
    const stopped = new host.ai.Observation(0.2, -0.1, 0.2, 0.2, 0, 0, 0.02);
    assert.equal(driver.predict(stopped), host.racing.ControlStateFlag.AccelerationOn);
});
