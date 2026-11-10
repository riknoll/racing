namespace racing {
    export const colorMap = racingArt.carColors;

    export function getCarFrames(colorIndex: number): Image[] {
        colorIndex = colorIndex % colorMap.height;
        const frames: Image[] = [];
        for (const carImage of racingArt.carFrames(colorIndex)) {
            const remapped = carImage.clone();
            for (let y = 0; y < carImage.height; y++) {
                for (let x = 0; x < carImage.width; x++) {
                    const pixel = carImage.getPixel(x, y);
                    if (pixel === 2) remapped.setPixel(x, y, colorMap.getPixel(0, colorIndex));
                    else if (pixel === 10) remapped.setPixel(x, y, colorMap.getPixel(1, colorIndex));
                }
            }
            frames.push(remapped);
        }
        return frames;
    }
}
