# Start racing game

Open the **Race / Train AI / View AI / How to Drive** menu. Players choose their track and race
options in the game. Trained bot slots are restored from settings.
These main-menu options use an outlined copy of the racing font in uppercase
alongside their icons: white letters and pink `AI` suffixes, all with a one-pixel
color-12 outline. The View AI icon has an opaque color-12 background. Labels
are rendered into the main-menu row images with a shared column for the `AI`
suffixes in `TRAIN AI` and `VIEW AI`; navigation and selection still use mini-menu.
The selected main-menu row has a rounded color-12 background with a rounded cyan border.
All four entries fit on screen. The longer **How to Drive** label uses the
compact geometric font so it fits without horizontal scrolling.
The font copy uses Fancy Text's two-tone font format; titles and other menus keep the original
racing font. Regenerate the copy after changing the source font with
`node fonts/create-outlined-racing-font.js`; use `--check` to verify it is current.

The main menu plays a three-car demonstration on a randomly chosen race course
behind its controls. It uses the normal autodrive, scenery, off-road dust, and
fading road/off-road tire tracks. The cars have different stats, cornering styles,
and racing lines, with independent changes of pace and passing maneuvers.
Dust appears only while cars move off-road and uses colors 13, 1, and 11.
A small, capped catch-up boost keeps the field competitive; cars trade places
through their actual movement, not position swaps. The camera smoothly follows
the leader, and menu input does not control the cars.
Normal race autodrive keeps its existing settings. Leaving the main menu stops and disposes the demo;
returning starts a fresh one. Demonstrations do not save race results or change
AI training data.

Menus use **arcade-mini-menu**, with A to select and B to return where available.
Track selection uses left/right navigation through synchronized preview and
name rows, showing one track at a time. Other menus use up/down navigation.
Longer lists and selected labels scroll automatically.
Menu lists use a two-pixel side margin, giving the main-menu labels enough room
to fit without horizontal scrolling.
Menu titles and control hints use **arcade-fancy-text** sprites,
centered and fixed to the screen above menu items and the demonstration race.
Titles use `customFont.racing` in white uppercase at its native size, one pixel
below the top of the screen, on one line without wrapping or shrinking long labels.
The main-menu title sits three pixels below the top, with a fitted rounded black
background matching the results title instead of a full-width header strip.
Menus have no screen border or subtitles; control hints use directional arrow
icons followed by uppercase text in their compact font. All menus share a
bottom-aligned help strip with one clear pixel above and below the icons and
text. These sprites are destroyed when their menu closes.

```sig
racing.startGame()
```

## Example

```blocks
racing.startGame()
```

Set a [car logo](set-car-logo.md) before this block. The menu keeps running, so
put setup blocks above it rather than below it.

Importing the extension does not start the game automatically. The repository's
`main.ts` is a test-only launcher, not part of the imported extension.

## How to Drive

The interactive tutorial has its own open-ended practice track and uses the
normal car physics, road/off-road particle effects, and player car artwork.
Its 64-pixel roads and corner section use the same compact 16-pixel
road tiles and four-pixel edging as the race courses, rather than drawn lines.
The hand-authored layout in `tracks/driving-tutorial.jres` spans 4080 by 1024
pixels, with a broad S-curve, a 64-pixel grass gap, and six sharp corners.
The generator preserves every road pixel in that source, replacing edge tiles
with outlined variants and adding neighboring outline-only tiles where needed.
It does not redraw, resize, or smooth the road.
Both sides of each tight-turn approach have directional warning signs. The
preceding 11 tiles (176 pixels) of straightaway edging use yellow/black stripes;
road pixels and the rest of the outline remain unchanged.
The outlined map and lesson checkpoints are baked by
`node tracks/create-driving-tutorial.js`; use `--check` to check the generated
`driving-tutorial.g.ts` after changing the source layout, generator, or race tile
artwork. Checkpoint coordinates live in the generator and must follow layout
edits; generation rejects checkpoint routes that leave the road.
The car arrives from the left and brakes before the introduction. Lessons cover
A/Up acceleration, Down reverse, Left/Right steering through gentle curves,
the slowdown caused by a grass gap, and slowing for right-angle corners.
The steering lesson caps road speed at 30 pixels/second; the final corners allow
110 pixels/second so braking or lifting off the accelerator matters.
As in a race, release A/Up before holding B to brake.

All six controls remain visible on the left, with arrows in a connected D-pad
and A diagonally above and to the right of B. Instructions highlight the
relevant buttons; practice highlights actual presses. Controls stay locked
while instructions type and during each `OK!` stop. Fancy Text animates the
geometric text character by character, with expanding rounded color-12
backgrounds two pixels below the top edge. The car stays below the instructions.
Button artwork is shared with training in `driving-controls.ts`.

Each driving lesson advances based only on the car's X position, assuming the
player follows the road. Reaching the end of the curves completes steering;
reaching 96 pixels beyond the grass gap completes that lesson. Reaching the
finish line's X position triggers congratulations and returns to the main menu,
without requiring precise checkpoint visits or a particular Y position.
Tutorial progress does not save race times or modify AI training data.
TypeScript callers can also start it with `racing.howToDrive()`.

## Results preview

Set `PREVIEW_RACE_RESULTS` to `true` in `main.ts` to launch directly into sample
four-lap race results using the real results renderer. It is disabled by default.
Press A after the animation finishes to replay it. Edit the sample
`LapResult` entries, placement, or new-best flags in that branch to preview other
results; the total time is calculated from the sample laps. No saved times or
race statistics are changed. Set the flag to `false` to restore the normal game
launcher and scripted menu options.

## Race options

After selecting a race track, configure **LAPS**, **OPPONENTS**, and **SPEED**.
Up/down moves between rows; left/right cycles the selected row's values. Each
row uses the racing font, with a left-aligned label and an equally sized,
single-value mini-menu on the right. Value selectors use color 3 text
to distinguish them from the labels. Pressing A on an option selects the final
**START** row; pressing A again starts the race. Double-tap A to accept the
defaults without changing any values. B returns to track selection without
starting.

After finishing, race results stay visible until the heading and all timing rows
finish animating. Release the driving buttons, then press A to continue; the menu
returns after the button is released.

Laps range from **1–4** (default 1), and opponents from **0–3** (default 3).
Until the racing font has digits, both selectors display **A, B, C, D**:
these represent 1, 2, 3, 4 laps and 0, 1, 2, 3 opponents, respectively.
Speed offers **Slow**, **Med**, and **Fast**, with road top speeds of **70**,
**135**, and **200 pixels/second** for both the player and opponents. Fast is
the default and preserves the previous race speed. Training and the main-menu
demonstration keep their existing driving settings.

Speed values use **15x15** square placeholder icons, matching the racing font's
height. All selectors share the same cell dimensions, sized using the actual
font metrics. Replace `raceSpeedSlowIcon`, `raceSpeedMedIcon`, and
`raceSpeedFastIcon` in `ui.ts` to supply the final artwork.

Training uses the same options menu with just a Laps row and Start. It retains
the existing default of three laps on Test Track and one on other courses.

`racing.chooseOptionsMenu(title, options, confirmLabel, allowBack)` is reusable:
each `MenuOption` has a `name`, nonempty `values`, an optional matching `icons`
array, and an optional zero-based `initialSelection`. The last two function
arguments default to `"START"` and `true`. The menu returns an array of selected
value indices on confirmation, or `null` on Back. All value selectors use the
same dimensions, calculated from the largest value; longer lists scroll
vertically with their selectors.

```typescript
const values = racing.chooseOptionsMenu("OPTIONS", [
    { name: "LAPS", values: ["A", "B", "C", "D"] },
    { name: "OPPONENTS", values: ["A", "B", "C", "D"], initialSelection: 3 }
])
```

Scripted menu choices use `OPTION: VALUE` entries followed by `Start`, for
example `["Race", "Monaco", "LAPS: B", "OPPONENTS: B", "SPEED: Med", "Start", "Continue"]`.
The results screen accepts `Continue` after its animation finishes.
Options not mentioned keep their defaults; `Back` cancels and `manual` switches
to interactive selection with any scripted changes retained.

TypeScript callers can also pass `racing.RaceSpeed.Slow`, `.Med`, or `.Fast` as
the fourth argument to `racing.startRace(course, laps, opponents, speed)`.
Omitting it retains Fast.

## Course background tilesets

Each `Course` has a fixed `backgroundTileset`, set as its final constructor
argument in `courses.ts`. Choose a named `racing.BackgroundTileset`: `Grass`,
`DarkGrass`, `DryGrass`, `Stone`, `DarkStone`, `Sand`, or `Checkerboard`.
For example, the Australia entry inside the `racing` namespace uses:

```typescript
new Course(
    Track.Australia, "Australia", tilemap`australia`,
    trackWaypoints.australia, trackCenterlines.australia, trackRoadWidths.australia,
    [14, 4, 5], 2, PreviewScrollDirection.N, BackgroundTileset.Sand
)
```

Initial assignments are Australia **Sand**, Great Britain **DarkGrass**,
Italy **Grass**, Monaco **Stone**, Netherlands **Grass**, USA **DryGrass**,
and Test Track **Checkerboard**. Races, the main-menu demonstration, training,
and watching a bot all use the selected course's tileset. Tile placement within
that tileset is still randomized; the tileset itself is no longer random.

Omitting the argument defaults to `Grass`, as does calling
`racing.generateBackground()` without a tileset. This setting is independent of
the menu preview's colors and pattern, so changing only the background tileset
does not require regenerating preview assets.

## Track previews

Track previews are pre-rendered at build time for all built-in courses, including
the training track. Menus load compiled frames rather than rasterizing tracks
on entry. The road uses a 72x72 layout, offset four pixels inside an 80x80 image
to leave room for the taller track-name font. There is no bevel or rectangular
background: a six-pixel circular dilation of the rasterized road creates a
track-shaped background, with transparent pixels outside it. Each course
receives a `previewColors` array in its constructor, ordered `[dark, medium, light]`.
These colors are independent of the car `colorMap`: light for the road, medium
for the track-shaped background, and dark for the road outline and pattern.
Built-in course arrays in `courses.ts` initially match their
previous colormap colors. The background tiles the course's
`patternIndex` template from `ui.ts`'s `patterns`, using dark pixels over the medium
base color. The pattern is confined to the dilated background and does not affect
the road or transparent area.

Preview roads use half the scaled
road width to keep tight turns legible, with a one-pixel outline generated from
the road pixels. Loading a preview does not change the active tilemap or the
actual road width.

The track carousel cycles menu item icons every 50 ms. Four deterministic wobble poses
offset the scaled centerline points by up to half a pixel per axis. The background
pattern scrolls one pixel per step, wrapping its 8x8 template in an eight-frame
loop; each wobble pose holds for two consecutive frames, updating every 100 ms.
The background shape follows the wobbling road while its pattern scrolls
independently. The preview size stays fixed. The animation ends when the menu closes.
Standalone `createTrackPreview(course)` calls return a copy of the first compiled
frame, so editing it does not change the carousel.
The former runtime color overrides and `wobble` argument have been removed;
customize the source settings and regenerate instead.

Track names use the extension's `customFont.racing` font at its native 15-pixel
height, in uppercase, with one pixel of padding above and below the text in a
156-pixel-wide row below the preview. All built-in
names fit without clipping. The names do not wobble; both rows retain equal
156-pixel item widths for synchronized horizontal scrolling, with each preview
centered in its item. Menu titles use the same racing font; help text keeps its
compact font.

Tracks with a saved best lap also show a stopped compact timer to the right of
their preview, just above the name, with a compact-font `BEST LAP` label above it.
The label and timer have transparent backgrounds and align with the right edge
of the track-name row, with the timer centered beneath the label. Neither overlaps
the preview image.
The timer displays the saved best lap in
minutes, seconds, and hundredths without counting. Timers and labels follow the same
horizontal scrolling as their preview items, including incoming and outgoing
tracks during transitions, and are clipped to the carousel. Tracks without a
saved best lap, including Test Track, show neither a timer nor a label. Both are
created when the menu opens and destroyed when it closes.

```typescript
const preview = racing.createTrackPreview(racing.getCourses()[0])
```

Set colors, `patternIndex` (a zero-based index in `racing.patterns`), and
`patternScrollDirection` in each `Course` constructor in `courses.ts`.
The generator reads these literal settings, centerlines and road widths from
`ai/geometry.g.ts` / `ai/training-track.g.ts`, and pattern images from `ui.ts`.
Unsupported constructor expressions or invalid settings stop generation with an error.

Each course's `patternScrollDirection` selects a
`racing.PreviewScrollDirection`: `N`, `E`, `S`, `W`, `NE`, `NW`, `SE`, or `SW`.
It defaults to `N`; the optional `backgroundTileset` argument follows it.
Built-in directions are Australia N, Great Britain E, Italy S, Monaco W,
Netherlands S, USA W, and Test Track SW.

After changing settings, geometry, patterns, or the renderer, regenerate and
commit both generated files:

```sh
node tracks/create-track-previews.js
```

The dependency-free script writes `track-previews.g.jres` (MakeCode animation
resources and their image frames) and `track-previews.g.ts` (flash-backed image
declarations and the animation factory). It uses a stable per-course random seed,
so regeneration is reproducible. Renderer settings such as dilation and timing
live in the script. CI runs `node tracks/create-track-previews.js --check` to
reject stale assets before building. Importing the extension needs no Node.js
or runtime image generation.

New courses must be defined in `courses.ts` and included in regenerated assets.
Unknown courses or runtime changes to baked course settings produce an explicit
error rather than showing another course's preview.

Use `racing.chooseTrackMenu(title, courses, allowBack, initialSelection)`
for the two-row track carousel. It returns the selected course index, or `-1`
when going back. The last two arguments are optional, and scripted menu choices
use the original course names.

```typescript
const selected = racing.chooseTrackMenu("Choose track", racing.getCourses())
```
