namespace aiRacing {
    enum MemoryView {
        Steering,
        Pedals
    }

    const STEERING_COLORS = [9, 1, 4];
    const PEDAL_COLORS = [1, 7, 2, 11];
    const PLOT_LEFT = 7;
    const PLOT_RIGHT = 152;
    const PLOT_TOP = 20;
    const PLOT_BOTTOM = 98;
    const AXIS_X = 80;
    const AXIS_Y = 59;

    /** A two-dimensional view of examples; the driver still uses all seven inputs. */
    export class MemoryChart {
        readonly picture = image.create(160, 120);
        private view = MemoryView.Steering;

        constructor(private driver: Driver) {}

        draw(animate: boolean): void {
            this.picture.fill(15);
            this.center("MEMORIES", 1, customFont.racing);
            this.picture.drawRect(4, 18, 152, 83, 6);
            this.legend();
            this.controls();
            this.axes();

            const count = this.driver.count();
            const batch = Math.max(1, Math.ceil(count / 40));
            this.driver.visitExamples((observation, action, index) => {
                this.dot(observation, action);
                if (animate && ((index + 1) % batch === 0 || index === count - 1)) {
                    this.axes();
                    this.picture.fillRect(7, 17, Math.round(146 * (index + 1) / count), 1, 9);
                    pause(25);
                }
            });
            this.axes();
            this.picture.fillRect(7, 17, 146, 1, 15);
        }

        switchView(): void {
            this.view = this.view === MemoryView.Steering ? MemoryView.Pedals : MemoryView.Steering;
            this.draw(false);
        }

        setPedalView(pedals: boolean): void {
            this.view = pedals ? MemoryView.Pedals : MemoryView.Steering;
            this.draw(false);
        }

        private dot(observation: Observation, action: Action): void {
            // Spread small aiming angles so straight-road examples are visible.
            const spread = Math.sqrt(Math.min(1, Math.abs(observation.aim) / 0.5)) * (observation.aim < 0 ? -1 : 1);
            const x = Math.round((PLOT_LEFT + PLOT_RIGHT - 1) / 2
                + spread * (PLOT_RIGHT - PLOT_LEFT - 1) / 2);
            const reverseSpeed = racing.REVERSE_TOP_SPEED / racing.TOP_SPEED_MAX;
            const speed = Math.max(-reverseSpeed, Math.min(1, observation.speed));
            const y = Math.round(PLOT_BOTTOM - 1 - (speed + reverseSpeed)
                / (1 + reverseSpeed) * (PLOT_BOTTOM - PLOT_TOP - 1));
            const color = this.view === MemoryView.Steering ? STEERING_COLORS[action.steer + 1] : PEDAL_COLORS[action.pedal];
            this.picture.fillRect(x, y, 2, 2, color);
        }

        private axes(): void {
            for (let distance = 3; distance <= Math.max(AXIS_X - PLOT_LEFT, PLOT_RIGHT - AXIS_X); distance += 3) {
                if (AXIS_X - distance >= PLOT_LEFT) this.picture.setPixel(AXIS_X - distance, AXIS_Y, 12);
                if (AXIS_X + distance <= PLOT_RIGHT) this.picture.setPixel(AXIS_X + distance, AXIS_Y, 12);
            }
            for (let distance = 3; distance <= Math.max(AXIS_Y - PLOT_TOP, PLOT_BOTTOM - AXIS_Y); distance += 3) {
                if (AXIS_Y - distance >= PLOT_TOP) this.picture.setPixel(AXIS_X, AXIS_Y - distance, 12);
                if (AXIS_Y + distance <= PLOT_BOTTOM) this.picture.setPixel(AXIS_X, AXIS_Y + distance, 12);
            }
            this.picture.fillRect(AXIS_X - 1, AXIS_Y, 3, 1, 12);
            this.picture.fillRect(AXIS_X, AXIS_Y - 1, 1, 3, 12);
            const font = fancyText.geometric_sans_6;
            this.axisLabel("FAST", AXIS_X - Math.idiv(fancyText.getTextWidth(font, "FAST"), 2), PLOT_TOP + 1, font);
            this.axisLabel("SLOW", AXIS_X - Math.idiv(fancyText.getTextWidth(font, "SLOW"), 2),
                PLOT_BOTTOM + 1 - font.lineHeight, font);
            const labelY = AXIS_Y - Math.idiv(font.lineHeight, 2);
            this.axisLabel("LEFT", PLOT_LEFT + 1, labelY, font);
            this.axisLabel("RIGHT", PLOT_RIGHT + 1 - fancyText.getTextWidth(font, "RIGHT"), labelY, font);
        }

        private legend(): void {
            const font = fancyText.geometric_sans_6;
            const labels = this.view === MemoryView.Steering ? ["LEFT", "STRAIGHT", "RIGHT"] : ["COAST", "GO", "BRAKE", "REV"];
            const colors = this.view === MemoryView.Steering ? STEERING_COLORS : PEDAL_COLORS;
            const widths = labels.map(label => fancyText.getTextWidth(font, label) + 6);
            let width = (labels.length - 1) * 5;
            for (const itemWidth of widths) width += itemWidth;
            let x = Math.idiv(160 - width, 2);
            for (let i = 0; i < labels.length; i++) {
                this.picture.fillRect(x, 101 + Math.idiv(font.lineHeight - 2, 2), 2, 2, colors[i]);
                fancyText.draw(labels[i], this.picture, x + 4, 101, 0, 1, font);
                x += widths[i] + 5;
            }
        }

        private controls(): void {
            const font = fancyText.geometric_sans_6;
            const left = racing.drivingControls.left;
            const right = racing.drivingControls.right;
            const a = racing.drivingControls.a;
            const pageWidth = fancyText.getTextWidth(font, "Page");
            const width = left.width + 2 + right.width + 4 + pageWidth
                + 12 + a.width + 4 + fancyText.getTextWidth(font, "Choose Track");
            let x = Math.idiv(160 - width, 2);
            this.picture.drawTransparentImage(left, x, 111);
            x += left.width + 2;
            this.picture.drawTransparentImage(right, x, 111);
            x += right.width + 4;
            fancyText.draw("Page", this.picture, x, 111, 0, 1, font);
            x += pageWidth + 12;
            this.picture.drawTransparentImage(a, x, 111);
            fancyText.draw("Choose Track", this.picture, x + a.width + 4, 111, 0, 1, font);
        }

        private axisLabel(text: string, x: number, y: number, font: fancyText.BaseFont): void {
            const width = fancyText.getTextWidth(font, text);
            racing.drawRoundedBackground(this.picture, x - 2, y - 1, width + 3, font.lineHeight + 1, 12);
            fancyText.draw(text, this.picture, x, y, 0, 5, font);
        }

        private center(text: string, y: number, font: fancyText.BaseFont): void {
            fancyText.draw(text, this.picture, Math.idiv(160 - fancyText.getTextWidth(font, text), 2), y, 0, 1, font);
        }
    }

    /** Return false when the player backs out without continuing. */
    export function showTrainingSummary(driver: Driver, _continueText?: string, _extraInfo?: string): boolean {
        const chart = new MemoryChart(driver);
        let confirmed = false;
        game.pushScene();
        try {
            scene.setBackgroundColor(15);
            scene.setBackgroundImage(chart.picture);
            chart.draw(true);
            releaseChartButtons();
            let finished = false;
            let manual = false;
            while (!finished) {
                const scripted = manual ? undefined : racing.scriptedMenuChoice("AI memories", ["Steering", "Pedals", "Continue"], true);
                if (scripted === undefined) manual = true;
                if (scripted === -1 || (manual && controller.B.isPressed())) {
                    finished = true;
                } else if (scripted === 2 || (manual && controller.A.isPressed())) {
                    confirmed = true;
                    finished = true;
                } else if (scripted === 0 || scripted === 1) {
                    chart.setPedalView(scripted === 1);
                } else if (manual && (controller.left.isPressed() || controller.right.isPressed())) {
                    chart.switchView();
                    releaseChartButtons();
                }
                pause(20);
            }
        } finally {
            game.popScene();
        }
        return confirmed;
    }

    function releaseChartButtons(): void {
        while (controller.A.isPressed() || controller.B.isPressed() || controller.left.isPressed()
            || controller.right.isPressed() || controller.up.isPressed() || controller.down.isPressed()) pause(20);
    }
}
