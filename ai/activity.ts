//% color="#007f86" icon="\uf1b9" block="AI Racing" weight=100
namespace aiRacing {
    const MIN_EXAMPLES = 40;
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

    /**
     * Record one lap of player driving.
     */
    //% blockId=racing_ai_teach block="teach AI by driving one lap"
    //% help=github:this/ai/docs/teach-driver
    //% weight=100
    export function teachDriver(): void {
        initialize();
        for (const car of cars) car.destroy();
        cars = [];
        driver = new Driver();
        player = new LearningCar(new racing.RacerStats(100, 100, 100, 100, 100, 100), racing.getCarFrames(0), track);
        cars.push(player);
        player.paused = true;
        watchedCar = player;
        scene.cameraFollowSprite(player);
        status = "READY";
        showMessage("Teach the AI with one lap.\nA or Up: accelerate\nB: brake\nLeft/Right: steer\nDown: reverse\nComplete one lap to finish teaching.\nIf you go off-road, show it how to recover. It learns your mistakes too.");
        releaseButtons();
        while (!controller.A.isPressed()) pause(20);
        status = "TEACH";
        player.controlEnabled = true;
        player.driver = driver;
        player.teaching = true;
        player.paused = false;
        while (player.completedGates < track.gates.length) {
            pause(20);
        }
        player.stop();
        player.teaching = false;
        teachingMillis = player.elapsedMillis;
        teachingOffRoadMillis = player.offRoadMillis;
        status = "TAUGHT";
        showTrainingSummary(driver);
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
        scene.cameraFollowSprite(racer);
        status = "AI";
        // A slow or unfamiliar driver gets time to try, but cannot run forever.
        const timeLimit = Math.max(120000, teachingMillis * 1.5);
        while (racer.completedGates < track.gates.length && racer.elapsedMillis < timeLimit) {
            pause(20);
        }
        racer.stop();
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

    function initialize(): void {
        if (initialized) return;
        initialized = true;
        tiles.setCurrentTilemap(tilemap`monaco`);
        scene.setBackgroundImage(racing.generateBackground());
        scroller.scrollBackgroundWithCamera(scroller.CameraScrollMode.BothDirections);
        track = new Track(trackWaypoints.monaco, trackCenterlines.monaco, trackRoadWidths.monaco);
        scene.createRenderable(10, (target, camera) => {
            if (!watchedCar || showingMessage) return;
            const gate = track.gates[(watchedCar.currentGateIndex + 1) % track.gates.length];
            drawing.drawThickLine(target, drawing.shiftedByCamera(gate.start), drawing.shiftedByCamera(gate.end), 3, 2);
        });
        scene.createRenderable(100, (target, camera) => {
            if (!watchedCar || showingMessage) return;
            const lineHeight = image.font5.charHeight + 3;
            target.fillRect(0, 0, target.width, lineHeight * 2 + 2, 15);
            target.print(status + " " + Math.min(watchedCar.completedGates, track.gates.length) + "/" + track.gates.length
                + " " + Math.round(watchedCar.elapsedMillis / 1000) + "s", 2, 1, 1, image.font5);
            const hint = status === "READY" ? "A: start teaching"
                : status === "TEACH" ? driver.count() + " examples" : "";
            target.print(hint, 2, lineHeight + 1, 1, image.font5);
        });
    }

    function showMessage(text: string): void {
        // Dialog scenes are see-through; do not paint the HUD or gates over them.
        showingMessage = true;
        game.showLongText(text, DialogLayout.Full);
        showingMessage = false;
    }

    function releaseButtons(): void {
        while (controller.A.isPressed() || controller.B.isPressed() || controller.up.isPressed()) pause(20);
    }

    function cleanPercent(elapsed: number, offRoad: number): number {
        return elapsed ? Math.round(100 * (1 - offRoad / elapsed)) : 100;
    }

    /** Release only the cars and state owned by this AI lesson. */
    export function disposeActivity(): void {
        for (const car of cars) car.destroy();
        cars = [];
        track = undefined;
        driver = undefined;
        player = undefined;
        watchedCar = undefined;
        teachingMillis = 0;
        teachingOffRoadMillis = 0;
        status = "";
        initialized = false;
        showingMessage = false;
    }
}
