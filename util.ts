namespace racing {
    export class Gate {
        constructor(public start: util.Point, public end: util.Point) {
        }
    }

    export function gateCenter(gate: Gate) {
        return new util.Point(
            (gate.start.x + gate.end.x) / 2,
            (gate.start.y + gate.end.y) / 2
        );
    }

    export function readGates(buf: Buffer) {
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


    export function distance(a: util.Point | Sprite, b: util.Point | Sprite) {
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        return Math.sqrt(dx * dx + dy * dy);
    }
}