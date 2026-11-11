# Choose color

Choose the **body** paint and **shading** colors without changing the car model.
For Racing car these control its two paint colors. For Mercedes car they
control its silver details and teal accents; black details and transparency
stay unchanged.

```sig
racing.chooseColor(2, 10)
```

Press **+** to select **player**, **bot 1**, or **bot 2**. The collapsed block
applies to the player.

## Example

Give the player a red racing car and bot 1 a Mercedes in green and blue:

```blocks
racing.chooseCar(racing.CarStyle.RacingCar)
racing.chooseColor(2, 10)
racing.chooseCar(racing.CarStyle.MercedesCar, racing.CarTarget.Bot1)
racing.chooseColor(7, 8, racing.CarTarget.Bot1)
racing.startGame()
```

Colors belong to the selected team and are preserved when using
[choose car](./choose-car.md), regardless of block order. Omit this block to
keep each model's native colors. Colors 1 (white/silver) and 6 (teal) reproduce
the supplied Mercedes palette.

The color choice applies to all eight poses and updates existing cars on
their next animation frame. Opaque paint colors preserve the selected model's
silhouette. Driving stats and saved AI examples are unchanged.

```package
racing=github:riknoll/racing
```
