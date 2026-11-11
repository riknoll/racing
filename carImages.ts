namespace racing {
    export enum CarTarget {
        //% block="player"
        Player,
        //% block="bot 1"
        Bot1,
        //% block="bot 2"
        Bot2
    }

    export enum CarStyle {
        //% block="Racing car"
        RacingCar,
        //% block="Mercedes car"
        MercedesCar
    }

    export const colorMap = racingArt.carColors;
    const teamFrames: Image[][] = [];
    const teamStyles: CarStyle[] = [];
    const teamColors: number[][] = [];

    export function getCarFrames(colorIndex: number): Image[] {
        colorIndex = colorIndex % colorMap.height;
        return recolorCarFrames(racingArt.carFrames(colorIndex),
            colorMap.getPixel(0, colorIndex), colorMap.getPixel(1, colorIndex));
    }

    function recolorCarFrames(source: Image[], bodyColor: number, shadowColor: number): Image[] {
        const frames: Image[] = [];
        for (const carImage of source) {
            const remapped = carImage.clone();
            for (let y = 0; y < carImage.height; y++) {
                for (let x = 0; x < carImage.width; x++) {
                    const pixel = carImage.getPixel(x, y);
                    if (pixel === 2) remapped.setPixel(x, y, bodyColor);
                    else if (pixel === 10) remapped.setPixel(x, y, shadowColor);
                }
            }
            frames.push(remapped);
        }
        return frames;
    }

    export function getTeamCarFrames(target: CarTarget): Image[] {
        if (!teamFrames[target]) teamFrames[target] = getCarFrames(target);
        return teamFrames[target];
    }

    export function getPlayerCarFrames(): Image[] {
        return getTeamCarFrames(CarTarget.Player);
    }

    export function setTeamCarStyle(style: CarStyle, target: CarTarget): void {
        teamStyles[target] = style;
        updateTeamCarFrames(target);
    }

    export function setTeamCarColor(bodyColor: number, shadowColor: number, target: CarTarget): void {
        teamColors[target] = [bodyColor, shadowColor];
        updateTeamCarFrames(target);
    }

    function updateTeamCarFrames(target: CarTarget): void {
        const mercedes = teamStyles[target] === CarStyle.MercedesCar;
        const source = mercedes ? racingArt.mercedesCarFrames() : racingArt.carFrames(target);
        const colors = teamColors[target] || (mercedes ? [1, 6]
            : [colorMap.getPixel(0, target), colorMap.getPixel(1, target)]);
        const updated = recolorCarFrames(source, colors[0], colors[1]);
        const frames = getTeamCarFrames(target);
        for (let i = 0; i < updated.length; i++) frames[i] = updated[i];
    }
}
