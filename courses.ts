namespace racing {
    export class Course {
        constructor(
            public readonly name: string,
            public readonly tilemap: tiles.TileMapData,
            public readonly gates: Buffer,
            public readonly centers: Buffer,
            public readonly roadWidth: number
        ) {}

        createTrack(): aiRacing.Track {
            return new aiRacing.Track(this.gates, this.centers, this.roadWidth);
        }
    }

    let courses: Course[];
    let testTrack: Course;

    export function getCourses(): Course[] {
        if (!courses) {
            courses = [
                new Course("Australia", tilemap`australia`, trackWaypoints.australia, trackCenterlines.australia, trackRoadWidths.australia),
                new Course("Great Britain", tilemap`great_britain`, trackWaypoints.greatbritain, trackCenterlines.greatbritain, trackRoadWidths.greatbritain),
                new Course("Italy", tilemap`italy`, trackWaypoints.italy, trackCenterlines.italy, trackRoadWidths.italy),
                new Course("Monaco", tilemap`monaco`, trackWaypoints.monaco, trackCenterlines.monaco, trackRoadWidths.monaco),
                new Course("Netherlands", tilemap`netherlands`, trackWaypoints.netherlands, trackCenterlines.netherlands, trackRoadWidths.netherlands),
                new Course("USA", tilemap`usa`, trackWaypoints.usa, trackCenterlines.usa, trackRoadWidths.usa)
            ];
        }
        return courses;
    }

    export function getTrainingCourses(): Course[] {
        if (!testTrack) {
            testTrack = new Course("Test Track", aiRacing.getTestTrackMap(), aiRacing.TEST_TRACK_GATES,
                aiRacing.TEST_TRACK_CENTERS, aiRacing.TEST_TRACK_WIDTH);
        }
        return [testTrack].concat(getCourses());
    }
}
