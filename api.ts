//% color="#007f86" icon="\uf1b9" block="Racing" weight=100
//% groups='["Game", "Car"]'
namespace racing {
    /**
     * Open the racing menu with Race, Train AI, and View AI.
     */
    //% blockId=racing_start_game block="start racing game"
    //% help=github:this/docs/start-game
    //% group="Game" weight=100
    export function startGame(): void {
        runGameMenu([], false, false);
    }

    /**
     * Race a selected track without opening the game menu.
     * @param track the race course
     * @param laps the number of laps, eg: 1
     */
    //% blockId=racing_race_on_track block="race on $track for $laps laps"
    //% help=github:this/docs/race-on-track
    //% group="Game" weight=90
    //% track.defl=racing.Track.Monaco
    //% laps.min=1 laps.max=4 laps.defl=1
    export function raceOnTrack(track: Track, laps: number = 1): void {
        const courses = getCourses();
        let course: Course;
        switch (track) {
            case Track.Netherlands: course = courses[4]; break;
            case Track.USA: course = courses[5]; break;
            case Track.Australia: course = courses[0]; break;
            case Track.GreatBritain: course = courses[1]; break;
            case Track.Monaco: course = courses[3]; break;
            case Track.Italy: course = courses[2]; break;
            default: throw "Choose a valid racing track";
        }
        laps = Math.max(1, Math.min(4, laps)) | 0;
        aiRacing.loadBots();
        startRace(course, laps, 3);
    }

    /**
     * Stamp an 8x8 sponsor logo onto the player's car.
     * @param logo an 8x8 drawing; transparent pixels leave the car visible
     */
    //% blockId=racing_set_car_logo block="set car logo $logo"
    //% help=github:this/docs/set-car-logo
    //% group="Car" weight=100
    //% logo.fieldEditor="sprite"
    //% logo.fieldOptions.taggedTemplate="img"
    //% logo.fieldOptions.decompileIndirectFixedInstances="true"
    //% logo.fieldOptions.decompileArgumentAsString="true"
    //% logo.fieldOptions.sizes="8,8"
    //% logo.fieldOptions.initWidth="8" logo.fieldOptions.initHeight="8"
    //% logo.fieldOptions.filter="!tile !background !dialog"
    export function setCarLogo(logo: Image): void {
        setPlayerLogo(logo);
    }
}
