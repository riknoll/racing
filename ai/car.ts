namespace aiRacing {
    const RECORD_INTERVAL_MS = 100;
    const DECISION_INTERVAL_MS = 50;
    const STOPPED_SPEED = 1;
    const STARTUP_TIMEOUT_MS = 5000;
    const STARTUP_MOVEMENT = 8;

    /** A car that records demonstrations or uses a learned driver. */
    export class LearningCar extends racing.Car {
        paused = false;
        driver: Driver;
        teaching = false;
        completedGates = 0;
        elapsedMillis = 0;
        offRoadMillis = 0;
        lastTrackX = 0;
        lastTrackY = 0;
        private recordTimer = 0;
        private decisionTimer = 0;
        private previousPedal = -1;
        private stopping = false;
        private startPosition: util.Point;
        private startupMillis = 0;
        private hasStartedMoving = false;

        constructor(stats: racing.RacerStats, frames: Image[], public track?: Track) {
            super(stats, frames);
            if (track) track.reset(this);
        }

        get startupStalled(): boolean {
            return !!this.driver && !this.controlEnabled && !this.teaching && !this.paused && !this.stopping
                && !this.hasStartedMoving && this.startupMillis >= STARTUP_TIMEOUT_MS;
        }

        update(deltaTimeMillis: number): void {
            if (this.paused) return;
            if (this.stopping) {
                super.update(deltaTimeMillis);
                if (this.speed === 0) this.stop();
                return;
            }
            if (this.driver && !this.track) throw "Set a track before teaching or testing the AI";
            if (this.track) this.track.updateProgress(this);
            if (this.controlEnabled) {
                if (this.teaching && this.driver) this.recordTimer -= deltaTimeMillis;
            } else if (this.driver) {
                if (!this.startPosition) this.startPosition = new util.Point(this.x, this.y);
                if (!this.hasStartedMoving) {
                    this.startupMillis += deltaTimeMillis;
                    const dx = this.x - this.startPosition.x;
                    const dy = this.y - this.startPosition.y;
                    this.hasStartedMoving = dx * dx + dy * dy >= STARTUP_MOVEMENT * STARTUP_MOVEMENT;
                }
                this.decisionTimer -= deltaTimeMillis;
                if (this.decisionTimer <= 0) {
                    this.controlState = this.driver.predict(this.track.observe(this));
                    this.decisionTimer = Math.max(1, this.decisionTimer + DECISION_INTERVAL_MS);
                }
            }
            this.elapsedMillis += deltaTimeMillis;
            if (this.isOffRoad()) this.offRoadMillis += deltaTimeMillis;
            super.update(deltaTimeMillis);
        }

        updateControls(): void {
            super.updateControls();
            // Record the buttons just read, before the base car applies physics.
            if (this.teaching && this.driver) {
                const pedal = Action.pedalFromControls(this.controlState);
                const changed = pedal !== this.previousPedal;
                const waiting = Math.abs(this.speed) < STOPPED_SPEED
                    && (pedal === Pedal.Coast || pedal === Pedal.Brake);
                // Brisk acceleration/braking taps can fall between regular samples.
                if (!waiting && (this.recordTimer <= 0 || changed)) {
                    this.driver.learn(this.track.observe(this), this.controlState);
                    this.recordTimer = changed ? RECORD_INTERVAL_MS : Math.max(1, this.recordTimer + RECORD_INTERVAL_MS);
                }
                this.previousPedal = pedal;
            }
        }

        brakeToStop(): void {
            this.stopping = true;
            this.controlEnabled = false;
            this.controlState = racing.ControlStateFlag.BrakingOn;
        }

        stop(): void {
            this.stopping = false;
            this.paused = true;
            this.controlEnabled = false;
            this.controlState = 0;
            this.speed = 0;
            this.acceleration = 0;
            this.vx = 0;
            this.vy = 0;
        }
    }
}
