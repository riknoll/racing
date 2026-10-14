namespace racing {
    const TRACK_PREVIEW_FRAME_SIZE = trackPreviewAnimations.FRAME_SIZE;
    const TRACK_MENU_WIDTH = 156;

    export function createTrackPreview(course: Course): Image {
        return trackPreviewAnimations.forCourse(course)[0].clone();
    }

    export function chooseTrackMenu(title: string, courses: Course[], allowBack = true, initialSelection = 0): number {
        const scripted = scriptedMenuChoice(title, courses.map(course => course.name), allowBack);
        if (scripted !== undefined) return scripted;
        if (!courses.length) throw "A track menu needs courses";
        if (initialSelection < 0 || initialSelection >= courses.length || initialSelection !== Math.floor(initialSelection)) {
            throw "Invalid initial track menu selection";
        }
        let previewMenu: Sprite;
        let nameMenu: Sprite;
        const textSprites: fancyText.TextSprite[] = [];
        let selected = -1;
        let chosen = false;
        game.pushScene();
        try {
            scene.setBackgroundColor(15);
            const picture = image.create(160, 120);
            picture.fill(15);
            scene.setBackgroundImage(picture);
            textSprites.push(createMenuText(title.toUpperCase(), 1, customFont.racing, 1));
            textSprites.push(createMenuHelp(picture, true, allowBack));

            const previewFrames = courses.map(course => trackPreviewAnimations.forCourse(course));
            const previewItems = courses.map((course, index) =>
                new TrackMenuItem(course.name, previewFrames[index][0]));
            previewMenu = miniMenu.createMenuFromArray(previewItems);
            nameMenu = miniMenu.createMenuFromArray(courses.map(course => new TrackMenuItem(course.name.toUpperCase())));
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
            miniMenu.setStyleProperty(nameMenu, miniMenu.StyleKind.DefaultAndSelected,
                miniMenu.StyleProperty.Padding, miniMenu.createBorderBox(0, 1, 0, 1));
            miniMenu.setStyleFont(nameMenu, miniMenu.StyleKind.DefaultAndSelected, customFont.racing);
            miniMenu.setDimensions(previewMenu, TRACK_MENU_WIDTH, TRACK_PREVIEW_FRAME_SIZE);
            miniMenu.setDimensions(nameMenu, TRACK_MENU_WIDTH, customFont.racing.lineHeight + 2);
            previewMenu.left = nameMenu.left = (screen.width - TRACK_MENU_WIDTH) / 2;
            previewMenu.top = 1 + customFont.racing.lineHeight;
            nameMenu.top = previewMenu.bottom;
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
            let previewFrame = 0;
            game.onUpdateInterval(trackPreviewAnimations.INTERVAL, () => {
                if (chosen) return;
                previewFrame = (previewFrame + 1) % trackPreviewAnimations.FRAME_COUNT;
                for (let i = 0; i < previewItems.length; i++) {
                    previewItems[i].setIcon(previewFrames[i][previewFrame]);
                }
            });
            releaseMenuButtons();
            miniMenu.setButtonEventsEnabled(previewMenu, true);
            while (!chosen) pause(20);
        } finally {
            if (previewMenu) miniMenu.close(previewMenu);
            if (nameMenu) miniMenu.close(nameMenu);
            for (const text of textSprites) text.destroy();
            game.popScene();
        }
        return selected;
    }

    export function chooseMenu(title: string, choices: string[], allowBack = true, icons?: Image[], initialSelection = 0, setupBackground?: () => () => void): number {
        const scripted = scriptedMenuChoice(title, choices, allowBack);
        if (scripted !== undefined) return scripted;
        if (!choices.length) throw "A racing menu needs choices";
        if (initialSelection < 0 || initialSelection >= choices.length || initialSelection !== Math.floor(initialSelection)) {
            throw "Invalid initial racing menu selection";
        }
        let menu: Sprite;
        let overlay: scene.Renderable;
        let disposeBackground: () => void;
        const textSprites: fancyText.TextSprite[] = [];
        let selected = -1;
        let chosen = false;
        game.pushScene();
        try {
            if (setupBackground) disposeBackground = setupBackground();
            else scene.setBackgroundColor(15);
            const picture = image.create(160, 120);
            if (setupBackground) {
                picture.fillRect(5, 0, 150, 20, 15);
            } else {
                picture.fill(15);
            }
            if (setupBackground) {
                overlay = scene.createRenderable(100, (target, camera) => {
                    target.drawTransparentImage(picture, 0, 0);
                });
            } else {
                scene.setBackgroundImage(picture);
            }
            textSprites.push(createMenuText(title.toUpperCase(), 1, customFont.racing, 1));
            textSprites.push(createMenuHelp(picture, false, allowBack));

            menu = miniMenu.createMenuFromArray(choices.map((choice, index) =>
                miniMenu.createMenuItem(choice, icons ? icons[index] : undefined)));
            miniMenu.setButtonEventsEnabled(menu, false);
            menu.setFlag(SpriteFlag.Ghost, true);
            menu.setFlag(SpriteFlag.RelativeToCamera, true);
            if (setupBackground) menu.z = 101;
            miniMenu.setMenuStyleProperty(menu, miniMenu.MenuStyleProperty.Columns, 1);
            miniMenu.setMenuStyleProperty(menu, miniMenu.MenuStyleProperty.Rows, 0);
            miniMenu.setMenuStyleProperty(menu, miniMenu.MenuStyleProperty.BackgroundColor, setupBackground ? 0 : 15);
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
            miniMenu.setStyleProperty(menu, miniMenu.StyleKind.Default, miniMenu.StyleProperty.Background, setupBackground ? 0 : 15);
            miniMenu.setStyleProperty(menu, miniMenu.StyleKind.Default, miniMenu.StyleProperty.BorderColor, setupBackground ? 0 : 15);
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
            for (const text of textSprites) text.destroy();
            if (overlay) overlay.destroy();
            if (disposeBackground) disposeBackground();
            game.popScene();
        }
        return selected;
    }

    class TrackMenuItem extends miniMenu.MenuItem {
        constructor(name: string, icon?: Image) {
            super(name, icon);
        }

        // Match preview widths so both horizontal menus animate by the same distance.
        getWidth(style: miniMenu.Style): number {
            return TRACK_MENU_WIDTH;
        }
    }

    function createMenuHelp(picture: Image, horizontal: boolean, allowBack: boolean): fancyText.TextSprite {
        const arrows = horizontal ? img`
            . . 1 . . . . . 1 . .
            . 1 1 . . . . . 1 1 .
            1 1 1 1 1 . 1 1 1 1 1
            . 1 1 . . . . . 1 1 .
            . . 1 . . . . . 1 . .
        ` : img`
            . . 1 . . . . . 1 . .
            . 1 1 1 . . . . 1 . .
            1 1 1 1 1 . 1 1 1 1 1
            . . 1 . . . . 1 1 1 .
            . . 1 . . . . . 1 . .
        `;
        const bottom = picture.height - 1;
        const height = Math.max(arrows.height, fancyText.tiny_4.lineHeight);
        picture.fillRect(0, bottom - height - 1, picture.width, height + 2, 15);
        const text = createMenuText(allowBack ? "MOVE A SELECT B BACK" : "MOVE A SELECT",
            bottom - fancyText.tiny_4.lineHeight, fancyText.tiny_4, 1);
        const left = Math.floor((picture.width - arrows.width - 3 - text.width) / 2);
        picture.drawTransparentImage(arrows, left, bottom - arrows.height);
        text.left = left + arrows.width + 3;
        return text;
    }

    function createMenuText(text: string, y: number, font: fancyText.BaseFont, color: number): fancyText.TextSprite {
        const sprite = fancyText.create(text, 0, color, font);
        sprite.setFlag(SpriteFlag.Ghost, true);
        sprite.setFlag(SpriteFlag.RelativeToCamera, true);
        sprite.z = 102;
        sprite.x = screen.width / 2;
        sprite.top = y;
        return sprite;
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
