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
        let totalLaps = 2;

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
        timer.top = 0;

        const lapTimes: number[] = [];
        const lapTimeSprites: timerSprite.TimerSprite[] = [];
        let finished = false;

        const eventContext = game.currentScene().eventContext;

        const dustSource = racing.effects.createDustSource(player);
        const tireTrackSource = racing.effects.createTireTrackSource(player);
        const tireTrackFactory = tireTrackSource.factory as racing.effects.TireTrackFactory;
        const offroadTireTrackSource = racing.effects.createOffroadTireTrackSource(player);
        const offroadTireTrackFactory = offroadTireTrackSource.factory as racing.effects.TireTrackFactory;

        const minimapRenderable = createMinimapRenderable(gates, player);
        const hudRenderable = scene.createRenderable(10, (target, camera) => {
            const gate = gates[(player.currentGateIndex + 1) % gates.length];

            drawing.drawThickLine(
                target,
                drawing.shiftedByCamera(gate.start),
                drawing.shiftedByCamera(gate.end),
                3,
                2
            );

            racing.drawLapIndicator(135, 0, Math.min(player.currentLap, totalLaps), totalLaps);
            racing.drawSpeedometer(19, 20, 99, player.speed, player.stats.topSpeed);
        });

        controller.menu.onEvent(ControllerButtonEvent.Pressed, () => {
            player.startAutoDrive(gates);
        })

        const handler = eventContext.registerFrameHandler(scene.UPDATE_PRIORITY, () => {
            const currentLap = player.currentLap;
            if (!finished) {
                player.checkGateOverlaps(gates);
            }

            const offroad = player.isOffRoad();
            (dustSource.factory as racing.effects.DustFactory).offroad = offroad;
            tireTrackFactory.braking = player.isBraking();
            tireTrackFactory.offroad = offroad;
            tireTrackFactory.sharpTurning = player.isSharpTurning();
            offroadTireTrackFactory.offroad = offroad;

            if (!finished && player.currentLap !== currentLap) {
                lapTimes.push(timer.getElapsedTime());

                if (player.currentLap === totalLaps) {
                    finished = true;
                    timer.setRunning(false);
                    // Replace the placement stub when opponent cars are implemented.
                    const result = recordRaceResult(track, lapTimes, 1);
                    player.startAutoDrive(gates);
                    timer.destroy();
                    for (const lapTimer of lapTimeSprites) lapTimer.destroy();
                    minimapRenderable.destroy();
                    hudRenderable.destroy();
                    showRaceResults(result);
                }
                else {
                    timer.setElapsedTime(0);
                    lapTimeSprites.push(createLapTime(lapTimes.length - 1, totalLaps,
                        lapTimes[lapTimes.length - 1]));
                }
            }

            scene.centerCameraAt(
                player.x + 30 * Math.cos(player.heading),
                player.y + 30 * Math.sin(player.heading)
            );
        });

        const countdownSprite = fancyText.create("3", 0, 12, fancyText.rounded_large);
        countdownSprite.setFlag(SpriteFlag.RelativeToCamera, true);
        countdownSprite.setFlag(SpriteFlag.Ghost, true);

        control.runInBackground(() => {
            for (let i = 3; i > 0; i--) {
                countdownSprite.setText(i.toString());
                countdownSprite.x = screen.width / 2;
                countdownSprite.y = screen.height / 2;
                pause(1000);
            }
            countdownSprite.setText("GO!");
            countdownSprite.x = screen.width / 2;
            countdownSprite.y = screen.height / 2;
            timer.setRunning(true);
            player.controlEnabled = true;
            pause(1000);
            countdownSprite.destroy();
        });
    }
}