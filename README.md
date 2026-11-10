Race tracks are authored as JSON definitions in `tracks/` using the in-game track editor.
The current courses are Birmingham, Vancouver, Strasbourg, Monclava, Hanover, Seattle, and Sydney.
Seattle is hidden until the player finishes a race on every other course.
Any placement, speed, or lap count qualifies; saved finishes from earlier sessions
count. Training, watching AI, and the tutorial do not count. Once unlocked, Seattle
appears in race, training, and watch-track menus and can appear in the menu demo.

See [AI racing](ai/README.md) for the added teaching activity.

## Blocks

- [Start racing game](docs/start-game.md): open the Race / Train AI / View AI menu.
- [Learn to drive](docs/learn-to-drive.md): launch How to Drive directly, without opening the menu.
- [Race on a track](docs/race-on-track.md): choose a map, lap count, and player or trained AI driver in blocks. A bot picker appears only when multiple AIs are trained.
- [Teach AI by driving one lap on a track](ai/docs/teach-driver.md): choose a training course, defaulting to one lap on Test Track.
- [View memories](docs/view-memories.md): reopen saved AI steering and pedal data without driving another lap, including after a simulator restart.
- [Set car logo](docs/set-car-logo.md): draw an 8x8 sponsor badge for the player car.

All blocks appear in the **Racing** category and are exposed by
[api.ts](api.ts) and [ai/activity.ts](ai/activity.ts). [main.ts](main.ts) is listed under
`testFiles`, so importing this project as an extension does not launch its test
game. A learner's program can start with just:

```blocks
racing.startGame()
```

## Regenerating track previews

After editing course palettes, patterns, scrolling directions, or track geometry:

```sh
node tracks/create-track-previews.js
makecode build --java-script
```

Commit `track-previews.g.ts` and `track-previews.g.jres` with the source changes.
The dependency-free generator bakes the scrolling/wobbling menu animations;
CI checks that these assets are current. See [track preview settings](docs/start-game.md#track-previews).

## Regenerating artwork

The PNG originals live in `assets/`. After replacing artwork, run:

```sh
node assets/create-assets.js
node --test assets/*.test.js
makecode build --java-script
```

Commit `racing-art.g.ts` and `racing-art.g.jres` with the PNGs.
The dependency-free converter accepts non-interlaced, 8-bit RGBA PNGs and maps
opaque colors to the nearest Arcade palette color, preserving transparency.
It extracts the sheet's eleven liveries and eight poses, sharing pose images
through body/shadow palette swaps wherever possible. Starting lights use one
unlit panel and one red lamp, composed at runtime; all six source frames are
checked against that composition. Use `node assets/create-assets.js --check`
to check that the generated files are current.

## Track editor

Set `DEBUG_TRACK_EDITOR` to `true` in `startup.ts` to show **Track Editor**
in the game menu (hidden by default), or call `racing.editTrack()` directly.
Choose **New Track** for an empty grid, or select any JSON-defined track to edit
its original nodes. Back returns to this picker. Rerun batch generation after
adding or changing track JSON files to update the picker.
The grid has 20 by 20 cells, each five pixels wide, with nodes at intersections
numbered 0 through 20 on each axis.

- Use the D-pad to move the cursor. Press A to append a node.
- Press A on a segment to insert a node there, splitting it into two segments.
- Hold A on an existing node, move it with the D-pad, and release A to drop it.
- Press B over a node to delete it.
- Quickly double-tap A on a node to make it the start without changing travel direction.
- Move right past the grid's right edge to select **Save**. Up/down selects
  the sidebar tools; left returns to the grid, and A activates the button.
- Select **Shift**, then use the D-pad to move the entire track one grid step.
  Moves outside the grid are blocked. A or B exits Shift mode.
- Select **Reverse** to reverse travel direction while keeping the same start node.
- **Flip H** mirrors left/right, **Flip V** mirrors up/down, and **Rotate** turns
  the track 90 degrees clockwise. These use the grid center and preserve node order.

The preview automatically connects the last node back to the first. The yellow
first node defines the finish, and its yellow outgoing segment shows travel direction.
Crossings, nonadjacent touching segments, overlaps, and slopes other than
horizontal, vertical, 1:1, 1:2, or 2:1 are red. Saving requires at least three
nodes and no invalid segments. Save prints one JSON object in the console:

```json
{"version":1,"points":[[0,0],[20,0],[20,20],[0,20]]}
```

Copy that line into `tracks/<name>.json`. To generate a standalone map:

```sh
node tracks/create-tilemap.js tracks/<name>.json --tileset compact --output track.ts
```

To regenerate the project's tilemaps, gates, AI geometry, and previews:

```sh
node tracks/create-tilemap.js --batch
node tracks/create-track-previews.js
makecode build --java-script
```

Batch generation also writes `track-editor-tracks.g.ts` with the editable definitions.
Only JSON definitions are supported. Editor nodes are scaled without simplification
or repositioning. New course names also need entries in `courses.ts` and the
`Track` enum in `race.ts`. Assign matching `TrainingTrack` values as `Track + 1`,
without reusing removed track IDs. Back closes the editor;
copy the console output before leaving, because drafts are not persisted.

Run editor and generator tests with Node.js 22.13 or newer:

```sh
node --test tracks/*.test.js
```
