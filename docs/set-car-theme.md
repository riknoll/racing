# Set car theme

Choose **Racing car** or **Mercedes car**, then use the color pickers to
choose the **body** paint and **shading** color. These are the two paint
colors that vary between the supplied car liveries. Tires, trim, highlights,
and transparent pixels are preserved.

```sig
racing.setCarTheme(racing.CarStyle.RacingCar, 1, 6)
```

Press **+** to select **player**, **bot 1**, or **bot 2**. The collapsed block
applies to the player. Each team keeps its own theme and logo.

## Example

Give the player a red racing car and bot 1 a silver/teal Mercedes:

```blocks
racing.setCarTheme(racing.CarStyle.RacingCar, 2, 10)
racing.setCarTheme(racing.CarStyle.MercedesCar, 1, 6, racing.CarTarget.Bot1)
racing.startGame()
```

The theme applies to all eight directional poses. Replacing it updates
existing cars on their next animation update, without changing speed,
handling, collision shape, or AI observations. Bot themes also appear in
AI-only races and watches. Human training and How to Drive use the player's
theme; menu demo cars use the three teams' themes.

```package
racing=github:riknoll/racing
```
