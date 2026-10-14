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

Set a [car logo](set-car-logo.md) before starting the race. Use
[start racing game](start-game.md) instead if you want players to choose from
the Race, Train AI, and View AI menus.
