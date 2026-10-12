namespace aiRacing {
    export const BOT_SLOT_COUNT = 2;
    export const SETTINGS_QUOTA = 16384;

    const STORAGE_RESERVE = 256;
    const BOT_HEADER_SIZE = 24;
    const BOT_FORMAT_VERSION = 1;
    const ABSOLUTE_RECORD = 0x0c;
    const MIN_SAVED_SPEED = -racing.REVERSE_TOP_SPEED / racing.TOP_SPEED_MAX;

    // Public writeBuffer clears ALL user settings on failure. This shim returns
    // an error instead, so a full device does not erase a bot or other settings.
    //% shim=settings::_set
    declare function setBotBuffer(key: string, data: Buffer): number;

    /** A restored model and the lesson that produced it. */
    export class SavedBot {
        constructor(
            public driver: Driver,
            public courseIndex: number,
            public teachingMillis: number,
            public offRoadMillis: number,
            public byteLength: number
        ) {}
    }

    function isFiniteNumber(value: number): boolean {
        // NaN and either infinity produce NaN when subtracted from themselves.
        return value - value === 0;
    }

    function requireInteger(value: number, minimum: number, maximum: number, label: string): void {
        if (!isFiniteNumber(value) || value !== Math.floor(value) || value < minimum || value > maximum) {
            throw label + " must be an integer from " + minimum + " to " + maximum;
        }
    }

    function requireRange(value: number, minimum: number, maximum: number, label: string): void {
        if (!isFiniteNumber(value) || value < minimum || value > maximum) {
            throw label + " must be finite and between " + minimum + " and " + maximum;
        }
    }

    function checkLesson(courseIndex: number, teachingMillis: number, offRoadMillis: number): void {
        requireInteger(courseIndex, 0, 6, "Bot course");
        requireInteger(teachingMillis, 0, 0xffffffff, "Teaching milliseconds");
        requireInteger(offRoadMillis, 0, teachingMillis, "Off-road milliseconds");
    }

    function botKey(slot: number): string {
        requireInteger(slot, 0, BOT_SLOT_COUNT - 1, "Bot slot");
        return "racing.bot." + slot;
    }

    function settingCost(key: string, byteLength: number): number {
        // Simulator storage includes the S/ prefix and Base64, not raw bytes.
        return 2 + key.length + 4 * Math.ceil(byteLength / 3);
    }

    /** Total encoded cost of user AND system settings, not just the bot slots. */
    export function getStorageUsage(): number {
        let usage = 0;
        for (const key of settings.list("").concat(settings.list("#"))) {
            const data = settings.readBuffer(key);
            if (!data) throw "Cannot read settings usage for " + key;
            usage += settingCost(key, data.length);
        }
        return usage;
    }

    function checksum(data: Buffer, length: number): number {
        let crc = 0xffffffff;
        for (let i = 0; i < length; i++) {
            if (i >= 20 && i < BOT_HEADER_SIZE) continue;
            crc ^= data[i];
            for (let bit = 0; bit < 8; bit++) {
                crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
            }
        }
        return (crc ^ 0xffffffff) >>> 0;
    }

    function quantizeAngle(value: number, label: string): number {
        requireRange(value, -1, 1, label);
        return Math.round(value * 127) + 127;
    }

    /** Encode every stored example; only sensor precision is intentionally reduced. */
    export function encodeBot(driver: Driver, courseIndex: number, teachingMillis: number, offRoadMillis: number): Buffer {
        if (!driver) throw "Choose a driver before saving an AI bot";
        checkLesson(courseIndex, teachingMillis, offRoadMillis);
        const count = driver.count();
        requireInteger(count, 0, SAMPLE_LIMIT, "Bot sample count");
        let offsetScale = 1;
        let visited = 0;
        driver.visitExamples((observation, action, index) => {
            if (index !== visited || visited >= count) throw "Bot sample order or count changed while saving";
            if (!isFiniteNumber(observation.offset)) throw "Bot offset must be finite";
            offsetScale = Math.max(offsetScale, Math.abs(observation.offset));
            visited++;
        });
        if (visited !== count) throw "Bot sample count changed while saving";

        const data = Buffer.create(BOT_HEADER_SIZE + 8 * count);
        data[0] = 82; // RBOT
        data[1] = 66;
        data[2] = 79;
        data[3] = 84;
        data[4] = BOT_FORMAT_VERSION;
        data[5] = courseIndex;
        data.setNumber(NumberFormat.UInt16LE, 6, count);
        data.setNumber(NumberFormat.UInt32LE, 8, teachingMillis);
        data.setNumber(NumberFormat.UInt32LE, 12, offRoadMillis);
        data.setNumber(NumberFormat.Float32LE, 16, offsetScale);
        // Round the positive Float32 scale UP if needed: never clip an offset.
        if (data.getNumber(NumberFormat.Float32LE, 16) < offsetScale) {
            data.setNumber(NumberFormat.UInt32LE, 16, data.getNumber(NumberFormat.UInt32LE, 16) + 1);
        }
        offsetScale = data.getNumber(NumberFormat.Float32LE, 16);
        if (!isFiniteNumber(offsetScale)) throw "Bot offset range is too large for Float32";

        let position = BOT_HEADER_SIZE;
        const previous: number[] = [0, 0, 0, 0, 0, 0];
        visited = 0;
        driver.visitExamples((observation, action, index) => {
            if (index !== visited || visited >= count) throw "Bot sample order or count changed while saving";
            requireRange(observation.offset, -offsetScale, offsetScale, "Bot offset");
            requireRange(observation.speed, MIN_SAVED_SPEED, 1, "Bot speed");
            requireInteger(observation.offRoad, 0, 1, "Bot off-road flag");
            requireInteger(action.steer, -1, 1, "Bot steering");
            requireInteger(action.pedal, Pedal.Coast, Pedal.Reverse, "Bot pedal");
            // Signed rounding error <= scale/254 for
            // offset, <= 1/254 for angles, and <= (1-MIN_SAVED_SPEED)/510 for
            // speed. Zero is exact for offset and angles; packing below is lossless.
            const values: number[] = [
                Math.round(observation.offset / offsetScale * 127) + 127,
                quantizeAngle(observation.heading, "Bot heading"),
                quantizeAngle(observation.nearBend, "Bot near bend"),
                quantizeAngle(observation.bend, "Bot bend"),
                Math.round((observation.speed - MIN_SAVED_SPEED) / (1 - MIN_SAVED_SPEED) * 255),
                quantizeAngle(observation.aim, "Bot aim")
            ];
            let delta = index > 0;
            for (let i = 0; i < values.length; i++) {
                const difference = values[i] - previous[i];
                if (difference < -8 || difference > 7) delta = false;
            }
            const flags = action.pedal | ((action.steer + 1) << 2) | (observation.offRoad << 4);
            if (delta) {
                const flagPosition = position++;
                let pairMask = 0;
                // Omit zero pairs while preserving exact actions for each sample.
                for (let i = 0; i < values.length; i += 2) {
                    const packed = ((values[i] - previous[i]) & 15)
                        | (((values[i + 1] - previous[i + 1]) & 15) << 4);
                    if (packed !== 0) {
                        pairMask |= 1 << (i / 2);
                        data[position++] = packed;
                    }
                }
                data[flagPosition] = flags | (pairMask << 5);
            } else {
                // Steering bits 11 cannot be an action, so 0x0c is an escape.
                data[position++] = ABSOLUTE_RECORD;
                data[position++] = flags;
                for (const value of values) data[position++] = value;
            }
            for (let i = 0; i < values.length; i++) previous[i] = values[i];
            visited++;
        });
        if (visited !== count) throw "Bot sample count changed while saving";
        data.setNumber(NumberFormat.UInt32LE, 20, checksum(data, position));
        return data.slice(0, position);
    }

    function checkBotHeader(data: Buffer): void {
        if (!data || data.length < BOT_HEADER_SIZE) throw "Saved AI bot is truncated";
        if (data[0] !== 82 || data[1] !== 66 || data[2] !== 79 || data[3] !== 84) {
            throw "Saved AI bot has an invalid signature";
        }
        if (data[4] !== BOT_FORMAT_VERSION) throw "Unsupported saved AI bot version " + data[4];
        const count = data.getNumber(NumberFormat.UInt16LE, 6);
        requireInteger(count, 0, SAMPLE_LIMIT, "Saved bot sample count");
        checkLesson(data[5], data.getNumber(NumberFormat.UInt32LE, 8), data.getNumber(NumberFormat.UInt32LE, 12));
        const scale = data.getNumber(NumberFormat.Float32LE, 16);
        if (!isFiniteNumber(scale) || scale < 1) throw "Saved AI bot has an invalid offset scale";
        if (data.length > BOT_HEADER_SIZE + 8 * count) throw "Saved AI bot has extra bytes";
        if (data.getNumber(NumberFormat.UInt32LE, 20) !== checksum(data, data.length)) {
            throw "Saved AI bot checksum does not match";
        }
    }

    function signedNibble(value: number): number {
        return value < 8 ? value : value - 16;
    }

    function readBotExamples(data: Buffer, driver?: Driver): void {
        const count = data.getNumber(NumberFormat.UInt16LE, 6);
        const scale = data.getNumber(NumberFormat.Float32LE, 16);
        const values: number[] = [0, 0, 0, 0, 0, 0];
        let position = BOT_HEADER_SIZE;
        for (let index = 0; index < count; index++) {
            if (position >= data.length) throw "Saved AI bot sample is truncated";
            const record = data[position++];
            let flags = record & 31;
            if ((record & 12) === 12) {
                if (record !== ABSOLUTE_RECORD) throw "Saved AI bot has an invalid absolute escape";
                if (position + 7 > data.length) throw "Saved AI bot sample is truncated";
                flags = data[position++];
                if ((flags & 224) || (flags & 12) === 12) throw "Saved AI bot has invalid action flags";
                for (let i = 0; i < values.length; i++) values[i] = data[position++];
            } else {
                if (index === 0) throw "Saved AI bot starts with a delta";
                for (let i = 0; i < values.length; i += 2) {
                    if (!(record & (1 << (5 + i / 2)))) continue;
                    if (position >= data.length) throw "Saved AI bot sample is truncated";
                    const packed = data[position++];
                    if (packed === 0) throw "Saved AI bot has a redundant zero delta pair";
                    values[i] += signedNibble(packed & 15);
                    values[i + 1] += signedNibble(packed >> 4);
                }
            }
            for (let i = 0; i < values.length; i++) {
                if (values[i] < 0 || values[i] > (i === 4 ? 255 : 254)) {
                    throw "Saved AI bot sensor byte is out of range";
                }
            }
            if (driver) {
                const observation = new Observation(
                    (values[0] - 127) / 127 * scale,
                    (values[1] - 127) / 127,
                    (values[2] - 127) / 127,
                    (values[3] - 127) / 127,
                    MIN_SAVED_SPEED + values[4] / 255 * (1 - MIN_SAVED_SPEED),
                    (flags >> 4) & 1,
                    (values[5] - 127) / 127
                );
                driver.learn(observation, new Action(((flags >> 2) & 3) - 1, flags & 3).controls());
            }
        }
        if (position !== data.length) throw "Saved AI bot has extra bytes";
    }

    /** Restore all samples, rejecting corrupt or unsupported data explicitly. */
    export function decodeBot(data: Buffer): SavedBot {
        checkBotHeader(data);
        const driver = new Driver();
        readBotExamples(data, driver);
        return new SavedBot(driver, data[5], data.getNumber(NumberFormat.UInt32LE, 8),
            data.getNumber(NumberFormat.UInt32LE, 12), data.length);
    }

    /** Return undefined only for an absent slot; decoding errors reach the caller. */
    export function readBot(slot: number): SavedBot | undefined {
        const data = settings.readBuffer(botKey(slot));
        return data ? decodeBot(data) : undefined;
    }

    /** Save once a lesson ends, without clearing settings if the shared store is full. */
    export function writeBot(slot: number, data: Buffer): void {
        const key = botKey(slot);
        checkBotHeader(data);
        readBotExamples(data);
        const previous = settings.readBuffer(key);
        const otherUsage = getStorageUsage() - (previous ? settingCost(key, previous.length) : 0);
        const required = settingCost(key, data.length);
        const available = SETTINGS_QUOTA - STORAGE_RESERVE - otherUsage;
        if (required > available) {
            throw "Not enough settings space for this AI bot: needs " + required
                + " encoded bytes, with " + available + " available";
        }
        const result = setBotBuffer(key, data);
        if (result !== 0) throw "Could not save AI bot: settings write failed (" + result + ")";
    }
}
