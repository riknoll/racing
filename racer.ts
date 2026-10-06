namespace racing {
    export const TURN_RATE_MIN_DEGREES = 45;
    export const TURN_RATE_MAX_DEGREES = 90;

    export const TURN_RATE_MIN = mathUtils.degreesToRadians(TURN_RATE_MIN_DEGREES);
    export const TURN_RATE_MAX = mathUtils.degreesToRadians(TURN_RATE_MAX_DEGREES);

    export const TOP_SPEED_MIN = 70;
    export const TOP_SPEED_MAX = 150;

    export const ACCELERATION_MIN = 5;
    export const ACCELERATION_MAX = 100;

    export const DECCELERATION_MIN = 5;
    export const DECCELERATION_MAX = 50;

    export const FRICTION_DECELERATION_MIN = 1;
    export const FRICTION_DECELERATION_MAX = 10;

    export const OFF_ROAD_TOP_SPEED = 20;
    export const OFF_ROAD_DECCELERATION = 100;

    export const REVERSE_TOP_SPEED = 20;
    export const REVERSE_ACCELERATION = 50;

    export const STAT_MAX = 100;

    enum ControlStateFlag {
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

        controlEnabled = false;

        constructor(
            public readonly stats: RacerStats,
            public readonly frames: Image[],
        ) {
            super(frames[0]);
        }

        update(deltaTimeMillis: number) {
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
                    this.speed = changeSpeed(this.speed, this.stats.topSpeed, this.stats.acceleration, deltaTimeMillis);
                }
            }
            else if (this.controlState & ControlStateFlag.BrakingOn || (this.controlState & ControlStateFlag.ReverseOn && this.speed > 0)) {
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
            if (controller.A.isPressed()) {
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

        isOffRoad() {
            const map = game.currentScene().tileMap.data;
            const col = this.x >> map.scale;
            const row = this.y >> map.scale;

            const tileImage = map.getTileset()[map.getTile(col, row)];

            const offsetX = (this.x - (col << map.scale));
            const offsetY = (this.y - (row << map.scale));

            if (tileImage.getPixel(offsetX, offsetY) === 7) {
                return true;
            }
            return false;
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
}