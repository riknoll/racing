const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const { test } = require("node:test");
const { root } = require("./test-host");

function entryHost(selections) {
    const events = [];
    const menus = [];
    const originalScene = { car: { x: 100, y: 200 }, minimap: [1, 2, 3] };
    const scenes = [originalScene];
    const slots = [0, 1].map(index => ({ index, driver: { examples: 0, count() { return this.examples; } }, courseIndex: -1 }));
    const driver = slots[0].driver;
    const courses = ["Australia", "Great Britain", "Italy", "Monaco", "Netherlands", "USA"].map(name => ({ name }));
    const context = vm.createContext({
        __choose: (title, choices, subtitle, allowBack, icons, initialSelection = 0) => {
            menus.push({ title, choices: Array.from(choices), subtitle, initialSelection, allowBack });
            assert(selections.length, "test must provide a menu selection");
            return selections.shift();
        },
        __driver: () => driver,
        __train: (course, slot, laps) => {
            events.push(["train", course.name, slot, laps]);
            slots[slot].driver.examples = 55;
            slots[slot].courseIndex = course.name === "Test Track" ? 6 : courses.indexOf(course);
        },
        __trained: () => slots.filter(slot => slot.driver.count() >= 40),
        __slotNames: () => slots.map(slot => "Bot " + (slot.index + 1) + ": " + (slot.courseIndex < 0 ? "Empty" : slot.courseIndex === 6 ? "Test Track" : courses[slot.courseIndex].name)),
        __slot: index => slots[index],
        __load: () => {},
        __botInfo: () => "",
        __view: (data, label) => events.push(["view", data.count(), label]),
        __watch: slot => events.push(["watch", slot]),
        __race: (course, laps) => events.push(["race", course.name, laps, slots.filter(slot => slot.driver.count() >= 40).length]),
        __dispose: () => events.push("dispose"),
        __release: () => {},
        __courses: () => courses,
        __trainingCourses: () => [{ name: "Test Track" }].concat(courses),
        __configure: () => {},
        __frames: () => [{}, {}],
        __icon: () => ({}),
        game: {
            pushScene: () => { scenes.push({}); events.push("push"); },
            popScene: () => { scenes.pop(); events.push("pop"); }
        }
    });
    const declarations = `namespace racing {
        export const chooseMenu = __choose;
        export const getCourses = __courses;
        export const getTrainingCourses = __trainingCourses;
        export const configureMenuTest = __configure;
        export const raceCourse = __race;
        export const releaseMenuButtons = __release;
        export const getCarFrames = __frames;
        export const memoryMenuIcon = __icon;
    }
    namespace aiRacing {
        export const MIN_EXAMPLES = 40;
        export const getTrainingDriver = __driver;
        export const trainFromMenu = __train;
        export const trainedBots = __trained;
        export const botNames = __slotNames;
        export const botSlot = __slot;
        export const loadBots = __load;
        export const botInfo = __botInfo;
        export const showTrainingSummary = __view;
        export const watchBotLap = __watch;
        export const disposeActivity = __dispose;
    }`;
    vm.runInContext(ts.transpileModule(declarations + fs.readFileSync(path.join(root, "startup.ts"), "utf8"), {
        compilerOptions: { target: ts.ScriptTarget.ES2017 }
    }).outputText, context);
    return { context, events, menus, scenes, originalScene };
}

test("the starting menu retains training through View AI and a four-lap map selection", () => {
    const host = entryHost([1, 1, 4, 0, 2, 1, 1, 0, 4, 3, -1]);
    host.context.racing.runGameMenu();
    assert.deepEqual(host.events, ["push", ["train", "Monaco", 1, 1], ["view", 55, "options"], ["race", "Netherlands", 4, 1], "dispose", "pop"]);
    assert.deepEqual(host.menus[0].choices, ["Race", "Train AI", "View AI"]);
    assert.equal(host.menus[0].allowBack, false, "the starting menu must not exit to a hidden demo");
    assert.equal(host.menus[0].subtitle, "NO AI TRAINED");
    assert(host.menus.some(menu => menu.subtitle === "1 AI BOT READY"));
    assert.deepEqual(host.menus.find(menu => menu.title === "Train AI").choices, ["Bot 1: Empty", "Bot 2: Empty"]);
    assert.deepEqual(host.menus.find(menu => menu.title === "View AI" && menu.choices.length === 2 && menu.choices[0].startsWith("Bot")).choices,
        ["Bot 1: Empty", "Bot 2: Monaco"]);
    assert.equal(host.menus.find(menu => menu.title === "Training track").choices[0], "Test Track");
    assert.deepEqual(host.menus.find(menu => menu.title === "Choose track").choices,
        ["Australia", "Great Britain", "Italy", "Monaco", "Netherlands", "USA"]);
    assert.deepEqual(host.menus.find(menu => menu.title === "Choose laps").choices, ["1 lap", "2 laps", "3 laps", "4 laps"]);
    assert.equal(host.scenes[0], host.originalScene);
    assert.equal(host.scenes.length, 1);
});

test("the entrypoint has no direct race fallback after the starting menu", () => {
    const main = fs.readFileSync(path.join(root, "main.ts"), "utf8");
    assert.match(main, /racing\.runGameMenu\(/);
    assert.doesNotMatch(main, /racing\.startRace\(/);
});

test("View AI before teaching shows the actual empty model", () => {
    const host = entryHost([2, 0, -1]);
    host.context.racing.runGameMenu();
    assert.deepEqual(host.events[1], ["view", 0, "back"]);
});

test("back from lap choice returns to map choice, and back from map choice returns to the main menu", () => {
    const host = entryHost([0, 1, -1, -1, -1]);
    host.context.racing.runGameMenu();
    assert.deepEqual(host.menus.map(menu => menu.title), ["RACING", "Choose track", "Choose laps", "Choose track", "RACING"]);
    assert(!host.events.some(event => Array.isArray(event) && event[0] === "race"));
});

test("a failed menu action restores the original scene and allows another launch", () => {
    const host = entryHost([1, 0, 4, 0]);
    host.context.aiRacing.trainFromMenu = () => { throw new Error("lesson failed"); };
    assert.throws(() => host.context.racing.runGameMenu(), /lesson failed/);
    assert.equal(host.scenes[0], host.originalScene);
    host.context.racing.chooseMenu = () => -1;
    host.context.racing.runGameMenu();
    assert.equal(host.scenes.length, 1);
});

test("a running menu rejects a second launch instead of nesting application scenes", () => {
    const host = entryHost([1, 0, 4, 0]);
    host.context.aiRacing.trainFromMenu = () => host.context.racing.runGameMenu();
    assert.throws(() => host.context.racing.runGameMenu(), /already running/);
    assert.deepEqual(host.events, ["push", "dispose", "pop"]);
    assert.equal(host.scenes.length, 1);
});

test("Test Track stays first and defaults to three continuous laps, with no exercise-review menus", () => {
    const host = entryHost([1, 0, 0, 2, -1]);
    host.context.racing.runGameMenu();
    assert.deepEqual(host.events[1], ["train", "Test Track", 0, 3]);
    const lapMenu = host.menus.find(menu => menu.title === "Training laps");
    assert.equal(lapMenu.initialSelection, 2);
    assert.deepEqual(lapMenu.choices, ["1 lap", "2 laps", "3 laps", "4 laps"]);
    assert.deepEqual(host.menus.map(menu => menu.title), ["RACING", "Train AI", "Training track", "Training laps", "RACING"]);
});

test("back from training lap selection returns to the training-track list", () => {
    const host = entryHost([1, 0, 0, -1, -1, -1]);
    host.context.racing.runGameMenu();
    assert.deepEqual(host.menus.map(menu => menu.title),
        ["RACING", "Train AI", "Training track", "Training laps", "Training track", "RACING"]);
    assert(!host.events.some(event => Array.isArray(event) && event[0] === "train"));
});

test("View AI shows graphs first, can watch the chosen bot, then returns to those graphs without retraining", () => {
    const host = entryHost([1, 1, 0, 2, 2, 1, 0, 1, -1]);
    host.context.racing.runGameMenu();
    assert.deepEqual(host.events, [
        "push", ["train", "Test Track", 1, 3],
        ["view", 55, "options"], ["watch", 1], ["view", 55, "options"],
        "dispose", "pop"
    ]);
    const actionMenus = host.menus.filter(menu => menu.choices[0] === "Watch a lap");
    assert.equal(actionMenus.length, 2);
    assert.deepEqual(actionMenus[0].choices, ["Watch a lap", "Back"]);
});
