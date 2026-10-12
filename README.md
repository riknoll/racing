F1 track SVGs taken from https://github.com/f1laps/f1-track-vectors/tree/981ef8e7bc9cb98380602f65f9b7b7f2ba0fe5d9. See LICENSE in that repo for usage details.

See [AI racing](ai/README.md) for the added teaching activity.

## Blocks

- [Start racing game](docs/start-game.md): open the Race / Train AI / View AI menu.
- [Race on a track](docs/race-on-track.md): choose a map and lap count in blocks.
- [Set car logo](docs/set-car-logo.md): draw an 8x8 sponsor badge for the player car.

The blocks are exposed by [api.ts](api.ts). [main.ts](main.ts) is listed under
`testFiles`, so importing this project as an extension does not launch its test
game. A learner's program can start with just:

```blocks
racing.startGame()
```
