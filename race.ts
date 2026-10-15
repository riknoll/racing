namespace racing {
    export enum Track {
        Netherlands,
        USA,
        Australia,
        GreatBritain,
        Monaco,
        Italy
    }

    export enum RaceSpeed {
        Slow,
        Med,
        Fast
    }

    export function startRace(course: Course, totalLaps: number, numOpponents: number, speed: RaceSpeed = 2) {
        let speedStat: number;
        switch (speed) {
            case RaceSpeed.Slow: speedStat = 50; break;
            case RaceSpeed.Med: speedStat = 75; break;
            case RaceSpeed.Fast: speedStat = 100; break;
            default: throw "Choose a valid race speed";
        }
        game.pushScene();
        const track = course.createTrack();
        const gates = track.gates;

        aiRacing.loadBots();

        createRaceScenery(course, gates);

        const stats = new racing.RacerStats(
                speedStat,
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

        const timer = racing.createTimer("compact");
        timer.top = 0;

        const lapTimes: number[] = [];
        const lapTimeSprites: timerSprite.TimerSprite[] = [];
        let finished = false;
        let result: RaceResult;
        let displayedAccelerationRatio = 0;

        const eventContext = game.currentScene().eventContext;

        const carEffects = new racing.effects.CarEffects(player);

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
            racing.drawSpeedometer(19, 20, 99, player.speed, player.stats.topSpeed,
                displayedAccelerationRatio);
            racing.drawPlacemarker(135, RACE_PLACE_MARKER_TOP, placement);
        });

        const accelerationHandler = eventContext.registerFrameHandler(scene.PRE_RENDER_UPDATE_PRIORITY + 1, () => {
            const limit = player.acceleration < 0 ? player.stats.deceleration : player.stats.acceleration;
            const target = Math.max(-1, Math.min(1, player.acceleration / limit));
            const blend = 1 - Math.exp(-eventContext.deltaTimeMillis / 120);
            displayedAccelerationRatio += (target - displayedAccelerationRatio) * blend;
            if (Math.abs(target - displayedAccelerationRatio) < 0.01) displayedAccelerationRatio = target;
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

            places.sort((a, b) => b.currentLap - a.currentLap
                || b.currentGateIndex - a.currentGateIndex
                || b.distance - a.distance);

            carEffects.update();

            if (!finished && player.currentLap !== currentLap) {
                lapTimes.push(timer.getElapsedTime());

                if (player.currentLap === totalLaps) {
                    const placement = places.indexOf(player) + 1;
                    timer.setRunning(false);
                    // Replace the placement stub when opponent cars are implemented.
                    result = recordRaceResult(course.trackId, lapTimes, placement);
                    finished = true;
                    player.startAutoDrive(gates);
                    timer.destroy();
                    for (const lapTimer of lapTimeSprites) lapTimer.destroy();
                    minimapRenderable.destroy();
                    hudRenderable.destroy();
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

        const countdownSprite = fancyText.create("3", 0, fancyText.twoToneColor(1, 12), outlinedRacingFont);
        countdownSprite.setFlag(SpriteFlag.RelativeToCamera, true);
        countdownSprite.setFlag(SpriteFlag.Ghost, true);

        try {
            control.runInBackground(() => {
                for (let i = 3; i > 0; i--) {
                    countdownSprite.setText(i.toString());
                    countdownSprite.x = screen.width / 2;
                    countdownSprite.y = screen.height / 2;
                    pause(1000);
                }
                countdownSprite.setText("GO");
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
            showRaceResults(result);
        } finally {
            timer.destroy();
            for (const lapTimer of lapTimeSprites) lapTimer.destroy();
            minimapRenderable.destroy();
            hudRenderable.destroy();
            eventContext.unregisterFrameHandler(handler);
            eventContext.unregisterFrameHandler(accelerationHandler);
            countdownSprite.destroy();
            carEffects.destroy();
            game.popScene();
        }
    }

    export function startMenuRaceBackground(): () => void {
        const courses = getCourses();
        const course = courses[randint(0, courses.length - 1)];
        const track = course.createTrack();
        const finishLineSprite = createRaceScenery(course, track.gates);
        const laneWidth = track.roadWidth * 0.22;
        const profiles: AutoDriveProfile[] = [
            { speedRatio: 0.74, cornerSlowdown: 0.6, lookaheadSeconds: 0.45, steeringGain: 1.8, laneOffset: -laneWidth },
            { speedRatio: 0.67, cornerSlowdown: 0.2, lookaheadSeconds: 0.65, steeringGain: 2.7, laneOffset: 0 },
            { speedRatio: 0.71, cornerSlowdown: 0.45, lookaheadSeconds: 0.4, steeringGain: 2.2, laneOffset: laneWidth }
        ];
        const basePaces = profiles.map(profile => profile.speedRatio);
        const baseLanes = profiles.map(profile => profile.laneOffset);
        const paceTargets = basePaces.map(pace => pace + randint(-8, 8) / 100);
        const nextPaceChanges = profiles.map(profile => game.runtime() + randint(4000, 9000));
        const passingUntil = [0, 0, 0];
        const cars: aiRacing.LearningCar[] = [];
        const carEffects: racing.effects.CarEffects[] = [];
        const firstGate = gateCenter(track.gates[0]);
        const nextGate = gateCenter(track.gates[1]);
        const heading = Math.atan2(nextGate.y - firstGate.y, nextGate.x - firstGate.x);
        for (let i = 0; i < 3; i++) {
            const stats = new RacerStats(100 - i * 5, 100 - i * 10, i === 0 ? 85 : 100, 80 + i * 10, 100, 100);
            const car = new aiRacing.LearningCar(stats, getCarFrames(i), track);
            const sideways = i === 2 ? track.roadWidth * 0.55 : (i - 0.5) * 18;
            const behind = 25 + i * 20;
            car.x = firstGate.x - behind * Math.cos(heading) - sideways * Math.sin(heading);
            car.y = firstGate.y - behind * Math.sin(heading) + sideways * Math.cos(heading);
            car.heading = heading;
            car.speed = stats.topSpeed * profiles[i].speedRatio * 0.85;
            car.lastTrackX = car.x;
            car.lastTrackY = car.y;
            car.startAutoDrive(track.gates, profiles[i]);
            cars.push(car);
            carEffects.push(new racing.effects.CarEffects(car));
        }
        const eventContext = game.currentScene().eventContext;
        let cameraX = cars[0].x + 30 * Math.cos(cars[0].heading);
        let cameraY = cars[0].y + 30 * Math.sin(cars[0].heading);
        scene.centerCameraAt(cameraX, cameraY);
        const handler = eventContext.registerFrameHandler(scene.UPDATE_PRIORITY, () => {
            const now = game.runtime();
            const dt = eventContext.deltaTimeMillis / 1000;
            let leader = cars[0];
            for (const car of cars) {
                car.distance = track.calculateDistance(car);
                if (car.distance > leader.distance) leader = car;
            }
            for (let i = 0; i < cars.length; i++) {
                const car = cars[i];
                const profile = profiles[i];
                if (now >= nextPaceChanges[i]) {
                    paceTargets[i] = basePaces[i] + randint(-8, 8) / 100;
                    nextPaceChanges[i] = now + randint(4000, 9000);
                }
                let desiredLane = baseLanes[i];
                if (now >= passingUntil[i]) {
                    for (const other of cars) {
                        if (other === car || Math.cos(other.heading - car.heading) < 0.5) continue;
                        const dx = other.x - car.x;
                        const dy = other.y - car.y;
                        const ahead = dx * Math.cos(car.heading) + dy * Math.sin(car.heading);
                        const sideways = -dx * Math.sin(car.heading) + dy * Math.cos(car.heading);
                        if (ahead > 0 && ahead < 50 && Math.abs(sideways) < 16) {
                            passingUntil[i] = now + 2000;
                            break;
                        }
                    }
                }
                const passing = now < passingUntil[i];
                if (passing) desiredLane = baseLanes[i] < 0 ? laneWidth : -laneWidth;
                profile.laneOffset += (desiredLane - profile.laneOffset) * Math.min(1, dt * 1.5);
                // Keep the field close without teleporting cars or assigning places.
                const catchUp = Math.min(0.08, Math.max(0, leader.distance - car.distance) * 0.04);
                const desiredPace = paceTargets[i] + catchUp + (passing ? 0.03 : 0);
                profile.speedRatio += (desiredPace - profile.speedRatio) * Math.min(1, dt);
            }
            for (const effects of carEffects) effects.update();
            cameraX += (leader.x + 30 * Math.cos(leader.heading) - cameraX) * Math.min(1, dt * 4);
            cameraY += (leader.y + 30 * Math.sin(leader.heading) - cameraY) * Math.min(1, dt * 4);
            scene.centerCameraAt(cameraX, cameraY);
        });
        return () => {
            eventContext.unregisterFrameHandler(handler);
            for (const effects of carEffects) effects.destroy();
            for (const car of cars) car.destroy();
            finishLineSprite.destroy();
        };
    }

    function createRaceScenery(course: Course, gates: Gate[]): Sprite {
        tiles.setCurrentTilemap(course.tilemap);
        const finishLineSprite = sprites.create(racing.finishLine);
        const position = gateCenter(gates[0]);
        finishLineSprite.rotation = Math.atan2(
            gates[0].end.y - gates[0].start.y,
            gates[0].end.x - gates[0].start.x
        );
        finishLineSprite.x = position.x;
        finishLineSprite.y = position.y;
        scene.setBackgroundImage(racing.generateBackground(course.backgroundTileset));
        scroller.scrollBackgroundWithCamera(scroller.CameraScrollMode.BothDirections);
        return finishLineSprite;
    }
}