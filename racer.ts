namespace racing {
    export const TURN_RATE_MIN_DEGREES = 45;
    export const TURN_RATE_MAX_DEGREES = 90;

    export const TURN_RATE_MIN = mathUtils.degreesToRadians(TURN_RATE_MIN_DEGREES);
    export const TURN_RATE_MAX = mathUtils.degreesToRadians(TURN_RATE_MAX_DEGREES);
    export const SHARP_TURN_MIN_SPEED_RATIO = 0.7;
    export const SHARP_TURN_MIN_DURATION_MILLIS = 300;

    export const TOP_SPEED_MIN = 70;
    export const TOP_SPEED_MAX = 200;

    export const ACCELERATION_MIN = 5;
    export const ACCELERATION_MAX = 100;

    export const DECCELERATION_MIN = 100
    export const DECCELERATION_MAX = 200;

    export const FRICTION_DECELERATION_MIN = 20;
    export const FRICTION_DECELERATION_MAX = 50;

    export const OFF_ROAD_TOP_SPEED = 20;
    export const OFF_ROAD_DECCELERATION = 100;

    export const REVERSE_TOP_SPEED = 20;
    export const REVERSE_ACCELERATION = 50;

    export const STAT_MAX = 100;

    export enum ControlStateFlag {
        AccelerationOn = 1 << 0,
        BrakingOn = 1 << 1,
        TurnLeftOn = 1 << 2,
        TurnRightOn = 1 << 3,
        ReverseOn = 1 << 4
    }

    export class RacerStats {
        constructor(
            public readonly speedStat: number,
            public readonly accelerationStat: number,
            public readonly handlingStat: number,
            public readonly brakingStat: number,
            public readonly frictionStat: number,
            public readonly offRoadSpeedStat: number
        ) {
        }

        get turnRate() {
            return getStatValue(this.handlingStat, TURN_RATE_MIN, TURN_RATE_MAX);
        }

        get topSpeed() {
            return getStatValue(this.speedStat, TOP_SPEED_MIN, TOP_SPEED_MAX);
        }

        get acceleration() {
            return getStatValue(this.accelerationStat, ACCELERATION_MIN, ACCELERATION_MAX);
        }

        get deceleration() {
            return getStatValue(this.brakingStat, DECCELERATION_MIN, DECCELERATION_MAX);
        }

        get friction() {
            return getStatValue(this.frictionStat, FRICTION_DECELERATION_MIN, FRICTION_DECELERATION_MAX);
        }

        get offRoadSpeed() {
            return getStatValue(this.offRoadSpeedStat, 0, OFF_ROAD_TOP_SPEED);
        }

        get reverseTopSpeed() {
            return REVERSE_TOP_SPEED;
        }
    }

    function getStatValue(stat: number, min: number, max: number) {
        return min + (stat / STAT_MAX) * (max - min);
    }

    export class Car extends sprites.ExtendableSprite {
        heading = 0;
        speed = 0;
        controlState = 0;
        currentGateIndex = 0;
        currentLap = 0;

        controlEnabled = false;

        corners: util.Point[] = [];

        private sharpTurnDirection = 0;
        private sharpTurnMillis = 0;
        private autoDriveCenters: util.Point[];
        private autoDriveSegment = 0;
        private autoDriveTurnRate = 0;

        constructor(
            public readonly stats: RacerStats,
            public readonly frames: Image[],
        ) {
            super(frames[0]);

            this.corners = [
                new util.Point(this.left, this.top),
                new util.Point(this.right, this.top),
                new util.Point(this.right, this.bottom),
                new util.Point(this.left, this.bottom)
            ];
        }

        private updateDriving(deltaTimeMillis: number) {
            if (this.controlEnabled) {
                this.updateControls();
            }

            // acceleration
            if (this.controlState & ControlStateFlag.AccelerationOn) {
                if (this.isOffRoad()) {
                    if (this.speed > this.stats.offRoadSpeed) {
                        this.speed = changeSpeed(this.speed, this.stats.offRoadSpeed, OFF_ROAD_DECCELERATION, deltaTimeMillis);
                    }
                    else if (this.speed < this.stats.offRoadSpeed) {
                        this.speed = changeSpeed(this.speed, this.stats.offRoadSpeed, OFF_ROAD_DECCELERATION, deltaTimeMillis);
                    }
                }
                else if (this.speed > this.stats.topSpeed) {
                    this.speed = changeSpeed(this.speed, this.stats.topSpeed, this.stats.friction, deltaTimeMillis);
                }
                else if (this.speed < this.stats.topSpeed) {
                    const acceleration = calculateAcceleration(this.speed, this.stats.topSpeed, this.stats.acceleration);
                    this.speed = changeSpeed(this.speed, this.stats.topSpeed, acceleration, deltaTimeMillis);
                }
            }
            else if (this.isBraking()) {
                if (this.isOffRoad()) {
                    this.speed = changeSpeed(this.speed, 0, OFF_ROAD_DECCELERATION, deltaTimeMillis);
                }
                else {
                    this.speed = changeSpeed(this.speed, 0, this.stats.deceleration, deltaTimeMillis);
                }
            }
            else if (this.controlState & ControlStateFlag.ReverseOn) {
                if (this.speed > -this.stats.reverseTopSpeed) {
                    this.speed = changeSpeed(this.speed, -this.stats.reverseTopSpeed, this.stats.acceleration, deltaTimeMillis);
                }
            }
            else if (this.speed !== 0) {
                if (this.isOffRoad()) {
                    this.speed = changeSpeed(this.speed, 0, OFF_ROAD_DECCELERATION, deltaTimeMillis);
                }
                else {
                    this.speed = changeSpeed(this.speed, 0, this.stats.friction, deltaTimeMillis);
                }
            }

            // turning
            if (this.controlState & ControlStateFlag.ReverseOn && !(this.controlState & (ControlStateFlag.BrakingOn | ControlStateFlag.AccelerationOn))) {
                if (this.controlState & ControlStateFlag.TurnLeftOn) {
                    this.heading += this.stats.turnRate * (deltaTimeMillis / 1000);
                }
                if (this.controlState & ControlStateFlag.TurnRightOn) {
                    this.heading -= this.stats.turnRate * (deltaTimeMillis / 1000);
                }
            } else {
                if (this.controlState & ControlStateFlag.TurnLeftOn) {
                    this.heading -= this.stats.turnRate * (deltaTimeMillis / 1000);
                }
                if (this.controlState & ControlStateFlag.TurnRightOn) {
                    this.heading += this.stats.turnRate * (deltaTimeMillis / 1000);
                }
            }
        }

        update(deltaTimeMillis: number) {
            if (this.autoDriveCenters) {
                this.updateAutoDrive(deltaTimeMillis);
            }
            else {
                this.updateDriving(deltaTimeMillis);
            }
            this.updateSharpTurn(deltaTimeMillis);

            this.vx = this.speed * Math.cos(this.heading);
            this.vy = this.speed * Math.sin(this.heading);

            // animation
            const numFrames = this.frames.length;
            const angle = mathUtils.clampRadians(this.heading);

            const wedgeSize = (2 * Math.PI) / numFrames;

            let frameIndex: number;
            if (angle < wedgeSize / 2 || angle > 2 * Math.PI - wedgeSize / 2) {
                frameIndex = 0;
            }
            else {
                frameIndex = Math.floor((angle + wedgeSize / 2) / wedgeSize);
            }

            this.setImage(this.frames[frameIndex]);
        }

        startAutoDrive(gates: Gate[]) {
            this.controlEnabled = false;
            this.controlState = 0;
            this.autoDriveTurnRate = 0;
            this.autoDriveCenters = getTrackCenterline(gates);
            let nearestDistance = Infinity;
            for (let i = 0; i < this.autoDriveCenters.length; i++) {
                const start = this.autoDriveCenters[i];
                const end = this.autoDriveCenters[(i + 1) % this.autoDriveCenters.length];
                const progress = Math.max(0, Math.min(1, getSegmentProgress(this, start, end)));
                const dx = this.x - (start.x + (end.x - start.x) * progress);
                const dy = this.y - (start.y + (end.y - start.y) * progress);
                const squaredDistance = dx * dx + dy * dy;
                if (squaredDistance < nearestDistance) {
                    nearestDistance = squaredDistance;
                    this.autoDriveSegment = i;
                }
            }
        }

        private updateAutoDrive(deltaTimeMillis: number) {
            const centers = this.autoDriveCenters;
            const reach = Math.max(3, this.speed * deltaTimeMillis / 1000);
            for (let i = 0; i < centers.length; i++) {
                const start = centers[this.autoDriveSegment];
                const end = centers[(this.autoDriveSegment + 1) % centers.length];
                if (getSegmentProgress(this, start, end) < 1 && distance(this, end) > reach) {
                    break;
                }
                this.autoDriveSegment = (this.autoDriveSegment + 1) % centers.length;
            }

            let segment = this.autoDriveSegment;
            const start = centers[segment];
            const end = centers[(segment + 1) % centers.length];
            const progress = Math.max(0, Math.min(1, getSegmentProgress(this, start, end)));
            let targetX = start.x + (end.x - start.x) * progress;
            let targetY = start.y + (end.y - start.y) * progress;
            let lookahead = Math.max(24, Math.max(Math.abs(this.speed) * 0.6, reach * 2));
            for (let i = 0; i < centers.length; i++) {
                const next = centers[(segment + 1) % centers.length];
                const dx = next.x - targetX;
                const dy = next.y - targetY;
                const length = Math.sqrt(dx * dx + dy * dy);
                if (length > lookahead) {
                    targetX += dx * lookahead / length;
                    targetY += dy * lookahead / length;
                    break;
                }
                lookahead -= length;
                targetX = next.x;
                targetY = next.y;
                segment = (segment + 1) % centers.length;
            }
            const targetHeading = Math.atan2(targetY - this.y, targetX - this.x);
            const headingError = mathUtils.angleDifference(targetHeading, this.heading);
            const targetTurnRate = Math.max(-this.stats.turnRate,
                Math.min(this.stats.turnRate, headingError * 2));
            this.autoDriveTurnRate = changeSpeed(this.autoDriveTurnRate, targetTurnRate,
                this.stats.turnRate * 4, deltaTimeMillis);
            this.heading = mathUtils.clampRadians(
                this.heading + this.autoDriveTurnRate * deltaTimeMillis / 1000
            );

            const cornerStrength = Math.min(1, Math.abs(headingError) / (Math.PI / 2));
            const targetSpeed = this.stats.topSpeed * 0.6 * (1 - cornerStrength * 0.4);
            this.speed = changeSpeed(this.speed, targetSpeed,
                this.speed > targetSpeed ? this.stats.deceleration : this.stats.acceleration,
                deltaTimeMillis);
        }

        draw(drawTop: number, drawLeft: number) {
            super.draw(drawTop, drawLeft);

            if (this.controlEnabled) {
                const camera = game.currentScene().camera;
                screen.setPixel(
                    this.x + 20 * Math.cos(this.heading) - camera.drawOffsetX,
                    this.y + 20 * Math.sin(this.heading) - camera.drawOffsetY,
                    2
                );
            }

        }

        updateControls() {
            this.controlState = 0;
            if (controller.A.isPressed() || controller.up.isPressed()) {
                this.controlState |= ControlStateFlag.AccelerationOn;
            }
            if (controller.B.isPressed()) {
                this.controlState |= ControlStateFlag.BrakingOn;
            }
            if (controller.left.isPressed()) {
                this.controlState |= ControlStateFlag.TurnLeftOn;
            }
            if (controller.right.isPressed()) {
                this.controlState |= ControlStateFlag.TurnRightOn;
            }
            if (controller.down.isPressed()) {
                this.controlState |= ControlStateFlag.ReverseOn;
            }
        }

        isBraking() {
            return !(this.controlState & ControlStateFlag.AccelerationOn)
                && !!(this.controlState & ControlStateFlag.BrakingOn
                    || (this.controlState & ControlStateFlag.ReverseOn && this.speed > 0));
        }

        isSharpTurning() {
            return this.sharpTurnMillis >= SHARP_TURN_MIN_DURATION_MILLIS
                && Math.abs(this.speed) > this.stats.topSpeed * SHARP_TURN_MIN_SPEED_RATIO
                && this.sharpTurnDirection === (this.controlState
                    & (ControlStateFlag.TurnLeftOn | ControlStateFlag.TurnRightOn));
        }

        private updateSharpTurn(deltaTimeMillis: number) {
            const direction = this.controlState
                & (ControlStateFlag.TurnLeftOn | ControlStateFlag.TurnRightOn);
            if ((direction !== ControlStateFlag.TurnLeftOn && direction !== ControlStateFlag.TurnRightOn)
                || Math.abs(this.speed) <= this.stats.topSpeed * SHARP_TURN_MIN_SPEED_RATIO) {
                this.sharpTurnDirection = 0;
                this.sharpTurnMillis = 0;
                return;
            }

            if (direction !== this.sharpTurnDirection) {
                this.sharpTurnDirection = direction;
                this.sharpTurnMillis = 0;
            }
            this.sharpTurnMillis = Math.min(
                SHARP_TURN_MIN_DURATION_MILLIS,
                this.sharpTurnMillis + deltaTimeMillis
            );
        }

        isOffRoad() {
            const map = game.currentScene().tileMap.data;
            const col = this.x >> map.scale;
            const row = this.y >> map.scale;

            const tileImage = map.getTileset()[map.getTile(col, row)];

            const offsetX = (this.x - (col << map.scale));
            const offsetY = (this.y - (row << map.scale));

            if (tileImage.getPixel(offsetX, offsetY) !== myTiles.road.getPixel(0, 0)) {
                return true;
            }
            return false;
        }

        checkGateOverlaps(gates: Gate[]) {
            this.corners[0].x = this.left;
            this.corners[0].y = this.top;
            this.corners[1].x = this.right;
            this.corners[1].y = this.top;
            this.corners[2].x = this.right;
            this.corners[2].y = this.bottom;
            this.corners[3].x = this.left;
            this.corners[3].y = this.bottom;

            const prevIndex = this.currentGateIndex;

            for (let gateIndex = 0; gateIndex < 2; gateIndex++) {
                const gate = gates[(this.currentGateIndex + 1 + gateIndex) % gates.length];
                const gateMidpoint = gateCenter(gate);
                let crossing = gateMidpoint.x >= this.left && gateMidpoint.x <= this.right &&
                    gateMidpoint.y >= this.top && gateMidpoint.y <= this.bottom;

                for (let i = 0; i < this.corners.length; i++) {
                    const corner = this.corners[i];
                    const next = this.corners[(i + 1) % this.corners.length];

                    if (mathUtils.lineIntersectsLine(
                        corner, next, gate.start, gate.end
                    )) {
                        crossing = true;
                        break;
                    }
                }
                if (crossing) {
                    this.currentGateIndex = (this.currentGateIndex + 1 + gateIndex) % gates.length;
                    break;
                }
            }

            if (prevIndex > this.currentGateIndex) {
                this.currentLap++;
            }
        }
    }

    function changeSpeed(currentSpeed: number, targetSpeed: number, acceleration: number, deltaTimeMillis: number) {
        if (currentSpeed < targetSpeed) {
            currentSpeed += acceleration * (deltaTimeMillis / 1000);
            if (currentSpeed > targetSpeed) {
                currentSpeed = targetSpeed;
            }
        } else if (currentSpeed > targetSpeed) {
            currentSpeed -= acceleration * (deltaTimeMillis / 1000);
            if (currentSpeed < targetSpeed) {
                currentSpeed = targetSpeed;
            }
        }
        return currentSpeed;
    }

    function calculateAcceleration(
        currentSpeed: number,
        maxSpeed: number,
        maxAcceleration: number
    ) {
        // Keep the initial response while tapering acceleration more strongly near top speed.
        return maxAcceleration * Math.exp(-2 * Math.max(0, currentSpeed) / maxSpeed);
    }
}