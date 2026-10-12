const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { createHash } = require("node:crypto");
const ts = require("typescript");
const { test } = require("node:test");
const { root, loadRacing, loadMonaco } = require("./test-host");

const HEADER_SIZE = 24;
const RESERVE = 256;
const FORMATS = { UInt16LE: 4, UInt32LE: 11, Float32LE: 13 };
const storageSource = fs.readFileSync(path.join(root, "ai", "storage.ts"), "utf8");
// Let the emitter resolve members from the namespace already loaded by the host.
const existingTypes = `namespace aiRacing {
    export declare const SAMPLE_LIMIT: number;
    export declare class Driver {}
    export declare class Observation {}
    export declare class Action {}
    export declare enum Pedal { Coast, Accelerate, Brake, Reverse }
}`;
const compiledStorage = ts.transpileModule(existingTypes + storageSource, {
    compilerOptions: { target: ts.ScriptTarget.ES2017 }
}).outputText;

// MakeCode slice takes (offset, LENGTH), unlike Node's (start, end).
function arcadeBuffer(bytes) {
    const data = Buffer.from(bytes);
    data.getNumber = (format, offset) => {
        if (format === FORMATS.UInt16LE) return data.readUInt16LE(offset);
        if (format === FORMATS.UInt32LE) return data.readUInt32LE(offset);
        if (format === FORMATS.Float32LE) return data.readFloatLE(offset);
        throw new Error(`Unexpected buffer format ${format}`);
    };
    data.setNumber = (format, offset, value) => {
        if (format === FORMATS.UInt16LE) data.writeUInt16LE(value, offset);
        else if (format === FORMATS.UInt32LE) data.writeUInt32LE(value, offset);
        else if (format === FORMATS.Float32LE) data.writeFloatLE(value, offset);
        else throw new Error(`Unexpected buffer format ${format}`);
    };
    data.slice = (offset = 0, length = data.length - offset) =>
        arcadeBuffer(data.subarray(offset, offset + length));
    return data;
}

function cost(key, data) {
    return 2 + key.length + data.toString("base64").length;
}

function storageHost() {
    const entries = new Map();
    let writeResult = 0;
    let writeCalls = 0;
    const host = loadRacing();
    Object.assign(host.context.NumberFormat, FORMATS);
    host.context.Buffer = { create: length => arcadeBuffer(Buffer.alloc(length)) };
    host.context.settings = {
        list: prefix => Array.from(entries.keys()).filter(key =>
            (prefix.startsWith("#") || !key.startsWith("#")) && key.startsWith(prefix)),
        readBuffer: key => entries.has(key) ? arcadeBuffer(entries.get(key)) : undefined,
        writeBuffer: () => { throw new Error("Destructive public writeBuffer must never be called"); }
    };
    host.context.setBotBuffer = (key, data) => {
        writeCalls++;
        if (writeResult) return writeResult;
        const usage = Array.from(entries, ([name, value]) => name === key ? 0 : cost(name, value))
            .reduce((total, value) => total + value, 0) + cost(key, data);
        if (usage > 16384) return -1;
        entries.set(key, arcadeBuffer(data));
        return 0;
    };
    vm.runInContext(compiledStorage, host.context, { filename: "storage.ts" });
    return Object.assign(host, {
        entries,
        failWrites: code => { writeResult = code; },
        writeCalls: () => writeCalls
    });
}

function examples(driver) {
    const result = [];
    driver.visitExamples((observation, action, index) => result.push({
        values: [observation.offset, observation.heading, observation.nearBend,
            observation.bend, observation.speed, observation.offRoad, observation.aim],
        controls: action.controls(),
        steer: action.steer,
        pedal: action.pedal,
        index
    }));
    return result;
}

test("prebuilt Cautious and Aggressive buffers preserve the exact saved models and decode independently", () => {
    const host = storageHost();
    const source = fs.readFileSync(path.join(root, "ai", "prebuilt-bots.ts"), "utf8");
    const fixtures = [
        { name: "cautious", bytes: 8796, count: 2107, millis: 176410, offRoad: 0,
            counts: [292, 444, 1480, 290, 0],
            sha256: "ce5074946a2e5c6c26d9d7d95320bdf113cf67b711151f827226cbffb260db86" },
        { name: "aggressive", bytes: 3085, count: 810, millis: 65336, offRoad: 1941,
            counts: [71, 119, 530, 90, 39],
            sha256: "f55a3fc4c61465e33b0cc41878d64ff831106bb878f2624b7dd59254f55489ab" }
    ];
    for (const fixture of fixtures) {
        const literal = source.match(new RegExp("export const " + fixture.name + ": Buffer = hex`([\\s\\S]*?)`;"));
        assert(literal, fixture.name + " must be exported as a MakeCode Buffer literal");
        const hex = literal[1].replace(/\s/g, "");
        assert.match(hex, /^(?:[0-9a-f]{2})+$/);
        const data = arcadeBuffer(Buffer.from(hex, "hex"));
        assert.equal(data.length, fixture.bytes);
        assert.equal(createHash("sha256").update(data).digest("hex"), fixture.sha256);
        const saved = host.ai.decodeBot(data);
        assert.equal(saved.courseIndex, 6);
        assert.equal(saved.driver.count(), fixture.count);
        assert.equal(saved.teachingMillis, fixture.millis);
        assert.equal(saved.offRoadMillis, fixture.offRoad);
        assert.deepEqual(Array.from(saved.driver.actionCounts), fixture.counts);
        const reencoded = host.ai.encodeBot(saved.driver, saved.courseIndex, saved.teachingMillis, saved.offRoadMillis);
        assert.equal(reencoded.toString("hex"), data.toString("hex"));
        const independent = host.ai.decodeBot(data);
        assert.notStrictEqual(saved.driver, independent.driver);
        saved.driver.learn(new host.ai.Observation(0, 0, 0, 0, 0, 0), 1);
        assert.equal(independent.driver.count(), fixture.count);
        assert.equal(createHash("sha256").update(data).digest("hex"), fixture.sha256);
    }
    assert.equal(host.writeCalls(), 0, "loading prebuilt models must not consume or overwrite settings");
});

function addExample(host, driver, values, steer = 0, pedal = host.ai.Pedal.Accelerate) {
    driver.learn(new host.ai.Observation(...values), new host.ai.Action(steer, pedal).controls());
}

function smallBot(host, count = 12, course = 3) {
    const driver = new host.ai.Driver();
    for (let i = 0; i < count; i++) {
        addExample(host, driver, [0.03 * i, 0, 0, 0, 0.4, i % 2, 0], i % 3 - 1, i % 4);
    }
    return host.ai.encodeBot(driver, course, 60000, 1500);
}

function assertRoundTrip(host, driver, data) {
    const saved = host.ai.decodeBot(data);
    const before = examples(driver);
    const after = examples(saved.driver);
    const scale = data.readFloatLE(16);
    const speedError = (1 + host.racing.REVERSE_TOP_SPEED / host.racing.TOP_SPEED_MAX) / 510;
    assert.equal(after.length, before.length);
    assert.deepEqual(Array.from(saved.driver.actionCounts), Array.from(driver.actionCounts));
    before.forEach((sample, index) => {
        const restored = after[index];
        assert.equal(restored.index, index);
        assert.equal(restored.controls, sample.controls);
        assert.equal(restored.steer, sample.steer);
        assert.equal(restored.pedal, sample.pedal);
        sample.values.forEach((value, sensor) => {
            const error = sensor === 0 ? scale / 254 : sensor === 4 ? speedError : sensor === 5 ? 0 : 1 / 254;
            assert(Math.abs(restored.values[sensor] - value) <= error + 1e-12,
                `Sample ${index}, sensor ${sensor}: ${restored.values[sensor]} vs ${value}, bound ${error}`);
            const quantized = sensor === 0 ? Math.round(value / scale * 127) / 127 * scale
                : sensor === 4 ? -0.1 + Math.round((value + 0.1) / 1.1 * 255) / 255 * 1.1
                : sensor === 5 ? value : Math.round(value * 127) / 127;
            assert.equal(restored.values[sensor], quantized === 0 ? 0 : quantized,
                `Sample ${index}, sensor ${sensor}: packing must preserve the original quantization exactly`);
        });
    });
    return saved;
}

function records(data) {
    const result = [];
    let position = HEADER_SIZE;
    for (let index = 0; index < data.readUInt16LE(6); index++) {
        const start = position;
        const record = data[position++];
        const delta = (record & 12) !== 12;
        const mask = delta ? record >> 5 : 0;
        if (delta) {
            for (let pair = 0; pair < 3; pair++) if (mask & (1 << pair)) position++;
        } else {
            assert.equal(record, 0x0c);
            position += 7;
        }
        result.push({ position: start, delta, mask, byteLength: position - start });
    }
    assert.equal(position, data.length);
    return result;
}

function updateChecksum(data) {
    let crc = 0xffffffff;
    for (let i = 0; i < data.length; i++) {
        if (i >= 20 && i < HEADER_SIZE) continue;
        crc ^= data[i];
        for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
    data.writeUInt32LE((crc ^ 0xffffffff) >>> 0, 20);
    return data;
}

function snapshot(entries) {
    return Array.from(entries, ([key, data]) => [key, data.toString("hex")]);
}

test("all steering/pedal combinations, off-road flags, sample order, and lesson metadata survive", () => {
    const host = storageHost();
    const driver = new host.ai.Driver();
    for (let steer = -1; steer <= 1; steer++) {
        for (let pedal = 0; pedal < 4; pedal++) {
            addExample(host, driver, [steer * 2.5, steer / 3, -0.2, 0.2, pedal / 4, pedal % 2, 0], steer, pedal);
        }
    }
    const data = host.ai.encodeBot(driver, 5, 123456, 1234);
    const saved = assertRoundTrip(host, driver, data);
    assert.equal(saved.courseIndex, 5);
    assert.equal(saved.teachingMillis, 123456);
    assert.equal(saved.offRoadMillis, 1234);
    assert.equal(saved.byteLength, data.length);
    const empty = host.ai.decodeBot(host.ai.encodeBot(new host.ai.Driver(), 0, 0, 0));
    assert.equal(empty.driver.count(), 0);
    assert.equal(empty.byteLength, HEADER_SIZE);
});

test("all six regular courses and training-only Test Track 6 survive encoding, saving, and reading", () => {
    const host = storageHost();
    for (let course = 0; course <= 6; course++) {
        const data = smallBot(host, 12 + course, course);
        const slot = course % host.ai.BOT_SLOT_COUNT;
        assert.equal(host.ai.decodeBot(data).courseIndex, course);
        host.ai.writeBot(slot, data);
        const saved = host.ai.readBot(slot);
        assert.equal(saved.courseIndex, course);
        assert.equal(saved.driver.count(), 12 + course);
    }
    for (const course of [7, 255]) {
        const invalid = smallBot(host, 18, 6);
        invalid[5] = course;
        updateChecksum(invalid);
        host.entries.set("racing.bot.0", invalid);
        const before = snapshot(host.entries);
        const calls = host.writeCalls();
        assert.throws(() => host.ai.readBot(0), /Bot course must be an integer from 0 to 6/);
        assert.throws(() => host.ai.writeBot(0, invalid), /Bot course must be an integer from 0 to 6/);
        assert.equal(host.writeCalls(), calls);
        assert.deepEqual(snapshot(host.entries), before);
    }
});

test("quantization meets numerical bounds, preserves zero for signed sensors, and never clips wide offsets", () => {
    const host = storageHost();
    const driver = new host.ai.Driver();
    const offsetLimit = 17.0000001; // Float32 rounds down unless the encoder rounds its scale up.
    for (let i = 0; i <= 1000; i++) {
        const fraction = i / 1000;
        const angle = -1 + 2 * fraction;
        addExample(host, driver, [-offsetLimit + 2 * offsetLimit * fraction,
            angle, -angle, angle, -0.1 + 1.1 * fraction, i % 2, -angle], i % 3 - 1, i % 4);
    }
    addExample(host, driver, [0, 0, 0, 0, 0, 0, 0]);
    const data = host.ai.encodeBot(driver, 0, 0xffffffff, 0xffffffff);
    assert(data.readFloatLE(16) >= offsetLimit);
    const saved = assertRoundTrip(host, driver, data);
    const zero = examples(saved.driver).at(-1).values;
    for (const sensor of [0, 1, 2, 3, 5, 6]) assert.equal(zero[sensor], 0);
    assert.equal(examples(saved.driver)[0].values[4], -0.1);
    assert.equal(examples(saved.driver)[1000].values[4], 1);
});

test("signed nibble boundaries and absolute escapes roundtrip losslessly after quantization", () => {
    const host = storageHost();
    const driver = new host.ai.Driver();
    const values = [127, 119, 126, 134, 125, 254, 246, 0, 7];
    values.forEach((value, i) => {
        const signed = (value - 127) / 127;
        addExample(host, driver, [signed, signed, signed, signed, -0.1 + value / 255 * 1.1, i % 2, signed], i % 3 - 1, i % 4);
    });
    const data = host.ai.encodeBot(driver, 3, 1000, 0);
    assert.deepEqual(records(data).map(record => record.delta), [false, true, true, false, false, false, true, false, true]);
    assert.equal(data.length, HEADER_SIZE + 5 * 8 + 4 * 4);
    assertRoundTrip(host, driver, data);
    assert.deepEqual(Buffer.from(host.ai.encodeBot(host.ai.decodeBot(data).driver, 3, 1000, 0)), Buffer.from(data));
});

test("every sparse pair mask preserves all six quantized sensors and exact per-sample actions", () => {
    const host = storageHost();
    const driver = new host.ai.Driver();
    const quantized = [127, 127, 127, 127, 127, 127];
    const learn = index => {
        const signed = quantized.map(value => (value - 127) / 127);
        addExample(host, driver, [signed[0], signed[1], signed[2], signed[3],
            -0.1 + quantized[4] / 255 * 1.1, index % 2, signed[5]], index % 3 - 1, index % 4);
    };
    learn(0);
    for (let mask = 0; mask < 8; mask++) {
        for (let pair = 0; pair < 3; pair++) {
            if (mask & (1 << pair)) {
                quantized[pair * 2]++;
                quantized[pair * 2 + 1]--;
            }
        }
        learn(mask + 1);
    }
    const data = host.ai.encodeBot(driver, 3, 1000, 0);
    assert.equal(data[4], 2);
    const encoded = records(data);
    assert.equal(encoded[0].byteLength, 8);
    assert.deepEqual(encoded.slice(1).map(record => record.mask), [0, 1, 2, 3, 4, 5, 6, 7]);
    assert.deepEqual(encoded.slice(1).map(record => record.byteLength), [1, 2, 2, 3, 2, 3, 3, 4]);
    assert.equal(data.length, HEADER_SIZE + 8 + 20);
    assertRoundTrip(host, driver, data);
    encoded.slice(1).forEach((record, index) => {
        const truncated = data.slice(0, record.position + record.byteLength - 1);
        truncated.writeUInt16LE(index + 2, 6);
        updateChecksum(truncated);
        assert.throws(() => host.ai.decodeBot(truncated), /truncated/);
        assert.throws(() => host.ai.writeBot(0, truncated), /truncated/);
    });
    assert.equal(host.writeCalls(), 0);
});

test("sparse deltas reject overflow and underflow in every sensor, including the full speed byte", () => {
    const host = storageHost();
    const header = smallBot(host, 2).subarray(0, HEADER_SIZE);
    for (let sensor = 0; sensor < 6; sensor++) {
        for (const overflow of [false, true]) {
            const values = [127, 127, 127, 127, 127, 127];
            values[sensor] = overflow ? (sensor === 4 ? 255 : 254) : 0;
            const pairMask = 1 << Math.floor(sensor / 2);
            const nibble = overflow ? 1 : 8;
            const packed = nibble << (sensor % 2 ? 4 : 0);
            const data = arcadeBuffer(Buffer.concat([header,
                Buffer.from([0x0c, 4, ...values, 4 | (pairMask << 5), packed])]));
            updateChecksum(data);
            assert.throws(() => host.ai.decodeBot(data), /sensor byte/);
            assert.throws(() => host.ai.writeBot(0, data), /sensor byte/);
        }
    }
    assert.equal(host.writeCalls(), 0);
});

test("a full 2400-example model retains EVERY sample even if it cannot fit the shared quota", () => {
    const host = storageHost();
    const driver = new host.ai.Driver();
    for (let i = 0; i < 2400; i++) {
        const value = i % 2 ? 1 : -1;
        addExample(host, driver, [value, value, value, value, i % 2 ? 1 : -0.1, i % 2, value], i % 3 - 1, i % 4);
    }
    const data = host.ai.encodeBot(driver, 3, 240000, 0);
    assert.equal(data.length, HEADER_SIZE + 8 * 2400);
    assertRoundTrip(host, driver, data);
    host.entries.set("racing.bot.0", smallBot(host));
    host.entries.set("sound", arcadeBuffer([1]));
    const before = snapshot(host.entries);
    assert.throws(() => host.ai.writeBot(0, data), /Not enough settings space/);
    assert.equal(host.writeCalls(), 0);
    assert.deepEqual(snapshot(host.entries), before);

    const smooth = new host.ai.Driver();
    for (let i = 0; i < 2400; i++) addExample(host, smooth, [0, 0, 0, 0, 0.4, i % 2, 0], i % 3 - 1, i % 4);
    const compressed = host.ai.encodeBot(smooth, 3, 240000, 0);
    assert.equal(compressed.length, HEADER_SIZE + 8 + 2399);
    assertRoundTrip(host, smooth, compressed);
    host.ai.writeBot(0, compressed);
    assert.equal(host.ai.readBot(0).driver.count(), 2400);
});

test("corrupt, truncated, unsupported, and structurally invalid buffers fail explicitly", () => {
    const host = storageHost();
    const valid = smallBot(host, 3);
    const mutate = action => {
        const data = arcadeBuffer(valid);
        action(data);
        return updateChecksum(data);
    };
    const invalid = [
        [arcadeBuffer([]), /truncated/],
        [mutate(data => { data[0] = 0; }), /signature/],
        [mutate(data => { data[4] = 1; }), /version/],
        [mutate(data => { data[4] = 3; }), /version/],
        [mutate(data => { data[5] = 7; }), /Bot course/],
        [mutate(data => data.writeUInt16LE(2401, 6)), /sample count/],
        [mutate(data => data.writeUInt32LE(60001, 12)), /Off-road milliseconds/],
        [mutate(data => data.writeFloatLE(NaN, 16)), /offset scale/],
        [mutate(data => data.writeFloatLE(Infinity, 16)), /offset scale/],
        [mutate(data => data.writeFloatLE(0.5, 16)), /offset scale/],
        [mutate(data => { data[HEADER_SIZE] |= 1; }), /absolute escape/],
        [mutate(data => { data[HEADER_SIZE] |= 16; }), /absolute escape/],
        [mutate(data => { data[HEADER_SIZE] |= 32; }), /absolute escape/],
        [mutate(data => { data[HEADER_SIZE] |= 64; }), /absolute escape/],
        [mutate(data => { data[HEADER_SIZE] |= 128; }), /absolute escape/],
        [mutate(data => { data[HEADER_SIZE + 1] |= 32; }), /action flags/],
        [mutate(data => { data[HEADER_SIZE + 1] |= 64; }), /action flags/],
        [mutate(data => { data[HEADER_SIZE + 1] |= 128; }), /action flags/],
        [mutate(data => { data[HEADER_SIZE + 1] |= 12; }), /action flags/],
        [mutate(data => { data[HEADER_SIZE] = 4; }), /starts with a delta/],
        [mutate(data => { data[HEADER_SIZE + 2] = 255; }), /sensor byte/],
        [mutate(data => { data[HEADER_SIZE + 8] |= 12; }), /absolute escape/],
        [mutate(data => { data[HEADER_SIZE + 9] = 0; }), /zero delta pair/],
        [updateChecksum(valid.slice(0, valid.length - 1)), /truncated/],
        [updateChecksum(arcadeBuffer(Buffer.concat([valid, Buffer.from([0])]))), /extra bytes/]
    ];
    const corrupt = arcadeBuffer(valid);
    corrupt[8] ^= 1;
    invalid.push([corrupt, /checksum/]);
    const overflow = mutate(data => {
        data[HEADER_SIZE + 2] = 254;
        data[HEADER_SIZE + 9] = (data[HEADER_SIZE + 9] & 240) | 7;
    });
    invalid.push([overflow, /sensor byte/]);
    const underflow = mutate(data => {
        data[HEADER_SIZE + 2] = 0;
        data[HEADER_SIZE + 9] = (data[HEADER_SIZE + 9] & 240) | 8;
    });
    invalid.push([underflow, /sensor byte/]);
    for (let length = 0; length < valid.length; length++) assert.throws(() => host.ai.decodeBot(valid.slice(0, length)));
    for (const [data, message] of invalid) {
        assert.throws(() => host.ai.decodeBot(data), message);
        assert.throws(() => host.ai.writeBot(0, data), message);
    }
    assert.equal(host.writeCalls(), 0);
});

test("invalid observations, actions, counts, and metadata are rejected rather than clipped", () => {
    const host = storageHost();
    const invalidSensors = [
        [0, NaN], [0, Infinity], [0, Number.MAX_VALUE], [1, -1.001], [1, NaN],
        [2, 1.001], [3, -Infinity], [4, -0.10001], [4, 1.00001], [4, NaN],
        [5, 0.5], [5, 2], [6, 1.001]
    ];
    for (const [sensor, value] of invalidSensors) {
        const driver = new host.ai.Driver();
        const values = [0, 0, 0, 0, 0, 0, 0];
        values[sensor] = value;
        addExample(host, driver, values);
        assert.throws(() => host.ai.encodeBot(driver, 3, 1000, 0));
    }
    for (const [field, value] of [["steer", 2], ["steer", 0.5], ["pedal", 4], ["pedal", NaN]]) {
        const driver = new host.ai.Driver();
        addExample(host, driver, [0, 0, 0, 0, 0, 0, 0]);
        driver.visitExamples((observation, action) => { action[field] = value; });
        assert.throws(() => host.ai.encodeBot(driver, 3, 1000, 0));
    }
    const driver = new host.ai.Driver();
    for (const metadata of [[7, 1000, 0], [-1, 1000, 0], [0.5, 1000, 0], [3, Infinity, 0],
        [3, -1, 0], [3, 1.5, 0], [3, 0x100000000, 0], [3, 1000, 1001], [3, 1000, NaN]]) {
        assert.throws(() => host.ai.encodeBot(driver, ...metadata));
    }
    for (const count of [-1, 2401, 0.5, NaN]) {
        driver.count = () => count;
        assert.throws(() => host.ai.encodeBot(driver, 3, 1000, 0), /sample count/);
    }
});

test("two independent Buffer slots and unrelated user/system settings share exact Base64 accounting", () => {
    const host = storageHost();
    assert.equal(host.ai.BOT_SLOT_COUNT, 2);
    assert.equal(host.ai.SETTINGS_QUOTA, 16384);
    assert.equal(host.ai.getStorageUsage(), 0);
    for (const [key, bytes] of [["sound", [1]], ["difficulty", [1, 2]], ["#run", [1, 2, 3]], ["#scope", [1, 2, 3, 4]]]) {
        host.entries.set(key, arcadeBuffer(bytes));
    }
    for (let slot = 0; slot < 2; slot++) {
        assert.equal(host.ai.readBot(slot), undefined);
        host.ai.writeBot(slot, smallBot(host, 12 + slot, slot));
    }
    const expected = Array.from(host.entries, ([key, value]) => cost(key, value)).reduce((a, b) => a + b, 0);
    assert.equal(host.ai.getStorageUsage(), expected);
    for (let slot = 0; slot < 2; slot++) {
        const saved = host.ai.readBot(slot);
        assert.equal(saved.courseIndex, slot);
        assert.equal(saved.driver.count(), 12 + slot);
    }
    for (const slot of [-1, 2, 3, 0.5, NaN, Infinity]) {
        assert.throws(() => host.ai.readBot(slot), /Bot slot/);
        assert.throws(() => host.ai.writeBot(slot, smallBot(host)), /Bot slot/);
    }
    host.entries.set("racing.bot.1", arcadeBuffer([]));
    assert.throws(() => host.ai.readBot(1), /truncated/, "corruption must not look like an absent bot");
});

test("replacement subtracts the OLD slot cost and allows the exact reserved quota boundary", () => {
    const host = storageHost();
    const key = "racing.bot.0";
    const original = smallBot(host, 12);
    const replacement = smallBot(host, 60, 5);
    host.entries.set(key, original);
    const budget = host.ai.SETTINGS_QUOTA - RESERVE;
    const fillerKey = "other";
    const fillerEncoded = Math.floor((budget - cost(key, replacement) - (2 + fillerKey.length)) / 4) * 4;
    const filler = arcadeBuffer(Buffer.alloc(fillerEncoded / 4 * 3));
    host.entries.set(fillerKey, filler);
    // Empty buffers still cost their keys; pad to the EXACT quota boundary.
    const paddingCost = budget - cost(key, replacement) - cost(fillerKey, filler);
    host.entries.set("p".repeat(2 + paddingCost), arcadeBuffer([]));
    // The minimum padding key costs four bytes. Make four extra bytes of room.
    host.entries.set(fillerKey, filler.slice(0, filler.length - 3));
    assert.equal(host.ai.getStorageUsage() - cost(key, original) + cost(key, replacement), budget);
    assert(host.ai.getStorageUsage() + cost(key, replacement) > budget, "ignoring replacement would reject it");
    const unrelated = host.entries.get(fillerKey).toString("hex");
    host.ai.writeBot(0, replacement);
    assert.equal(host.ai.getStorageUsage(), budget);
    assert.equal(host.ai.readBot(0).courseIndex, 5);
    assert.equal(host.entries.get(fillerKey).toString("hex"), unrelated);
    const before = snapshot(host.entries);
    assert.throws(() => host.ai.writeBot(1, smallBot(host)), /Not enough settings space/);
    assert.equal(host.writeCalls(), 1);
    assert.deepEqual(snapshot(host.entries), before);
    host.ai.writeBot(0, original);
    assert.equal(host.ai.getStorageUsage(), budget - cost(key, replacement) + cost(key, original));
});

test("a native write error preserves the previous bot, other slots, and unrelated settings", () => {
    const host = storageHost();
    host.ai.writeBot(0, smallBot(host));
    host.ai.writeBot(1, smallBot(host, 15, 1));
    host.entries.set("sound", arcadeBuffer([1]));
    host.entries.set("#scope", arcadeBuffer([2, 3]));
    const before = snapshot(host.entries);
    for (const result of [-1, -3, 1]) {
        host.failWrites(result);
        assert.throws(() => host.ai.writeBot(0, smallBot(host, 30, 5)), /settings write failed/);
        assert.deepEqual(snapshot(host.entries), before);
        assert.equal(host.ai.readBot(0).courseIndex, 3);
        assert.throws(() => host.ai.writeBot(1, smallBot(host, 30, 5)), /settings write failed/);
        assert.equal(host.ai.readBot(1).courseIndex, 1);
        assert.deepEqual(snapshot(host.entries), before);
    }
});

test("a native write error leaves an empty slot empty without deleting the existing bot", () => {
    const host = storageHost();
    host.ai.writeBot(0, smallBot(host));
    host.entries.set("sound", arcadeBuffer([1]));
    const before = snapshot(host.entries);
    for (const result of [-1, -3, 1]) {
        host.failWrites(result);
        assert.throws(() => host.ai.writeBot(1, smallBot(host)), /settings write failed/);
        assert.equal(host.ai.readBot(1), undefined);
        assert.deepEqual(snapshot(host.entries), before);
    }
});

test("settings read errors propagate without attempting a write or hiding a saved bot", () => {
    const host = storageHost();
    host.entries.set("racing.bot.0", smallBot(host));
    host.entries.set("#scope", arcadeBuffer([1, 2]));
    const before = snapshot(host.entries);
    const readBuffer = host.context.settings.readBuffer;
    host.context.settings.readBuffer = key => {
        if (key === "racing.bot.0") throw new Error("Settings read failed");
        return readBuffer(key);
    };
    assert.throws(() => host.ai.readBot(0), /Settings read failed/);
    host.context.settings.readBuffer = key => key === "#scope" ? undefined : readBuffer(key);
    assert.throws(() => host.ai.getStorageUsage(), /Cannot read settings usage/);
    assert.throws(() => host.ai.writeBot(0, smallBot(host)), /Cannot read settings usage/);
    assert.equal(host.writeCalls(), 0);
    assert.deepEqual(snapshot(host.entries), before);
});

function roadContact(track, car) {
    let nearest = Infinity;
    track.centers.forEach((a, index) => {
        const b = track.centers[(index + 1) % track.centers.length];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const fraction = Math.max(0, Math.min(1, ((car.x - a.x) * dx + (car.y - a.y) * dy) / (dx * dx + dy * dy)));
        nearest = Math.min(nearest, Math.hypot(car.x - a.x - dx * fraction, car.y - a.y - dy * fraction));
    });
    return nearest <= track.roadWidth / 2;
}

function driveLap(host, track, driver, teaching) {
    const car = host.makeCar();
    track.reset(car);
    car.driver = driver;
    car.controlEnabled = car.teaching = teaching;
    car.isOffRoad = () => !roadContact(track, car);
    for (let frame = 0; frame < 5000 && car.completedGates < track.gates.length; frame++) {
        if (teaching) {
            // Test-only demonstrator. Playback uses Driver.predict, never this rule.
            const observation = track.observe(car);
            const steer = observation.aim < -0.04 / Math.PI ? -1 : observation.aim > 0.04 / Math.PI ? 1 : 0;
            const targetSpeed = Math.abs(observation.bend) > 0.05 || Math.abs(observation.nearBend) > 0.05
                ? 40 : car.stats.topSpeed;
            const pedal = car.speed < targetSpeed - 2 ? host.ai.Pedal.Accelerate
                : car.speed > targetSpeed + 2 ? host.ai.Pedal.Brake : host.ai.Pedal.Coast;
            host.setControls(new host.ai.Action(steer, pedal).controls());
        }
        car.update(50);
        car.x += car.vx * 0.05;
        car.y += car.vy * 0.05;
    }
    assert(car.completedGates >= track.gates.length,
        `${teaching ? "Teacher" : "Learned driver"} missed the finish: ${car.completedGates}/${track.gates.length} gates`);
    return car;
}

test("two full Monaco lesson models coexist with system settings and both drive after loading", t => {
    const host = storageHost();
    const track = loadMonaco(host);
    const driver = new host.ai.Driver();
    const lesson = driveLap(host, track, driver, true);
    const data = host.ai.encodeBot(driver, 3, lesson.elapsedMillis, lesson.offRoadMillis);
    assertRoundTrip(host, driver, data);
    const secondDriver = new host.ai.Driver();
    const secondLesson = driveLap(host, track, secondDriver, true);
    const secondData = host.ai.encodeBot(secondDriver, 3, secondLesson.elapsedMillis, secondLesson.offRoadMillis);
    assertRoundTrip(host, secondDriver, secondData);
    host.entries.set("#run", arcadeBuffer([1]));
    host.entries.set("#scope", arcadeBuffer(Buffer.from("racing-storage-test")));
    host.entries.set("sound", arcadeBuffer([1]));
    const systemOverhead = cost("#run", host.entries.get("#run")) + cost("#scope", host.entries.get("#scope"));
    const unrelatedOverhead = cost("sound", host.entries.get("sound"));
    const twoSlotsCost = cost("racing.bot.0", data) + cost("racing.bot.1", secondData);
    t.diagnostic(JSON.stringify({
        samples: [driver.count(), secondDriver.count()],
        rawBytes: [data.length, secondData.length],
        slotEncodedBytes: [cost("racing.bot.0", data), cost("racing.bot.1", secondData)],
        twoSlotsEncodedBytes: twoSlotsCost,
        systemOverhead,
        unrelatedOverhead,
        totalEncodedBytes: twoSlotsCost + systemOverhead + unrelatedOverhead,
        reserve: RESERVE,
        quota: host.ai.SETTINGS_QUOTA
    }));
    assert(twoSlotsCost + systemOverhead + unrelatedOverhead <= host.ai.SETTINGS_QUOTA - RESERVE,
        "two complete typical lesson models must fit, without trimming or lowering precision");
    const baseline = driveLap(host, track, driver, false);
    host.ai.writeBot(0, data);
    const firstStored = host.entries.get("racing.bot.0").toString("hex");
    host.ai.writeBot(1, secondData);
    assert.equal(host.entries.get("racing.bot.0").toString("hex"), firstStored);
    assert.notStrictEqual(host.entries.get("racing.bot.0"), host.entries.get("racing.bot.1"));
    assert.equal(host.ai.getStorageUsage(), twoSlotsCost + systemOverhead + unrelatedOverhead);
    const playbacks = [];
    for (const [slot, original] of [[0, driver], [1, secondDriver]]) {
        const loaded = host.ai.readBot(slot);
        assert.equal(loaded.driver.count(), original.count());
        assert.deepEqual(examples(loaded.driver), examples(host.ai.decodeBot(slot ? secondData : data).driver));
        const playback = driveLap(host, track, loaded.driver, false);
        assert.equal(loaded.driver.count(), original.count(), "driving must not add or remove samples");
        assert(playback.elapsedMillis <= baseline.elapsedMillis * 1.25, "saving must not substantially slow this fixture");
        assert(playback.offRoadMillis <= baseline.offRoadMillis + 1000, "saving must not substantially worsen road contact");
        playbacks.push(playback);
    }
    const before = snapshot(host.entries);
    assert.throws(() => host.ai.writeBot(2, data), /Bot slot/);
    assert.deepEqual(snapshot(host.entries), before);
    const encodedRecords = records(data);
    t.diagnostic(JSON.stringify({
        recordBytes: [1, 2, 3, 4, 8].map(size => [size, encodedRecords.filter(record => record.byteLength === size).length]),
        offsetScale: data.readFloatLE(16),
        lessonMillis: lesson.elapsedMillis,
        baselineMillis: baseline.elapsedMillis,
        restoredMillis: playbacks.map(car => car.elapsedMillis),
        baselineOffRoadMillis: baseline.offRoadMillis,
        restoredOffRoadMillis: playbacks.map(car => car.offRoadMillis)
    }));
});
