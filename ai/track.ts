namespace aiRacing {
    interface RoadPosition {
        segment: number;
        fraction: number;
        x: number;
        y: number;
        heading: number;
    }

    /** Track geometry supplies observations and checkpoints, not driving commands. */
    export class Track {
        readonly gates: racing.Gate[] = [];
        readonly centers: util.Point[] = [];
        private finishGateOffset: number;

        constructor(gates: Buffer, centers: Buffer, public readonly roadWidth: number) {
            if (gates.length < 48 || gates.length % 16 || centers.length < 12 || centers.length % 4 || roadWidth <= 0) {
                throw "Invalid racing track geometry";
            }
            this.gates = racing.readGates(gates);
            for (let i = 0; i < centers.length; i += 4) {
                this.centers.push(new util.Point(centers.getNumber(NumberFormat.UInt16LE, i), centers.getNumber(NumberFormat.UInt16LE, i + 2)));
            }
            this.finishGateOffset = this.gates.length - this.centers.length * 2;
            if (this.finishGateOffset !== 0 && this.finishGateOffset !== 1) {
                throw "Expected two gates per turn with an optional finish gate";
            }
            for (let i = 0; i < this.centers.length; i++) {
                if (!this.segmentLength(i)) throw "A racing road segment has zero length";
            }
        }

        reset(car: LearningCar): void {
            const gate = this.gates[0];
            car.x = (gate.start.x + gate.end.x) / 2;
            car.y = (gate.start.y + gate.end.y) / 2;
            // The first gate precedes turn zero, on the final road segment.
            const start = this.centers[this.centers.length - 1];
            const end = this.centers[0];
            car.heading = Math.atan2(end.y - start.y, end.x - start.x);
            car.speed = 0;
            car.vx = 0;
            car.vy = 0;
            car.controlState = 0;
            car.currentGateIndex = 0;
            car.currentLap = 0;
            car.completedGates = 0;
            car.elapsedMillis = 0;
            car.offRoadMillis = 0;
            car.lastTrackX = car.x;
            car.lastTrackY = car.y;
            car.track = this;
        }

        updateProgress(car: LearningCar): void {
            const corners = [
                new util.Point(car.left, car.top), new util.Point(car.right, car.top),
                new util.Point(car.right, car.bottom), new util.Point(car.left, car.bottom)
            ];
            const movementX = car.x - car.lastTrackX;
            const movementY = car.y - car.lastTrackY;
            const onRoad = !car.isOffRoad();
            const sweptLeft = Math.min(car.left, car.lastTrackX);
            const sweptRight = Math.max(car.right, car.lastTrackX);
            const sweptTop = Math.min(car.top, car.lastTrackY);
            const sweptBottom = Math.max(car.bottom, car.lastTrackY);
            // Recover from missed gates rather than requiring another perfect lap.
            // The half-lap bound excludes gates just passed while reversing.
            for (let ahead = 1; ahead <= Math.floor(this.gates.length / 2); ahead++) {
                const next = (car.currentGateIndex + ahead) % this.gates.length;
                const gate = this.gates[next];
                if (Math.max(gate.start.x, gate.end.x) < sweptLeft || Math.min(gate.start.x, gate.end.x) > sweptRight
                    || Math.max(gate.start.y, gate.end.y) < sweptTop || Math.min(gate.start.y, gate.end.y) > sweptBottom) continue;
                const segment = this.segmentForGate(next);
                const start = this.centers[segment];
                const end = this.centers[(segment + 1) % this.centers.length];
                const forward = movementX * (end.x - start.x) + movementY * (end.y - start.y);
                if (forward < 0) continue;
                if (ahead > 2) {
                    if (!onRoad || forward <= 0) continue;
                }
                const midpointX = (gate.start.x + gate.end.x) / 2;
                const midpointY = (gate.start.y + gate.end.y) / 2;
                let crossing = midpointX >= car.left && midpointX <= car.right
                    && midpointY >= car.top && midpointY <= car.bottom;
                for (let i = 0; !crossing && i < corners.length; i++) {
                    crossing = !!mathUtils.lineIntersectsLine(corners[i], corners[(i + 1) % corners.length], gate.start, gate.end);
                }
                // A long frame can move the whole sprite past a gate between updates.
                if (!crossing) {
                    crossing = !!mathUtils.lineIntersectsLine(
                        new util.Point(car.lastTrackX, car.lastTrackY), new util.Point(car.x, car.y), gate.start, gate.end);
                }
                if (crossing) {
                    car.currentGateIndex = next;
                    car.completedGates += ahead;
                    car.currentLap = Math.floor(car.completedGates / this.gates.length);
                    break;
                }
            }
            car.lastTrackX = car.x;
            car.lastTrackY = car.y;
        }

        observe(car: racing.Car): Observation {
            const road = this.nearestRoadPosition(car);
            const offsetX = car.x - road.x;
            const offsetY = car.y - road.y;
            const offset = (-Math.sin(road.heading) * offsetX + Math.cos(road.heading) * offsetY) / (this.roadWidth / 2);
            const speed = Math.abs(car.speed);
            // Stopping distance is speed² / (2 * deceleration); add 0.6s of travel.
            const preview = Math.max(this.roadWidth, speed * 0.6 + speed * speed / (2 * car.stats.deceleration));
            const aim = this.positionAhead(road, Math.max(24, speed * 0.4));
            const near = this.positionAhead(road, this.roadWidth / 2);
            const ahead = this.positionAhead(road, preview);
            return new Observation(
                offset,
                angleDifference(car.heading, road.heading) / Math.PI,
                angleDifference(near.heading, road.heading) / Math.PI,
                angleDifference(ahead.heading, road.heading) / Math.PI,
                car.speed / racing.TOP_SPEED_MAX,
                car.isOffRoad() ? 1 : 0,
                angleDifference(Math.atan2(aim.y - car.y, aim.x - car.x), car.heading) / Math.PI
            );
        }

        private nearestRoadPosition(car: racing.Car): RoadPosition {
            // Gates before/after a turn identify nearby road segments. Searching
            // only these prevents jumping to a neighboring straight at a hairpin.
            const expected = this.segmentForGate(car.currentGateIndex);
            let nearest: RoadPosition;
            let bestDistance = 1000000000;
            for (let step = -1; step <= 1; step++) {
                const segment = (expected + step + this.centers.length) % this.centers.length;
                const start = this.centers[segment];
                const end = this.centers[(segment + 1) % this.centers.length];
                const dx = end.x - start.x;
                const dy = end.y - start.y;
                const fraction = Math.max(0, Math.min(1, ((car.x - start.x) * dx + (car.y - start.y) * dy) / (dx * dx + dy * dy)));
                const x = start.x + fraction * dx;
                const y = start.y + fraction * dy;
                const distance = (car.x - x) * (car.x - x) + (car.y - y) * (car.y - y);
                if (distance < bestDistance) {
                    bestDistance = distance;
                    nearest = { segment, fraction, x, y, heading: Math.atan2(dy, dx) };
                }
            }
            return nearest;
        }

        private segmentForGate(index: number): number {
            // Upstream race maps prepend the finish line to the turn pairs;
            // the Test Track uses only turn pairs and starts at the first one.
            const paired = index - this.finishGateOffset;
            if (paired < 0) return this.centers.length - 1;
            const turn = Math.floor(paired / 2);
            return (turn + (paired % 2 ? 0 : -1) + this.centers.length) % this.centers.length;
        }

        private positionAhead(position: RoadPosition, distance: number): RoadPosition {
            let segment = position.segment;
            let fraction = position.fraction;
            let remaining = this.segmentLength(segment) * (1 - position.fraction);
            for (let i = 0; i < this.centers.length && distance > remaining; i++) {
                distance -= remaining;
                segment = (segment + 1) % this.centers.length;
                fraction = 0;
                remaining = this.segmentLength(segment);
            }
            const start = this.centers[segment];
            const end = this.centers[(segment + 1) % this.centers.length];
            fraction += distance / this.segmentLength(segment);
            return {
                segment, fraction,
                x: start.x + fraction * (end.x - start.x),
                y: start.y + fraction * (end.y - start.y),
                heading: Math.atan2(end.y - start.y, end.x - start.x)
            };
        }

        private segmentLength(index: number): number {
            const start = this.centers[index];
            const end = this.centers[(index + 1) % this.centers.length];
            const dx = end.x - start.x;
            const dy = end.y - start.y;
            return Math.sqrt(dx * dx + dy * dy);
        }
    }

    export function angleDifference(first: number, second: number): number {
        const turn = Math.PI * 2;
        return ((first - second + Math.PI) % turn + turn) % turn - Math.PI;
    }
}
