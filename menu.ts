namespace racing {
    const TRACK_PREVIEW_SIZE = 80;
    const TRACK_PREVIEW_BEVEL = 2;
    const TRACK_PREVIEW_MARGIN = 2;
    const TRACK_PREVIEW_PADDING = TRACK_PREVIEW_BEVEL + TRACK_PREVIEW_MARGIN;
    const TRACK_PREVIEW_FRAME_SIZE = TRACK_PREVIEW_SIZE + TRACK_PREVIEW_PADDING * 2;

    export function createTrackPreview(course: Course, trackColor?: number, outlineColor?: number, backgroundColor?: number): Image {
        if (course.patternIndex < 0 || course.patternIndex >= patterns.length
            || course.patternIndex !== Math.floor(course.patternIndex)) {
            throw "Invalid preview pattern for " + course.name;
        }
        if (trackColor === undefined) trackColor = course.previewColors[2];
        if (backgroundColor === undefined) backgroundColor = course.previewColors[1];
        if (outlineColor === undefined) outlineColor = course.previewColors[0];
        const track = course.createTrack();
        const picture = image.create(TRACK_PREVIEW_SIZE, TRACK_PREVIEW_SIZE);
        picture.fill(backgroundColor);
        const pattern = patterns[course.patternIndex];
        for (let y = 0; y < picture.height; y++) {
            for (let x = 0; x < picture.width; x++) {
                if (pattern.getPixel(x % pattern.width, y % pattern.height)) {
                    picture.setPixel(x, y, outlineColor);
                }
            }
        }
        let minX = track.centers[0].x;
        let maxX = minX;
        let minY = track.centers[0].y;
        let maxY = minY;
        for (const point of track.centers) {
            minX = Math.min(minX, point.x);
            maxX = Math.max(maxX, point.x);
            minY = Math.min(minY, point.y);
            maxY = Math.max(maxY, point.y);
        }

        const width = maxX - minX;
        const height = maxY - minY;
        const scale = (TRACK_PREVIEW_SIZE - 8) / Math.max(width + track.roadWidth, height + track.roadWidth);
        const left = (TRACK_PREVIEW_SIZE - 1 - width * scale) / 2;
        const top = (TRACK_PREVIEW_SIZE - 1 - height * scale) / 2;
        const points = track.centers.map(point => new util.Point(
            left + (point.x - minX) * scale,
            top + (point.y - minY) * scale
        ));
        const trackRadius = Math.max(1, Math.round(track.roadWidth * scale / 4));
        const roadMask = image.create(TRACK_PREVIEW_SIZE, TRACK_PREVIEW_SIZE);
        for (let i = 0; i < points.length; i++) {
            const point = points[i];
            const next = points[(i + 1) % points.length];
            drawing.drawThickLine(roadMask, point, next, trackRadius * 2, 1);
            roadMask.fillCircle(Math.round(point.x), Math.round(point.y), trackRadius, 1);
        }

        // Outline the rasterized road, so diagonal edges get exactly one pixel too.
        for (let y = 0; y < TRACK_PREVIEW_SIZE; y++) {
            for (let x = 0; x < TRACK_PREVIEW_SIZE; x++) {
                if (!roadMask.getPixel(x, y)) continue;
                picture.setPixel(x, y, trackColor);
                for (let ny = Math.max(0, y - 1); ny <= Math.min(TRACK_PREVIEW_SIZE - 1, y + 1); ny++) {
                    for (let nx = Math.max(0, x - 1); nx <= Math.min(TRACK_PREVIEW_SIZE - 1, x + 1); nx++) {
                        if (!roadMask.getPixel(nx, ny)) picture.setPixel(nx, ny, outlineColor);
                    }
                }
            }
        }
        const framed = image.create(TRACK_PREVIEW_FRAME_SIZE, TRACK_PREVIEW_FRAME_SIZE);
        for (let inset = TRACK_PREVIEW_MARGIN; inset < TRACK_PREVIEW_PADDING; inset++) {
            const right = framed.width - inset - 1;
            const bottom = framed.height - inset - 1;
            framed.drawLine(inset, inset, right, inset, trackColor);
            framed.drawLine(inset, inset, inset, bottom, trackColor);
            framed.drawLine(right, inset, right, bottom, outlineColor);
            framed.drawLine(inset, bottom, right, bottom, outlineColor);
        }
        framed.drawImage(picture, TRACK_PREVIEW_PADDING, TRACK_PREVIEW_PADDING);
        return framed;
    }

    export function chooseTrackMenu(title: string, courses: Course[], subtitle = "", allowBack = true, initialSelection = 0): number {
        const scripted = scriptedMenuChoice(title, courses.map(course => course.name), allowBack);
        if (scripted !== undefined) return scripted;
        if (!courses.length) throw "A track menu needs courses";
        if (initialSelection < 0 || initialSelection >= courses.length || initialSelection !== Math.floor(initialSelection)) {
            throw "Invalid initial track menu selection";
        }
        let previewMenu: Sprite;
        let nameMenu: Sprite;
        let selected = -1;
        let chosen = false;
        game.pushScene();
        try {
            scene.setBackgroundColor(15);
            const picture = image.create(160, 120);
            picture.fill(15);
            picture.drawRect(1, 1, 158, 118, 12);
            centerMenuText(picture, title, 2, image.font8, 9);
            centerMenuText(picture, subtitle, 10, image.font5, 1);
            centerMenuText(picture, allowBack ? "< > move A select B back" : "< > move A select",
                113, image.font5, 1);
            scene.setBackgroundImage(picture);

            previewMenu = miniMenu.createMenuFromArray(courses.map(course =>
                miniMenu.createMenuItem(course.name, createTrackPreview(course))));
            nameMenu = miniMenu.createMenuFromArray(courses.map(course => new TrackNameMenuItem(course.name)));
            for (const menu of [previewMenu, nameMenu]) {
                miniMenu.setButtonEventsEnabled(menu, false);
                menu.setFlag(SpriteFlag.Ghost, true);
                menu.setFlag(SpriteFlag.RelativeToCamera, true);
                miniMenu.setMenuStyleProperty(menu, miniMenu.MenuStyleProperty.Columns, 0);
                miniMenu.setMenuStyleProperty(menu, miniMenu.MenuStyleProperty.Rows, 1);
                miniMenu.setMenuStyleProperty(menu, miniMenu.MenuStyleProperty.Border, 0);
                miniMenu.setMenuStyleProperty(menu, miniMenu.MenuStyleProperty.Padding, 0);
                miniMenu.setMenuStyleProperty(menu, miniMenu.MenuStyleProperty.BackgroundColor, 15);
                miniMenu.setMenuStyleProperty(menu, miniMenu.MenuStyleProperty.ScrollIndicatorColor, 0);
                miniMenu.setStyleProperty(menu, miniMenu.StyleKind.DefaultAndSelected, miniMenu.StyleProperty.Padding, 0);
                miniMenu.setStyleProperty(menu, miniMenu.StyleKind.DefaultAndSelected, miniMenu.StyleProperty.Margin, 0);
                miniMenu.setStyleProperty(menu, miniMenu.StyleKind.DefaultAndSelected, miniMenu.StyleProperty.Border, 0);
                miniMenu.setStyleProperty(menu, miniMenu.StyleKind.DefaultAndSelected, miniMenu.StyleProperty.Foreground, 1);
                miniMenu.setStyleProperty(menu, miniMenu.StyleKind.DefaultAndSelected,
                    miniMenu.StyleProperty.Alignment, miniMenu.Alignment.Center);
            }
            miniMenu.setStyleProperty(previewMenu, miniMenu.StyleKind.DefaultAndSelected, miniMenu.StyleProperty.IconOnly, 1);
            miniMenu.setStyleProperty(previewMenu, miniMenu.StyleKind.DefaultAndSelected, miniMenu.StyleProperty.Background, 15);
            miniMenu.setStyleProperty(nameMenu, miniMenu.StyleKind.DefaultAndSelected, miniMenu.StyleProperty.Background, 12);
            miniMenu.setDimensions(previewMenu, TRACK_PREVIEW_FRAME_SIZE, TRACK_PREVIEW_FRAME_SIZE);
            miniMenu.setDimensions(nameMenu, TRACK_PREVIEW_FRAME_SIZE, image.font8.charHeight);
            previewMenu.left = nameMenu.left = (screen.width - TRACK_PREVIEW_FRAME_SIZE) / 2;
            previewMenu.top = 15;
            nameMenu.top = previewMenu.bottom + 1;
            for (let i = 0; i < initialSelection; i++) {
                miniMenu.moveSelection(previewMenu, miniMenu.MoveDirection.Right);
                miniMenu.moveSelection(nameMenu, miniMenu.MoveDirection.Right);
            }
            miniMenu.onButtonPressed(previewMenu, miniMenu.Button.Left, () => {
                miniMenu.moveSelection(previewMenu, miniMenu.MoveDirection.Left);
                miniMenu.moveSelection(nameMenu, miniMenu.MoveDirection.Left);
            });
            miniMenu.onButtonPressed(previewMenu, miniMenu.Button.Right, () => {
                miniMenu.moveSelection(previewMenu, miniMenu.MoveDirection.Right);
                miniMenu.moveSelection(nameMenu, miniMenu.MoveDirection.Right);
            });
            miniMenu.onButtonPressed(previewMenu, miniMenu.Button.A, (selection, index) => {
                selected = index;
                chosen = true;
                miniMenu.setButtonEventsEnabled(previewMenu, false);
            });
            if (allowBack) {
                miniMenu.onButtonPressed(previewMenu, miniMenu.Button.B, () => {
                    chosen = true;
                    miniMenu.setButtonEventsEnabled(previewMenu, false);
                });
            }
            releaseMenuButtons();
            miniMenu.setButtonEventsEnabled(previewMenu, true);
            while (!chosen) pause(20);
        } finally {
            if (previewMenu) miniMenu.close(previewMenu);
            if (nameMenu) miniMenu.close(nameMenu);
            game.popScene();
        }
        return selected;
    }

    export function chooseMenu(title: string, choices: string[], subtitle = "", allowBack = true, icons?: Image[], initialSelection = 0): number {
        const scripted = scriptedMenuChoice(title, choices, allowBack);
        if (scripted !== undefined) return scripted;
        if (!choices.length) throw "A racing menu needs choices";
        if (initialSelection < 0 || initialSelection >= choices.length || initialSelection !== Math.floor(initialSelection)) {
            throw "Invalid initial racing menu selection";
        }
        let menu: Sprite;
        let selected = -1;
        let chosen = false;
        game.pushScene();
        try {
            scene.setBackgroundColor(15);
            const picture = image.create(160, 120);
            picture.fill(15);
            picture.drawRect(3, 3, 154, 115, 12);
            centerMenuText(picture, title, icons ? 8 : 9,
                icons ? image.scaledFont(image.font8, 2) : image.font8, 9);
            centerMenuText(picture, subtitle, icons ? 29 : 22, image.font5, 1);
            centerMenuText(picture, allowBack ? "^ v move A select B back" : "^ v move A select",
                111, image.font5, 1);
            scene.setBackgroundImage(picture);

            menu = miniMenu.createMenuFromArray(choices.map((choice, index) =>
                miniMenu.createMenuItem(choice, icons ? icons[index] : undefined)));
            miniMenu.setButtonEventsEnabled(menu, false);
            menu.setFlag(SpriteFlag.Ghost, true);
            menu.setFlag(SpriteFlag.RelativeToCamera, true);
            miniMenu.setMenuStyleProperty(menu, miniMenu.MenuStyleProperty.Columns, 1);
            miniMenu.setMenuStyleProperty(menu, miniMenu.MenuStyleProperty.Rows, 0);
            miniMenu.setMenuStyleProperty(menu, miniMenu.MenuStyleProperty.BackgroundColor, 15);
            miniMenu.setMenuStyleProperty(menu, miniMenu.MenuStyleProperty.ScrollIndicatorColor, 9);
            miniMenu.setStyleProperty(menu, miniMenu.StyleKind.DefaultAndSelected,
                miniMenu.StyleProperty.Foreground, 1);
            miniMenu.setStyleProperty(menu, miniMenu.StyleKind.DefaultAndSelected,
                miniMenu.StyleProperty.Padding, miniMenu.createBorderBox(18, 1, 8, 1));
            miniMenu.setStyleProperty(menu, miniMenu.StyleKind.DefaultAndSelected,
                miniMenu.StyleProperty.Margin, miniMenu.createBorderBox(0, 0, 0, 1));
            miniMenu.setStyleProperty(menu, miniMenu.StyleKind.DefaultAndSelected,
                miniMenu.StyleProperty.Border, 1);
            miniMenu.setStyleProperty(menu, miniMenu.StyleKind.DefaultAndSelected,
                miniMenu.StyleProperty.IconTextSpacing, 6);
            miniMenu.setStyleProperty(menu, miniMenu.StyleKind.Default, miniMenu.StyleProperty.Background, 15);
            miniMenu.setStyleProperty(menu, miniMenu.StyleKind.Default, miniMenu.StyleProperty.BorderColor, 15);
            miniMenu.setStyleProperty(menu, miniMenu.StyleKind.Selected, miniMenu.StyleProperty.Background, 12);
            miniMenu.setStyleProperty(menu, miniMenu.StyleKind.Selected, miniMenu.StyleProperty.BorderColor, 9);
            miniMenu.setDimensions(menu, 144, icons ? 66 : 78);
            menu.left = 8;
            menu.top = icons ? 42 : 31;
            for (let i = 0; i < initialSelection; i++) {
                miniMenu.moveSelection(menu, miniMenu.MoveDirection.Down);
            }
            miniMenu.onButtonPressed(menu, miniMenu.Button.A, (selection, index) => {
                selected = index;
                chosen = true;
                miniMenu.setButtonEventsEnabled(menu, false);
            });
            if (allowBack) {
                miniMenu.onButtonPressed(menu, miniMenu.Button.B, () => {
                    chosen = true;
                    miniMenu.setButtonEventsEnabled(menu, false);
                });
            }
            releaseMenuButtons();
            miniMenu.setButtonEventsEnabled(menu, true);
            while (!chosen) pause(20);
        } finally {
            if (menu) miniMenu.close(menu);
            game.popScene();
        }
        return selected;
    }

    class TrackNameMenuItem extends miniMenu.MenuItem {
        constructor(name: string) {
            super(name, undefined);
        }

        // Match preview widths so both horizontal menus animate by the same distance.
        getWidth(style: miniMenu.Style): number {
            return TRACK_PREVIEW_FRAME_SIZE;
        }
    }

    function centerMenuText(picture: Image, text: string, y: number, font: image.Font, color: number): void {
        picture.print(text, Math.floor((picture.width - text.length * font.charWidth) / 2), y, color, font);
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
