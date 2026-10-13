namespace racing {
    export enum Track {
        Netherlands,
        USA,
        Australia,
        GreatBritain,
        Monaco,
        Italy
    }

    export function startRace(course: Course, totalLaps: number, numOpponents: number) {
        game.pushScene();
        const track = course.createTrack();
        const gates = track.gates;

        aiRacing.loadBots();

        tiles.setCurrentTilemap(course.tilemap);

        const finishLineSprites = sprites.create(racing.finishLine);
        const finishLinePosition = gateCenter(gates[0]);
        finishLineSprites.rotation = Math.atan2(
            gates[0].end.y - gates[0].start.y,
            gates[0].end.x - gates[0].start.x
        );

        finishLineSprites.x = finishLinePosition.x;
        finishLineSprites.y = finishLinePosition.y;

        const stats = new racing.RacerStats(
                100,
                100,
                100,
                100,
                100,
                100,
            );

        const player = new racing.Car(
            stats,
            racing.getPlayerCarFrames()
        );

        const places: racing.Car[] = [];

        const opponents: aiRacing.LearningCar[] = [];
        const bots = aiRacing.getBotSlots();
        for (let i = 0; i < numOpponents; i++) {
            const botSlot = bots[i % bots.length];

            const opponent = new aiRacing.LearningCar(stats, racing.getCarFrames(i), track);
            opponents.push(opponent);

            if (botSlot && botSlot.driver.count() > aiRacing.MIN_EXAMPLES) {
                opponent.driver = botSlot.driver;
                opponent.paused = true;
            }
        }

        const allCars = [player].concat(opponents);

        const firstGate = gateCenter(gates[0]);
        const secondGate = gateCenter(gates[1]);
        const startingAngle = Math.atan2(
            secondGate.y - firstGate.y,
            secondGate.x - firstGate.x
        );

        const orthogonalAngle = startingAngle + Math.PI / 2;
        const spacing = 30;

        // Position cars in two columns at the starting line
        for (let i = 0; i < allCars.length; i++) {
            const car = allCars[i];

            const column = (i % 2) - 0.5;
            const row = 1 + Math.idiv(i, 2);

            car.x = firstGate.x + column * spacing * Math.cos(orthogonalAngle) + row * spacing * Math.cos(startingAngle + Math.PI);
            car.y = firstGate.y + column * spacing * Math.sin(orthogonalAngle) + row * spacing * Math.sin(startingAngle + Math.PI);

            car.heading = startingAngle;
            places.push(car);
        }

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

            const placement = places.indexOf(player) + 1;

            drawing.drawThickLine(
                target,
                drawing.shiftedByCamera(gate.start),
                drawing.shiftedByCamera(gate.end),
                3,
                2
            );

            racing.drawLapIndicator(135, 0, Math.min(player.currentLap, totalLaps), totalLaps);
            racing.drawSpeedometer(19, 20, 99, player.speed, player.stats.topSpeed);
            racing.drawPlacemarker(135, 95, placement);
        });

        const handler = eventContext.registerFrameHandler(scene.UPDATE_PRIORITY, () => {
            const currentLap = player.currentLap;
            if (!finished) {
                player.checkGateOverlaps(gates);
                player.distance = track.calculateDistance(player);
            }

            for (const opponent of opponents) {
                track.updateProgress(opponent);
                opponent.distance = track.calculateDistance(opponent);
                if (opponent.currentLap === totalLaps) {
                    opponent.driver = undefined;
                    opponent.startAutoDrive(gates);
                }
            }

            places.sort((a, b) => b.distance - a.distance);

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
                    const placement = places.indexOf(player) + 1;
                    timer.setRunning(false);
                    // Replace the placement stub when opponent cars are implemented.
                    const result = recordRaceResult(course.trackId, lapTimes, placement);
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

        pauseUntilAllButtonsReleased();

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
            for (const opponent of opponents) {
                if (!opponent.driver) {
                    opponent.startAutoDrive(gates);
                }
                opponent.paused = false;
            }
            pause(1000);
            countdownSprite.destroy();
        });


        pauseUntil(() => finished);


        return () => {
            timer.destroy();
            for (const lapTimer of lapTimeSprites) lapTimer.destroy();
            minimapRenderable.destroy();
            hudRenderable.destroy();
            eventContext.unregisterFrameHandler(handler);
            countdownSprite.destroy();
            dustSource.destroy();
            tireTrackSource.destroy();
            offroadTireTrackSource.destroy();
            game.popScene();
        }
    }
}