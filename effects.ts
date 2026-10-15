namespace racing.effects {
    export class CarEffects {
        private dustSource: particles.ParticleSource;
        private tireTrackSource: particles.ParticleSource;
        private offroadTireTrackSource: particles.ParticleSource;

        constructor(private car: racing.Car) {
            this.dustSource = createDustSource(car);
            this.tireTrackSource = createTireTrackSource(car);
            this.offroadTireTrackSource = createOffroadTireTrackSource(car);
            this.update();
        }

        update(): void {
            const offroad = this.car.isOffRoad();
            (this.dustSource.factory as DustFactory).offroad = offroad;
            const tireTracks = this.tireTrackSource.factory as TireTrackFactory;
            tireTracks.braking = this.car.isBraking();
            tireTracks.offroad = offroad;
            tireTracks.sharpTurning = this.car.isSharpTurning();
            (this.offroadTireTrackSource.factory as TireTrackFactory).offroad = offroad;
        }

        destroy(): void {
            this.dustSource.destroy();
            this.tireTrackSource.destroy();
            this.offroadTireTrackSource.destroy();
        }
    }

    export class DustFactory extends particles.ParticleFactory {
        private colors = [13, 1, 11];

        public offroad = false;

        constructor() {
            super();
        }

        createParticle(anchor: particles.ParticleAnchor) {
            const vx = anchor.vx || 0;
            const vy = anchor.vy || 0;
            const speed = Math.sqrt(vx * vx + vy * vy);
            if (!this.offroad || speed < 1)
                return null;

            const p = super.createParticle(anchor);
            const kick = randint(2, 8);
            const xRange = Math.max(1, (anchor.width || 8) >> 2);
            const yRange = Math.max(1, (anchor.height || 8) >> 2);

            p._x = Fx.add(p._x, Fx8(randint(-xRange, xRange)));
            p._y = Fx.add(p._y, Fx8(randint(-yRange, yRange)));
            p.vx = Fx8(vx * 0.1 - vx / speed * kick + randint(-8, 8));
            p.vy = Fx8(vy * 0.1 - vy / speed * kick + randint(-8, 8));
            p.lifespan = randint(350, 700);
            p.data = randint(1, 4);
            p.color = this.colors[randint(0, this.colors.length - 1)];

            return p;
        }

        drawParticle(p: particles.Particle, x: Fx8, y: Fx8) {
            const radius = Math.max(1, Math.ceil(p.data * Math.min(1, p.lifespan / 200)));
            screen.fillCircle(Fx.toInt(x), Fx.toInt(y), radius, p.color);
        }
    }

    export function createDustSource(car: Sprite) {
        const source = new particles.ParticleSource(car, 24, new DustFactory());
        source.z = car.z - 1;
        return source;
    }

    export class TireTrackFactory extends particles.ParticleFactory {
        public braking = false;
        public offroad = false;
        public sharpTurning = false;

        constructor(private readonly offroadTracks: boolean = false) {
            super();
        }

        createParticle(anchor: particles.ParticleAnchor) {
            const vx = anchor.vx || 0;
            const vy = anchor.vy || 0;
            const speed = Math.sqrt(vx * vx + vy * vy);
            const active = this.offroadTracks
                ? this.offroad
                : !this.offroad && (this.braking || this.sharpTurning);
            if (!active || speed < 1)
                return null;

            const p = super.createParticle(anchor);
            p.data = Math.atan2(vy, vx);
            p._x = Fx.add(p._x, Fx8(-7 * vx / speed));
            p._y = Fx.add(p._y, Fx8(-7 * vy / speed));
            p.vx = Fx.zeroFx8;
            p.vy = Fx.zeroFx8;
            p.lifespan = 2000;
            p.color = this.offroadTracks ? 14 : 12;
            return p;
        }

        drawParticle(p: particles.Particle, x: Fx8, y: Fx8) {
            const dx = Math.cos(p.data);
            const dy = Math.sin(p.data);
            const density = Math.min(4, Math.ceil(p.lifespan / 250));
            const phase = Fx.toInt(p._x) + Fx.toInt(p._y);

            // Stable dithering fades the tracks without changing their palette color.
            for (let side = -1; side <= 1; side += 2) {
                for (let i = 0; i <= 4; i++) {
                    if (((phase + i) & 3) >= density)
                        continue;
                    screen.setPixel(
                        Fx.toInt(x) - dx * i - dy * side * 5,
                        Fx.toInt(y) - dy * i + dx * side * 5,
                        p.color
                    );
                }
            }
        }
    }

    export function createTireTrackSource(car: Sprite) {
        const source = new particles.ParticleSource(car, 60, new TireTrackFactory());
        source.z = car.z - 1;
        return source;
    }

    export function createOffroadTireTrackSource(car: Sprite) {
        const source = new particles.ParticleSource(car, 60, new TireTrackFactory(true));
        source.z = scene.TILE_MAP_Z - 1;
        return source;
    }
}