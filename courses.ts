namespace racing {
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
            public patternScrollDirection: PreviewScrollDirection = 0
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
                    Track.Australia,
                    "Australia",
                    tilemap`australia`,
                    trackWaypoints.australia,
                    trackCenterlines.australia,
                    trackRoadWidths.australia,
                    [14, 4, 5],
                    2,
                    PreviewScrollDirection.N
                ),
                new Course(
                    Track.GreatBritain,
                    "Great Britain",
                    tilemap`greatbritain`,
                    trackWaypoints.greatbritain,
                    trackCenterlines.greatbritain,
                    trackRoadWidths.greatbritain,
                    [8, 6, 9],
                    4,
                    PreviewScrollDirection.E
                ),
                new Course(
                    Track.Italy,
                    "Italy",
                    tilemap`italy`,
                    trackWaypoints.italy,
                    trackCenterlines.italy,
                    trackRoadWidths.italy,
                    [4, 5, 1],
                    3,
                    PreviewScrollDirection.S
                ),
                new Course(
                    Track.Monaco,
                    "Monaco",
                    tilemap`monaco`,
                    trackWaypoints.monaco,
                    trackCenterlines.monaco,
                    trackRoadWidths.monaco,
                    [6, 7, 9],
                    14,
                    PreviewScrollDirection.W
                ),
                new Course(
                    Track.Netherlands,
                    "Netherlands",
                    tilemap`netherlands`,
                    trackWaypoints.netherlands,
                    trackCenterlines.netherlands,
                    trackRoadWidths.netherlands,
                    [8, 6, 9],
                    9,
                    PreviewScrollDirection.S
                ),
                new Course(
                    Track.USA,
                    "USA",
                    tilemap`usa`,
                    trackWaypoints.usa,
                    trackCenterlines.usa,
                    trackRoadWidths.usa,
                    [14, 2, 3],
                    10,
                    PreviewScrollDirection.W
                )
            ];
        }
        return courses;
    }

    export function getTrainingCourses(): Course[] {
        if (!testTrack) {
            testTrack = new Course(undefined, "Test Track", aiRacing.getTestTrackMap(), aiRacing.TEST_TRACK_GATES,
                aiRacing.TEST_TRACK_CENTERS, aiRacing.TEST_TRACK_WIDTH, [12, 14, 4], 6, PreviewScrollDirection.SW);
        }
        return [testTrack].concat(getCourses());
    }
}
