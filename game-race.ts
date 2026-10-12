namespace racing {
    const BOT_UI_COLORS = [2, 5];
    /** Human and learned racers share physics but keep their own lap progress. */
    export class RaceSession {
        readonly track: aiRacing.Track;
        readonly player: aiRacing.LearningCar;
        readonly opponent: aiRacing.LearningCar;
        readonly opponents: aiRacing.LearningCar[] = [];
        readonly botNumbers: number[] = [];
        readonly gateGoal: number;
        finished = false;
        countdown = 3;
        showingMessage = false;

        constructor(public readonly course: Course, public readonly laps: number, bots: aiRacing.BotSlot[]) {
            if (laps < 1 || laps > 4 || laps !== Math.floor(laps)) throw "Choose one to four racing laps";
            this.track = course.createTrack();
            this.gateGoal = laps * this.track.gates.length;
            const stats = new racing.RacerStats(100, 100, 100, 100, 100, 100);
            this.player = new aiRacing.LearningCar(stats, racing.getCarFrames(0), this.track);
            this.player.controlEnabled = true;
            this.player.paused = true;
            for (const bot of bots) {
                if (bot.driver.count() < aiRacing.MIN_EXAMPLES) continue;
                const opponent = new aiRacing.LearningCar(stats, racing.getCarFrames(bot.index + 1), this.track);
                opponent.driver = bot.driver;
                opponent.paused = true;
                this.opponents.push(opponent);
                this.botNumbers.push(bot.index + 1);
            }
            this.opponent = this.opponents[0];
            if (this.opponents.length) {
                this.offsetStart(this.player, -9);
                for (let i = 0; i < this.opponents.length; i++) {
                    this.offsetStart(this.opponents[i], i % 2 ? -9 : 9, i < 1 ? 0 : 24);
                }
            }
        }

        start(): void {
            this.countdown = 0;
            this.player.paused = false;
            for (const opponent of this.opponents) opponent.paused = false;
        }

        update(): void {
            if (this.countdown || this.finished) return;
            for (const opponent of this.opponents) {
                if (opponent.completedGates >= this.gateGoal) opponent.stop();
            }
            if (this.player.completedGates >= this.gateGoal) {
                this.finished = true;
                this.player.stop();
                for (const opponent of this.opponents) opponent.stop();
            }
        }

        drawWorld(target: Image, camera: scene.Camera, display?: DrivingDisplay): void {
            if (this.showingMessage) return;
            if (display) {
                for (let i = 0; i < this.opponents.length; i++) {
                    display.drawMinimapDot(target, this.opponents[i], BOT_UI_COLORS[this.botNumbers[i] - 1]);
                }
            }
            this.carLabel(target, camera, this.player, "YOU", 1);
            for (let i = 0; i < this.opponents.length; i++) {
                this.carLabel(target, camera, this.opponents[i], "" + this.botNumbers[i], 1, i > 0);
            }
        }

        drawHud(target: Image): void {
            if (this.showingMessage) return;
            if (this.countdown) {
                const font = image.scaledFont(image.font8, 2);
                target.fillRect(66, 44, 28, 28, 15);
                target.print("" + this.countdown, 74, 50, 5, font);
            }
        }

        summary(): string {
            let heading = "Race finished!";
            let place = 1;
            let ai = "";
            for (let i = 0; i < this.opponents.length; i++) {
                const opponent = this.opponents[i];
                const aiFinished = opponent.completedGates >= this.gateGoal;
                if (aiFinished && opponent.elapsedMillis < this.player.elapsedMillis) place++;
                ai += "\nBot " + this.botNumbers[i] + ": " + (aiFinished
                    ? Math.round(opponent.elapsedMillis / 1000) + "s"
                    : opponent.completedGates + "/" + this.gateGoal + " checkpoints");
            }
            if (this.opponents.length) heading = place === 1 ? "YOU WIN!" : "You placed " + place + "/" + (this.opponents.length + 1);
            return heading + "\n" + this.course.name + ": " + this.laps + (this.laps === 1 ? " lap" : " laps")
                + "\nYou: " + Math.round(this.player.elapsedMillis / 1000) + "s" + ai;
        }

        destroy(): void {
            this.player.destroy();
            for (const opponent of this.opponents) opponent.destroy();
        }

        private offsetStart(car: aiRacing.LearningCar, offset: number, behind = 0): void {
            car.x += -Math.sin(car.heading) * offset;
            car.y += Math.cos(car.heading) * offset;
            car.x -= Math.cos(car.heading) * behind;
            car.y -= Math.sin(car.heading) * behind;
            car.lastTrackX = car.x;
            car.lastTrackY = car.y;
        }

        private carLabel(target: Image, camera: scene.Camera, car: aiRacing.LearningCar, label: string, color: number, below = false): void {
            const x = Math.round(car.x - camera.drawOffsetX - label.length * image.font5.charWidth / 2);
            const y = Math.round((below ? car.bottom + 3 : car.top - 8) - camera.drawOffsetY);
            if (x < 0 || x + label.length * image.font5.charWidth > target.width || y < 0 || y + image.font5.charHeight > target.height) return;
            target.fillRect(x - 1, y - 1, label.length * image.font5.charWidth + 2, image.font5.charHeight + 2, 15);
            target.print(label, x, y, color, image.font5);
        }
    }

    let activeRace: RaceSession;

    /** Race the selected course without adding or replacing training examples. */
    export function raceCourse(course: Course, laps: number): void {
        game.pushScene();
        let race: RaceSession;
        let display: DrivingDisplay;
        try {
            tiles.setCurrentTilemap(course.tilemap);
            scene.setBackgroundImage(racing.generateBackground());
            scroller.scrollBackgroundWithCamera(scroller.CameraScrollMode.BothDirections);
            race = new RaceSession(course, laps, aiRacing.trainedBots());
            activeRace = race;
            display = new DrivingDisplay(race.track.gates, race.player, laps);
            scene.createRenderable(10, (target, camera) => race.drawWorld(target, camera, display));
            scene.createRenderable(100, (target, camera) => race.drawHud(target));
            game.onUpdate(() => {
                race.update();
                display.update(race.player.elapsedMillis, race.player.currentLap, race.finished);
                scene.centerCameraAt(race.player.x + 30 * Math.cos(race.player.heading), race.player.y + 30 * Math.sin(race.player.heading));
            });
            releaseMenuButtons();
            if (!skipTestPrompts()) {
                for (let count = 3; count > 0; count--) {
                    race.countdown = count;
                    pause(700);
                }
            }
            race.start();
            while (!race.finished) pause(20);
            race.showingMessage = true;
            display.update(race.player.elapsedMillis, race.player.currentLap, true);
            display.setVisible(false);
            if (skipTestPrompts()) console.log(race.summary());
            else game.showLongText(race.summary(), DialogLayout.Full);
            releaseMenuButtons();
        } finally {
            if (display) display.destroy();
            if (race) race.destroy();
            activeRace = undefined;
            game.popScene();
        }
    }
}
