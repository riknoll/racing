namespace racing {
    //% whenUsed
    export const enemyCarFrames = [img`
    . . . . . . . . . . . . . . . . .
    . . . . 8 8 8 8 8 8 8 8 . . . . .
    . . . 8 6 6 6 6 6 6 6 6 8 . . . .
    . . 8 6 9 6 6 6 6 6 6 c 6 8 . . .
    . 8 6 c 9 6 6 6 6 6 6 c c 6 8 8 .
    8 6 c c 9 9 9 9 9 9 6 c c 9 6 d 8
    8 6 c 6 8 8 8 8 8 8 8 b c 9 6 6 8
    8 6 6 8 b b 8 b b b 8 8 b 9 6 6 8
    8 6 8 b b b 8 b b b b 8 6 6 6 6 8
    c 8 8 6 6 6 8 6 6 6 6 6 8 6 6 6 8
    c 8 8 8 8 8 8 f 8 8 8 f 8 6 d d 8
    c 8 8 8 8 8 8 f 8 8 f 8 8 8 6 d 8
    c 8 8 8 8 8 8 f f f 8 8 8 8 8 8 c
    c 8 f f f f 8 8 8 8 f f f 8 8 8 c
    . c f f f f f 8 8 f f f f f 8 c .
    . . . f f f . . . . f f f f . . .
    . . . . . . . . . . . . . . . . .
    `,img`
    . . . . . . 8 8 8 8 8 8 . . . . .
    . . . . . 8 6 6 6 6 6 6 8 . . . .
    . . . . 8 6 6 9 9 6 6 6 6 8 . . .
    . . . . 8 c 9 6 6 6 6 6 c 8 . . .
    . . . 8 6 c 9 6 6 6 6 6 c 6 8 . .
    . . . 8 6 c 9 6 6 6 6 6 c 6 8 . .
    . . . f 6 c 9 6 6 6 6 6 c 6 f . .
    . . . f 8 c 6 6 6 6 6 6 c 8 f . .
    . . . f 6 c 6 b b b b 6 c 6 f . .
    . . . 8 6 6 b c c c c b 6 6 8 . .
    . . . 8 8 b c c c c c c b 8 8 . .
    . . . f 8 9 9 9 9 9 9 9 9 8 f . .
    . . . f 8 d 6 6 6 6 6 6 d 8 f . .
    . . . 8 6 d d 6 6 6 6 d d 6 f . .
    . . . . f 6 d 6 6 6 6 d 6 f . . .
    . . . . . 8 6 6 6 6 6 6 8 . . . .
    . . . . . . 8 8 8 8 8 8 . . . . .
    `,img`
    . . . . . . . . . . . . . . . . .
    . . . . . . 8 8 8 8 8 8 8 8 . . .
    . . . . . 8 6 6 6 6 6 6 6 6 8 . .
    . . . . 8 6 c 6 6 6 6 6 6 9 6 8 .
    . . 8 8 6 c c 6 6 6 6 6 6 9 c 6 c
    . 8 d 6 9 c c 6 9 9 9 9 9 9 c c c
    8 d 6 6 9 c b 8 8 8 8 8 8 8 6 c c
    8 6 6 6 9 b 8 8 b b b 8 b b 8 6 c
    8 6 6 6 6 6 8 b b b b 8 b b b 8 c
    8 6 6 6 6 8 6 6 6 6 6 8 6 6 6 8 c
    8 6 d d 6 8 f 8 8 8 f 8 8 8 8 8 c
    8 d d 6 8 8 8 f 8 8 f 8 8 8 8 8 c
    c 8 8 8 8 8 8 8 f f f 8 8 8 8 8 c
    c 8 8 8 8 f f f 8 8 8 8 f f f f .
    . c c 8 f f f f f 8 8 f f f f f .
    . . . c f f f f . . . . f f f . .
    . . . . . . . . . . . . . . . . .
    `,img`
    . . . . . . c c c c c c . . . . .
    . . . . . c 8 8 c c 8 8 c . . . .
    . . . . 8 8 6 6 6 6 6 6 8 8 . . .
    . . . c 6 c 6 6 6 6 6 6 c 6 c . .
    . . . 8 6 c 9 6 6 6 6 6 c 6 8 . .
    . . . f 6 6 9 6 6 6 6 6 c 6 f . .
    . . . f 6 6 9 6 6 6 6 6 6 6 f . .
    . . . f 6 6 9 6 6 6 6 6 6 6 f . .
    . . . f 6 c 6 9 9 6 6 6 c 6 f . .
    . . . 8 6 c 8 c c c c 8 c 6 8 . .
    . . . 8 6 8 c b b b b c 8 6 8 . .
    . . . 8 6 8 b b b b b b 8 6 8 . .
    . . . 8 8 8 8 8 8 8 8 8 8 8 8 . .
    . . . f 8 d 8 8 8 8 8 8 d 8 f . .
    . . . f 8 6 d 8 8 8 8 d 6 8 f . .
    . . . f f 8 8 8 8 8 8 8 8 f f . .
    . . . . f f . . . . . . f f . . .
    `,]

    export const colorMap = img`
        9 6 8 d b c f
        3 2 e d b c f
        5 4 e d b c f
        3 a 8 d b c f
        9 7 6 d b c f
        1 5 4 d b c f
        4 e c d b c f
    `;

    export function getCarFrames(colorIndex: number): Image[] {
        const frames: Image[] = []
        for (const carImage of enemyCarFrames) {
            frames.push(remapCarImage(carImage, colorIndex, colorMap))
        }
        return frames
    }

    function remapCarImage(carImage: Image, colorIndex: number, colorMap: Image) {
        if (colorIndex == 0) {
            return carImage
        }
        const remappedImage = carImage.clone()
        for (let indexX = 0; indexX <= image.getDimension(carImage, image.Dimension.Width) - 1; indexX++) {
            for (let indexY = 0; indexY <= image.getDimension(carImage, image.Dimension.Width) - 1; indexY++) {
                for (let index = 0; index <= 3; index++) {
                    if (colorMap.getPixel(index, 0) == carImage.getPixel(indexX, indexY)) {
                        remappedImage.setPixel(indexX, indexY, colorMap.getPixel(index, colorIndex))
                    }
                }
            }
        }
        return remappedImage
    }
}