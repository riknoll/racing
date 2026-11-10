namespace racing.trackEditor {
    export const GRID_SIZE = 20;

    export interface Point {
        x: number;
        y: number;
    }

    export interface Definition {
        name: string;
        points: Point[];
    }

    function cross(a: Point, b: Point, c: Point): number {
        return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
    }

    function onSegment(p: Point, a: Point, b: Point): boolean {
        return cross(a, b, p) === 0 && p.x >= Math.min(a.x, b.x) && p.x <= Math.max(a.x, b.x)
            && p.y >= Math.min(a.y, b.y) && p.y <= Math.max(a.y, b.y);
    }

    function intersects(a: Point, b: Point, c: Point, d: Point): boolean {
        const abC = cross(a, b, c);
        const abD = cross(a, b, d);
        const cdA = cross(c, d, a);
        const cdB = cross(c, d, b);
        return ((abC < 0 && abD > 0 || abC > 0 && abD < 0)
            && (cdA < 0 && cdB > 0 || cdA > 0 && cdB < 0))
            || onSegment(c, a, b) || onSegment(d, a, b)
            || onSegment(a, c, d) || onSegment(b, c, d);
    }

    export function invalidSegments(points: Point[]): boolean[] {
        const invalid: boolean[] = [];
        for (let i = 0; i < points.length; i++) {
            const a = points[i];
            const b = points[(i + 1) % points.length];
            const dx = Math.abs(b.x - a.x);
            const dy = Math.abs(b.y - a.y);
            invalid.push((dx === 0 && dy === 0)
                || !(dx === 0 || dy === 0 || dx === dy || dx === 2 * dy || dy === 2 * dx));
        }
        for (let i = 0; i < points.length; i++) {
            const a = points[i];
            const b = points[(i + 1) % points.length];
            for (let j = i + 1; j < points.length; j++) {
                const c = points[j];
                const d = points[(j + 1) % points.length];
                if (!intersects(a, b, c, d)) continue;
                const adjacent = j === i + 1 || i === 0 && j === points.length - 1;
                const turn = (b.x - a.x) * (d.y - c.y) - (b.y - a.y) * (d.x - c.x);
                const dot = (b.x - a.x) * (d.x - c.x) + (b.y - a.y) * (d.y - c.y);
                if (adjacent && (turn !== 0 || dot > 0)) continue;
                invalid[i] = invalid[j] = true;
            }
        }
        return invalid;
    }

    export class Model {
        points: Point[];
        cursorX: number;
        cursorY: number;
        dragging: number;
        private lastTapNode: number;
        private lastTapTime: number;
        private pressTime: number;

        constructor(points: Point[] = []) {
            this.points = points.map(point => ({ x: point.x, y: point.y }));
            this.cursorX = points.length ? points[0].x : 0;
            this.cursorY = points.length ? points[0].y : 0;
            this.dragging = -1;
            this.lastTapNode = this.lastTapTime = this.pressTime = -1;
        }

        nodeAtCursor(): number {
            for (let i = 0; i < this.points.length; i++) {
                if (this.points[i].x === this.cursorX && this.points[i].y === this.cursorY) return i;
            }
            return -1;
        }

        move(dx: number, dy: number): void {
            this.clearTap();
            this.cursorX = Math.max(0, Math.min(GRID_SIZE, this.cursorX + dx));
            this.cursorY = Math.max(0, Math.min(GRID_SIZE, this.cursorY + dy));
            if (this.dragging >= 0) {
                this.points[this.dragging] = { x: this.cursorX, y: this.cursorY };
            }
        }

        shift(dx: number, dy: number): boolean {
            this.clearTap();
            if (!this.points.length || this.dragging >= 0 || this.points.some(point =>
                point.x + dx < 0 || point.x + dx > GRID_SIZE
                || point.y + dy < 0 || point.y + dy > GRID_SIZE)) return false;
            for (const point of this.points) {
                point.x += dx;
                point.y += dy;
            }
            this.cursorX = Math.max(0, Math.min(GRID_SIZE, this.cursorX + dx));
            this.cursorY = Math.max(0, Math.min(GRID_SIZE, this.cursorY + dy));
            return true;
        }

        reverse(): void {
            this.clearTap();
            this.releaseA(-1);
            if (this.points.length > 1) {
                const remaining = this.points.slice(1);
                remaining.reverse();
                this.points = [this.points[0]].concat(remaining);
            }
        }

        flipHorizontal(): void {
            this.transform(point => ({ x: GRID_SIZE - point.x, y: point.y }));
        }

        flipVertical(): void {
            this.transform(point => ({ x: point.x, y: GRID_SIZE - point.y }));
        }

        rotate(): void {
            this.transform(point => ({ x: GRID_SIZE - point.y, y: point.x }));
        }

        private transform(apply: (point: Point) => Point): void {
            this.clearTap();
            this.releaseA(-1);
            this.points = this.points.map(apply);
            const cursor = apply({ x: this.cursorX, y: this.cursorY });
            this.cursorX = cursor.x;
            this.cursorY = cursor.y;
        }

        private clearTap(): void {
            this.lastTapNode = this.lastTapTime = this.pressTime = -1;
        }

        pressA(now: number = -1): void {
            this.dragging = this.nodeAtCursor();
            if (this.dragging >= 0) {
                if (now >= 0 && this.lastTapNode === this.dragging && now - this.lastTapTime <= 300) {
                    this.points = this.points.slice(this.dragging).concat(this.points.slice(0, this.dragging));
                    this.dragging = -1;
                    this.clearTap();
                } else {
                    this.clearTap();
                    this.pressTime = now;
                }
                return;
            }
            this.clearTap();
            const point = { x: this.cursorX, y: this.cursorY };
            for (let i = 0; i < this.points.length; i++) {
                if (onSegment(point, this.points[i], this.points[(i + 1) % this.points.length])) {
                    this.points.insertAt(i + 1, point);
                    return;
                }
            }
            this.points.push(point);
        }

        releaseA(now: number = -1): void {
            if (this.dragging >= 0 && this.pressTime >= 0 && now - this.pressTime <= 300 && now >= this.pressTime) {
                this.lastTapNode = this.dragging;
                this.lastTapTime = now;
            }
            this.pressTime = -1;
            this.dragging = -1;
        }

        deleteNode(): void {
            this.clearTap();
            const index = this.dragging >= 0 ? this.dragging : this.nodeAtCursor();
            if (index >= 0) this.points.removeAt(index);
            this.dragging = -1;
        }

        canSave(): boolean {
            return this.dragging < 0 && this.points.length >= 3
                && !invalidSegments(this.points).some(invalid => invalid);
        }

        serialize(): string {
            if (!this.canSave()) throw "A track needs at least three nodes and no invalid segments";
            return '{"version":1,"points":['
                + this.points.map(point => "[" + point.x + "," + point.y + "]").join(",") + "]}";
        }
    }
}
