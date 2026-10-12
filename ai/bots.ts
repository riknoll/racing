namespace aiRacing {
    export class BotSlot {
        driver = new Driver();
        courseIndex = -1;
        teachingMillis = 0;
        offRoadMillis = 0;
        byteLength = 0;
        saved = false;

        constructor(public readonly index: number) {}
    }

    let botSlots: BotSlot[];
    let loaded = false;

    /** Each slot has a separate settings buffer; all slots share the same quota. */
    export function getBotSlots(): BotSlot[] {
        if (!botSlots) {
            botSlots = [];
            for (let i = 0; i < BOT_SLOT_COUNT; i++) botSlots.push(new BotSlot(i));
        }
        return botSlots;
    }

    export function botSlot(index: number): BotSlot {
        if (index < 0 || index >= BOT_SLOT_COUNT || index !== Math.floor(index)) throw "Choose a valid AI bot slot";
        return getBotSlots()[index];
    }

    export function trainedBots(): BotSlot[] {
        return getBotSlots().filter(bot => bot.driver.count() >= MIN_EXAMPLES);
    }

    export function botNames(): string[] {
        const courses = racing.getCourses();
        return getBotSlots().map(bot => "Bot " + (bot.index + 1) + ": "
            + (bot.courseIndex < 0 ? "Empty" : bot.courseIndex === 6 ? "Test Track" : courses[bot.courseIndex].name)
            + (bot.driver.count() >= MIN_EXAMPLES && !bot.saved ? "*" : ""));
    }

    export function botInfo(index: number): string {
        const bot = botSlot(index);
        const name = bot.courseIndex < 0 ? "No training yet" : bot.courseIndex === 6 ? "Test Track" : racing.getCourses()[bot.courseIndex].name;
        return "Bot " + (index + 1) + ": " + name
            + (bot.saved ? "\nSaved buffer: " + bot.byteLength + " bytes" : "\nNot saved; available this session only.")
            + "\nSettings: " + getStorageUsage() + "/" + SETTINGS_QUOTA + " encoded bytes."
            + "\nAll samples are kept. Saved sensor values use quantization; delta packing does not lose more data.";
    }

    /** Invalid saved data is reported, never silently treated as a trained bot. */
    export function loadBots(): void {
        if (loaded) return;
        loaded = true;
        const slots = getBotSlots();
        for (let i = 0; i < slots.length; i++) {
            try {
                const saved = readBot(i);
                if (saved) applySaved(slots[i], saved);
            } catch (error) {
                console.log("AI bot " + (i + 1) + " load failed: " + error);
                game.showLongText("Bot " + (i + 1) + " could not be loaded. Its saved data was not changed. Train that slot to replace it.", DialogLayout.Full);
            }
        }
    }

    /** Keep every example. A failed save leaves the old buffer and other slots alone. */
    export function rememberBot(index: number, driver: Driver, courseIndex: number, teachingMillis: number, offRoadMillis: number): BotSlot {
        const bot = botSlot(index);
        bot.driver = driver;
        bot.courseIndex = courseIndex;
        bot.teachingMillis = teachingMillis;
        bot.offRoadMillis = offRoadMillis;
        bot.byteLength = 0;
        bot.saved = false;
        try {
            const data = encodeBot(driver, courseIndex, teachingMillis, offRoadMillis);
            writeBot(index, data);
            // Use the same quantized values now and after a restart.
            applySaved(bot, decodeBot(data));
        } catch (error) {
            console.log("AI bot " + (index + 1) + " save failed: " + error);
            game.showLongText("Bot " + (index + 1) + " is trained, but could not be saved: " + error
                + "\nIt is available for this session. Existing saved bots were not deleted.", DialogLayout.Full);
        }
        return bot;
    }

    function applySaved(bot: BotSlot, saved: SavedBot): void {
        bot.driver = saved.driver;
        bot.courseIndex = saved.courseIndex;
        bot.teachingMillis = saved.teachingMillis;
        bot.offRoadMillis = saved.offRoadMillis;
        bot.byteLength = saved.byteLength;
        bot.saved = true;
    }
}
