# Start racing game

Open the **Race / Train AI / View AI** menu. Players choose their track and laps
in the game. Trained bot slots are restored from settings.

Menus use **arcade-mini-menu**, with A to select and B to return where available.
Track selection uses left/right navigation through synchronized preview and
name rows, showing one track at a time. Other menus use up/down navigation.
Longer lists and selected labels scroll automatically.

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

## Track previews

TypeScript menus can generate a centered, aspect-ratio-preserving track preview
from any course including training courses. The road keeps its original 80x80
layout, offset four pixels inside an 88x88 image. There is no bevel or rectangular
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

Optional color arguments override the track, outline, and background colors,
in that order. Preview roads use half the scaled
road width to keep tight turns legible, with a one-pixel outline generated from
the road pixels. Generating a preview does not change the active tilemap or the
actual road width.

The track carousel cycles menu item icons every 50 ms. Four wobble poses randomly
offset the scaled centerline points by up to half a pixel per axis. The background
pattern scrolls one pixel per step, wrapping its 8x8 template in an eight-frame
loop; each wobble pose holds for two consecutive frames, updating every 100 ms.
The background shape follows the wobbling road while its pattern scrolls
independently. The preview size stays fixed. The animation ends when the menu closes.
Standalone previews remain still unless the optional fifth `wobble` argument is
`true`, which generates one randomly perturbed frame.

Track names use mini-menu's normal text rendering in a fixed 88x8 row below the
preview. The names do not wobble; both rows retain equal item widths for
synchronized horizontal scrolling.

```typescript
const preview = racing.createTrackPreview(racing.getCourses()[0])
const customPreview = racing.createTrackPreview(racing.getCourses()[0], 12, 1, 15)
```

Set a course's writable `patternIndex` to a zero-based index in `racing.patterns`,
or pass it after `previewColors` in the `Course` constructor. New courses
default to pattern 0; built-in courses keep their existing pattern assignments
in `courses.ts`. Invalid indices produce an error when generating the preview.

```typescript
racing.getCourses()[0].patternIndex = 4
```

Each course's writable `patternScrollDirection` selects a
`racing.PreviewScrollDirection`: `N`, `E`, `S`, `W`, `NE`, `NW`, `SE`, or `SW`.
It is the final optional constructor argument and defaults to `N`.
Built-in directions are Australia N, Great Britain E, Italy S, Monaco W,
Netherlands NE, USA NW, and Test Track SW.

```typescript
racing.getCourses()[0].patternScrollDirection = racing.PreviewScrollDirection.SE
```

Use `racing.chooseTrackMenu(title, courses, subtitle, allowBack, initialSelection)`
for the two-row track carousel. It returns the selected course index, or `-1`
when going back. The last three arguments are optional, and scripted menu choices
use the original course names.

```typescript
const selected = racing.chooseTrackMenu("Choose track", racing.getCourses())
```
