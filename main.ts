

tiles.setCurrentTilemap(tilemap`netherlands`);
const gates = readGates(trackWaypoints.netherlands);

const minimap = getMinimapPoints(gates, 0.018, 0, 0);


const player = new racing.Car(
    new racing.RacerStats(
        100,
        100,
        100,
        100,
        100,
        100,
    ),
    racing.getCarFrames(0)
);

const firstGate = gateCenter(gates[0]);
const secondGate = gateCenter(gates[1]);
player.x = firstGate.x;
player.y = firstGate.y;
player.heading = Math.atan2(
    secondGate.y - firstGate.y,
    secondGate.x - firstGate.x
);

const corners = [
    new util.Point(player.left, player.top),
    new util.Point(player.right, player.top),
    new util.Point(player.right, player.bottom),
    new util.Point(player.left, player.bottom)
];


scene.createRenderable(10, (target, camera) => {
    const gate = gates[(player.currentGateIndex + 1) % gates.length];

    drawing.drawThickLine(
        target,
        drawing.shiftedByCamera(gate.start),
        drawing.shiftedByCamera(gate.end),
        3,
        2
    );

    corners[0].x = player.left;
    corners[0].y = player.top;
    corners[1].x = player.right;
    corners[1].y = player.top;
    corners[2].x = player.right;
    corners[2].y = player.bottom;
    corners[3].x = player.left;
    corners[3].y = player.bottom;

    // check the two gates in front of the player
    for (let gateIndex = 0; gateIndex < 2; gateIndex++) {
        const gate = gates[(player.currentGateIndex + 1 + gateIndex) % gates.length];
        const gateMidpoint = gateCenter(gate);
        let crossing = gateMidpoint.x >= player.left && gateMidpoint.x <= player.right &&
            gateMidpoint.y >= player.top && gateMidpoint.y <= player.bottom;
        for (let i = 0; i < corners.length; i++) {
            const corner = corners[i];
            const next = corners[(i + 1) % corners.length];

            if (mathUtils.lineIntersectsLine(
                corner, next, gate.start, gate.end
            )) {
                crossing = true;
                break;
            }
        }
        if (crossing) {
            player.currentGateIndex = (player.currentGateIndex + 1 + gateIndex) % gates.length;
            break;
        }
    }

    let playerX = 0;
    let playerY = 0;

    for (let i = 0; i < minimap.length; i++) {
        const point = minimap[i];
        const next = minimap[(i + 1) % minimap.length];

        drawing.drawLine(
            target,
            point,
            next,
            3,
        );
        if (i === player.currentGateIndex) {
            const progress = distance(gateCenter(gates[i]), player) / distance(gateCenter(gates[i]), gateCenter(gates[(i + 1) % gates.length]));
            playerX = point.x + progress * (next.x - point.x);
            playerY = point.y + progress * (next.y - point.y);
        }
    }
    screen.fillCircle(
        playerX,
        playerY,
        2,
        1
    );

    drawSpeedometer(19, 20, 99, player.speed, player.stats.topSpeed);
})

scene.setBackgroundImage(racing.generateBackground());
scroller.scrollBackgroundWithCamera(scroller.CameraScrollMode.BothDirections)





// scene.cameraFollowSprite(player);

game.onUpdate(() => {
    scene.centerCameraAt(
        player.x + 30 * Math.cos(player.heading),
        player.y + 30 * Math.sin(player.heading)
    )
})

player.controlEnabled = true;

class Gate {
    constructor(public start: util.Point, public end: util.Point) {
    }
}

function gateCenter(gate: Gate) {
    return new util.Point(
        (gate.start.x + gate.end.x) / 2,
        (gate.start.y + gate.end.y) / 2
    );
}

function readGates(buf: Buffer) {
    const gates: Gate[] = [];
    for (let i = 0; i < buf.length; i += 8) {
        gates.push(new Gate(
            new util.Point(
                buf.getNumber(NumberFormat.UInt16LE, i),
                buf.getNumber(NumberFormat.UInt16LE, i + 2)
            ),
            new util.Point(
                buf.getNumber(NumberFormat.UInt16LE, i + 4),
                buf.getNumber(NumberFormat.UInt16LE, i + 6)
            )
        ));
    }

    return gates;
}

function getMinimapPoints(gates: Gate[], scale: number, left: number, top: number) {
    const points: util.Point[] = [];

    // first find the bounding box of all gates
    let minX = 9999999;
    let minY = 9999999;
    let maxX = 0;
    let maxY = 0;

    for (const gate of gates) {
        const center = gateCenter(gate);
        minX = Math.min(minX, center.x);
        minY = Math.min(minY, center.y);
        maxX = Math.max(maxX, center.x);
        maxY = Math.max(maxY, center.y);
    }

    for (const gate of gates) {
        const center = gateCenter(gate);
        points.push(new util.Point(
            left + (center.x - minX) * scale,
            top + (center.y - minY) * scale
        ));
    }

    return points;
}

function distance(a: util.Point | Sprite, b: util.Point | Sprite) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
}

const digits = [
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
    `,img`
    . f f f .
    f . . . 2
    f . . . 2
    f . . . 2
    . f f f .
    f . . . 2
    f . . . 2
    f . . . 2
    . f f f .
    `,img`
    . 2 2 2 .
    f . . . 2
    f . . . 2
    f . . . 2
    . 2 2 2 .
    2 . . . f
    2 . . . f
    2 . . . f
    . 2 2 2 .
    `,img`
    . 2 2 2 .
    f . . . 2
    f . . . 2
    f . . . 2
    . 2 2 2 .
    f . . . 2
    f . . . 2
    f . . . 2
    . 2 2 2 .
    `,img`
    . f f f .
    2 . . . 2
    2 . . . 2
    2 . . . 2
    . 2 2 2 .
    f . . . 2
    f . . . 2
    f . . . 2
    . f f f .
    `,img`
    . 2 2 2 .
    2 . . . f
    2 . . . f
    2 . . . f
    . 2 2 2 .
    f . . . 2
    f . . . 2
    f . . . 2
    . 2 2 2 .
    `,img`
    . 2 2 2 .
    2 . . . f
    2 . . . f
    2 . . . f
    . 2 2 2 .
    2 . . . 2
    2 . . . 2
    2 . . . 2
    . 2 2 2 .
    `,img`
    . 2 2 2 .
    f . . . 2
    f . . . 2
    f . . . 2
    . f f f .
    f . . . 2
    f . . . 2
    f . . . 2
    . f f f .
    `,img`
    . 2 2 2 .
    2 . . . 2
    2 . . . 2
    2 . . . 2
    . 2 2 2 .
    2 . . . 2
    2 . . . 2
    2 . . . 2
    . 2 2 2 .
    `,img`
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

function drawSpeedometer(radius: number, x: number, y: number, speed: number, maxSpeed: number) {
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

        screen.drawTransparentImage(digits[digit], x - 8 + i * 6, y - 4);
    }
}