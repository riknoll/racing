namespace aiRacing {
    enum MemoryView {
        Steering,
        Pedals
    }

    const STEERING_COLORS = [9, 1, 4];
    const PEDAL_COLORS = [1, 7, 2, 11];
    const PLOT_LEFT = 9;
    const PLOT_RIGHT = 150;
    const PLOT_TOP = 30;
    const PLOT_BOTTOM = 73;

    /** A two-dimensional view of examples; the driver still uses all seven inputs. */
    export class MemoryChart {
        readonly picture = image.create(160, 120);
        private view = MemoryView.Steering;

        constructor(private driver: Driver) {}

        draw(animate: boolean): void {
            this.picture.fill(15);
            this.title(animate ? "MAPPING MEMORIES" : "YOUR AI'S MEMORIES");
            this.center((this.view === MemoryView.Steering ? "STEERING" : "PEDALS")
                + "  " + this.driver.count() + " EXAMPLES", 15, image.font5);
            this.picture.print("FASTER ^", 8, 22, 1, image.font5);
            this.picture.drawRect(6, 28, 148, 48, 6);
            for (let y = PLOT_TOP; y <= PLOT_BOTTOM; y += 3) this.picture.setPixel(80, y, 12);
            this.picture.print("LEFT", 9, 79, 1, image.font5);
            this.center("AIM", 79, image.font5);
            this.picture.print("RIGHT", 123, 79, 1, image.font5);
            this.legend();
            this.center("< > view A race B info", 112, image.font5);

            const count = this.driver.count();
            const batch = Math.max(1, Math.ceil(count / 40));
            this.driver.visitExamples((observation, action, index) => {
                this.dot(observation, action);
                if (animate && ((index + 1) % batch === 0 || index === count - 1)) {
                    this.picture.fillRect(7, 105, Math.round(146 * (index + 1) / count), 2, 9);
                    pause(25);
                }
            });
            this.picture.fillRect(7, 105, 146, 2, 15);
            this.title("YOUR AI'S MEMORIES");
        }

        switchView(): void {
            this.view = this.view === MemoryView.Steering ? MemoryView.Pedals : MemoryView.Steering;
            this.draw(false);
        }

        private dot(observation: Observation, action: Action): void {
            // Spread small aiming angles so straight-road examples are visible.
            const spread = Math.sqrt(Math.min(1, Math.abs(observation.aim) / 0.5)) * (observation.aim < 0 ? -1 : 1);
            const x = Math.round(80 + spread * (PLOT_RIGHT - PLOT_LEFT) / 2);
            const reverseSpeed = racing.REVERSE_TOP_SPEED / racing.TOP_SPEED_MAX;
            const speed = Math.max(-reverseSpeed, Math.min(1, observation.speed));
            const y = Math.round(PLOT_BOTTOM - (speed + reverseSpeed) / (1 + reverseSpeed) * (PLOT_BOTTOM - PLOT_TOP));
            const color = this.view === MemoryView.Steering ? STEERING_COLORS[action.steer + 1] : PEDAL_COLORS[action.pedal];
            this.marker(x, y, color, this.view === MemoryView.Steering ? action.steer : action.pedal + 2);
        }

        private marker(x: number, y: number, color: number, shape: number): void {
            if (shape === -1 || shape === 1) {
                this.picture.setPixel(x - shape, y - 1, color);
                this.picture.setPixel(x, y, color);
                this.picture.setPixel(x - shape, y + 1, color);
            } else if (shape === Pedal.Reverse + 2) {
                this.picture.drawLine(x - 1, y - 1, x + 1, y + 1, color);
                this.picture.drawLine(x - 1, y + 1, x + 1, y - 1, color);
            } else if (shape === Pedal.Brake + 2) {
                this.picture.drawRect(x - 1, y - 1, 3, 3, color);
            } else if (shape === Pedal.Accelerate + 2) {
                this.picture.drawLine(x, y - 1, x, y + 1, color);
                this.picture.drawLine(x - 1, y, x + 1, y, color);
            } else {
                this.picture.fillRect(x, y, 2, 2, color);
            }
        }

        private legend(): void {
            const counts = this.driver.actionCounts;
            if (this.view === MemoryView.Steering) {
                this.marker(9, 90, STEERING_COLORS[0], -1);
                this.marker(53, 90, STEERING_COLORS[1], 0);
                this.marker(116, 90, STEERING_COLORS[2], 1);
                this.picture.print("LEFT", 16, 88, 1, image.font5);
                this.picture.print("STRAIGHT", 59, 88, 1, image.font5);
                this.picture.print("RIGHT", 123, 88, 1, image.font5);
                this.picture.print("" + counts[0], 16, 98, 1, image.font5);
                this.picture.print("" + (this.driver.count() - counts[0] - counts[1]), 59, 98, 1, image.font5);
                this.picture.print("" + counts[1], 123, 98, 1, image.font5);
            } else {
                const labels = ["COAST", "GO", "BRAKE", "REV"];
                const totals = [this.driver.count() - counts[2] - counts[3] - counts[4], counts[2], counts[3], counts[4]];
                for (let i = 0; i < labels.length; i++) {
                    const x = i % 2 ? 86 : 8;
                    const y = i < 2 ? 90 : 100;
                    this.marker(x, y, PEDAL_COLORS[i], i + 2);
                    this.picture.print(labels[i] + " " + totals[i], x + 7, y - 2, 1, image.font5);
                }
            }
        }

        private title(text: string): void {
            this.picture.fillRect(0, 0, 160, 13, 15);
            this.center(text, 3, image.font8);
        }

        private center(text: string, y: number, font: image.Font): void {
            this.picture.print(text, Math.floor((160 - text.length * font.charWidth) / 2), y, 1, font);
        }
    }

    /** Inspect the training data in a separate scene, leaving the racing scene intact. */
    export function showTrainingSummary(driver: Driver): void {
        const chart = new MemoryChart(driver);
        game.pushScene();
        try {
            scene.setBackgroundColor(15);
            scene.setBackgroundImage(chart.picture);
            chart.draw(true);
            releaseChartButtons();
            while (!controller.A.isPressed()) {
                if (controller.left.isPressed() || controller.right.isPressed()) {
                    chart.switchView();
                    releaseChartButtons();
                } else if (controller.B.isPressed()) {
                    const counts = driver.actionCounts;
                    game.showLongText("Each dot is one stored example.\nLeft/right: the angle to the road ahead.\nHigher: faster forward speed. Bottom: stopped or reversing."
                        + "\nColors and shapes show your steering or pedal action. This chart shows only two of the AI's seven inputs."
                        + "\nLeft: " + counts[0] + "\nRight: " + counts[1] + "\nAccelerate: " + counts[2]
                        + "\nBrake: " + counts[3] + "\nReverse: " + counts[4]
                        + (counts[4] ? "" : "\nNo reverse examples: the AI has not learned reversing.")
                        + "\nThe animation displays saved examples; it does not train the AI again.", DialogLayout.Full);
                    releaseChartButtons();
                }
                pause(20);
            }
        } finally {
            game.popScene();
        }
    }

    function releaseChartButtons(): void {
        while (controller.A.isPressed() || controller.B.isPressed() || controller.left.isPressed()
            || controller.right.isPressed() || controller.up.isPressed() || controller.down.isPressed()) pause(20);
    }
}
