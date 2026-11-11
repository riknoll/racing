# Choose car

Choose **Racing car** or **Mercedes car** without setting its paint colors.
Each model has its own eight directional poses. Mercedes uses the supplied
silver/teal artwork unless you explicitly use **choose color**.

```sig
racing.chooseCar(racing.CarStyle.MercedesCar, racing.CarTarget.Player)
```

Select **player**, **bot 1**, or **bot 2** using the required dropdown,
which is always visible on the block. Each team keeps its own model,
colors, and logo.

## Example

Give the player a racing car and bot 1 a Mercedes with its original colors:

```blocks
racing.chooseCar(racing.CarStyle.RacingCar, racing.CarTarget.Player)
racing.chooseCar(racing.CarStyle.MercedesCar, racing.CarTarget.Bot1)
racing.startGame()
```

Choosing a model does not overwrite colors explicitly set by
[choose color](./choose-color.md). The two blocks can be used in either
order. Without an explicit color choice, Racing car uses the team's stock
livery and Mercedes car uses its native silver/teal palette.

Existing cars update on their next animation frame. Speed, handling, and
other driving stats are unchanged. Bot choices apply in races and AI watches;
human training and How to Drive use the player's choices.

```package
racing=github:riknoll/racing
```
