namespace aiRacing {
    export const SAMPLE_LIMIT = 2400;
    const NEIGHBOR_COUNT = 5;
    const WEIGHT_SMOOTHING = 0.04;
    const PEDAL_SPEED_WEIGHT = 64;

    enum Decision {
        Steering,
        Pedals
    }

    export enum Pedal {
        Coast,
        Accelerate,
        Brake,
        Reverse
    }

    /** Normalized road observations used to compare driving situations. */
    export class Observation {
        constructor(
            public offset: number,
            public heading: number,
            public nearBend: number,
            public bend: number,
            public speed: number,
            public offRoad: number,
            public aim = 0
        ) {}

        distanceSquaredTo(other: Observation): number {
            const offset = this.offset - other.offset;
            // +179° and -179° are close, not opposite directions.
            const heading = angleDifference(this.heading * Math.PI, other.heading * Math.PI) / Math.PI;
            const nearBend = this.nearBend - other.nearBend;
            const bend = this.bend - other.bend;
            const speed = this.speed - other.speed;
            const offRoad = this.offRoad - other.offRoad;
            const aim = angleDifference(this.aim * Math.PI, other.aim * Math.PI) / Math.PI;
            return 3 * offset * offset + 4 * heading * heading
                + 2 * nearBend * nearBend + 2 * bend * bend
                + speed * speed + 2 * offRoad * offRoad + 12 * aim * aim;
        }

        /** Keep rolling/coasting examples distinct from stopped/accelerating examples. */
        pedalDistanceSquaredTo(other: Observation): number {
            const speed = this.speed - other.speed;
            const nearBend = this.nearBend - other.nearBend;
            const bend = this.bend - other.bend;
            const offRoad = this.offRoad - other.offRoad;
            return PEDAL_SPEED_WEIGHT * speed * speed + 4 * nearBend * nearBend
                + 4 * bend * bend + 4 * offRoad * offRoad;
        }
    }

    /** Steering and pedals are separate: turning while accelerating is allowed. */
    export class Action {
        constructor(public steer: number, public pedal: Pedal) {}

        static fromControls(controls: number): Action {
            const steer = (controls & racing.ControlStateFlag.TurnRightOn ? 1 : 0)
                - (controls & racing.ControlStateFlag.TurnLeftOn ? 1 : 0);
            return new Action(steer, Action.pedalFromControls(controls));
        }

        /** Match the car's priority when more than one pedal is held. */
        static pedalFromControls(controls: number): Pedal {
            return controls & racing.ControlStateFlag.AccelerationOn ? Pedal.Accelerate
                : controls & racing.ControlStateFlag.BrakingOn ? Pedal.Brake
                : controls & racing.ControlStateFlag.ReverseOn ? Pedal.Reverse : Pedal.Coast;
        }

        controls(): number {
            let controls = this.steer < 0 ? racing.ControlStateFlag.TurnLeftOn
                : this.steer > 0 ? racing.ControlStateFlag.TurnRightOn : 0;
            if (this.pedal === Pedal.Accelerate) controls |= racing.ControlStateFlag.AccelerationOn;
            else if (this.pedal === Pedal.Brake) controls |= racing.ControlStateFlag.BrakingOn;
            else if (this.pedal === Pedal.Reverse) controls |= racing.ControlStateFlag.ReverseOn;
            return controls;
        }
    }

    class Example {
        constructor(public observation: Observation, public action: Action) {}
    }

    /** Vote on each driving decision using its five nearest demonstrations. */
    export class Driver {
        private examples: Example[] = [];
        private replaceAt = 0;
        private indices: number[] = [];
        private distances: number[] = [];
        private steeringVotes: number[] = [0, 0, 0];
        private pedalVotes: number[] = [0, 0, 0, 0];
        actionCounts: number[] = [0, 0, 0, 0, 0];

        constructor() {
            for (let i = 0; i < NEIGHBOR_COUNT; i++) {
                this.indices.push(-1);
                this.distances.push(0);
            }
        }

        count(): number {
            return this.examples.length;
        }

        /** Read stored examples for visualization without running a prediction. */
        visitExamples(visitor: (observation: Observation, action: Action, index: number) => void): void {
            for (let i = 0; i < this.examples.length; i++) {
                const example = this.examples[i];
                visitor(example.observation, example.action, i);
            }
        }

        learn(observation: Observation, controls: number): void {
            const action = Action.fromControls(controls);
            const example = new Example(observation, action);
            if (this.examples.length < SAMPLE_LIMIT) this.examples.push(example);
            else {
                this.countActions(this.examples[this.replaceAt].action, -1);
                this.examples[this.replaceAt] = example;
                this.replaceAt = (this.replaceAt + 1) % SAMPLE_LIMIT;
            }
            this.countActions(action, 1);
        }

        predict(observation: Observation): number {
            if (!this.examples.length) throw "Teach the AI before asking it to drive";
            this.findNeighbors(observation, Decision.Steering);
            const steer = this.vote(Decision.Steering) - 1;
            this.findNeighbors(observation, Decision.Pedals);
            return new Action(steer, this.vote(Decision.Pedals)).controls();
        }

        private findNeighbors(observation: Observation, decision: Decision): void {
            const pedals = decision === Decision.Pedals;
            for (let i = 0; i < NEIGHBOR_COUNT; i++) {
                this.indices[i] = -1;
                this.distances[i] = 1000000000;
            }
            for (let i = 0; i < this.examples.length; i++) {
                const example = this.examples[i];
                const distance = pedals ? observation.pedalDistanceSquaredTo(example.observation)
                    : observation.distanceSquaredTo(example.observation);
                for (let place = 0; place < NEIGHBOR_COUNT; place++) {
                    if (distance >= this.distances[place]) continue;
                    for (let move = NEIGHBOR_COUNT - 1; move > place; move--) {
                        this.distances[move] = this.distances[move - 1];
                        this.indices[move] = this.indices[move - 1];
                    }
                    this.distances[place] = distance;
                    this.indices[place] = i;
                    break;
                }
            }
        }

        private vote(decision: Decision): number {
            const pedals = decision === Decision.Pedals;
            const votes = pedals ? this.pedalVotes : this.steeringVotes;
            for (let i = 0; i < votes.length; i++) votes[i] = 0;
            for (let i = 0; i < NEIGHBOR_COUNT; i++) {
                if (this.indices[i] < 0) continue;
                const action = this.examples[this.indices[i]].action;
                const weight = 1 / (WEIGHT_SMOOTHING + this.distances[i]);
                votes[pedals ? action.pedal : action.steer + 1] += weight;
            }
            return this.winner(votes, pedals ? Pedal.Coast : 1);
        }

        private winner(votes: number[], preferred: number): number {
            let best = preferred;
            for (let i = 0; i < votes.length; i++) {
                if (votes[i] > votes[best]) best = i;
            }
            return best;
        }

        private countActions(action: Action, change: number): void {
            if (action.steer < 0) this.actionCounts[0] += change;
            if (action.steer > 0) this.actionCounts[1] += change;
            if (action.pedal === Pedal.Accelerate) this.actionCounts[2] += change;
            if (action.pedal === Pedal.Brake) this.actionCounts[3] += change;
            if (action.pedal === Pedal.Reverse) this.actionCounts[4] += change;
        }
    }
}
