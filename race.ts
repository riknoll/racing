namespace racing {
    export enum Track {
        Netherlands,
        USA,
        Australia,
        GreatBritain,
        Monaco,
        Italy
    }

    export function startRace(track: Track) {
        let gates: Gate[];
        switch (track) {
            case Track.Netherlands:
                tiles.setCurrentTilemap(tilemap`netherlands`);
                gates = readGates(trackWaypoints.netherlands);
                break;
            case Track.USA:
                tiles.setCurrentTilemap(tilemap`usa`);
                gates = readGates(trackWaypoints.usa);
                break;
            case Track.Australia:
                tiles.setCurrentTilemap(tilemap`australia`);
                gates = readGates(trackWaypoints.australia);
                break;
            case Track.GreatBritain:
                tiles.setCurrentTilemap(tilemap`great_britain`);
                gates = readGates(trackWaypoints.greatbritain);
                break;
            case Track.Monaco:
                tiles.setCurrentTilemap(tilemap`monaco`);
                gates = readGates(trackWaypoints.monaco);
                break;
            case Track.Italy:
                tiles.setCurrentTilemap(tilemap`italy`);
                gates = readGates(trackWaypoints.italy);
                break;
        }

        const finishLineSprites = sprites.create(racing.finishLine);
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

        scene.setBackgroundImage(racing.generateBackground());
        scroller.scrollBackgroundWithCamera(scroller.CameraScrollMode.BothDirections)

        const timer = racing.createTimer("compact");
        timer.setRunning(true);
        timer.top = 0;

        game.onUpdate(() => {
            player.checkGateOverlaps(gates);
            scene.centerCameraAt(
                player.x + 30 * Math.cos(player.heading),
                player.y + 30 * Math.sin(player.heading)
            )
        })

        player.controlEnabled = true;

        createMinimapRenderable(gates, player);

        scene.createRenderable(10, (target, camera) => {
            const gate = gates[(player.currentGateIndex + 1) % gates.length];

            drawing.drawThickLine(
                target,
                drawing.shiftedByCamera(gate.start),
                drawing.shiftedByCamera(gate.end),
                3,
                2
            );


            racing.drawSpeedometer(19, 20, 99, player.speed, player.stats.topSpeed);
        })
    }





}