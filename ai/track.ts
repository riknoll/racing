namespace aiRacing {
    export interface Gate {
        start: util.Point;
        end: util.Point;
    }

    interface RoadPosition {
        segment: number;
        fraction: number;
        x: number;
        y: number;
        heading: number;
    }

    /** Track geometry supplies observations and checkpoints, not driving commands. */
    export class Track {
        readonly gates: Gate[] = [];
        readonly centers: util.Point[] = [];

        constructor(gates: Buffer, centers: Buffer, public readonly roadWidth: number) {
            if (gates.length < 24 || gates.length % 8 || centers.length < 12 || centers.length % 4 || roadWidth <= 0) {
                throw "Invalid racing track geometry";
            }
            for (let i = 0; i < gates.length; i += 8) {
                this.gates.push({
                    start: new util.Point(gates.getNumber(NumberFormat.UInt16LE, i), gates.getNumber(NumberFormat.UInt16LE, i + 2)),
                    end: new util.Point(gates.getNumber(NumberFormat.UInt16LE, i + 4), gates.getNumber(NumberFormat.UInt16LE, i + 6))
                });
            }
            for (let i = 0; i < centers.length; i += 4) {
                this.centers.push(new util.Point(centers.getNumber(NumberFormat.UInt16LE, i), centers.getNumber(NumberFormat.UInt16LE, i + 2)));
            }
            if (this.gates.length !== this.centers.length * 2) throw "Expected two racing gates per turn";
            for (let i = 0; i < this.centers.length; i++) {
                if (!this.segmentLength(i)) throw "A racing road segment has zero length";
            }
        }

        reset(car: LearningCar): void {
            const gate = this.gates[0];
            car.x = (gate.start.x + gate.end.x) / 2;
            car.y = (gate.start.y + gate.end.y) / 2;
            // The first gate is before turn zero, on the last centerline segment.
            const start = this.centers[this.centers.length - 1];
            const end = this.centers[0];
            car.heading = Math.atan2(end.y - start.y, end.x - start.x);
            car.speed = 0;
            car.vx = 0;
            car.vy = 0;
            car.controlState = 0;
            car.currentGateIndex = 0;
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
            // Match the race's tolerance for missing the first gate at a corner.
            for (let ahead = 1; ahead <= 2; ahead++) {
                const next = (car.currentGateIndex + ahead) % this.gates.length;
                const gate = this.gates[next];
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
            const turn = Math.floor(car.currentGateIndex / 2);
            const expected = car.currentGateIndex % 2 ? turn : turn - 1;
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
