# Start racing game

Open the **Race / Train AI / View AI** menu. Players choose their track and laps
in the game. Trained bot slots are restored from settings.

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
