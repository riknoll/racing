namespace aiRacing {
    export const MIN_EXAMPLES = 40;
    export const MIN_ATTEMPT_TIME_MS = 180000;
    let track: Track;
    let driver: Driver;
    let player: LearningCar;
    let watchedCar: LearningCar;
    let cars: LearningCar[] = [];
    let carEffects: racing.effects.CarEffects[] = [];
    let teachingMillis = 0;
    let teachingOffRoadMillis = 0;
    let status = "";
    let initialized = false;
    let showingMessage = false;
    let selectedBot = 0;
    let trainingLaps = 1;
    let drivingDisplay: racing.DrivingDisplay;

    /**
     * Record one lap of player driving on the selected training track.
     * @param track the course to teach on
     */
    //% blockId=racing_ai_teach block="teach AI by driving one lap on $track"
    //% help=github:this/ai/docs/teach-driver
    //% blockNamespace=racing group="Game" weight=80
    //% track.defl=racing.TrainingTrack.TestTrack
    export function teachDriver(track: racing.TrainingTrack = racing.TrainingTrack.TestTrack): void {
        const courses = racing.getTrainingCourses();
        if (track < 0 || track >= courses.length || track !== Math.floor(track)) throw "Choose a valid training track";
        teachLesson("race", courses[track], selectedBot, 1);
    }

    function teachLesson(continueText: string, course: racing.Course, slot: number, laps: number): void {
        if (laps < 1 || laps > 4 || laps !== Math.floor(laps)) throw "Choose one to four training laps";
        let courseIndex = racing.getCourses().indexOf(course);
        if (courseIndex < 0) {
            if (course !== racing.getTrainingCourses()[0]) throw "Choose a valid training track";
            courseIndex = 6;
        }
        trainingLaps = laps;
        initialize(course);
        if (drivingDisplay) drivingDisplay.destroy();
        disposeCars();
        driver = new Driver();
        player = new LearningCar(new racing.RacerStats(100, 100, 100, 100, 100, 100), racing.getPlayerCarFrames(), track);
        cars.push(player);
        carEffects.push(new racing.effects.CarEffects(player));
        player.paused = true;
        watchedCar = player;
        drivingDisplay = new racing.DrivingDisplay(track.gates, player, laps);
        status = "READY";
        showTrainingHelp(laps);
        releaseButtons();
        if (!racing.skipTestPrompts()) {
            while (!controller.A.isPressed()) pause(20);
        }
        status = "TEACH";
        player.controlEnabled = true;
        player.driver = driver;
        player.teaching = true;
        player.paused = false;
        while (player.completedGates < laps * track.gates.length) {
            pause(20);
        }
        player.stop();
        drivingDisplay.update(player.elapsedMillis, player.currentLap, true);
        player.teaching = false;
        teachingMillis = player.elapsedMillis;
        teachingOffRoadMillis = player.offRoadMillis;
        status = "TAUGHT";
        let bot: BotSlot;
        showingMessage = true;
        drivingDisplay.setVisible(false);
        try {
            bot = rememberBot(slot, driver, courseIndex, teachingMillis, teachingOffRoadMillis);
        } finally {
            showingMessage = false;
            drivingDisplay.setVisible(true);
        }
        selectedBot = slot;
        driver = bot.driver;
        showTrainingSummary(driver, continueText);
    }

    /** Teaching from the menu keeps its model when the teaching scene closes. */
    export function trainFromMenu(course: racing.Course, slot: number, laps = 1): void {
        game.pushScene();
        try {
            teachLesson("back", course, slot, laps);
            racing.releaseMenuButtons();
        } finally {
            disposeActivity();
            game.popScene();
        }
    }

    export function getTrainingDriver(): Driver {
        driver = botSlot(selectedBot).driver;
        return driver;
    }

    /**
     * Attempt one lap using the recorded examples, without further learning.
     */
    export function testDriver(): void {
        if (!driver || driver.count() < MIN_EXAMPLES) {
            showMessage("Teach the AI first. It needs at least " + MIN_EXAMPLES + " driving examples.");
            return;
        }
        releaseButtons();
        player.setFlag(SpriteFlag.Invisible, true);
        const racer = addRacer(1);
        watchedCar = racer;
        if (drivingDisplay) drivingDisplay.destroy();
        drivingDisplay = new racing.DrivingDisplay(track.gates, racer, 1);
        status = "AI";
        // A slow or unfamiliar driver gets time to try, but cannot run forever.
        const timeLimit = Math.max(MIN_ATTEMPT_TIME_MS, teachingMillis * 1.5);
        while (racer.completedGates < track.gates.length && racer.elapsedMillis < timeLimit) {
            pause(20);
        }
        racer.stop();
        drivingDisplay.update(racer.elapsedMillis, racer.currentLap, true);
        status = racer.completedGates >= track.gates.length ? "FINISHED" : "STOPPED";
        showMessage("AI " + (status === "FINISHED" ? "finished the lap!" : "attempt ended before a full lap.")
            + "\nYour drive: " + Math.round(teachingMillis / 1000) + "s, " + cleanPercent(teachingMillis, teachingOffRoadMillis) + "% on-road"
            + "\nAI drive: " + Math.round(racer.elapsedMillis / 1000) + "s, " + cleanPercent(racer.elapsedMillis, racer.offRoadMillis) + "% on-road"
            + "\nGates: " + Math.min(racer.completedGates, track.gates.length) + "/" + track.gates.length
            + "\nThe test did not change its training examples.");
    }

    /** Additional racers share examples, but keep their own controls and progress. */
    export function addRacer(colorIndex: number): LearningCar {
        if (!driver || driver.count() < MIN_EXAMPLES) throw "Teach the AI before adding a racer";
        if (colorIndex < 0 || colorIndex >= racing.colorMap.height || colorIndex !== Math.floor(colorIndex)) {
            throw "Choose a valid racing car color";
        }
        const racer = new LearningCar(player.stats, racing.getCarFrames(colorIndex), track);
        racer.driver = driver;
        cars.push(racer);
        carEffects.push(new racing.effects.CarEffects(racer));
        return racer;
    }

    function initialize(course: racing.Course): void {
        tiles.setCurrentTilemap(course.tilemap);
        scene.setBackgroundImage(racing.generateBackground(course.backgroundTileset));
        scroller.scrollBackgroundWithCamera(scroller.CameraScrollMode.BothDirections);
        track = course.createTrack();
        if (initialized) return;
        initialized = true;
        game.onUpdate(() => {
            for (const effects of carEffects) effects.update();
            if (!watchedCar) return;
            if (drivingDisplay) {
                drivingDisplay.update(watchedCar.elapsedMillis, watchedCar.currentLap, watchedCar.paused && status !== "READY");
            }
        });
        const startFont = fancyText.geometric_sans_6;
        const startPrompt = image.create(12 + fancyText.getTextWidth(startFont, "Start teaching"), 11);
        startPrompt.drawTransparentImage(racing.drivingControls.a, 0, 1);
        fancyText.draw("Start teaching", startPrompt, 12, 1, 0, 1, startFont);
        scene.createRenderable(100, (target, camera) => {
            if (!watchedCar || showingMessage || status !== "READY") return;
            const left = Math.idiv(target.width - startPrompt.width, 2);
            racing.drawRoundedBackground(target, left - 4, 43, startPrompt.width + 8, 15);
            target.drawTransparentImage(startPrompt, left, 45);
        });
    }

    function createTrainingHelp(laps: number): Image {
        const picture = image.create(screen.width, screen.height);
        picture.fill(12);
        racing.drawRoundedBackground(picture, 3, 2, picture.width - 6, 116, 9);
        racing.drawRoundedBackground(picture, 4, 3, picture.width - 8, 114);
        const font = fancyText.geometric_sans_6;
        const centeredText = (text: string, top: number, textFont: fancyText.BaseFont, color: number) => {
            fancyText.draw(text, picture, Math.idiv(picture.width - fancyText.getTextWidth(textFont, text), 2),
                top, 0, color, textFont);
        };
        centeredText("TEACH THE AI", 5, fancyText.geometric_sans_7, 5);
        centeredText("Drive " + laps + (laps === 1 ? " lap" : " laps") + " to teach it.", 17, font, 1);

        const accelerate = image.create(20, 8);
        accelerate.drawTransparentImage(racing.drivingControls.a, 0, 0);
        accelerate.drawTransparentImage(racing.drivingControls.up, 12, 0);
        const steer = image.create(20, 8);
        steer.drawTransparentImage(racing.drivingControls.left, 0, 0);
        steer.drawTransparentImage(racing.drivingControls.right, 12, 0);
        const controls = [accelerate, racing.drivingControls.b, steer, racing.drivingControls.down];
        const descriptions = ["Accelerate", "Brake", "Steer", "Reverse"];
        const columnLeft = Math.idiv(picture.width - 136, 2);
        const rowHeight = 10;
        picture.fillRect(columnLeft + 35, 29, 1, controls.length * rowHeight, 12);
        for (let i = 0; i < controls.length; i++) {
            const top = 29 + i * rowHeight;
            const icon = controls[i];
            picture.drawTransparentImage(icon, columnLeft + 16 - Math.idiv(icon.width, 2),
                top + Math.idiv(rowHeight - icon.height, 2));
            fancyText.draw(descriptions[i], picture, columnLeft + 44,
                top + Math.idiv(rowHeight - font.lineHeight, 2), 0, 1, font);
        }

        centeredText("Keep driving until the end.", 74, font, 1);
        centeredText("Show off-road recovery.", 83, font, 1);
        centeredText("It learns your mistakes, too.", 92, font, 1);
        const continueLeft = Math.idiv(picture.width - 12 - fancyText.getTextWidth(font, "Continue"), 2);
        picture.drawTransparentImage(racing.drivingControls.a, continueLeft, 106);
        fancyText.draw("Continue", picture, continueLeft + 12, 106, 0, 1, font);
        return picture;
    }

    function showTrainingHelp(laps: number): void {
        if (racing.skipTestPrompts()) {
            console.log("Teach the AI by driving " + laps + (laps === 1 ? " lap." : " laps."));
            return;
        }
        const picture = createTrainingHelp(laps);
        showingMessage = true;
        if (drivingDisplay) drivingDisplay.setVisible(false);
        game.pushScene();
        let renderable: scene.Renderable;
        try {
            renderable = scene.createRenderable(110, (target, camera) => {
                target.drawImage(picture, 0, 0);
            });
            racing.pauseUntilAllButtonsReleased();
            pauseUntil(() => controller.A.isPressed());
            racing.pauseUntilAllButtonsReleased();
        } finally {
            if (renderable) renderable.destroy();
            game.popScene();
            showingMessage = false;
            if (drivingDisplay) drivingDisplay.setVisible(true);
        }
    }

    function showMessage(text: string): void {
        if (racing.skipTestPrompts()) {
            console.log(text);
            return;
        }
        // Dialog scenes are see-through; do not paint the HUD or gates over them.
        showingMessage = true;
        if (drivingDisplay) drivingDisplay.setVisible(false);
        try {
            game.showLongText(text, DialogLayout.Full);
        } finally {
            showingMessage = false;
            if (drivingDisplay) drivingDisplay.setVisible(true);
        }
    }

    function releaseButtons(): void {
        while (controller.A.isPressed() || controller.B.isPressed() || controller.up.isPressed()) pause(20);
    }

    function cleanPercent(elapsed: number, offRoad: number): number {
        return elapsed ? Math.round(100 * (1 - offRoad / elapsed)) : 100;
    }

    function disposeCars(): void {
        for (const effects of carEffects) effects.destroy();
        carEffects = [];
        for (const car of cars) car.destroy();
        cars = [];
    }

    /** Release scene objects, keeping the model available to the starting menu. */
    export function disposeActivity(): void {
        if (drivingDisplay) drivingDisplay.destroy();
        drivingDisplay = undefined;
        disposeCars();
        track = undefined;
        player = undefined;
        watchedCar = undefined;
        status = "";
        initialized = false;
        trainingLaps = 1;
        showingMessage = false;
    }
}
