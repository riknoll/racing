namespace racing {
    const EDITOR_GRID_X = 4;
    const EDITOR_GRID_Y = 12;
    const EDITOR_CELL_SIZE = 5;

    class TrackEditor {
        private model: trackEditor.Model;
        private focus: number;
        private done: boolean;
        private saved: boolean;
        private saveError: boolean;
        private invalid: boolean[];
        private valid: boolean;
        private shifting: boolean;
        private shiftBlocked: boolean;

        constructor(points: trackEditor.Point[] = []) {
            this.model = new trackEditor.Model(points);
            this.focus = 0;
            this.done = this.saved = this.saveError = false;
            this.shifting = this.shiftBlocked = false;
            this.refresh();
        }

        run(): void {
            game.pushScene();
            try {
                scene.setBackgroundColor(15);
                releaseMenuButtons();
                scene.createRenderable(100, target => this.draw(target));
                const directions = [controller.up, controller.down, controller.left, controller.right];
                const dx = [0, 0, -1, 1];
                const dy = [-1, 1, 0, 0];
                const held = [false, false, false, false];
                const nextMove = [0, 0, 0, 0];
                let wasA = false;
                let wasB = false;
                while (!this.done) {
                    const a = controller.A.isPressed();
                    const b = controller.B.isPressed();
                    if (a && !wasA) this.pressA();
                    if (!a && wasA) {
                        this.model.releaseA(game.runtime());
                        this.refresh();
                    }
                    if (b && !wasB && this.shifting) {
                        this.shifting = this.shiftBlocked = false;
                    } else if (b && !wasB && this.focus === 0) {
                        this.model.deleteNode();
                        this.saved = this.saveError = false;
                        this.refresh();
                    }
                    wasA = a;
                    wasB = b;
                    const now = game.runtime();
                    for (let i = 0; i < directions.length; i++) {
                        const pressed = directions[i].isPressed();
                        if (pressed && (!held[i] || now >= nextMove[i])) {
                            this.move(dx[i], dy[i]);
                            nextMove[i] = now + (held[i] ? 80 : 250);
                        }
                        held[i] = pressed;
                    }
                    pause(20);
                }
                releaseMenuButtons();
            } finally {
                game.popScene();
            }
        }

        private move(dx: number, dy: number): void {
            this.saveError = false;
            this.shiftBlocked = false;
            if (this.shifting) {
                if (this.model.shift(dx, dy)) {
                    this.saved = false;
                    this.refresh();
                } else {
                    this.shiftBlocked = true;
                }
            } else if (this.focus !== 0) {
                if (dx < 0) this.focus = 0;
                else if (dy !== 0) this.focus = Math.max(1, Math.min(7, this.focus + dy));
            } else if (dx > 0 && this.model.cursorX === trackEditor.GRID_SIZE && this.model.dragging < 0) {
                this.focus = 1;
            } else {
                if (this.model.dragging >= 0) this.saved = false;
                this.model.move(dx, dy);
                if (this.model.dragging >= 0) this.refresh();
            }
        }

        private pressA(): void {
            if (this.shifting) {
                this.shifting = this.shiftBlocked = false;
            } else if (this.focus === 7) {
                this.done = true;
            } else if (this.focus >= 3) {
                if (this.focus === 3) this.model.reverse();
                else if (this.focus === 4) this.model.flipHorizontal();
                else if (this.focus === 5) this.model.flipVertical();
                else this.model.rotate();
                this.saved = this.saveError = false;
                this.refresh();
            } else if (this.focus === 2) {
                this.shifting = true;
            } else if (this.focus === 1) {
                if (this.valid) {
                    console.log(this.model.serialize());
                    this.saved = true;
                    this.saveError = false;
                } else {
                    this.saveError = true;
                }
            } else {
                this.model.pressA(game.runtime());
                this.saved = this.saveError = false;
                this.refresh();
            }
        }

        private refresh(): void {
            this.invalid = trackEditor.invalidSegments(this.model.points);
            this.valid = this.model.dragging < 0 && this.model.points.length >= 3
                && !this.invalid.some(value => value);
        }

        private draw(target: Image): void {
            target.fill(15);
            target.print("TRACK EDITOR", 4, 2, 1, image.font5);
            for (let i = 0; i <= trackEditor.GRID_SIZE; i++) {
                const offset = i * EDITOR_CELL_SIZE;
                target.drawLine(EDITOR_GRID_X + offset, EDITOR_GRID_Y,
                    EDITOR_GRID_X + offset, EDITOR_GRID_Y + 100, 11);
                target.drawLine(EDITOR_GRID_X, EDITOR_GRID_Y + offset,
                    EDITOR_GRID_X + 100, EDITOR_GRID_Y + offset, 11);
            }
            const points = this.model.points;
            const invalid = this.invalid;
            for (let i = 0; i < points.length; i++) {
                const a = points[i];
                const b = points[(i + 1) % points.length];
                target.drawLine(EDITOR_GRID_X + a.x * EDITOR_CELL_SIZE, EDITOR_GRID_Y + a.y * EDITOR_CELL_SIZE,
                    EDITOR_GRID_X + b.x * EDITOR_CELL_SIZE, EDITOR_GRID_Y + b.y * EDITOR_CELL_SIZE,
                    invalid[i] ? 2 : i === 0 ? 5 : 9);
            }
            for (let i = 0; i < points.length; i++) {
                const point = points[i];
                target.fillRect(EDITOR_GRID_X + point.x * EDITOR_CELL_SIZE - 1,
                    EDITOR_GRID_Y + point.y * EDITOR_CELL_SIZE - 1, 3, 3, i === 0 ? 5 : 1);
            }
            if (this.focus === 0) {
                target.drawRect(EDITOR_GRID_X + this.model.cursorX * EDITOR_CELL_SIZE - 2,
                    EDITOR_GRID_Y + this.model.cursorY * EDITOR_CELL_SIZE - 2, 5, 5,
                    this.model.dragging >= 0 ? 4 : 5);
            }
            this.drawButton(target, "SAVE", 12, 1, this.valid ? 7 : 2);
            this.drawButton(target, "SHIFT", 23, 2, this.shifting ? 5 : 1);
            this.drawButton(target, "REVERSE", 34, 3, 1);
            this.drawButton(target, "FLIP H", 45, 4, 1);
            this.drawButton(target, "FLIP V", 56, 5, 1);
            this.drawButton(target, "ROTATE", 67, 6, 1);
            this.drawButton(target, "BACK", 78, 7, 1);
            const status = this.shiftBlocked ? "BLOCKED" : this.shifting ? "SHIFT MAP"
                : this.saveError ? "NOT SAVED" : this.saved ? "SAVED!"
                : this.model.dragging >= 0 ? "DROP NODE" : points.length < 3 ? "3+ NODES"
                : invalid.some(value => value) ? "FIX RED" : "VALID";
            target.print(status, 110, 90, this.shiftBlocked || this.saveError || !this.valid ? 2 : 7, image.font5);
            target.print(this.shifting ? "DPAD:MOVE" : "A: PLACE", 110, 98, 1, image.font5);
            target.print(this.shifting ? "A/B:DONE" : "HOLD:MOVE", 110, 105, 1, image.font5);
            if (!this.shifting) {
                target.print("B:DELETE", 4, 114, 1, image.font5);
            }
            target.print("2A: START", 110, 112, 5, image.font5);
        }

        private drawButton(target: Image, label: string, y: number, focus: number, color: number): void {
            target.fillRect(111, y, 46, 10, this.focus === focus ? 12 : 15);
            target.drawRect(111, y, 46, 10, this.focus === focus ? 5 : color);
            target.print(label, 134 - Math.floor(label.length * 5 / 2), y + 2, color, image.font5);
        }
    }

    export function editTrack(): void {
        const tracks = trackEditor.getTracks();
        const choices = ["New Track"].concat(tracks.map(track => track.name));
        while (true) {
            const selected = chooseMenu("TRACK EDITOR", choices);
            if (selected < 0) return;
            new TrackEditor(selected === 0 ? [] : tracks[selected - 1].points).run();
        }
    }
}
