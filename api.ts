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
    //% track.defl=racing.Track.Monclava
    //% laps.min=1 laps.max=4 laps.defl=1
    //% driver.defl=racing.RaceDriver.Player
    export function raceOnTrack(track: Track, laps: number = 1, driver: RaceDriver = RaceDriver.Player): void {
        const courses = getCourses();
        const course = courses.find(course => course.trackId === track);
        if (!course) throw "Choose a valid racing track";
        if (driver !== RaceDriver.Player && driver !== RaceDriver.AI) throw "Choose a valid race driver";
        laps = Math.max(1, Math.min(4, laps)) | 0;
        aiRacing.loadBots();
        let bot: aiRacing.BotSlot;
        if (driver === RaceDriver.AI) {
            bot = chooseTrainedBot("watching it race");
            if (!bot) return;
        }
        startRace(course, laps, 3, RaceSpeed.Fast, bot);
    }

    /**
     * View a trained AI's saved driving examples without recording another lap.
     */
    //% blockId=racing_view_memories block="view memories"
    //% help=github:this/docs/view-memories
    //% group="Game" weight=75
    export function viewMemories(): void {
        aiRacing.loadBots();
        const bot = chooseTrainedBot("viewing memories");
        if (bot) aiRacing.showMemories(bot.driver);
    }

    function chooseTrainedBot(action: string): aiRacing.BotSlot {
        const trained = aiRacing.trainedBots();
        if (!trained.length) {
            showTrainingRequired(false, action);
            return undefined;
        }
        if (trained.length === 1) return trained[0];
        const names = aiRacing.botNames();
        const selected = chooseMenu("SELECT AI", trained.map(slot => names[slot.index]), false);
        return trained[selected];
    }

    /**
     * Draw a team logo on the track beneath the selected team's starting position.
     * @param logo a 40x40 drawing; transparent pixels leave the track visible
     * @param target the player, bot 1, or bot 2
     */
    //% blockId=racing_set_team_logo block="set team logo $logo for $target"
    //% help=github:this/docs/set-team-logo
    //% group="Car" weight=100
    //% inlineInputMode=inline
    //% target.defl=racing.CarTarget.Player
    //% logo.shadow=racing_team_logo_image
    export function setTeamLogo(logo: Image, target: CarTarget): void {
        setTeamLogoImage(logo, target);
    }

    /**
     * A 40x40 image shadow for the team logo block.
     */
    //% blockId=racing_team_logo_image block="$logo"
    //% shim=TD_ID
    //% blockNamespace=images blockHidden=1 duplicateShadowOnDrag
    //% help=github:this/docs/set-team-logo
    //% logo.fieldEditor="sprite"
    //% logo.fieldOptions.taggedTemplate="img"
    //% logo.fieldOptions.decompileIndirectFixedInstances="true"
    //% logo.fieldOptions.decompileArgumentAsString="true"
    //% logo.fieldOptions.initWidth="40" logo.fieldOptions.initHeight="40"
    //% logo.fieldOptions.filter="!tile !background !dialog"
    export function _teamLogoImage(logo: Image): Image {
        return logo;
    }

    /**
     * Choose a car style without changing any explicitly chosen colors.
     * @param style Racing car or Mercedes car
     * @param target the player, bot 1, or bot 2
     */
    //% blockId=racing_choose_car block="choose $style for $target"
    //% help=github:this/docs/choose-car
    //% group="Car" weight=90
    //% inlineInputMode=inline
    //% style.defl=racing.CarStyle.RacingCar
    //% target.defl=racing.CarTarget.Player
    export function chooseCar(style: CarStyle, target: CarTarget): void {
        setTeamCarStyle(style, target);
    }

    /**
     * Choose body and shading colors without changing the car style.
     * @param bodyColor the body paint color, eg: 1
     * @param shadowColor the shading and accent color, eg: 6
     * @param target the player, bot 1, or bot 2
     */
    //% blockId=racing_choose_color block="choose color body $bodyColor shading $shadowColor for $target"
    //% help=github:this/docs/choose-color
    //% group="Car" weight=85
    //% inlineInputMode=inline
    //% bodyColor.shadow=colorindexpicker bodyColor.defl=1
    //% shadowColor.shadow=colorindexpicker shadowColor.defl=6
    //% target.defl=racing.CarTarget.Player
    export function chooseColor(bodyColor: number = 1, shadowColor: number = 6, target: CarTarget): void {
        setTeamCarColor(bodyColor, shadowColor, target);
    }
}
