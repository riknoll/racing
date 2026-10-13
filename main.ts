// Use exact menu labels; "Bot 1" also matches its changing slot description.
// Examples: ["Race", "Monaco", "2 laps"], ["View AI", "Bot 1", "Continue", "Back"].
// "manual" pauses scripting for one menu. Exhausting the list restores normal UI.
const MENU_TEST_SEQUENCE: string[] = [];
const MENU_TEST_REPEAT = false;
const MENU_TEST_SKIP_PROMPTS = false;

if (MENU_TEST_SEQUENCE.length || MENU_TEST_REPEAT || MENU_TEST_SKIP_PROMPTS) {
    racing.runGameMenu(MENU_TEST_SEQUENCE, MENU_TEST_REPEAT, MENU_TEST_SKIP_PROMPTS);
} else {
    racing.startGame();
}
