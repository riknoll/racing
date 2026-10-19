//% color="#00A19B" icon="\uf1b9" block="Racing" weight=100
//% groups='["Game", "Car"]'
namespace racing {
    export enum RaceDriver {
        //% block="player"
        Player,
        //% block="AI"
        AI
    }

    /**
     * Open the racing menu with Race, Train AI, View AI, and How to Drive.
     */
    //% blockId=racing_start_game block="start racing game"
    //% help=github:this/docs/start-game
    //% group="Game" weight=100
    export function startGame(): void {
        runGameMenu([], false, false);
    }

    /**
     * Start the How to Drive lesson without opening the racing menu.
     */
    //% blockId=racing_learn_to_drive block="learn to drive"
    //% help=github:this/docs/learn-to-drive
    //% group="Game" weight=95
    export function learnToDrive(): void {
        howToDrive();
    }

    /**
     * Race a selected track without opening the game menu.
     * @param track the race course
     * @param laps the number of laps, eg: 1
     * @param driver who drives the car
     */
    //% blockId=racing_race_on_track block="race on $track for $laps laps as $driver"
    //% help=github:this/docs/race-on-track
    //% group="Game" weight=90
    //% track.defl=racing.Track.Monaco
    //% laps.min=1 laps.max=4 laps.defl=1
    //% driver.defl=racing.RaceDriver.Player
    export function raceOnTrack(track: Track, laps: number = 1, driver: RaceDriver = RaceDriver.Player): void {
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
        if (driver !== RaceDriver.Player && driver !== RaceDriver.AI) throw "Choose a valid race driver";
        laps = Math.max(1, Math.min(4, laps)) | 0;
        aiRacing.loadBots();
        let bot: aiRacing.BotSlot;
        if (driver === RaceDriver.AI) {
            const trained = aiRacing.trainedBots();
            if (!trained.length) {
                showTrainingRequired();
                return;
            }
            if (trained.length === 1) bot = trained[0];
            else {
                const names = aiRacing.botNames();
                const selected = chooseMenu("SELECT AI", trained.map(slot => names[slot.index]), false);
                bot = trained[selected];
            }
        }
        startRace(course, laps, 3, RaceSpeed.Fast, bot);
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
