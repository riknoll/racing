# Start racing game

Open the **Race / Train AI / View AI** menu. Players choose their track and race
options in the game. Trained bot slots are restored from settings.

The main menu plays a three-car demonstration on a randomly chosen race course
behind its controls. It uses the normal autodrive, scenery, off-road dust, and
fading road/off-road tire tracks. The cars have different stats, cornering styles,
and racing lines, with independent changes of pace and passing maneuvers.
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
Menu titles and control hints use **arcade-fancy-text** sprites,
centered and fixed to the screen above menu items and the demonstration race.
Titles use `customFont.racing` in white uppercase at its native size, one pixel
below the top of the screen, on one line without wrapping or shrinking long labels.
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

## Race options

After selecting a race track, configure **LAPS**, **OPPONENTS**, and **SPEED**.
Up/down moves between rows; left/right cycles the selected row's values. Each
row uses the racing font, with a left-aligned label and an equally sized,
single-value mini-menu on the right. Value selectors use color 3 text
to distinguish them from the labels. Pressing A on an option does not start the
race: move to the final **START** row and press A. B returns to track selection
without starting.

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
example `["Race", "Monaco", "LAPS: B", "OPPONENTS: B", "SPEED: Med", "Start"]`.
Options not mentioned keep their defaults; `Back` cancels and `manual` switches
to interactive selection with any scripted changes retained.

TypeScript callers can also pass `racing.RaceSpeed.Slow`, `.Med`, or `.Fast` as
the fourth argument to `racing.startRace(course, laps, opponents, speed)`.
Omitting it retains Fast.

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
It is the final optional constructor argument and defaults to `N`.
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
