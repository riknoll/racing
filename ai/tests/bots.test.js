const assert = require("node:assert/strict");
const { test } = require("node:test");
const { loadRacing, loadCourses } = require("./test-host");

function botHost() {
    const messages = [];
    const host = loadRacing({
        console: { log: () => {} },
        __writeBot: () => { throw "Settings are full"; }
    });
    loadCourses(host);
    host.context.game.showLongText = message => messages.push(message);
    host.context.DialogLayout = { Full: 0 };
    return { ...host, messages };
}

test("only two slots are available for training, viewing, and racing", () => {
    const host = botHost();
    assert.deepEqual(Array.from(host.ai.getBotSlots(), bot => bot.index), [0, 1]);
    assert.deepEqual(Array.from(host.ai.botNames()), ["Bot 1: Empty", "Bot 2: Empty"]);
    assert.throws(() => host.ai.botSlot(2), /valid AI bot slot/);
    assert.throws(() => host.ai.rememberBot(2, new host.ai.Driver(), 6, 1000, 0), /valid AI bot slot/);
    for (let index = 0; index < 2; index++) {
        const driver = host.ai.botSlot(index).driver;
        for (let i = 0; i < 40; i++) driver.learn(new host.ai.Observation(0, 0, 0, 0, 0, 0), 1);
    }
    assert.deepEqual(Array.from(host.ai.trainedBots(), bot => bot.index), [0, 1]);
});

test("a full settings store keeps every newly trained sample in memory without deleting previous slots", () => {
    const host = botHost();
    const first = host.ai.botSlot(0);
    first.driver.learn(new host.ai.Observation(0, 0, 0, 0, 0, 0), 1);
    const current = new host.ai.Driver();
    for (let i = 0; i < 55; i++) current.learn(new host.ai.Observation(0, 0, 0, 0, 0, 0), 2);
    const bot = host.ai.rememberBot(1, current, 3, 1000, 0);
    assert.equal(bot.driver, current);
    assert.equal(bot.driver.count(), 55);
    assert.equal(bot.saved, false);
    assert.equal(first.driver.count(), 1);
    assert.match(host.messages[0], /could not be saved/);
    assert.match(host.ai.botNames()[1], /\*$/);
});

test("Test Track provenance is labeled and an in-memory bot is not overwritten by a second load call", () => {
    const host = botHost();
    host.ai.loadBots();
    const driver = new host.ai.Driver();
    for (let i = 0; i < 40; i++) driver.learn(new host.ai.Observation(0, 0, 0, 0, 0, 0), 1);
    host.ai.rememberBot(1, driver, 6, 1000, 0);
    host.context.aiRacing.readBot = () => { throw new Error("must not reload"); };
    host.ai.loadBots();
    assert.equal(host.ai.botSlot(1).driver, driver);
    assert.equal(host.ai.botNames()[1], "Bot 2: Test Track*");
});
