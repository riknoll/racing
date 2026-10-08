namespace SpriteKind {
    export const Timer = SpriteKind.create();
}

namespace racing {
    const sevenSegColon = img`
        .
        2
        .
        .
        .
        2
        .
    `
    const sevenSegPeriod = img`
        2
        .
    `

    const sevenSegDigits = [
        img`
        . 2 2 2 .
        2 . . . 2
        2 . . . 2
        2 . . . 2
        . f f f .
        2 . . . 2
        2 . . . 2
        2 . . . 2
        . 2 2 2 .
        `, img`
        . f f f .
        f . . . 2
        f . . . 2
        f . . . 2
        . f f f .
        f . . . 2
        f . . . 2
        f . . . 2
        . f f f .
        `, img`
        . 2 2 2 .
        f . . . 2
        f . . . 2
        f . . . 2
        . 2 2 2 .
        2 . . . f
        2 . . . f
        2 . . . f
        . 2 2 2 .
        `, img`
        . 2 2 2 .
        f . . . 2
        f . . . 2
        f . . . 2
        . 2 2 2 .
        f . . . 2
        f . . . 2
        f . . . 2
        . 2 2 2 .
        `, img`
        . f f f .
        2 . . . 2
        2 . . . 2
        2 . . . 2
        . 2 2 2 .
        f . . . 2
        f . . . 2
        f . . . 2
        . f f f .
        `, img`
        . 2 2 2 .
        2 . . . f
        2 . . . f
        2 . . . f
        . 2 2 2 .
        f . . . 2
        f . . . 2
        f . . . 2
        . 2 2 2 .
        `, img`
        . 2 2 2 .
        2 . . . f
        2 . . . f
        2 . . . f
        . 2 2 2 .
        2 . . . 2
        2 . . . 2
        2 . . . 2
        . 2 2 2 .
        `, img`
        . 2 2 2 .
        f . . . 2
        f . . . 2
        f . . . 2
        . f f f .
        f . . . 2
        f . . . 2
        f . . . 2
        . f f f .
        `, img`
        . 2 2 2 .
        2 . . . 2
        2 . . . 2
        2 . . . 2
        . 2 2 2 .
        2 . . . 2
        2 . . . 2
        2 . . . 2
        . 2 2 2 .
        `, img`
        . 2 2 2 .
        2 . . . 2
        2 . . . 2
        2 . . . 2
        . 2 2 2 .
        f . . . 2
        f . . . 2
        f . . . 2
        . 2 2 2 .
        `
    ];

    const compactDigits = [
        img`
        1 1 1
        1 . 1
        1 . 1
        1 . 1
        1 1 1
        `,img`
        . 1 .
        1 1 .
        . 1 .
        . 1 .
        1 1 1
        `,img`
        1 1 1
        . . 1
        1 1 1
        1 . .
        1 1 1
        `,img`
        1 1 1
        . . 1
        . 1 1
        . . 1
        1 1 1
        `,img`
        1 . 1
        1 . 1
        1 1 1
        . . 1
        . . 1
        `,img`
        1 1 1
        1 . .
        1 1 1
        . . 1
        1 1 1
        `,img`
        1 1 1
        1 . .
        1 1 1
        1 . 1
        1 1 1
        `,img`
        1 1 1
        . . 1
        . . 1
        . 1 .
        . 1 .
        `,img`
        1 1 1
        1 . 1
        1 1 1
        1 . 1
        1 1 1
        `,img`
        1 1 1
        1 . 1
        1 1 1
        . . 1
        1 1 1
        `
    ];

    const compactPeriod = img`1`;

    const compactColon = img`
    .
    1
    .
    .
    1
    `;

    export function drawSpeedometer(radius: number, x: number, y: number, speed: number, maxSpeed: number) {
        screen.fillCircle(x, y, radius + 1, 12);
        screen.fillCircle(x, y, radius, 1);
        const progress = maxSpeed > 0 ? Math.max(0, Math.min(speed / maxSpeed, 1)) : 0;
        const startAngle = 3 * Math.PI / 4;
        const endAngle = startAngle + 3 * Math.PI / 2;
        const sweep = endAngle - startAngle;
        const filledAngle = startAngle + progress * sweep;
        const yellowEnd = startAngle + 0.6 * sweep;
        const orangeEnd = startAngle + 0.85 * sweep;
        const outerRadius = radius - 2;
        const innerRadius = outerRadius - 7;
        if (innerRadius < 0) return;

        screen.fillRect(x - innerRadius, y - 5, innerRadius * 2 + 2, 11, 15);

        const onArc = (dx: number, dy: number) => {
            const pixelRadius = Math.round(Math.sqrt(dx * dx + dy * dy));
            if (pixelRadius <= innerRadius || pixelRadius > outerRadius) return false;
            let angle = Math.atan2(dy, dx);
            if (angle < startAngle) angle += 2 * Math.PI;
            return angle >= startAngle && angle <= endAngle;
        };

        for (let dy = -outerRadius; dy <= outerRadius; dy++) {
            for (let dx = -outerRadius; dx <= outerRadius; dx++) {
                if (!onArc(dx, dy)) continue;
                let angle = Math.atan2(dy, dx);
                if (angle < startAngle) angle += 2 * Math.PI;
                if (!onArc(dx - 1, dy) || !onArc(dx + 1, dy) ||
                    !onArc(dx, dy - 1) || !onArc(dx, dy + 1)) {
                    screen.setPixel(x + dx, y + dy, 12);
                } else if (angle <= filledAngle) {
                    screen.setPixel(x + dx, y + dy,
                        angle < yellowEnd ? 5 : angle < orangeEnd ? 4 : 2);
                } else {
                    screen.setPixel(x + dx, y + dy, 11);
                }
            }
        }

        let speedText = Math.round(Math.max(speed, 0)).toString();

        while (speedText.length < 3) {
            speedText = "0" + speedText;
        }

        for (let i = 0; i < speedText.length; i++) {
            const digit = speedText.charCodeAt(i) - 48; // Convert ASCII code to numeric digit

            screen.drawTransparentImage(sevenSegDigits[digit], x - 8 + i * 6, y - 4);
        }
    }

    export function createTimer(style: "seven-seg" | "compact") {
        const timer = new timerSprite.TimerSprite(SpriteKind.Timer);

        if (style === "compact") {
            timer.setCharacterImages(
                compactDigits, compactColon, compactPeriod
            );
            timer.setColors(12, 0);
            timer.setPadding(1);
        }
        else if (style === "seven-seg") {
            timer.setCharacterImages(
                sevenSegDigits, sevenSegColon, sevenSegPeriod
            );
            timer.setColors(15, 0);
            timer.setPadding(1);
        }


        timer.setFormatEnabled(timerSprite.Format.MM_SS_MM, true);
        timer.setFormatEnabled(timerSprite.Format.SS_MM, false);
        timer.setFormatEnabled(timerSprite.Format.MM_SS, false);

        timer.setFlag(SpriteFlag.RelativeToCamera, true);

        return timer;
    }
}