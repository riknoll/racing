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
        const body = colorMap.getPixel(1, 0);
        const highlight = colorMap.getPixel(0, 0);
        let bestX = -1;
        let bestY = -1;
        let bestScore = -1;
        // Keep the whole badge inside opaque body pixels, favoring painted panels.
        for (let y = 0; y <= base.height - LOGO_SIZE; y++) {
            for (let x = 0; x <= base.width - LOGO_SIZE; x++) {
                let score = 0;
                let opaque = true;
                for (let dy = 0; dy < LOGO_SIZE && opaque; dy++) {
                    for (let dx = 0; dx < LOGO_SIZE; dx++) {
                        const pixel = base.getPixel(x + dx, y + dy);
                        if (!pixel) {
                            opaque = false;
                            break;
                        }
                        if (pixel === body || pixel === highlight) score++;
                    }
                }
                if (opaque && score > bestScore) {
                    bestX = x;
                    bestY = y;
                    bestScore = score;
                }
            }
        }
        if (bestX < 0) throw "The car image needs an opaque 8x8 area for its logo";
        const result = base.clone();
        // Stock poses face east, south, west, north; the drawing's top faces forward.
        const turns = (frame + 1) % 4;
        for (let y = 0; y < LOGO_SIZE; y++) {
            for (let x = 0; x < LOGO_SIZE; x++) {
                let sourceX = x;
                let sourceY = y;
                if (turns === 1) {
                    sourceX = y;
                    sourceY = LOGO_SIZE - 1 - x;
                } else if (turns === 2) {
                    sourceX = LOGO_SIZE - 1 - x;
                    sourceY = LOGO_SIZE - 1 - y;
                } else if (turns === 3) {
                    sourceX = LOGO_SIZE - 1 - y;
                    sourceY = x;
                }
                const pixel = logo.getPixel(sourceX, sourceY);
                if (pixel) result.setPixel(bestX + x, bestY + y, pixel);
            }
        }
        return result;
    }
}
