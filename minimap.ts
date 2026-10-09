namespace racing {
    export function createMinimapRenderable(gates: Gate[], player: Car) {
        const points = getMinimapPoints(gates, 0.018, 1, 1);

        const offset = points.pop();

        return scene.createRenderable(10, (target, camera) => {
            for (let i = 0; i < points.length; i++) {
                const point = points[i];
                const next = points[(i + 1) % points.length];

                drawing.drawLine(
                    target,
                    point,
                    next,
                    10,
                );
            }
            screen.fillRect(points[0].x - 1, points[0].y - 1, 3, 3, 2);

            const playerX = player.x * 0.018 + offset.x;
            const playerY = player.y * 0.018 + offset.y;

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

        points.push(new util.Point(
            left - minX * scale,
            top - minY * scale
        ));

        return points;
    }
}