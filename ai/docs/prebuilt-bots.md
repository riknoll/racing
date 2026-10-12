# Prebuilt example bots

[prebuilt-bots.ts](../prebuilt-bots.ts) contains two exported MakeCode `Buffer`
literals in `aiRacing.prebuilt`. These are the exact version 2 buffers exported
from the trained bots' settings, not scripts or waypoint replays.

| Model | Export | Course | Teaching laps | Examples | Buffer bytes | Reverse examples |
| --- | --- | --- | --- | --- | --- | --- |
| Cautious | `aiRacing.prebuilt.cautious` | Test Track | 3 | 2,107 | 8,796 | 0 |
| Aggressive | `aiRacing.prebuilt.aggressive` | Test Track | 1 | 810 | 3,085 | 39 |

Cautious was taught clean laps with slower corners. Aggressive was taught a
late corner overshoot, braking, backing up before the corner, and a slow forward
turn. Its verified autonomous Test Track lap took about 97 seconds and included
six reverse maneuvers. Aggressive describes its driving style, not a promise of
a faster lap: recovering from mistakes costs time.

## Loading a model

Use the normal decoder to get an independent driver and its teaching metadata:

```typescript
const cautious = aiRacing.decodeBot(aiRacing.prebuilt.cautious)
const aggressive = aiRacing.decodeBot(aiRacing.prebuilt.aggressive)

aiRacing.showTrainingSummary(cautious.driver, "back", "Cautious")
aiRacing.showTrainingSummary(aggressive.driver, "back", "Aggressive")
```

Every call to `decodeBot` creates a new driver. Use that driver for an opponent
without recording additional examples if you want a fixed baseline for students
to beat. Loading these buffers does not write settings, replace a saved slot,
or automatically add an opponent to the menu-driven game.

The buffers keep every saved sample, its exact controls and terrain flag, and
the sensor quantization already present in settings. Exporting adds no further
quantization or sampling. Both models use Test Track course index 6; they can
be tried on other tracks, but performance there is not guaranteed.

The storage tests verify their SHA-256 hashes, checksums, metadata, action counts,
byte-identical re-encoding, and independent decoded drivers.
