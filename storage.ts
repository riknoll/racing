namespace racing {
    export enum StorageKey {
        BestLap = 0,
        TotalRaces = 1,
        TotalWins = 2,
        BestPlace = 3,
        BestTime = 4,
        LastTime = 5,
        LastLapTimes = 6
    }

    export class LapResult {
        constructor(public time: number, public newBest: boolean) {
        }
    }

    export class RaceResult {
        constructor(
            public laps: LapResult[],
            public totalTime: number,
            public newBestTotal: boolean,
            public place: number
        ) {
        }
    }

    export function recordRaceResult(track: Track, lapTimes: number[], place: number) {
        const laps: LapResult[] = [];
        let totalTime = 0;
        let hasBestLap = hasStorageKey(track, StorageKey.BestLap);
        let bestLap = hasBestLap ? readStorage(track, StorageKey.BestLap) : 0;
        let improvedLap = false;
        for (const time of lapTimes) {
            const newBest = !hasBestLap || time < bestLap;
            laps.push(new LapResult(time, newBest));
            totalTime += time;
            if (newBest) {
                hasBestLap = true;
                bestLap = time;
                improvedLap = true;
            }
        }
        if (improvedLap) {
            writeStorage(track, StorageKey.BestLap, bestLap);
        }

        const newBestTotal = !hasStorageKey(track, StorageKey.BestTime)
            || totalTime < readStorage(track, StorageKey.BestTime);
        if (newBestTotal) {
            writeStorage(track, StorageKey.BestTime, totalTime);
        }
        writeStorage(track, StorageKey.LastTime, totalTime);
        settings.writeNumberArray(getStorageKey(track, StorageKey.LastLapTimes), lapTimes);
        incrementStorage(track, StorageKey.TotalRaces);
        if (place === 1) {
            incrementStorage(track, StorageKey.TotalWins);
        }
        if (!hasStorageKey(track, StorageKey.BestPlace)
            || place < readStorage(track, StorageKey.BestPlace)) {
            writeStorage(track, StorageKey.BestPlace, place);
        }
        return new RaceResult(laps, totalTime, newBestTotal, place);
    }

    export function readLastLapTimes(track: Track): number[] {
        return settings.readNumberArray(getStorageKey(track, StorageKey.LastLapTimes));
    }

    export function hasStorageKey(track: Track, key: StorageKey): boolean {
        return settings.exists(getStorageKey(track, key));
    }

    export function readStorage(track: Track, key: StorageKey): number {
        return settings.readNumber(getStorageKey(track, key));
    }

    export function incrementStorage(track: Track, key: StorageKey, incrementBy: number = 1): void {
        const currentValue = hasStorageKey(track, key) ? readStorage(track, key) : 0;
        writeStorage(track, key, currentValue + incrementBy);
    }

    export function writeStorage(track: Track, key: StorageKey, value: number): void {
        settings.writeNumber(getStorageKey(track, key), value);
    }

    function getStorageKey(track: Track, key: StorageKey): string {
        return `${track}_${key}`;
    }
}