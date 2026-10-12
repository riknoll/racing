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
exporting the existing control flags. A single call to `racing.runGameMenu()` at
startup opens the game menu in a separate scene. The starting menu cannot be
dismissed with B; there is no direct-USA fallback. Back still returns from track,
lap, and bot selectors. Racing, training, and watching all use the same
[driving display](../driving-display.ts), reusing upstream [UI](../ui.ts) and
[minimap](../minimap.ts) helpers. All retain the minimap, speedometer, finish line,
lap timer, lap-time panels, and forward-looking camera. AI-specific information
does not replace these instruments or add a full-width driving header.

The added [metadata generator](generate-geometry.js) produces
[geometry.g.ts](geometry.g.ts) without modifying the original track generator,
maps, checkpoints, or car artwork.

## Development

```sh
makecode build --java-script
node ai/generate-geometry.js
node ai/generate-training-track.js
node --test ai/tests/*.test.js
node --test tracks/create-tilemap.test.js
```

Run these commands from the project root. The AI metadata generator checks the
original track gates before writing its file. If the upstream track generation
settings change, update its settings rather than editing generated coordinates.

For a standalone learner project, the lesson can also be started with just:

```typescript
aiRacing.teachDriver()
aiRacing.testDriver()
```

## Fast menu checks

The constants at the top of [main.ts](../main.ts) can select menus automatically:

```typescript
const MENU_TEST_SEQUENCE = ["Race", "Monaco", "2 laps"]
const MENU_TEST_REPEAT = false
const MENU_TEST_SKIP_PROMPTS = true
```

Exact menu labels are case-insensitive. `"Bot 1"` matches that slot even when its
course description changes. `"Back"` cancels a selector; `"manual"` hands one
menu to the user. When a non-repeating sequence ends, normal interaction resumes.
Invalid/ambiguous choices report an error rather than silently choosing a default.

View example: `["View AI", "Bot 1", "Pedals", "Continue", "Back"]`.
Watch example: `["View AI", "Bot 1", "Continue", "Watch a lap", "Continue", "Back"]`.
Other-track example: `["View AI", "Bot 1", "Continue", "Watch another track", "Monaco", "Continue", "Back"]`
(for a bot trained on a track other than Monaco).
The final Back in these examples exits the trained bot's action menu.
Training example: `["Train AI", "Bot 1", "Test Track", "3 laps", "Continue"]`.
The final `"Continue"` exits the memory chart, not an exercise review.
Prompt skipping bypasses descriptions/start waits/countdowns,
not driving or the menu sequence; it does not add a scripted racer.