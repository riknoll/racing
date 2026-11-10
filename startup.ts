namespace racing {
    const DEBUG_TRACK_EDITOR = false;
    let running = false;
    let splashShown = false;

    /** Keep game menus in their own scene while races and training run separately. */
    export function runGameMenu(sequence: string[] = [], repeat = false, skipPrompts = false): void {
        if (running) throw "The racing menu is already running";
        running = true;
        configureMenuTest(sequence, repeat, skipPrompts);
        game.pushScene();
        try {
            if (!splashShown) {
                splashShown = true;
                const splash = scene.createRenderable(200, (target, camera) => {
                    target.drawImage(racingArt.splash, 0, 0);
                });
                try {
                    pause(1000);
                } finally {
                    splash.destroy();
                }
            }
            aiRacing.loadBots();
            aiRacing.getTrainingDriver();
            const icons = createMainMenuIcons();
            const choices = ["Race", "Train AI", "View AI", "TUTORIAL"];
            if (DEBUG_TRACK_EDITOR) choices.push("Track Editor");
            while (true) {
                const selected = chooseMenu("RACING", choices, false, icons, 0,
                    startMenuRaceBackground, racingArt.menuLogo);
                if (selected < 0) break;
                if (selected === 0) chooseRace();
                else if (selected === 1) chooseTraining();
                else if (selected === 2) viewAI();
                else if (selected === 3) howToDrive();
                else if (DEBUG_TRACK_EDITOR && selected === 4) editTrack();
                releaseMenuButtons();
            }
        } finally {
            aiRacing.disposeActivity();
            game.popScene();
            running = false;
        }
    }

    function createMainMenuIcons(): Image[] {
        const car = img`
            . . . . . . 8 8 8 8 8 8 . . . . .
            . . . . . 8 6 6 6 6 6 6 8 . . . .
            . . . . 8 6 6 9 9 6 6 6 6 8 . . .
            . . . . 8 c 9 6 6 6 6 6 c 8 . . .
            . . . 8 6 c 9 6 6 6 6 6 c 6 8 . .
            . . . 8 6 c 9 6 6 6 6 6 c 6 8 . .
            . . . f 6 c 9 6 6 6 6 6 c 6 f . .
            . . . f 8 c 6 6 6 6 6 6 c 8 f . .
            . . . f 6 c 6 b b b b 6 c 6 f . .
            . . . 8 6 6 b c c c c b 6 6 8 . .
            . . . 8 8 b c c c c c c b 8 8 . .
            . . . f 8 9 9 9 9 9 9 9 9 8 f . .
            . . . f 8 d 6 6 6 6 6 6 d 8 f . .
            . . . 8 6 d d 6 6 6 6 d d 6 f . .
            . . . . f 6 d 6 6 6 6 d 6 f . . .
            . . . . . 8 6 6 6 6 6 6 8 . . . .
            . . . . . . 8 8 8 8 8 8 . . . . .
        `;
        const tutorial = img`
            . . . . . . . . . . . . . . . . .
            . . . . 8 8 8 8 8 8 8 8 . . . . .
            . . . 8 6 6 6 6 6 6 6 6 8 . . . .
            . . 8 6 9 6 6 6 6 6 6 c 6 8 . . .
            . 8 6 c 9 6 6 6 6 6 6 c c 6 8 8 .
            8 6 c c 9 9 9 9 9 9 6 c c 9 6 d 8
            8 6 c 6 8 8 8 8 8 8 8 b c 9 6 6 8
            8 6 6 8 b b 8 b b b 8 8 b 9 6 6 8
            8 6 8 b b b 8 b b b b 8 6 6 6 6 8
            c 8 8 6 6 6 8 6 6 6 6 6 8 6 6 6 8
            c 8 8 8 8 8 8 f 8 8 8 f 8 6 d d 8
            c 8 8 8 8 8 8 f 8 8 f 8 8 8 6 d 8
            c 8 8 8 8 8 8 f f f 8 8 8 8 8 8 c
            c 8 f f f f 8 8 8 8 f f f 8 8 8 c
            . c f f f f f 8 8 f f f f f 8 c .
            . . . f f f . . . . f f f f . . .
            . . . . . . . . . . . . . . . . .
        `;
        const training = car.clone();
        training.replace(9, 3);
        training.replace(6, 2);
        training.replace(8, 14);
        return [car, training, memoryMenuIcon(), tutorial];
    }

    function chooseRace(): void {
        const courses = getUnlockedCourses();
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
        const courses = getUnlockedTrainingCourses();
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
        if (!aiRacing.trainedBots().length) {
            showTrainingRequired(true);
            return;
        }
        const slot = chooseMenu("View AI", aiRacing.botNames());
        if (slot < 0) return;
        const bot = aiRacing.botSlot(slot);
        while (true) {
            const trained = bot.driver.count() >= aiRacing.MIN_EXAMPLES;
            const confirmed = aiRacing.showTrainingSummary(bot.driver);
            if (!confirmed || !trained) return;
            const courses = getUnlockedTrainingCourses();
            const course = chooseTrackMenu("Watch track", courses);
            if (course < 0) continue;
            aiRacing.watchBotLap(bot.index, courses[course]);
        }
    }
}
