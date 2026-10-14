F1 track SVGs taken from https://github.com/f1laps/f1-track-vectors/tree/981ef8e7bc9cb98380602f65f9b7b7f2ba0fe5d9. See LICENSE in that repo for usage details.

See [AI racing](ai/README.md) for the added teaching activity.

## Blocks

- [Start racing game](docs/start-game.md): open the Race / Train AI / View AI menu.
- [Race on a track](docs/race-on-track.md): choose a map and lap count in blocks.
- [Teach AI by driving one lap](ai/docs/teach-driver.md): train a driver on Monaco.
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
