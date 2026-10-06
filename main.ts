

tiles.setCurrentTilemap(tilemap`monaco`);
const gates = readGates(trackWaypoints.monaco);

const player = new racing.Car(
    new racing.RacerStats(
        100,
        100,
        100,
        100,
        10,
        20,
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
        player.currentGateIndex = (player.currentGateIndex + 1) % gates.length;
    }
})



scene.cameraFollowSprite(player);

player.controlEnabled = true;

function gateCenter(gate: { start: util.Point, end: util.Point }) {
    return new util.Point(
        (gate.start.x + gate.end.x) / 2,
        (gate.start.y + gate.end.y) / 2
    );
}

function readGates(buf: Buffer) {
    const gates: { start: util.Point, end: util.Point }[] = [];
    for (let i = 0; i < buf.length; i += 8) {
        gates.push({
            start: new util.Point(
                buf.getNumber(NumberFormat.UInt16LE, i),
                buf.getNumber(NumberFormat.UInt16LE, i + 2)
            ),
            end: new util.Point(
                buf.getNumber(NumberFormat.UInt16LE, i + 4),
                buf.getNumber(NumberFormat.UInt16LE, i + 6)
            )
        });
    }

    return gates;
}