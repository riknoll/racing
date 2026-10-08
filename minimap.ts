namespace racing {
    export function createMinimapRenderable(gates: Gate[], player: Car) {
        const points = getMinimapPoints(gates, 0.018, 0, 0);

        return scene.createRenderable(10, (target, camera) => {
            let playerX = 0;
            let playerY = 0;

            for (let i = 0; i < points.length; i++) {
                const point = points[i];
                const next = points[(i + 1) % points.length];

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
        });
    }

    export function getMinimapPoints(gates: Gate[], scale: number, left: number, top: number) {
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
}