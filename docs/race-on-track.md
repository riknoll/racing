# Race on a track

Start a race directly, without opening the menu. Choose Australia, Great Britain,
Italy, Monaco, Netherlands, or USA, and **1-4 laps**. This block keeps three
opponents and Fast speed; the game menu offers configurable race options.

```sig
racing.raceOnTrack(racing.Track.Monaco, 1)
```

## Example

```blocks
racing.raceOnTrack(racing.Track.Monaco, 2)
```

The player drives with the normal racing controls and instruments. Any trained
saved bots join the race without learning new examples. After the player finishes
and closes the result, the program continues with the next block.

The speedometer's lower segmented bar shows actual acceleration: green cells
fill from the left for positive acceleration, and red cells fill from the right
for negative acceleration. Coasting and off-road slowing are included, not just
pedal input. The race-sized bar has four whole cells: a segment is either fully
filled or empty, never partially filled. Outlines and dividers use color 12,
and empty cells use color 11, with a clear pixel separating the bar from the
speed arc. The race HUD smoothly eases between acceleration
values with a frame-rate-independent 120 ms response, without changing the car's
physics or measured acceleration.
The number of filled cells is proportional to the car's acceleration or braking limit.

For TypeScript HUDs, `Car.acceleration` is the signed change in speed in
pixels/second squared. The optional sixth argument to `drawSpeedometer` is that
acceleration divided by the car's acceleration limit for positive values, or its
deceleration limit for negative values; the display clamps it to -1 through 1.

Set a [car logo](set-car-logo.md) before starting the race. Use
[start racing game](start-game.md) instead if you want players to choose from
the Race, Train AI, and View AI menus.
