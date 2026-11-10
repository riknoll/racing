# Set team logo

Draw a **40x40** team logo in the block's sprite editor. The drawing is used
at its original size, with no scaling: it gives the car's 32x32 image four
extra pixels on each side, like a starting block painted on the track.
Transparent pixels leave the track visible underneath. Use the editor's
rotation tool to line up your drawing.

Images of other sizes are centered on the 40x40 canvas: larger images are
cropped and smaller images get transparent padding. Pixels are not scaled.

```sig
racing.setTeamLogo(image.create(40, 40))
```

## Example

Design your own logo in the sprite editor, then put the logo block before
starting the game. Press **+** to select **player**, **bot 1**, or **bot 2**.
The collapsed block applies to the player.

```blocks
racing.setTeamLogo(assets.image`playerStartingBlock`)
racing.setTeamLogo(assets.image`bot1StartingBlock`, racing.CarTarget.Bot1)
racing.startGame()
```

Create the named 40x40 images in your project's asset editor before using
this example.

The logo stays at the starting spot when the car drives away; it does not
move or rotate with the car. Each team gets its own decal in races, including
AI opponents and a selected bot racing or being watched. Human AI training
and How to Drive use the player's decal. Menu demo cars do not get starting
decals. Car artwork, speed, handling, collision shape, and road sensors are
unchanged.

```package
racing=github:riknoll/racing
```
