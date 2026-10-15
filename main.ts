// Launch sample results instead of the game; A replays the animation.
const PREVIEW_RACE_RESULTS = false;

// Use exact menu labels; "Bot 1" also matches its changing slot description.
// Examples: ["Race", "Monaco", "LAPS: B", "Start"], ["View AI", "Bot 1", "Continue", "Back"].
// "manual" pauses scripting for one menu. Exhausting the list restores normal UI.
const MENU_TEST_SEQUENCE: string[] = [];
const MENU_TEST_REPEAT = false;
const MENU_TEST_SKIP_PROMPTS = false;

if (PREVIEW_RACE_RESULTS) {
    const laps = [
        new racing.LapResult(61234, true),
        new racing.LapResult(62567, false),
        new racing.LapResult(59876, true),
        new racing.LapResult(60789, false)
    ];
    let totalTime = 0;
    for (const lap of laps) totalTime += lap.time;
    const result = new racing.RaceResult(laps, totalTime, true, 1);
    scene.setBackgroundColor(11);
    while (true) racing.showRaceResults(result);
} else if (MENU_TEST_SEQUENCE.length || MENU_TEST_REPEAT || MENU_TEST_SKIP_PROMPTS) {
    racing.runGameMenu(MENU_TEST_SEQUENCE, MENU_TEST_REPEAT, MENU_TEST_SKIP_PROMPTS);
} else {
    racing.startGame();
}

// racing.startRace(racing.Track.USA);

// racing.startRace(racing.getCourses()[0], 2, 4);
