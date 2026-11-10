namespace racing {
    const LOGO_SIZE = 8;
    let playerFrames: Image[];

    /** Player frames are separate from the stock and AI frame arrays. */
    export function getPlayerCarFrames(): Image[] {
        if (!playerFrames) playerFrames = getCarFrames(0);
        return playerFrames;
    }

    export function setPlayerLogo(logo: Image): void {
        if (!logo || logo.width !== LOGO_SIZE || logo.height !== LOGO_SIZE) {
            throw "Draw an 8x8 car logo";
        }
        const drawing = logo.clone();
        let visible = false;
        for (let y = 0; y < LOGO_SIZE; y++) {
            for (let x = 0; x < LOGO_SIZE; x++) {
                if (drawing.getPixel(x, y)) visible = true;
            }
        }
        const stock = getCarFrames(0);
        const updated: Image[] = [];
        for (let frame = 0; frame < stock.length; frame++) {
            updated.push(visible ? stampLogo(stock[frame], drawing, frame) : stock[frame]);
        }
        if (!playerFrames) playerFrames = updated;
        else {
            for (let frame = 0; frame < updated.length; frame++) playerFrames[frame] = updated[frame];
        }
    }

    function stampLogo(base: Image, logo: Image, frame: number): Image {
        const body = colorMap.getPixel(0, 0);
        const shadow = colorMap.getPixel(1, 0);
        const size = frame % 2 ? 12 : LOGO_SIZE;
        const angle = (frame + 2) * Math.PI / 4;
        const cosine = Math.cos(angle);
        const sine = Math.sin(angle);
        const rotated = image.create(size, size);
        const footprint = image.create(size, size);
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                const dx = x - (size - 1) / 2;
                const dy = y - (size - 1) / 2;
                const sourceX = Math.round(cosine * dx + sine * dy + (LOGO_SIZE - 1) / 2);
                const sourceY = Math.round(-sine * dx + cosine * dy + (LOGO_SIZE - 1) / 2);
                if (sourceX < 0 || sourceY < 0 || sourceX >= LOGO_SIZE || sourceY >= LOGO_SIZE) continue;
                footprint.setPixel(x, y, 1);
                rotated.setPixel(x, y, logo.getPixel(sourceX, sourceY));
            }
        }
        let bestX = -1;
        let bestY = -1;
        let bestScore = -1;
        for (let y = 0; y <= base.height - size; y++) {
            for (let x = 0; x <= base.width - size; x++) {
                let score = 0;
                for (let dy = 0; dy < size; dy++) {
                    for (let dx = 0; dx < size; dx++) {
                        if (!footprint.getPixel(dx, dy)) continue;
                        const pixel = base.getPixel(x + dx, y + dy);
                        if (pixel) score++;
                        if (pixel === body || pixel === shadow) score++;
                    }
                }
                if (score > bestScore) {
                    bestX = x;
                    bestY = y;
                    bestScore = score;
                }
            }
        }
        if (bestScore <= 0) throw "The car image needs a painted area for its logo";
        const result = base.clone();
        // Diagonal badges are clipped to the existing silhouette.
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                const pixel = rotated.getPixel(x, y);
                if (pixel && base.getPixel(bestX + x, bestY + y)) result.setPixel(bestX + x, bestY + y, pixel);
            }
        }
        return result;
    }
}
