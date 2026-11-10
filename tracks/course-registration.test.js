const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const { stripTypeScriptTypes } = require("node:module")
const test = require("node:test")
const vm = require("node:vm")

test("JSON courses, block IDs and saved bot IDs stay aligned after removing SVG courses", () => {
    const root = path.join(__dirname, "..")
    const context = vm.createContext({
        tilemap: ([name]) => ({ name }),
        trackWaypoints: {}, trackCenterlines: {}, trackRoadWidths: {},
        BackgroundTileset: { DryGrass: 0, Grass: 1, DarkGrass: 2, Stone: 3, Checkerboard: 4, Sand: 5 },
    })
    const load = file => vm.runInContext(stripTypeScriptTypes(fs.readFileSync(path.join(root, file), "utf8"),
        { mode: "transform" }), context)
    load("race.ts")
    context.Track = context.racing.Track
    load("courses.ts")
    context.PreviewScrollDirection = context.racing.PreviewScrollDirection
    const courses = context.racing.getCourses()
    assert.deepEqual(Array.from(courses, course => [course.name, course.trackId]).sort(),
        [["Monclava", 7], ["Strasbourg", 8], ["Vancouver", 9], ["Hanover", 10],
            ["Birmingham", 11], ["Seattle", 12], ["Sydney", 13]].sort())
    assert.equal(context.racing.TrainingTrack.Monclava, 8)
    assert.equal(context.racing.TrainingTrack.Birmingham, 12)
    assert.equal(context.racing.TrainingTrack.Seattle, 13)
    assert.equal(context.racing.TrainingTrack.Sydney, 14)
    assert.equal(context.racing.Track.Monaco, undefined)
    for (const course of courses) {
        assert.ok(fs.existsSync(path.join(__dirname, `${course.name.toLowerCase()}.json`)))
    }
    load("ai/bots.ts")
    const testTrack = { name: "Test Track" }
    context.racing.getTrainingCourses = () => [testTrack, ...courses]
    assert.equal(context.aiRacing.botCourse(6), testTrack)
    courses.forEach(course => assert.equal(context.aiRacing.botCourse(course.trackId + 1), course))
    for (const id of [0, 1, 2, 3, 4, 5, 7]) {
        assert.throws(() => context.aiRacing.botCourse(id), error =>
            error === "The bot's training track is unavailable")
    }
})
