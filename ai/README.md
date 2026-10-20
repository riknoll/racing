# Train an AI Racer

The starting menu offers **Race**, **Train AI**, and **View AI**.

- **Race:** choose any of the six named tracks, then 1–4 laps. All trained bot
  slots race beside your blue car in different colors. The race ends when you
  finish your chosen laps and returns to the menu after the result.
- **Train AI:** choose a bot slot, track, and 1–4 training laps.
  [Test Track](docs/test-track.md) is first and defaults to three continuous laps;
  normal maps default to one. There are no segment prompts, teleports, or
  Continue/Retry decisions. New training replaces only the chosen slot.
- **View AI:** choose a slot to inspect its stored examples. Empty slots show
  zero examples; there is no scripted opponent. After viewing a trained bot's
  graphs, A opens **Watch a lap / Watch another track / Back**. **Watch a lap**
  uses its training track; **Watch another track** lets you choose any other
  regular map or Test Track. Back from that picker returns to the action menu.
  Watching returns to the graphs afterward and does not change its examples or
  recorded training track. AI watch/test
  attempts allow at least three minutes, or 1.5 times the teaching duration when
  that is longer. B ends a menu watch early. Player training has no time cutoff.
Both cars use the current upstream car stats, including its 20-pixel/second
grass speed rather than the older 4-pixel/second setting.

Use **Up/Down** and **A** in menus, with **B** to go back. In a car, **A / Up**
accelerates, **B** brakes, **Left/Right** steers, and **Down** reverses.

After teaching, inspect an animated map of the AI's saved examples. **Left/Right**
switches between steering and pedals, **B** explains the chart, and **A** returns
to the menu. Racing and viewing do not add training examples. Training is kept
between menu choices and automatically restored after restarting the same project.
Two bot slots use separate buffers but share the settings quota. A typical
two-minute bot may use about 5.8 KiB raw / 7.7 KiB encoded. Whether both fit depends
on the training data and other settings. Oversized saves are reported; no samples or other
saved bots are trimmed/deleted. `*` marks a trained slot available only this session.
See [storage and quantization](docs/storage.md) for exact accounting and precision.

The [prebuilt bots](docs/prebuilt-bots.md) provide the exact saved **Cautious**
and **Aggressive** demonstrations as reusable buffers in the program source.
They do not automatically replace either saved slot.

See [teaching](docs/teach-driver.md) and [testing](docs/test-driver.md) for the
blocks, learning model, and experiments.

Learning and visualization live in [AI files](./), under `aiRacing`. The general
[menu](../menu.ts), [course registry](../courses.ts), [race](../game-race.ts), and
[startup](../startup.ts) are top-level game files under `racing`. The shared
[car](../racer.ts) keeps its original physics; its only AI integration change is
exporting the existing control flags. The [block API](../api.ts) starts the menu
with `racing.startGame()`, or starts a selected race with `racing.raceOnTrack()`.
The [standalone launcher](../main.ts) is included only when building this project
directly, not when importing it as an extension. The starting menu cannot be
dismissed with B; there is no direct-USA fallback. Back still returns from track,
lap, and bot selectors. Racing, training, and watching all use the same
[driving display](../driving-display.ts), reusing upstream [UI](../ui.ts) and
[minimap](../minimap.ts) helpers. All retain the minimap, speedometer, finish line,
lap timer, lap-time panels, and forward-looking camera. AI-specific information
does not replace these instruments or add a full-width driving header.

The extension includes the ready-to-use [race geometry](geometry.g.ts),
[Test Track assets](training-track.g.ts), and original race tilemaps and
checkpoints. The added AI generator scripts and their source SVG are not included
or needed to build the extension. The original track generator and SVG sources
remain unchanged.

## Building

```sh
makecode build --java-script
```

Run this command from the project root.

For a standalone learner project, the lesson can also be started with just:

```typescript
aiRacing.teachDriver(racing.TrainingTrack.TestTrack)
aiRacing.testDriver()
```

The teaching block's course dropdown defaults to Test Track and also offers all
six race tracks. It always teaches one lap; the menu's three-lap Test Track
default is unchanged.