namespace racing {
    let running = false;

    /** Keep game menus in their own scene while races and training run separately. */
    export function runGameMenu(sequence: string[] = [], repeat = false, skipPrompts = false): void {
        if (running) throw "The racing menu is already running";
        running = true;
        configureMenuTest(sequence, repeat, skipPrompts);
        game.pushScene();
        try {
            aiRacing.loadBots();
            aiRacing.getTrainingDriver();
            const icons = [racing.getCarFrames(0)[1], racing.getCarFrames(1)[1], memoryMenuIcon()];
            while (true) {
                const count = aiRacing.trainedBots().length;
                const status = count ? count + (count === 1 ? " AI BOT READY" : " AI BOTS READY") : "NO AI TRAINED";
                const selected = chooseMenu("RACING", ["Race", "Train AI", "View AI"], status, false, icons);
                if (selected < 0) break;
                if (selected === 0) chooseRace();
                else if (selected === 1) chooseTraining();
                else viewAI();
                releaseMenuButtons();
            }
        } finally {
            aiRacing.disposeActivity();
            game.popScene();
            running = false;
        }
    }

    function chooseRace(): void {
        const courses = getCourses();
        while (true) {
            const selected = chooseMenu("Choose track", courses.map(course => course.name), "Six race courses");
            if (selected < 0) return;
            const laps = chooseMenu("Choose laps", ["1 lap", "2 laps", "3 laps", "4 laps"], courses[selected].name);
            if (laps < 0) continue;
            raceCourse(courses[selected], laps + 1);
            return;
        }
    }

    function chooseTraining(): void {
        const slot = chooseMenu("Train AI", aiRacing.botNames(), "Choose slot (* unsaved)");
        if (slot < 0) return;
        const courses = getTrainingCourses();
        while (true) {
            const course = chooseMenu("Training track", courses.map(value => value.name), "Continuous lap training");
            if (course < 0) return;
            const laps = chooseMenu("Training laps", ["1 lap", "2 laps", "3 laps", "4 laps"],
                courses[course].name, true, undefined, course === 0 ? 2 : 0);
            if (laps < 0) continue;
            aiRacing.trainFromMenu(courses[course], slot, laps + 1);
            return;
        }
    }

    function viewAI(): void {
        const slot = chooseMenu("View AI", aiRacing.botNames(), "Choose a bot's memories");
        if (slot < 0) return;
        const bot = aiRacing.botSlot(slot);
        while (true) {
            const trained = bot.driver.count() >= aiRacing.MIN_EXAMPLES;
            aiRacing.showTrainingSummary(bot.driver, trained ? "options" : "back", aiRacing.botInfo(slot));
            if (!trained) return;
            const selected = chooseMenu("View AI", ["Watch a lap", "Back"], "Bot " + (slot + 1));
            if (selected !== 0) return;
            aiRacing.watchBotLap(slot);
        }
    }
}
