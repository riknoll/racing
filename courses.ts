namespace racing {
    export enum TrainingTrack {
        //% block="Test Track"
        TestTrack,
        Monclava = 8,
        Strasbourg,
        Vancouver,
        Hanover,
        Birmingham,
        Seattle,
        Sydney
    }

    export enum PreviewScrollDirection {
        N,
        E,
        S,
        W,
        NE,
        NW,
        SE,
        SW
    }

    export class Course {
        constructor(
            public readonly trackId: Track,
            public readonly name: string,
            public readonly tilemap: tiles.TileMapData,
            public readonly gates: Buffer,
            public readonly centers: Buffer,
            public readonly roadWidth: number,
            public readonly previewColors: number[],
            public patternIndex: number = 0,
            public patternScrollDirection: PreviewScrollDirection = 0,
            public readonly backgroundTileset: BackgroundTileset = 0
        ) {
            if (!tilemap) throw "Missing tilemap for " + name;
            if (previewColors.length !== 3) throw "Course preview colors must contain dark, medium, and light";
            for (const color of previewColors) {
                if (color < 0 || color > 15 || color !== Math.floor(color)) {
                    throw "Invalid preview color for " + name;
                }
            }
        }

        createTrack(): aiRacing.Track {
            return new aiRacing.Track(this.gates, this.centers, this.roadWidth);
        }
    }

    let courses: Course[];
    let testTrack: Course;

    export function getCourses(): Course[] {
        if (!courses) {
            courses = [
                new Course(
                    Track.Birmingham,
                    "Birmingham",
                    tilemap`birmingham`,
                    trackWaypoints.birmingham,
                    trackCenterlines.birmingham,
                    trackRoadWidths.birmingham,
                    [6, 7, 9],
                    14,
                    PreviewScrollDirection.E,
                    BackgroundTileset.Grass
                ),
                new Course(
                    Track.Vancouver,
                    "Vancouver",
                    tilemap`vancouver`,
                    trackWaypoints.vancouver,
                    trackCenterlines.vancouver,
                    trackRoadWidths.vancouver,
                    [8, 6, 9],
                    9,
                    PreviewScrollDirection.S,
                    BackgroundTileset.DarkGrass
                ),
                new Course(
                    Track.Sydney,
                    "Sydney",
                    tilemap`sydney`,
                    trackWaypoints.sydney,
                    trackCenterlines.sydney,
                    trackRoadWidths.sydney,
                    [14, 4, 5],
                    2,
                    PreviewScrollDirection.N,
                    BackgroundTileset.Sand
                ),
                new Course(
                    Track.Strasbourg,
                    "Strasbourg",
                    tilemap`strasbourg`,
                    trackWaypoints.strasbourg,
                    trackCenterlines.strasbourg,
                    trackRoadWidths.strasbourg,
                    [4, 5, 1],
                    3,
                    PreviewScrollDirection.NE,
                    BackgroundTileset.Stone
                ),
                new Course(
                    Track.Monclava,
                    "Monclava",
                    tilemap`monclava`,
                    trackWaypoints.monclava,
                    trackCenterlines.monclava,
                    trackRoadWidths.monclava,
                    [14, 2, 3],
                    10,
                    PreviewScrollDirection.E,
                    BackgroundTileset.DryGrass
                ),
                new Course(
                    Track.Hanover,
                    "Hanover",
                    tilemap`hanover`,
                    trackWaypoints.hanover,
                    trackCenterlines.hanover,
                    trackRoadWidths.hanover,
                    [15, 10, 3],
                    4,
                    PreviewScrollDirection.S,
                    BackgroundTileset.Grass
                ),
                new Course(
                    Track.Seattle,
                    "Seattle",
                    tilemap`seattle`,
                    trackWaypoints.seattle,
                    trackCenterlines.seattle,
                    trackRoadWidths.seattle,
                    [8, 6, 9],
                    4,
                    PreviewScrollDirection.E,
                    BackgroundTileset.DarkStone
                )
            ];
        }
        return courses;
    }

    export function getTrainingCourses(): Course[] {
        if (!testTrack) {
            testTrack = new Course(undefined, "Test Track", aiRacing.getTestTrackMap(), aiRacing.TEST_TRACK_GATES,
                aiRacing.TEST_TRACK_CENTERS, aiRacing.TEST_TRACK_WIDTH, [12, 14, 4], 6, PreviewScrollDirection.SW,
                BackgroundTileset.Checkerboard);
        }
        return [testTrack].concat(getCourses());
    }
}
