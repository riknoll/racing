

tiles.setCurrentTilemap(tilemap`netherlands`);
const gates = readGates(trackWaypoints.netherlands);

const minimap = getMinimapPoints(gates, 0.018, 0, 0);


const finishLine = img`
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

const finishLineSprites = sprites.create(finishLine);

const finishLinePosition = gateCenter(gates[0]);

finishLineSprites.rotation = Math.atan2(
    gates[0].end.y - gates[0].start.y,
    gates[0].end.x - gates[0].start.x
);

finishLineSprites.x = finishLinePosition.x;
finishLineSprites.y = finishLinePosition.y;


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

    racing.drawSpeedometer(19, 20, 99, player.speed, player.stats.topSpeed);
})

scene.setBackgroundImage(racing.generateBackground());
scroller.scrollBackgroundWithCamera(scroller.CameraScrollMode.BothDirections)

const timer = racing.createTimer("compact");
timer.setRunning(true);
timer.top = 0;




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
    for (let i = 0; i < buf.length; i += 16) {
        gates.push(new Gate(
            new util.Point(
                buf.getNumber(NumberFormat.Int32LE, i),
                buf.getNumber(NumberFormat.Int32LE, i + 4)
            ),
            new util.Point(
                buf.getNumber(NumberFormat.Int32LE, i + 8),
                buf.getNumber(NumberFormat.Int32LE, i + 12)
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