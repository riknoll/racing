//% color="#007f86" icon="\uf1b9" block="AI Racing" weight=100
namespace aiRacing {
    export const MIN_EXAMPLES = 40;
    export const MIN_ATTEMPT_TIME_MS = 180000;
    let track: Track;
    let driver: Driver;
    let player: LearningCar;
    let watchedCar: LearningCar;
    let cars: LearningCar[] = [];
    let teachingMillis = 0;
    let teachingOffRoadMillis = 0;
    let status = "";
    let initialized = false;
    let showingMessage = false;
    let selectedBot = 0;
    let trainingLaps = 1;
    let drivingDisplay: racing.DrivingDisplay;

    /**
     * Record one lap of player driving.
     */
    //% blockId=racing_ai_teach block="teach AI by driving one lap"
    //% help=github:this/ai/docs/teach-driver
    //% weight=100
    export function teachDriver(): void {
        teachLesson("race", racing.getCourses()[3], selectedBot, 1);
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
        for (const car of cars) car.destroy();
        cars = [];
        driver = new Driver();
        player = new LearningCar(new racing.RacerStats(100, 100, 100, 100, 100, 100), racing.getPlayerCarFrames(), track);
        cars.push(player);
        player.paused = true;
        watchedCar = player;
        drivingDisplay = new racing.DrivingDisplay(track.gates, player, laps);
        status = "READY";
        showMessage("Teach the AI by driving " + laps + (laps === 1 ? " lap." : " laps.")
            + "\nA or Up: accelerate\nB: brake\nLeft/Right: steer\nDown: reverse"
            + "\nDrive continuously until the laps are complete. If you go off-road, show it how to recover. It learns your mistakes too.");
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
    //% blockId=racing_ai_test block="watch one AI race attempt"
    //% help=github:this/ai/docs/test-driver
    //% weight=90
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
        return racer;
    }

    function initialize(course: racing.Course): void {
        if (initialized) return;
        initialized = true;
        tiles.setCurrentTilemap(course.tilemap);
        scene.setBackgroundImage(racing.generateBackground());
        scroller.scrollBackgroundWithCamera(scroller.CameraScrollMode.BothDirections);
        track = course.createTrack();
        game.onUpdate(() => {
            if (!watchedCar) return;
            if (drivingDisplay) {
                drivingDisplay.update(watchedCar.elapsedMillis, watchedCar.currentLap, watchedCar.paused && status !== "READY");
            }
            scene.centerCameraAt(watchedCar.x + 30 * Math.cos(watchedCar.heading),
                watchedCar.y + 30 * Math.sin(watchedCar.heading));
        });
        scene.createRenderable(100, (target, camera) => {
            if (!watchedCar || showingMessage || status !== "READY") return;
            target.fillRect(16, 43, 128, 18, 15);
            target.print("A: start teaching", 29, 48, 1, image.font8);
        });
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

    /** Release scene objects, keeping the model available to the starting menu. */
    export function disposeActivity(): void {
        if (drivingDisplay) drivingDisplay.destroy();
        drivingDisplay = undefined;
        for (const car of cars) car.destroy();
        cars = [];
        track = undefined;
        player = undefined;
        watchedCar = undefined;
        status = "";
        initialized = false;
        trainingLaps = 1;
        showingMessage = false;
    }
}
