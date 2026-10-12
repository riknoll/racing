# Test Track training

Choose **Train AI**, a bot slot, and a training track. **Test Track** remains the
first track; the six normal race maps follow it.

Choose **1–4 training laps**. The Test Track defaults to **three laps**; normal
maps default to one. Training is a continuous drive: the car starts once and
keeps moving between laps, with no exercise prompts, teleports, or Continue/Retry
reviews.

The hand-designed loop includes straights, gentle left/right bends, sharp
left/right corners, and both hairpin directions. Build speed on the straights
and demonstrate braking before the tighter corners. If you leave the road,
demonstrate how to recover. Reversing is learned only when you use Down.

- **A / Up:** accelerate.
- **B:** brake.
- **Left / Right:** steer.
- **Down:** reverse.

Recording continues throughout the selected laps, including mistakes. The model
keeps up to 2,400 examples; after that, new examples replace the oldest ones.
Completing the selected number of circuits ends training and shows the memory
chart. There are no intermediate decisions about keeping or rejecting segments.

Training replaces only the chosen slot. Saving uses the
[documented buffer format](storage.md) and retains every example still in the
model. If settings are full, the model remains available for the session and
previously saved bots are unchanged.

The geometry comes from [training-track.svg](../training-track.svg). Its generated
tilemap and checkpoint buffers stay isolated from the original race assets.
Regenerate it from the project root with:

```sh
node ai/generate-training-track.js
```
