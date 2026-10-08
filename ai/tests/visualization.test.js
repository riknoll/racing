const assert = require("node:assert/strict");
const { test } = require("node:test");
const { loadRacing } = require("./test-host");

class RecordingImage {
    constructor(width, height) {
        this.width = width;
        this.height = height;
        this.operations = [];
    }
    fill(color) { this.operations.push({ kind: "fill", color }); }
    fillRect(x, y, width, height, color) { this.operations.push({ kind: "rect", x, y, width, height, color }); }
    drawRect(x, y, width, height, color) { this.operations.push({ kind: "rect", x, y, width, height, color }); }
    drawLine(x, y, endX, endY, color) { this.operations.push({ kind: "line", x, y, endX, endY, color }); }
    setPixel(x, y, color) { this.operations.push({ kind: "pixel", x, y, color }); }
    print(text, x, y, color, font) { this.operations.push({ kind: "text", text, x, y, color, width: text.length * font.charWidth, height: font.charHeight }); }
}

function chartHost() {
    let pauses = 0;
    const host = loadRacing({
        image: { create: (width, height) => new RecordingImage(width, height),
            font5: { charWidth: 6, charHeight: 5 }, font8: { charWidth: 6, charHeight: 8 } },
        pause: () => pauses++
    });
    return { ...host, pauses: () => pauses };
}

test("the chart displays every stored example without changing the model or running predictions", () => {
    const host = chartHost();
    const driver = new host.ai.Driver();
    for (let i = 0; i < 47; i++) {
        driver.learn(new host.ai.Observation(0, 0, 0, 0, i / 47, 0, (i - 23) / 100),
            host.racing.ControlStateFlag.AccelerationOn | (i % 2 ? host.racing.ControlStateFlag.TurnLeftOn : host.racing.ControlStateFlag.TurnRightOn));
    }
    const counts = Array.from(driver.actionCounts);
    const model = JSON.stringify(driver);
    driver.predict = () => { throw new Error("Visualization must not run predictions"); };
    const chart = new host.ai.MemoryChart(driver);
    let dots = 0;
    const drawDot = chart.dot;
    chart.dot = function (observation, action) { dots++; drawDot.call(this, observation, action); };
    chart.draw(true);
    assert.equal(dots, 47);
    assert(host.pauses() > 0 && host.pauses() <= 40);
    chart.switchView();
    assert.equal(dots, 94);
    assert.equal(driver.count(), 47);
    assert.deepEqual(Array.from(driver.actionCounts), counts);
    assert.equal(JSON.stringify(driver), model);
});

test("both views fit the screen and plot extreme angles, forward speed, and reverse inside the chart", () => {
    const host = chartHost();
    const driver = new host.ai.Driver();
    for (let i = 0; i < host.ai.SAMPLE_LIMIT; i++) {
        const controls = [0, 1, 2, 16][i % 4] | [0, 4, 8][i % 3];
        driver.learn(new host.ai.Observation(0, 0, 0, 0, i % 2 ? 2 : -2, 0, i % 2 ? 1 : -1), controls);
    }
    const chart = new host.ai.MemoryChart(driver);
    for (let view = 0; view < 2; view++) {
        chart.picture.operations = [];
        chart.draw(false);
        for (const op of chart.picture.operations) {
            if (op.kind === "fill") continue;
            assert(op.x >= 0 && op.y >= 0, JSON.stringify(op));
            assert(op.x + (op.width || 1) <= 160, JSON.stringify(op));
            assert(op.y + (op.height || 1) <= 120, JSON.stringify(op));
            if (op.kind === "line") assert(op.endX >= 0 && op.endX < 160 && op.endY >= 0 && op.endY < 120);
        }
        chart.switchView();
    }
    for (const speed of [-2, 2]) {
        chart.picture.operations = [];
        chart.dot(new host.ai.Observation(0, 0, 0, 0, speed, 0, speed), new host.ai.Action(1, host.ai.Pedal.Reverse));
        for (const op of chart.picture.operations) {
            assert(op.x >= 7 && op.x <= 152 && op.y >= 29 && op.y <= 74);
            if (op.kind === "line") assert(op.endX >= 7 && op.endX <= 152 && op.endY >= 29 && op.endY <= 74);
        }
    }
});

test("empty models display zero counts rather than fabricated memories", () => {
    const host = chartHost();
    const chart = new host.ai.MemoryChart(new host.ai.Driver());
    let dots = 0;
    chart.dot = () => dots++;
    chart.draw(true);
    assert.equal(dots, 0);
    assert.equal(host.pauses(), 0);
    assert(chart.picture.operations.some(op => op.kind === "text" && op.text.includes("0 EXAMPLES")));
});

test("the temporary visualization scene is popped even if drawing fails", () => {
    const host = chartHost();
    let pushes = 0;
    let pops = 0;
    host.context.game.pushScene = () => pushes++;
    host.context.game.popScene = () => pops++;
    host.context.scene = { setBackgroundColor: () => {}, setBackgroundImage: () => {} };
    host.ai.MemoryChart.prototype.draw = () => { throw new Error("drawing failed"); };
    assert.throws(() => host.ai.showTrainingSummary(new host.ai.Driver()), /drawing failed/);
    assert.equal(pushes, 1);
    assert.equal(pops, 1);
});
