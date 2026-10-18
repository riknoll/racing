namespace aiRacing {
    /** Watch one stored bot without recording examples or requiring a player car. */
    export class LapWatch {
        readonly course: racing.Course;
        readonly track: Track;
        readonly car: LearningCar;
        readonly timeLimit: number;
        ended = false;
        cancelled = false;

        constructor(public readonly bot: BotSlot, course?: racing.Course) {
            if (bot.driver.count() < MIN_EXAMPLES) throw "Train this bot before watching a lap";
            this.course = resolveWatchCourse(bot, course);
            this.track = this.course.createTrack();
            this.car = new LearningCar(new racing.RacerStats(100, 100, 100, 100, 100, 100),
                racing.getCarFrames(bot.index + 1), this.track);
            this.car.driver = bot.driver;
            this.timeLimit = Math.max(MIN_ATTEMPT_TIME_MS, bot.teachingMillis * 1.5);
        }

        update(cancel: boolean): void {
            if (this.ended) return;
            const finished = this.car.completedGates >= this.track.gates.length;
            if (finished || this.car.elapsedMillis >= this.timeLimit || cancel) {
                this.cancelled = cancel && !finished;
                this.ended = true;
                this.car.brakeToStop();
            }
        }

        result(): racing.RaceResult {
            const finished = this.car.completedGates >= this.track.gates.length;
            const laps = finished ? [new racing.LapResult(this.car.elapsedMillis, false)] : [];
            return new racing.RaceResult(laps, this.car.elapsedMillis, false);
        }

        summary(): string {
            const finished = this.car.completedGates >= this.track.gates.length;
            return "Bot " + (this.bot.index + 1) + (finished ? " finished the lap!" : this.cancelled
                ? " watch stopped." : " reached the time limit.")
                + "\n" + this.course.name + "\nTime: " + Math.round(this.car.elapsedMillis / 1000) + "s"
                + "\nCheckpoints: " + Math.min(this.car.completedGates, this.track.gates.length) + "/" + this.track.gates.length
                + "\nWatching did not change the training.";
        }
    }

    let activeWatch: LapWatch;

    function resolveWatchCourse(bot: BotSlot, selected?: racing.Course): racing.Course {
        if (selected) {
            if (racing.getTrainingCourses().indexOf(selected) < 0) throw "Choose a valid watch track";
            return selected;
        }
        const course = bot.courseIndex === 6 ? racing.getTrainingCourses()[0] : racing.getCourses()[bot.courseIndex];
        if (!course) throw "The bot's training track is unavailable";
        return course;
    }

    /** Watch the training track unless another registered course is selected. */
    export function watchBotLap(index: number, course?: racing.Course): void {
        const bot = botSlot(index);
        if (bot.driver.count() < MIN_EXAMPLES) throw "Train this bot before watching a lap";
        const selectedCourse = resolveWatchCourse(bot, course);
        game.pushScene();
        let watch: LapWatch;
        let display: racing.DrivingDisplay;
        let showingResults = false;
        try {
            tiles.setCurrentTilemap(selectedCourse.tilemap);
            scene.setBackgroundImage(racing.generateBackground(selectedCourse.backgroundTileset));
            scroller.scrollBackgroundWithCamera(scroller.CameraScrollMode.BothDirections);
            racing.releaseMenuButtons();
            watch = new LapWatch(bot, selectedCourse);
            activeWatch = watch;
            display = new racing.DrivingDisplay(watch.track.gates, watch.car, 1);
            scene.createRenderable(100, target => {
                if (showingResults) return;
                target.fillRect(54, 111, 39, 8, 15);
                target.print("B back", 56, 113, 1, image.font5);
            });
            game.onUpdate(() => {
                watch.update(controller.B.isPressed());
                display.update(watch.car.elapsedMillis, watch.car.currentLap, watch.ended);
                scene.centerCameraAt(watch.car.x + 30 * Math.cos(watch.car.heading),
                    watch.car.y + 30 * Math.sin(watch.car.heading));
            });
            while (!watch.ended) pause(20);
            showingResults = true;
            display.setVisible(false);
            if (racing.skipTestPrompts()) console.log(watch.summary());
            else {
                const result = watch.result();
                racing.showRaceResults(result, result.laps.length ? undefined
                    : watch.cancelled ? "WATCH STOPPED" : "TIME LIMIT");
            }
            racing.releaseMenuButtons();
        } finally {
            if (display) display.destroy();
            if (watch) watch.car.destroy();
            activeWatch = undefined;
            game.popScene();
        }
    }
}
