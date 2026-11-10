namespace racing {
    /** Keep the selected car's look-ahead target bound to its own scene. */
    export function followRaceCar(car: Car): () => void {
        const currentScene = game.currentScene();
        const eventContext = currentScene.eventContext;
        const camera = currentScene.camera;
        const target = new Sprite(image.create(2, 2));
        target.setFlag(SpriteFlag.Ghost, true);
        target.setFlag(SpriteFlag.Invisible, true);
        const update = () => {
            target.setPosition(car.x + 30 * Math.cos(car.heading), car.y + 30 * Math.sin(car.heading));
            camera.sprite = target;
        };
        update();
        scene.cameraFollowSprite(target);
        const handler = eventContext.registerFrameHandler(scene.PRE_RENDER_UPDATE_PRIORITY - 1, update);
        return () => {
            eventContext.unregisterFrameHandler(handler);
            if (camera.sprite === target) camera.sprite = undefined;
            target.destroy();
        };
    }

    /** Use the upstream instruments for human races, training, and AI watches. */
    export class DrivingDisplay {
        private visible = true;
        private minimap: scene.Renderable;
        private instruments: scene.Renderable;
        private finishLine: Sprite;
        private timer: timerSprite.TimerSprite;
        private lapTimes: timerSprite.TimerSprite[] = [];
        private completedLaps = 0;
        private lapStart = 0;
        private minimapOffset: util.Point;
        private stopFollowing: () => void;

        constructor(private gates: Gate[], private car: Car, private laps: number) {
            if (!gates.length || laps < 1 || laps > 4 || laps !== Math.floor(laps)) {
                throw "A driving display needs checkpoints and one to four laps";
            }
            this.minimap = racing.createMinimapRenderable(gates, car, () => this.visible);
            this.minimapOffset = racing.getMinimapPoints(gates, 0.018, 1, 1).pop();
            this.finishLine = sprites.create(racing.finishLine);
            this.finishLine.z = car.z - 1;
            this.finishLine.rotation = Math.atan2(gates[0].end.y - gates[0].start.y,
                gates[0].end.x - gates[0].start.x);
            const position = racing.gateCenter(gates[0]);
            this.finishLine.setPosition(position.x, position.y);
            this.timer = racing.createTimer("compact");
            this.timer.top = 0;
            this.timer.setRunning(false);
            this.instruments = scene.createRenderable(10, (target, camera) => {
                const gate = gates[(car.currentGateIndex + 1) % gates.length];
                drawing.drawThickLine(target, drawing.shiftedByCamera(gate.start), drawing.shiftedByCamera(gate.end), 3, 2);
                racing.drawLapIndicator(135, 0, Math.min(car.currentLap, laps - 1), laps);
                racing.drawSpeedometer(19, 20, 99, car.speed, car.stats.topSpeed);
            }, () => this.visible);
            this.stopFollowing = followRaceCar(car);
        }

        update(elapsedMillis: number, completedLaps: number, finished: boolean): void {
            const lap = Math.min(this.laps, completedLaps);
            if (lap > this.completedLaps) {
                const lapTime = racing.createLapTime(this.completedLaps, this.laps, elapsedMillis - this.lapStart);
                lapTime.setFlag(SpriteFlag.Invisible, !this.visible);
                this.lapTimes.push(lapTime);
                this.completedLaps = lap;
                this.lapStart = elapsedMillis;
            }
            this.timer.setElapsedTime(finished ? elapsedMillis : elapsedMillis - this.lapStart);
        }

        drawMinimapDot(target: Image, car: Car, color: number): void {
            if (!this.visible) return;
            target.fillCircle(car.x * 0.018 + this.minimapOffset.x, car.y * 0.018 + this.minimapOffset.y, 2, color);
        }

        setVisible(visible: boolean): void {
            this.visible = visible;
            this.finishLine.setFlag(SpriteFlag.Invisible, !visible);
            this.timer.setFlag(SpriteFlag.Invisible, !visible);
            for (const lapTime of this.lapTimes) lapTime.setFlag(SpriteFlag.Invisible, !visible);
        }

        destroy(): void {
            this.stopFollowing();
            this.minimap.destroy();
            this.instruments.destroy();
            this.finishLine.destroy();
            this.timer.destroy();
            for (const lapTime of this.lapTimes) lapTime.destroy();
        }
    }
}
