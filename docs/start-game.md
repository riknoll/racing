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

TypeScript menus can generate a centered, aspect-ratio-preserving 80x80 preview
inside a raised-bevel frame, from any course including training courses.
The two-pixel bevel has bright top/left edges and shaded bottom/right edges,
with no outer outline. A two-pixel transparent margin surrounds the bevel,
keeping the complete image 88x88; the inner preview is unchanged. Each course
receives a `previewColors` array in its constructor, ordered `[dark, medium, light]`.
These colors are independent of the car `colorMap`: light for the road and bevel
highlights, medium for the image background, and dark for the road outline and
bevel shadows. Built-in course arrays in `courses.ts` initially match their
previous colormap colors. The background tiles the course's
`patternIndex` template from `ui.ts`'s `patterns`, using dark pixels over the medium
base color. The pattern is confined to the inner preview and does not affect
the road or bevel.

Optional color arguments override the track, outline, and background colors,
in that order. Preview roads use half the scaled
road width to keep tight turns legible, with a one-pixel outline generated from
the road pixels. Generating a preview does not change the active tilemap or the
actual road width.

```typescript
const preview = racing.createTrackPreview(racing.getCourses()[0])
const customPreview = racing.createTrackPreview(racing.getCourses()[0], 12, 1, 15)
```

Set a course's writable `patternIndex` to a zero-based index in `racing.patterns`,
or pass it as the final optional `Course` constructor argument. New courses
default to pattern 0; built-in courses keep their existing pattern assignments
in `courses.ts`. Invalid indices produce an error when generating the preview.

```typescript
racing.getCourses()[0].patternIndex = 4
```

Use `racing.chooseTrackMenu(title, courses, subtitle, allowBack, initialSelection)`
for the two-row track carousel. It returns the selected course index, or `-1`
when going back. The last three arguments are optional, and scripted menu choices
use the original course names.

```typescript
const selected = racing.chooseTrackMenu("Choose track", racing.getCourses())
```
