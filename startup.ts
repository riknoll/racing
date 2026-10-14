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
            const icons = [racing.getPlayerCarFrames()[1], racing.getCarFrames(1)[1], memoryMenuIcon()];
            while (true) {
                const selected = chooseMenu("RACING", ["Race", "Train AI", "View AI"], false, icons, 0,
                    startMenuRaceBackground);
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
        const options: MenuOption[] = [
            { name: "LAPS", values: ["1", "2", "3", "4"] },
            { name: "OPPONENTS", values: ["0", "1", "2", "3"], initialSelection: 3 },
            {
                name: "SPEED",
                values: ["Slow", "Med", "Fast"],
                icons: [raceSpeedSlowIcon, raceSpeedMedIcon, raceSpeedFastIcon],
                initialSelection: 2
            }
        ];
        while (true) {
            const selected = chooseTrackMenu("SELECT TRACK", courses);
            if (selected < 0) return;
            const values = chooseOptionsMenu("RACE OPTIONS", options);
            if (!values) continue;
            startRace(courses[selected], values[0] + 1, values[1], values[2]);
            return;
        }
    }

    function chooseTraining(): void {
        const slot = chooseMenu("Train AI", aiRacing.botNames());
        if (slot < 0) return;
        const courses = getTrainingCourses();
        while (true) {
            const course = chooseTrackMenu("SELECT TRACK", courses);
            if (course < 0) return;
            const values = chooseOptionsMenu("TRAINING", [
                { name: "LAPS", values: ["1", "2", "3", "4"], initialSelection: course === 0 ? 2 : 0 }
            ]);
            if (!values) continue;
            aiRacing.trainFromMenu(courses[course], slot, values[0] + 1);
            return;
        }
    }

    function viewAI(): void {
        const slot = chooseMenu("View AI", aiRacing.botNames());
        if (slot < 0) return;
        const bot = aiRacing.botSlot(slot);
        while (true) {
            const trained = bot.driver.count() >= aiRacing.MIN_EXAMPLES;
            aiRacing.showTrainingSummary(bot.driver, trained ? "options" : "back", aiRacing.botInfo(slot));
            if (!trained) return;
            if (!chooseWatch(bot)) return;
        }
    }

    function chooseWatch(bot: aiRacing.BotSlot): boolean {
        while (true) {
            const selected = chooseMenu("View AI", ["Watch a lap", "Watch another track", "Back"]);
            if (selected < 0 || selected === 2) return false;
            if (selected === 0) {
                aiRacing.watchBotLap(bot.index);
                return true;
            }
            const courses = getTrainingCourses();
            const trainingCourse = bot.courseIndex === 6 ? courses[0] : getCourses()[bot.courseIndex];
            const otherCourses = courses.filter(course => course !== trainingCourse);
            const course = chooseTrackMenu("Watch track", otherCourses);
            if (course < 0) continue;
            aiRacing.watchBotLap(bot.index, otherCourses[course]);
            return true;
        }
    }
}
