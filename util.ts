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

    export function getTrackCenterline(gates: Gate[]) {
        const points: util.Point[] = [];
        for (let i = 0; i < gates.length; i++) {
            const gate = gates[i];
            const next = gates[(i + 1) % gates.length];
            const center = gateCenter(gate);
            const nextCenter = gateCenter(next);
            points.push(center);

            const dx = gate.end.y - gate.start.y;
            const dy = gate.start.x - gate.end.x;
            const nextDx = next.end.y - next.start.y;
            const nextDy = next.start.x - next.end.x;
            const determinant = dx * nextDy - dy * nextDx;
            const lengths = Math.sqrt((dx * dx + dy * dy)
                * (nextDx * nextDx + nextDy * nextDy));

            // Gates bracket each corner; intersect their centerlines to avoid cutting it.
            if (Math.abs(determinant) > lengths * 0.05) {
                const along = ((nextCenter.x - center.x) * nextDy
                    - (nextCenter.y - center.y) * nextDx) / determinant;
                points.push(new util.Point(center.x + along * dx, center.y + along * dy));
            }
        }
        return points;
    }

    export function getSegmentProgress(point: util.Point | Sprite, start: util.Point, end: util.Point) {
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const lengthSquared = dx * dx + dy * dy;
        return lengthSquared > 0
            ? ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared
            : 0;
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

    export function pauseUntilAllButtonsReleased() {
        pauseUntil(() => !controller.anyButton.isPressed());
    }
}