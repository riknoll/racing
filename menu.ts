namespace racing {
    export class MenuScreen {
        readonly picture = image.create(160, 120);
        selected = 0;

        constructor(
            private title: string,
            private choices: string[],
            private subtitle: string,
            private allowBack: boolean,
            private icons?: Image[],
            initialSelection = 0
        ) {
            if (!choices.length) throw "A racing menu needs choices";
            if (initialSelection < 0 || initialSelection >= choices.length || initialSelection !== Math.floor(initialSelection)) {
                throw "Invalid initial racing menu selection";
            }
            this.selected = initialSelection;
        }

        move(direction: number): void {
            this.selected = (this.selected + direction + this.choices.length) % this.choices.length;
        }

        draw(): void {
            const large = !!this.icons;
            this.picture.fill(15);
            this.picture.drawRect(3, 3, 154, 115, 12);
            this.center(this.title, large ? 8 : 9, large ? image.scaledFont(image.font8, 2) : image.font8, 9);
            this.center(this.subtitle, large ? 29 : 22, image.font5, 1);
            const rowHeight = large ? 20 : 13;
            const firstRow = large ? 42 : 31;
            const first = Math.max(0, this.selected - 5);
            for (let i = first; i < Math.min(first + 6, this.choices.length); i++) {
                const y = firstRow + (i - first) * (rowHeight + (large ? 2 : 0));
                if (i === this.selected) {
                    this.picture.fillRect(8, y, 144, rowHeight, 12);
                    this.picture.drawRect(8, y, 144, rowHeight, 9);
                    this.picture.print(">", 12, y + (rowHeight - image.font8.charHeight) / 2, 9, image.font8);
                }
                if (this.icons) this.picture.drawTransparentImage(this.icons[i], 28, y + 1);
                this.picture.print(this.choices[i], large ? 51 : 28, y + (rowHeight - image.font8.charHeight) / 2, 1, image.font8);
            }
            this.center(this.allowBack ? "^ v move A select B back" : "^ v move A select", 111, image.font5, 1);
        }

        private center(text: string, y: number, font: image.Font, color: number): void {
            this.picture.print(text, Math.floor((160 - text.length * font.charWidth) / 2), y, color, font);
        }
    }

    export function chooseMenu(title: string, choices: string[], subtitle = "", allowBack = true, icons?: Image[], initialSelection = 0): number {
        const scripted = scriptedMenuChoice(title, choices, allowBack);
        if (scripted !== undefined) return scripted;
        const menu = new MenuScreen(title, choices, subtitle, allowBack, icons, initialSelection);
        let selected = -1;
        let chosen = false;
        game.pushScene();
        try {
            scene.setBackgroundColor(15);
            scene.setBackgroundImage(menu.picture);
            menu.draw();
            releaseMenuButtons();
            while (!chosen) {
                if (controller.A.isPressed()) {
                    selected = menu.selected;
                    chosen = true;
                } else if (controller.B.isPressed() && allowBack) {
                    chosen = true;
                } else if (controller.up.isPressed() || controller.down.isPressed()) {
                    menu.move(controller.up.isPressed() ? -1 : 1);
                    menu.draw();
                    releaseMenuButtons();
                }
                pause(20);
            }
        } finally {
            game.popScene();
        }
        return selected;
    }

    export function releaseMenuButtons(): void {
        while (controller.A.isPressed() || controller.B.isPressed() || controller.up.isPressed()
            || controller.down.isPressed() || controller.left.isPressed() || controller.right.isPressed()) pause(20);
    }

    export function memoryMenuIcon(): Image {
        const icon = image.create(17, 17);
        icon.drawRect(1, 1, 15, 15, 9);
        icon.fillRect(4, 10, 2, 2, 9);
        icon.fillRect(8, 7, 2, 2, 1);
        icon.fillRect(12, 4, 2, 2, 4);
        return icon;
    }
}
