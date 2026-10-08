# Train an AI Racer

Drive one teaching lap, then watch one AI attempt on the same Monaco track.
The AI learns steering, acceleration, braking, reversing, and coasting from your
demonstrations. It uses the existing car physics, not a prerecorded route.
Both cars use the current upstream car stats, including its 20-pixel/second
grass speed rather than the older 4-pixel/second setting.

Press **A** or **Up** to accelerate, **B** to brake, **Left/Right** to steer, and
**Down** to reverse. Teaching ends after one lap; the AI attempt ends after one lap
or its time limit. There is no finish-early shortcut.

After teaching, inspect an animated map of the AI's saved examples. **Left/Right**
switches between steering and pedals, **B** explains the chart, and **A** starts
the AI attempt.

See [teaching](docs/teach-driver.md) and [testing](docs/test-driver.md) for the
blocks, learning model, and experiments.

The added learning, car controller, track observations, and activity UI live in
[AI files](./) under the `aiRacing` namespace. The shared [car](../racer.ts) keeps its
original physics; its only AI integration change is exporting the existing
control flags. A single call to `aiRacing.runActivity()` at the end of the original
startup runs the lesson in a separate scene. After the report is dismissed, the
original demo resumes with its minimap and speedometer intact.

The added [metadata generator](generate-geometry.js) produces
[geometry.g.ts](geometry.g.ts) without modifying the original track generator,
maps, checkpoints, or car artwork.

## Development

```sh
makecode build --java-script
node ai/generate-geometry.js
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