namespace racing {
    const TUTORIAL_DRIVING_CONTROLS = ControlStateFlag.AccelerationOn | ControlStateFlag.BrakingOn
        | ControlStateFlag.TurnLeftOn | ControlStateFlag.TurnRightOn | ControlStateFlag.ReverseOn;

    enum TutorialButton {
        A,
        B,
        Up,
        Down,
        Left,
        Right
    }

    const turnSign = img`
            ..............ffff..............
            .............f5555f.............
            ............f55ff55f............
            ...........f55f55f55f...........
            ..........f55f5555f55f..........
            .........f55f555555f55f.........
            ........f55f55555555f55f........
            .......f55f5555555555f55f.......
            ......f55f555555555555f55f......
            .....f55f555555555f5555f55f.....
            ....f55f5555555555ff5555f55f....
            ...f55f555555ffffffff5555f55f...
            ..f55f555555ffffffffff5555f55f..
            .f55f555555ffffffffffff5555f55f.
            f55f5555555fffffffffff555555f55f
            f5f55555555ffffffffff55555555f5f
            f5f55555555fffff55ff555555555f5f
            f55f5555555fffff55f555555555f55f
            .f55f555555fffff55555555555f55f.
            ..f55f55555fffff5555555555f55f..
            ...f55f5555fffff555555555f55f...
            ....f55f5555555555555555f55f....
            .....f55f55555555555555f55f.....
            ......f55f555555555555f55f......
            .......f55f5555555555f55f.......
            ........f55f55555555f55f........
            .........f55f555555f55f.........
            ..........f55f5555f55f..........
            ...........f55f55f55f...........
            ............f55ff55f............
            .............f5555f.............
            ..............ffff..............
        `;

    class TutorialTrack {
        readonly baseline = drivingTutorialTrack.baseline;
        readonly roadWidth = drivingTutorialTrack.roadWidth;
        readonly cornerWidth = drivingTutorialTrack.cornerWidth;
        readonly gapStart = drivingTutorialTrack.gapStart;
        readonly gapEnd = drivingTutorialTrack.gapEnd;
        readonly finishX = drivingTutorialTrack.finishX;
        readonly finishY = drivingTutorialTrack.finishY;
        readonly wave: util.Point[];
        readonly turns: util.Point[];

        constructor() {
            this.wave = this.readPoints(drivingTutorialTrack.wave);
            this.turns = this.readPoints(drivingTutorialTrack.turns);
        }

        private readPoints(data: Buffer): util.Point[] {
            const points: util.Point[] = [];
            for (let i = 0; i < data.length; i += 4) {
                points.push(new util.Point(data.getNumber(NumberFormat.UInt16LE, i),
                    data.getNumber(NumberFormat.UInt16LE, i + 2)));
            }
            return points;
        }
    }

    class TutorialStats extends RacerStats {
        speedLimit = 60;

        constructor() {
            super(0, 100, 100, 100, 100, 100);
        }

        get topSpeed() {
            return this.speedLimit;
        }
    }

    class TutorialCar extends Car {
        allowedControls = 0;

        constructor(stats: TutorialStats) {
            super(stats, getPlayerCarFrames());
        }

        updateControls(): void {
            super.updateControls();
            this.controlState &= this.allowedControls;
        }
    }

    class DrivingTutorial {
        private track = new TutorialTrack();
        private stats = new TutorialStats();
        private car: TutorialCar;
        private carEffects: effects.CarEffects;
        private finish: Sprite;
        private signs: Sprite[] = [];
        private caption: fancyText.TextSprite;
        private ok: fancyText.TextSprite;
        private overlay: scene.Renderable;
        private disposeUpdate: () => void;
        private arrived = false;
        private highlighted: TutorialButton[] = [];
        private buttons = [controller.A, controller.B, controller.up, controller.down, controller.left, controller.right];
        private icons = [drivingControls.a, drivingControls.b];
        private dpad = image.create(25, 25);
        private normalIcons: Image[] = [];
        private pressedIcons: Image[] = [];
        private buttonPositions = [
            new util.Point(44, screen.height - 25),
            new util.Point(35, screen.height - 14),
            new util.Point(11, screen.height - 27),
            new util.Point(11, screen.height - 11),
            new util.Point(3, screen.height - 19),
            new util.Point(19, screen.height - 19)
        ];

        constructor() {
            this.dpad.fillRect(9, 1, 7, 23, 12);
            this.dpad.fillRect(1, 9, 23, 7, 12);
            for (const edge of [1, 23]) {
                this.dpad.setPixel(9, edge, 0);
                this.dpad.setPixel(15, edge, 0);
                this.dpad.setPixel(edge, 9, 0);
                this.dpad.setPixel(edge, 15, 0);
            }
            for (let y = 0; y < this.dpad.height; y++) {
                for (let x = 0; x < this.dpad.width; x++) {
                    if (this.dpad.getPixel(x, y) !== 12) continue;
                    if (!this.dpad.getPixel(x - 1, y)) this.dpad.setPixel(x - 1, y, 15);
                    if (!this.dpad.getPixel(x + 1, y)) this.dpad.setPixel(x + 1, y, 15);
                    if (!this.dpad.getPixel(x, y - 1)) this.dpad.setPixel(x, y - 1, 15);
                    if (!this.dpad.getPixel(x, y + 1)) this.dpad.setPixel(x, y + 1, 15);
                }
            }
            this.dpad.fillRect(11, 10, 3, 5, 11);
            this.dpad.fillRect(10, 11, 5, 3, 11);
            const up = img`
                . c c c c c .
                c c c b c c c
                c c b b b c c
                c b b b b b c
                c c c c c c c
                c c c c c c c
                c c c c c c c
            `;
            const down = up.clone();
            down.flipY();
            const left = img`
                . c c c c c c
                c c c b c c c
                c c b b c c c
                c b b b c c c
                c c b b c c c
                c c c b c c c
                . c c c c c c
            `;
            const right = left.clone();
            right.flipX();
            this.icons.push(up);
            this.icons.push(down);
            this.icons.push(left);
            this.icons.push(right);
            for (let button = 0; button < this.icons.length; button++) {
                this.normalIcons.push(this.createButtonImage(button, false));
                this.pressedIcons.push(this.createButtonImage(button, true));
            }
        }

        private createButtonImage(button: number, pressed: boolean): Image {
            const icon = this.icons[button];
            const face = image.create(icon.width, icon.height);
            for (let y = 0; y < icon.height; y++) {
                for (let x = 0; x < icon.width; x++) {
                    const color = icon.getPixel(x, y);
                    if (pressed && button <= TutorialButton.B) {
                        if (color === 6 || color === 1) face.setPixel(x, y + 1, color === 6 ? 7 : 1);
                    } else {
                        face.setPixel(x, y, pressed && color === 12 ? 3 : color);
                    }
                }
            }
            if (button > TutorialButton.B) return face;
            const outlined = image.create(icon.width + 2, icon.height + 2);
            for (let y = 0; y < face.height; y++) {
                for (let x = 0; x < face.width; x++) {
                    if (!face.getPixel(x, y)) continue;
                    outlined.setPixel(x, y + 1, 15);
                    outlined.setPixel(x + 2, y + 1, 15);
                    outlined.setPixel(x + 1, y, 15);
                    outlined.setPixel(x + 1, y + 2, 15);
                }
            }
            outlined.drawTransparentImage(face, 1, 1);
            return outlined;
        }

        run(): void {
            try {
                this.initialize();
                pauseUntil(() => this.car.x >= 112 - this.car.speed * this.car.speed / (2 * this.stats.deceleration));
                this.brake();
                pauseUntil(() => this.car.speed === 0);
                this.car.x = 112;
                this.arrived = true;
                this.say("Welcome to How to Drive!\nLet's learn the controls together.", []);
                this.say("Hold A or Up to accelerate.", [TutorialButton.A, TutorialButton.Up]);
                const forwardStart = this.car.x;
                this.practice(ControlStateFlag.AccelerationOn);
                this.stats.speedLimit = 180;
                pauseUntil(() => this.car.x - forwardStart >= 180);
                this.success();

                this.car.heading = 0;

                this.say("Hold Down to reverse.\nTry backing up!", [TutorialButton.Down]);
                const reverseStart = this.car.x;
                this.practice(ControlStateFlag.ReverseOn);
                pauseUntil(() => reverseStart - this.car.x >= 64);
                this.success();

                this.stats.speedLimit = 90;
                this.car.heading = 0;

                this.say("Press Left or Right to steer.\nTry steering through the curves!",
                    [TutorialButton.Left, TutorialButton.Right]);
                this.practice(TUTORIAL_DRIVING_CONTROLS);
                pauseUntil(() => this.car.x >= this.track.wave[this.track.wave.length - 1].x);
                this.success();

                this.stats.speedLimit = 110;
                this.car.heading = 0;
                this.say("Grass slows your car down.\nDrive through the gap!",
                    [TutorialButton.A, TutorialButton.Up]);
                this.practice(TUTORIAL_DRIVING_CONTROLS);
                pauseUntil(() => this.car.x >= this.track.gapEnd + 96);
                this.success();

                this.stats.speedLimit = 180;
                this.car.heading = 0;

                this.say("Sharp turns need less speed.\nRelease A or Up to slow down.", [TutorialButton.A, TutorialButton.Up]);
                this.say("You can also press B to brake!", [TutorialButton.B]);
                this.say("The track will have red and\nwhite curbs when a\nsharp turn is coming!", []);
                this.say("Try taking the tight turns!\nSlow down when needed.", [TutorialButton.B]);
                this.practice(TUTORIAL_DRIVING_CONTROLS);
                pauseUntil(() => this.car.x >= this.track.finishX);
                this.brake();
                pauseUntil(() => this.car.speed === 0);
                this.say("You did it! You're ready to race.\nSee you on the starting line!", []);
                pause(1600);
                releaseMenuButtons();
            } finally {
                this.destroy();
            }
        }

        private initialize(): void {
            tiles.setCurrentTilemap(drivingTutorialTrack.createMap());
            scene.setBackgroundImage(generateBackground(BackgroundTileset.Grass));
            scroller.scrollBackgroundWithCamera(scroller.CameraScrollMode.BothDirections);
            const flag = image.create(8, this.track.cornerWidth);
            for (let row = 0; row < this.track.cornerWidth / 4; row++) {
                for (let col = 0; col < 2; col++) {
                    flag.fillRect(col * 4, row * 4, 4, 4, (col + row) % 2 ? 1 : 15);
                }
            }
            this.finish = sprites.create(flag);
            this.finish.setFlag(SpriteFlag.Ghost, true);
            this.finish.z = -1;
            this.finish.setPosition(this.track.finishX, this.track.finishY);
            this.createTurnSigns();
            this.car = new TutorialCar(this.stats);
            this.car.setPosition(28, this.track.baseline);
            this.car.speed = 55;
            this.car.controlState = ControlStateFlag.AccelerationOn;
            this.carEffects = new effects.CarEffects(this.car);
            this.caption = this.createText(fancyText.geometric_sans_6, screen.width - 16, 1);
            this.ok = this.createText(fancyText.geometric_sans_11, 0, 5);
            this.overlay = scene.createRenderable(100, (target, camera) => this.drawOverlay(target));
            const eventContext = game.currentScene().eventContext;
            const handler = eventContext.registerFrameHandler(scene.PRE_RENDER_UPDATE_PRIORITY + 1, () => this.update());
            this.disposeUpdate = () => eventContext.unregisterFrameHandler(handler);
            this.update();
        }

        private createTurnSigns(): void {
            for (let i = 0; i < this.track.turns.length; i++) {
                const turn = this.track.turns[i];
                const previous = i ? this.track.turns[i - 1] : new util.Point(this.track.gapEnd, this.track.baseline);
                const next = i + 1 < this.track.turns.length ? this.track.turns[i + 1]
                    : new util.Point(this.track.finishX, this.track.finishY);
                const length = distance(previous, turn);
                const dx = (turn.x - previous.x) / length;
                const dy = (turn.y - previous.y) / length;
                const incoming = dx > 0 ? 0 : dy > 0 ? 1 : dx < 0 ? 2 : 3;
                const artwork = drawing.rotatedImage(turnSign, incoming + 1);
                if (dx * (next.y - turn.y) - dy * (next.x - turn.x) < 0) {
                    if (dx) artwork.flipY();
                    else artwork.flipX();
                }
                const offset = this.track.cornerWidth / 2 + 4 + artwork.width / 2 + 4;
                for (let side = -1; side <= 1; side += 2) {
                    const sign = sprites.create(artwork);
                    this.signs.push(sign);
                    sign.setFlag(SpriteFlag.Ghost, true);
                    sign.z = -1;
                    sign.setPosition(turn.x - dx * 80 - dy * offset * side,
                        turn.y - dy * 80 + dx * offset * side);
                }
            }
        }

        private createText(font: fancyText.BaseFont, maxWidth: number, color: number): fancyText.TextSprite {
            const text = fancyText.create("", maxWidth, color, font);
            text.setFlag(SpriteFlag.Ghost, true);
            text.setFlag(SpriteFlag.RelativeToCamera, true);
            text.setFlag(SpriteFlag.Invisible, true);
            text.setTextFlag(fancyText.Flag.AlwaysOccupyMaxWidth, false);
            text.setTextFlag(fancyText.Flag.ChangeWidthWhileAnimating, true);
            text.setTextFlag(fancyText.Flag.ChangeHeightWhileAnimating, true);
            text.z = 101;
            return text;
        }

        private say(message: string, highlighted: TutorialButton[]): void {
            this.highlighted = highlighted;
            this.caption.setText(message);
            this.caption.setFlag(SpriteFlag.Invisible, false);
            this.caption.animateAtSpeed(35);
            this.caption.pauseUntilAnimationIsComplete();
            pause(2000);
        }

        private practice(allowedControls: number): void {
            this.highlighted = [];
            this.car.allowedControls = allowedControls;
            this.car.controlEnabled = true;
        }

        private brake(): void {
            this.car.controlEnabled = false;
            this.car.controlState = ControlStateFlag.BrakingOn;
            this.highlighted = [];
        }

        private success(): void {
            this.brake();
            this.caption.setFlag(SpriteFlag.Invisible, true);
            this.ok.setText("OK!");
            this.ok.setFlag(SpriteFlag.Invisible, false);
            this.ok.animateAtSpeed(12);
            pauseUntil(() => this.car.speed === 0);
            this.ok.pauseUntilAnimationIsComplete();
            pause(850);
            this.ok.setFlag(SpriteFlag.Invisible, true);
        }

        private update(): void {
            this.carEffects.update();
            scene.centerCameraAt(this.arrived ? this.car.x : 112,
                (this.arrived ? this.car.y : this.track.baseline) - 18);
            this.caption.left = 8;
            this.caption.top = 5;
            this.ok.x = screen.width / 2;
            this.ok.y = screen.height / 2;
        }

        private drawOverlay(target: Image): void {
            if (!(this.caption.flags & SpriteFlag.Invisible)) {
                drawRoundedBackground(target, this.caption.left - 4, this.caption.top - 3,
                    this.caption.width + 8, this.caption.height + 6, 12);
            }
            if (!(this.ok.flags & SpriteFlag.Invisible)) {
                drawRoundedBackground(target, this.ok.left - 4, this.ok.top - 3,
                    this.ok.width + 8, this.ok.height + 6, 12);
            }
            target.drawTransparentImage(this.dpad, 2, screen.height - 28);
            for (let button = 0; button < this.buttons.length; button++) {
                const highlighted = this.car.controlEnabled ? this.buttons[button].isPressed()
                    : this.highlighted.indexOf(button) >= 0;
                const left = this.buttonPositions[button].x;
                const top = this.buttonPositions[button].y;
                target.drawTransparentImage(highlighted ? this.pressedIcons[button] : this.normalIcons[button], left, top);
            }
        }

        private destroy(): void {
            if (this.disposeUpdate) this.disposeUpdate();
            if (this.overlay) this.overlay.destroy();
            if (this.caption) this.caption.destroy();
            if (this.ok) this.ok.destroy();
            if (this.carEffects) this.carEffects.destroy();
            if (this.car) this.car.destroy();
            if (this.finish) this.finish.destroy();
            for (const sign of this.signs) sign.destroy();
        }
    }

    export function howToDrive(): void {
        game.pushScene();
        try {
            const tutorial = new DrivingTutorial();
            tutorial.run();
        } finally {
            game.popScene();
        }
    }
}
