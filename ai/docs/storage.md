# Saving learned AI racers

[storage.ts](../storage.ts) provides two slots with **separate Buffer values** at
`racing.bot.0` and `racing.bot.1`. They share the game's settings space with each
other and with unrelated settings. Two slot names do **not** guarantee that
both full models fit.

The codec keeps **every example currently in the Driver**, in the same order,
with its exact steering, pedal, and off-road flag. It never subsamples, trims,
merges examples, or relearns actions from a script. The Driver's existing
2,400-example limit still applies before saving.

## API and integration

All APIs are in `aiRacing`:

```typescript
export const BOT_SLOT_COUNT = 2;
export const SETTINGS_QUOTA = 16384;
export class SavedBot {
    driver: Driver;
    courseIndex: number;
    teachingMillis: number;
    offRoadMillis: number;
    byteLength: number;
}
export function encodeBot(driver: Driver, courseIndex: number,
    teachingMillis: number, offRoadMillis: number): Buffer;
export function decodeBot(data: Buffer): SavedBot;
export function readBot(slot: number): SavedBot | undefined;
export function writeBot(slot: number, data: Buffer): void;
export function getStorageUsage(): number;
```

At startup, call `readBot` for the selected slot. `undefined` means **only**
that the key is absent; invalid saved data throws instead. When a lesson
finishes, encode it and write it once:

```typescript
const data = aiRacing.encodeBot(driver, courseIndex, teachingMillis, offRoadMillis);
aiRacing.writeBot(slot, data);
```

`SavedBot.byteLength` is the raw Buffer length; `getStorageUsage()` reports the
encoded cost of all settings.

The integrating activity/menu must handle thrown strings and display the error.
Keep the current in-memory driver and the previous stored bot if saving fails.
Do not write continuously during driving or prediction: flash has limited write
endurance. The codec does not change menus, training, startup, or the manifest;
the parent integration must include `ai/storage.ts` (and this documentation)
in the project's files.

Slots must be integers 0-1, courses integers 0-6, and times integer milliseconds
0-4,294,967,295. Off-road time cannot exceed teaching time. Empty models are valid
24-byte records; deciding whether a model is ready to race belongs to the caller.
Course indices 0-5 identify the six regular maps; index 6 identifies the
training-only Test Track. This metadata records where the lesson happened, not
which maps the saved bot may race on.

## Intentional sensor quantization

Keeping seven floating-point inputs per example would not fit settings.
We deliberately round the six continuous sensors, **not the actions or the
number of memories**:

| Sensor | Encoded range | Maximum absolute rounding error |
| --- | --- | --- |
| Road offset | 255 evenly spaced values from `-scale` to `+scale` | `scale / 254` road-half-width units |
| Heading, near bend, bend, aim | 255 values from -1 to +1 | `1 / 254`, about 0.003937 normalized or 0.709 degrees |
| Signed speed | 256 values from -0.1 to +1 | `1.1 / 510`, about 0.002157 normalized or 0.432 pixels/second |
| Off-road, steering, pedal | Exact bits | Zero |

Heading and bend inputs are angles divided by pi. Zero is exactly representable
for signed angle sensors and offset. Signed speed spans reverse at -20 through
forward at 200 pixels/second: its spacing is about **0.863 pixels/second**.
Zero speed is not exact (it restores to about -0.157 pixels/second), but is
within the stated error. Nonfinite inputs, angles outside [-1, 1], and speeds
outside [-0.1, 1] are rejected, **never silently clipped**.

`scale` is at least 1 and covers the largest absolute offset in the whole model,
including off-road examples. Its stored Float32 is rounded upward when necessary,
then that exact stored scale is used for both encoding and decoding. Thus there
is no endpoint clipping and no extra scale-conversion error beyond the bound.
Very large offsets that cannot have a finite Float32 scale are rejected. A very
wide excursion reduces offset precision for all samples; the chart and nearest
neighbor model still receive every example.

Quantization can change the nearest neighbors or a close vote. It is **not**
a promise of identical controls or success for every taught bot. The focused
tests check numerical bounds and complete a Monaco course before and after
saving with the actual learned Driver, Track, and car physics. Their road-contact
fixture uses centerline distance rather than the rendered tilemap; browser and
physical-device behavior still need integration testing.

## Binary format

The format packs quantized sensor values losslessly while preserving every
sample in order, its exact actions, and the lesson metadata.

The 24-byte little-endian header:

| Byte offset | Field |
| --- | --- |
| 0-3 | ASCII `RBOT` |
| 4 | Format version, currently 1 |
| 5 | Course index 0-6 (6 is the training-only Test Track) |
| 6-7 | UInt16 example count, at most 2,400 |
| 8-11 | UInt32 teaching milliseconds |
| 12-15 | UInt32 off-road milliseconds |
| 16-19 | Positive Float32 offset scale, at least 1 |
| 20-23 | CRC-32 of header and samples, excluding these checksum bytes |

Each **delta** sample starts with a flag byte:

- Bits 0-1: exact pedal (0 coast, 1 accelerate, 2 brake, 3 reverse).
- Bits 2-3: exact `steer + 1` (0 left, 1 straight, 2 right; 3 marks an escape).
- Bit 4: exact off-road flag.
- Bit 5: include a packed offset/heading delta pair.
- Bit 6: include a packed near-bend/bend delta pair.
- Bit 7: include a packed speed/aim delta pair.

If all six quantized differences from the previous sample are in [-8, 7], each
pair packs two signed four-bit differences into a byte, first in the low nibble,
second in the high nibble. Negative differences use four-bit two's complement.
Pairs are written in the order above, **only when at least one difference in
the pair is nonzero**. An omitted pair means both previous sensor values stay
exactly the same. The three high flag bits say which pairs are present.

A delta sample takes **1-4 bytes**: its flag byte plus 0-3 packed pairs. Even if
all six sensors are unchanged, the sample still has its **own flag byte**, with
its exact actions and off-road state. It is not merged with another memory.

The first sample, or any sample whose differences do not all fit signed
nibbles, uses an **absolute escape**: byte `0x0c`, followed by the actual action
flags and all six UInt8 values, ordered offset, heading, near bend, bend, speed,
aim. This takes **8 bytes total**. All but speed use values 0-254.
The escape's steering bits are `11`, which cannot be a valid action; every other
bit of the escape must be zero. The following action byte uses only bits 0-4,
with a valid steering value; its high bits are reserved and must be zero.

Skipping unchanged sensor pairs keeps typical full lessons small without
discarding samples. Packing is **lossless after sensor quantization**.

Decoding and writing validate the signature, version, count, metadata, finite
scale, CRC, canonical escape, reserved absolute-action bits, steering,
first-record mode, sensor bounds after applying deltas, and exact consumed length.
Explicitly encoded zero pairs are rejected as noncanonical. Missing packed
pairs, missing absolute bytes, and extra bytes throw.
CRC-32 detects accidental corruption, not malicious tampering. Writing validates
the input without allocating another full Driver.

## Capacity and safe failure

For `n` samples with `a` absolute records and `p` packed nonzero delta pairs:

```text
raw Buffer bytes = 24 + 8*a + (n-a) + p
0 <= p <= 3*(n-a)
```

For a nonempty model, best case is `31 + n`, worst case `24 + 8*n`.
At 2,400 examples that is **2,431 to 19,224 raw bytes**. Encoding a model that
is too large is allowed: `writeBot` rejects it without dropping examples.

The simulator's 16,384-byte limit is **encoded settings space**, not raw Buffer
space. Each stored value costs:

```text
key cost = 2 + key.length             (includes the simulator's "S/" prefix)
value cost = 4 * ceil(rawBytes / 3)   (Base64)
setting cost = key cost + value cost
```

Each bot key costs 14 bytes. A best-case full model therefore costs
**3,258 encoded bytes**, while a worst-case full model costs **25,646** and cannot
fit even by itself. Two typical full-lap models fit in the measured fixture below,
but two arbitrary full models are **not guaranteed**. Budget for system
keys and all unrelated user settings too; show "storage full" rather than
discarding examples when the complete model cannot fit.

`getStorageUsage()` counts both `settings.list("")` (user keys) and
`settings.list("#")` (system keys). It reports the simulator-equivalent encoded
cost even on hardware. Replacement subtracts the previous slot's entire cost
before adding the new one. The writer reserves another **256 encoded bytes**:

```text
usage - oldSlotCost + newSlotCost <= 16384 - 256
```

The public `settings.writeBuffer` clears **all user settings** and panics if its
write fails. This codec intentionally bypasses it with the existing returning
native/simulator shim `settings::_set`. Quota preflight rejects oversized saves
before writing; a nonzero shim result throws explicitly without clearing,
removing, or retrying settings. The previous bot, other slots, and unrelated
values remain untouched on the tested failure paths.

Hardware's default 32 KB settings region uses two flash banks, with filesystem
and garbage-collection overhead; actual usable space varies by board. This
encoded preflight is a conservative shared policy, **not** a hardware free-space
query or a guarantee that a native write succeeds. Native write errors must
still be shown to the learner.

## Focused tests

From the racing project root:

```sh
node --test ai/tests/storage.test.js
```

The tests compile the codec into the existing test host, with a MakeCode-style
Buffer fixture and a returning settings shim. They cover all actions, exact
counts, unchanged quantization, all eight sparse pair masks, signed delta limits,
canonical absolute escapes, truncated sparse payloads, overflow/underflow in
every sensor, corrupt records, full 2,400-example models, independent slots,
replacement accounting, the reserved quota boundary, and safe quota/native
failures. Two complete Monaco lessons are stored together with system and
unrelated settings; both loaded models then complete the course with unchanged
sample counts. All course indices 0-6 are checked through encode/decode and
write/read, with out-of-range saved indices rejected. The Monaco test prints
its actual sample
count, raw/encoded size, compression mix, and before/after lap measurements.

### Representative measurement

Two separately recorded full lessons with the current Monaco geometry,
upstream car stats, and the same deterministic test demonstrator produced:

| Measurement | Result |
| --- | --- |
| Retained examples | 1,490 of 1,490 in **each** model |
| Raw Buffer | 5,837 bytes per model |
| Slot cost including key and Base64 | 7,798 encoded bytes per model |
| Two separate bot slots | 15,596 encoded bytes |
| System settings (`#run`, `#scope`) | 46 encoded bytes |
| Unrelated user setting (`sound`) | 11 encoded bytes |
| Total measured settings usage | **15,653 of 16,384 encoded bytes** |
| Reserved / additional available capacity | 256 / 475 encoded bytes |
| Delta / absolute records | 1,108 / 382 |
| 1 / 2 / 3 / 4 / 8-byte records per model | 0 / 567 / 541 / 0 / 382 |
| Offset scale | 1 |
| Unsaved learned-driver lap | 94,800 ms; 0 ms off-road |
| Each saved, loaded learned-driver lap | 104,200 ms; 600 ms off-road |

No samples or quantized sensor information were removed. The tests compare
restored sensors against the original quantization **exactly**, not just against
a relaxed numerical tolerance. Attempts to use a third slot are rejected without
changing either existing bot or the unrelated settings.

These are fixture results, not a general guarantee about a learner's model,
system-setting size, rendered tilemap, or physical device.
