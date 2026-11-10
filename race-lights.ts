namespace racing {
    export function createRaceLightImage(litCount: number): Image {
        if (litCount < 0 || litCount > racingArt.lightPositions.length || litCount !== Math.floor(litCount)) {
            throw "Choose a valid starting light count";
        }
        const picture = racingArt.startLights.clone();
        for (let i = 0; i < litCount; i++) {
            picture.drawTransparentImage(racingArt.redLamp, racingArt.lightPositions[i], racingArt.lightY);
        }
        return picture;
    }

    export function animateRaceStartLights(sprite: Sprite, isCancelled: () => boolean, onStart: () => void): void {
        for (let i = 0; i <= racingArt.lightPositions.length; i++) {
            if (isCancelled()) return;
            sprite.setImage(createRaceLightImage(i));
            pause(1000);
        }
        if (isCancelled()) return;
        sprite.setImage(createRaceLightImage(0));
        onStart();
        pause(1000);
        if (!isCancelled()) sprite.destroy();
    }
}
