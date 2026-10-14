namespace SpriteKind {
    export const Timer = SpriteKind.create();
}

namespace racing {
    export const raceSpeedSlowIcon = img`
        8 8 8 8 8 8 8 8 8 8 8 8 8 8 8
        8 8 8 8 8 8 8 8 8 8 8 8 8 8 8
        8 8 8 8 8 8 8 8 8 8 8 8 8 8 8
        8 8 8 8 8 8 8 8 8 8 8 8 8 8 8
        8 8 8 8 8 8 1 1 1 8 8 8 8 8 8
        8 8 8 8 8 8 1 1 1 8 8 8 8 8 8
        8 8 8 8 8 8 1 1 1 8 8 8 8 8 8
        8 8 8 8 8 8 1 1 1 8 8 8 8 8 8
        8 8 8 8 8 8 1 1 1 8 8 8 8 8 8
        8 8 8 8 8 8 1 1 1 8 8 8 8 8 8
        8 8 8 8 8 8 1 1 1 8 8 8 8 8 8
        8 8 8 8 8 8 8 8 8 8 8 8 8 8 8
        8 8 8 8 8 8 8 8 8 8 8 8 8 8 8
        8 8 8 8 8 8 8 8 8 8 8 8 8 8 8
        8 8 8 8 8 8 8 8 8 8 8 8 8 8 8
    `;
    export const raceSpeedMedIcon = img`
        4 4 4 4 4 4 4 4 4 4 4 4 4 4 4
        4 4 4 4 4 4 4 4 4 4 4 4 4 4 4
        4 4 4 4 4 4 4 4 4 4 4 4 4 4 4
        4 4 4 4 4 4 4 4 4 4 4 4 4 4 4
        4 4 4 1 1 1 4 4 4 1 1 1 4 4 4
        4 4 4 1 1 1 4 4 4 1 1 1 4 4 4
        4 4 4 1 1 1 4 4 4 1 1 1 4 4 4
        4 4 4 1 1 1 4 4 4 1 1 1 4 4 4
        4 4 4 1 1 1 4 4 4 1 1 1 4 4 4
        4 4 4 1 1 1 4 4 4 1 1 1 4 4 4
        4 4 4 1 1 1 4 4 4 1 1 1 4 4 4
        4 4 4 4 4 4 4 4 4 4 4 4 4 4 4
        4 4 4 4 4 4 4 4 4 4 4 4 4 4 4
        4 4 4 4 4 4 4 4 4 4 4 4 4 4 4
        4 4 4 4 4 4 4 4 4 4 4 4 4 4 4
    `;
    export const raceSpeedFastIcon = img`
        2 2 2 2 2 2 2 2 2 2 2 2 2 2 2
        2 2 2 2 2 2 2 2 2 2 2 2 2 2 2
        2 2 2 2 2 2 2 2 2 2 2 2 2 2 2
        2 2 2 2 2 2 2 2 2 2 2 2 2 2 2
        2 2 1 1 1 2 1 1 1 2 1 1 1 2 2
        2 2 1 1 1 2 1 1 1 2 1 1 1 2 2
        2 2 1 1 1 2 1 1 1 2 1 1 1 2 2
        2 2 1 1 1 2 1 1 1 2 1 1 1 2 2
        2 2 1 1 1 2 1 1 1 2 1 1 1 2 2
        2 2 1 1 1 2 1 1 1 2 1 1 1 2 2
        2 2 1 1 1 2 1 1 1 2 1 1 1 2 2
        2 2 2 2 2 2 2 2 2 2 2 2 2 2 2
        2 2 2 2 2 2 2 2 2 2 2 2 2 2 2
        2 2 2 2 2 2 2 2 2 2 2 2 2 2 2
        2 2 2 2 2 2 2 2 2 2 2 2 2 2 2
    `;

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
        `, img`
        . 1 .
        1 1 .
        . 1 .
        . 1 .
        1 1 1
        `, img`
        1 1 1
        . . 1
        1 1 1
        1 . .
        1 1 1
        `, img`
        1 1 1
        . . 1
        . 1 1
        . . 1
        1 1 1
        `, img`
        1 . 1
        1 . 1
        1 1 1
        . . 1
        . . 1
        `, img`
        1 1 1
        1 . .
        1 1 1
        . . 1
        1 1 1
        `, img`
        1 1 1
        1 . .
        1 1 1
        1 . 1
        1 1 1
        `, img`
        1 1 1
        . . 1
        . . 1
        . 1 .
        . 1 .
        `, img`
        1 1 1
        1 . 1
        1 1 1
        1 . 1
        1 1 1
        `, img`
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

    export const finishLine = img`
        ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff
        ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff
        ffffffffff11111111ffffffff11111111ffffffff11111111ffffffff11111111ffffffff11111111ff
        ffffffffff11111111ffffffff11111111ffffffff11111111ffffffff11111111ffffffff11111111ff
        ffffffffff11111111ffffffff11111111ffffffff11111111ffffffff11111111ffffffff11111111ff
        ffffffffff11111111ffffffff11111111ffffffff11111111ffffffff11111111ffffffff11111111ff
        ffffffffff11111111ffffffff11111111ffffffff11111111ffffffff11111111ffffffff11111111ff
        ffffffffff11111111ffffffff11111111ffffffff11111111ffffffff11111111ffffffff11111111ff
        ffffffffff11111111ffffffff11111111ffffffff11111111ffffffff11111111ffffffff11111111ff
        ffffffffff11111111ffffffff11111111ffffffff11111111ffffffff11111111ffffffff11111111ff
        ff11111111ffffffff11111111ffffffff11111111ffffffff11111111ffffffff11111111ffffffffff
        ff11111111ffffffff11111111ffffffff11111111ffffffff11111111ffffffff11111111ffffffffff
        ff11111111ffffffff11111111ffffffff11111111ffffffff11111111ffffffff11111111ffffffffff
        ff11111111ffffffff11111111ffffffff11111111ffffffff11111111ffffffff11111111ffffffffff
        ff11111111ffffffff11111111ffffffff11111111ffffffff11111111ffffffff11111111ffffffffff
        ff11111111ffffffff11111111ffffffff11111111ffffffff11111111ffffffff11111111ffffffffff
        ff11111111ffffffff11111111ffffffff11111111ffffffff11111111ffffffff11111111ffffffffff
        ff11111111ffffffff11111111ffffffff11111111ffffffff11111111ffffffff11111111ffffffffff
        ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff
        ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff
    `;

    const lapIndicatorBg = img`
        c c c c c c c c c c c c c c c c c c c c c c c c c
        c 1 c c c 1 1 1 c 1 1 1 c c c c c c c 1 c c c c c
        c 1 c c c 1 c 1 c 1 c 1 c c c c c c c 1 c c c c c
        c 1 c c c 1 1 1 c 1 1 1 c c c c c c 1 c c c c c c
        c 1 c c c 1 c 1 c 1 c c c c c c c 1 c c c c c c c
        c 1 1 1 c 1 c 1 c 1 c c c c c c c 1 c c c c c c c
        c c c c c c c c c c c c c c c c c c c c c c c c c
    `;

    let frames = [
        img`
        .....................
        .....................
        .....................
        .....................
        .....................
        .....................
        .1111111111111111111.
        111111111111111111111
        111211111111111111111
        112211111111111111111
        111211111111111111111
        111211111111111111111
        112221111111111111111
        111111111111111111111
        .1111111111111111111.
        .....................
        .....................
        .....................
        .....................
        .....................
        .....................
        `,img`
        .....................
        .....................
        .....................
        .....................
        .....................
        .....................
        .1111111111111111111.
        111111111111111111111
        118881111111111111111
        111181111111111111111
        118881111111111111111
        118111111111111111111
        118881111111111111111
        111111111111111111111
        .1111111111111111111.
        .....................
        .....................
        .....................
        .....................
        .....................
        .....................
        `,img`
        .....................
        .....................
        .....................
        .....................
        .....................
        .....................
        .1111111111111111111.
        111111111111111111111
        114441111111111111111
        111141111111111111111
        111441111111111111111
        111141111111111111111
        114441111111111111111
        111111111111111111111
        .1111111111111111111.
        .....................
        .....................
        .....................
        .....................
        .....................
        .....................
        `,img`
        .....................
        .....................
        .....................
        .....................
        .....................
        .....................
        .1111111111111111111.
        111111111111111111111
        116161111111111111111
        116161111111111111111
        116661111111111111111
        111161111111111111111
        111161111111111111111
        111111111111111111111
        .1111111111111111111.
        .....................
        .....................
        .....................
        .....................
        .....................
        .....................
        `,img`
        .....................
        .....................
        .....................
        .....................
        .....................
        .....................
        .1111111111111111111.
        111111111111111111111
        11aaa1111111111111111
        11a111111111111111111
        11aaa1111111111111111
        1111a1111111111111111
        11aaa1111111111111111
        111111111111111111111
        .1111111111111111111.
        .....................
        .....................
        .....................
        .....................
        .....................
        .....................
        `
    ];

    let placeMarkers = [
        img`
            ......11111.............
            .....1222221............
            ....122222221...........
            ...1222222221...........
            ..12222222221...........
            .122222222221...........
            1222222222221...........
            1222222222221...........
            1222222222221...........
            1222222222221...........
            .111112222221...........
            .....12222221...........
            .....1222222111..111111.
            .....1222221222112222221
            .....1222212222212222221
            .....122221221221112211.
            .....12222122111..1221..
            .....12222122221..1221..
            .....122222122221.1221..
            .....122222111221.1221..
            .....122221221221.1221..
            .....122221222221.1221..
            ......1222212221..1221..
            .......1111.111....11...
        `,
        img`
            ....11111111............
            ...1888888881...........
            ..188888888881..........
            .18888888888881.........
            1888888888888881........
            1888888888888881........
            1888881111888881........
            1888881..1888881........
            .11111...1888881........
            .........1888881........
            ........18888881........
            .......18888881.........
            ......18888881.......11.
            .....18888881.......1881
            ....18888881........1881
            ...1888888111.......1881
            ..18888881188111..111881
            .18888881118888811888881
            188888888818888881888881
            188888888818811881881881
            188888888818811881881881
            188888888818811881888881
            .18888888818811881888881
            ..11111111.11..11.11111.
        `,
        img`
            ....11111111............
            ...1444444441...........
            ..144444444441..........
            .14444444444441.........
            1444444444444441........
            1444444444444441........
            1444441111444441........
            1444441..1444441........
            .11111...1444441........
            ........11444441........
            .......144444441........
            ......144444441.........
            ......144444441......11.
            .......144444441....1441
            ........11444441....1441
            .11111...1441141....1441
            1444441..1414411..111441
            144444111141444411444441
            144444444441444441444441
            144444444441441441441441
            .14444444441441111441441
            ..1444444441441..1444441
            ...144444441441...444441
            ....1111111.11....11111.
        `,
        img`
            .11111....11111.........
            1666661..1666661........
            1666661..1666661........
            1666661..1666661........
            1666661..1666661........
            1666661..1666661........
            1666661..1666661........
            1666661..1666661........
            1666661..1666661........
            1666661111666661........
            1666666666666661........
            1666666666666661........
            1666666666666611.111....
            166666666666616611661...
            .11111111666616611661...
            .........166616611661...
            .........16661661166111.
            .........166166661666661
            .........166166661666661
            .........166616611661661
            .........166616611661661
            .........166616661661661
            .........166616661661661
            ..........111.111.11.11.
        `
    ];

    export function drawSpeedometer(radius: number, x: number, y: number, speed: number, maxSpeed: number, accelerationRatio = 0) {
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

        const barBottom = outerRadius - 2;
        const accelerationHalfWidth = Math.min(innerRadius - 2,
            Math.floor(Math.sqrt(outerRadius * outerRadius - barBottom * barBottom)));
        if (accelerationHalfWidth > 1) {
            const barTop = y + innerRadius + 1;
            const barHeight = outerRadius - innerRadius - 2;
            const segmentWidth = 3;
            const segmentStride = segmentWidth + 1;
            const segmentCount = Math.idiv(accelerationHalfWidth * 2, segmentStride);
            const barWidth = segmentCount * segmentStride + 1;
            const barLeft = x - Math.idiv(barWidth, 2);
            const filledSegments = Math.round(Math.min(Math.abs(accelerationRatio), 1) * segmentCount);
            screen.fillRect(barLeft, barTop, barWidth, barHeight, 12);
            for (let i = 0; i < segmentCount; i++) {
                const filled = accelerationRatio > 0 ? i < filledSegments : i >= segmentCount - filledSegments;
                screen.fillRect(barLeft + 1 + i * segmentStride, barTop + 1, segmentWidth, barHeight - 2,
                    filled ? (accelerationRatio > 0 ? 7 : 2) : 11);
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
        timer.z = 100;

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

    export function drawLapIndicator(x: number, y: number, lap: number, total: number) {
        screen.drawImage(lapIndicatorBg, x, y);
        screen.drawTransparentImage(compactDigits[lap + 1], x + 13, y + 1);
        screen.drawTransparentImage(compactDigits[total], x + 21, y + 1);
    }

    export function drawPlacemarker(x: number, y: number, place: number) {
        screen.drawTransparentImage(placeMarkers[place - 1], x, y);
    }

    export function createLapTime(lap: number, totalLaps: number, time: number) {
        const timer = createTimer("compact");
        timer.setFrame(frames[lap]);
        timer.setRunning(false);
        timer.setElapsedTime(time);
        timer.right = screen.width + 8;
        timer.top = screen.height - (totalLaps - lap) * 10 - 6;
        return timer;
    }

    export function formatRaceTime(time: number) {
        const hundredths = Math.floor(time / 10);
        const minutes = Math.floor(hundredths / 6000);
        const seconds = Math.floor(hundredths / 100) % 60;
        const fraction = hundredths % 100;
        return (minutes < 10 ? "0" : "") + minutes
            + ":" + (seconds < 10 ? "0" : "") + seconds
            + "." + (fraction < 10 ? "0" : "") + fraction;
    }

    export function showRaceResults(result: RaceResult) {
        const started = game.runtime();
        const width = 144;
        const height = 64 + result.laps.length * 14;
        const top = Math.idiv(screen.height - height, 2);
        return scene.createRenderable(110, (target, camera) => {
            const elapsed = game.runtime() - started;
            const panelProgress = Math.min(1, elapsed / 350);
            const left = Math.round((screen.width - width) / 2
                - width * Math.pow(1 - panelProgress, 3));
            target.fillRect(left, top, width, height, 15);
            target.drawRect(left, top, width, height, 1);
            target.print("RACE RESULTS", left + 36, top + 8, 1, image.font8);
            target.print("PLACE " + result.place, left + 30, top + 22, 5, image.font8);

            for (let i = 0; i <= result.laps.length; i++) {
                const rowProgress = Math.max(0, Math.min(1, (elapsed - 350 - i * 160) / 250));
                if (rowProgress === 0) continue;
                const rowLeft = left + Math.round(screen.width * Math.pow(1 - rowProgress, 3));
                const isTotal = i === result.laps.length;
                const rowTop = top + (isTotal ? 42 : 39) + i * 14;
                const time = isTotal ? result.totalTime : result.laps[i].time;
                const newBest = isTotal ? result.newBestTotal : result.laps[i].newBest;
                target.print(isTotal ? "TOTAL" : "LAP " + (i + 1), rowLeft + 8, rowTop, 1, image.font8);
                target.print(formatRaceTime(time), rowLeft + 46, rowTop, 1, image.font8);
                if (newBest) {
                    target.print("NEW!", rowLeft + 106, rowTop, 5, image.font8);
                }
            }
        });
    }

    export let patterns = [
        img`
            F . F . F . F .
            F . F . F . F .
            F . F . F . F .
            F . F . F . F .
            F . F . F . F .
            F . F . F . F .
            F . F . F . F .
            F . F . F . F .
        `,
        img`
            F F F F F F F F
            . . . . . . . .
            F F F F F F F F
            . . . . . . . .
            F F F F F F F F
            . . . . . . . .
            F F F F F F F F
            . . . . . . . .
        `,
        img`
            . . . . . F . F
            F F F F . F . F
            . . . . . F . F
            F F F F . F . F
            . F . F . . . .
            . F . F F F F F
            . F . F . . . .
            . F . F F F F F
        `,
        img`
            . F . . . F . .
            F F F . F F F .
            . F . . . F . .
            . . . . . . . .
            . F . . . F . .
            F F F . F F F .
            . F . . . F . .
            . . . . . . . .
        `,
        img`
            F . . . F . . .
            . F . . . F . .
            . . F . . . F .
            . . . F . . . F
            F . . . F . . .
            . F . . . F . .
            . . F . . . F .
            . . . F . . . F
        `,
        img`
            . . . F . . . F
            . . F . . . F .
            . F . . . F . .
            F . . . F . . .
            . . . F . . . F
            . . F . . . F .
            . F . . . F . .
            F . . . F . . .
        `,
        img`
            F F . . F F . .
            . F F . . F F .
            . . F F . . F F
            F . . F F . . F
            F F . . F F . .
            . F F . . F F .
            . . F F . . F F
            F . . F F . . F
        `,
        img`
            . . F F . . F F
            . F F . . F F .
            F F . . F F . .
            F . . F F . . F
            . . F F . . F F
            . F F . . F F .
            F F . . F F . .
            F . . F F . . F
        `,
        img`
            F F F F F F F F
            . F F F . F F F
            F F F F F F F F
            F F . F F F . F
            F F F F F F F F
            . F F F . F F F
            F F F F F F F F
            F F . F F F . F
        `,
        img`
            F F F F F F F F
            . F . F . F . F
            F F F F F F F F
            . F . F . F . F
            F F F F F F F F
            . F . F . F . F
            F F F F F F F F
            . F . F . F . F
        `,
        img`
            F . F F F . F F
            . F . F . F . F
            F F F . F F F .
            . F . F . F . F
            F . F F F . F F
            . F . F . F . F
            F F F . F F F .
            . F . F . F . F
        `,
        img`
            F . F . F . F .
            . F . F . F . F
            F . F . F . F .
            . F . F . F . F
            F . F . F . F .
            . F . F . F . F
            F . F . F . F .
            . F . F . F . F
        `,
        img`
            . . F . . . F .
            . F . F . F . F
            F . . . F . . .
            . F . F . F . F
            . . F . . . F .
            . F . F . F . F
            F . . . F . . .
            . F . F . F . F
        `,
        img`
            . . . . . . . .
            . F . F . F . F
            . . . . . . . .
            . F . F . F . F
            . . . . . . . .
            . F . F . F . F
            . . . . . . . .
            . F . F . F . F
        `,
        img`
            . . . . . . . .
            . F . . . F . .
            . . . . . . . .
            . . . F . . . F
            . . . . . . . .
            . F . . . F . .
            . . . . . . . .
            . . . F . . . F
        `,
        img`
            . F F F . F F F
            . F . . . F . .
            . F F F . F F F
            . . . F . . . F
            . F F F . F F F
            . F . . . F . .
            . F F F . F F F
            . . . F . . . F
        `,
        img`
            F . F F F . F F
            F . F . F . F .
            F F F . F F F .
            . . . . . . . .
            F . F F F . F F
            F . F . F . F .
            F F F . F F F .
            . . . . . . . .
        `,
        img`
            . . . . . F . .
            . F . . . F F .
            . F F . . . F .
            . . F . . . . .
            . . . . . . F .
            . . F . . . F F
            . . F F . . . F
            . . . F . . . .
        `,
        img`
            . . . . . . . .
            . . . . . F F .
            . F F . F F . .
            F F . . . . . .
            . . . . . . . .
            . . . . . . F F
            . . F F . F F .
            . F F . . . . .
        `,
        img`
            . . . F . . . F
            . F . . . F . .
            . . F . . . F .
            F . . . F . . .
            . . . F . . . F
            . F . . . F . .
            . . F . . . F .
            F . . . F . . .
        `,
        img`
            F F . . F F . .
            F F . . F F . .
            . . F F . . F F
            . . F F . . F F
            F F . . F F . .
            F F . . F F . .
            . . F F . . F F
            . . F F . . F F
        `,
    ];
}