# Race on a track

Start a single race directly, without opening the game menu. Choose Australia, Great Britain,
Italy, Monaco, Netherlands, or USA, **1-4 laps**, and **player** or **AI** in the
driver dropdown. The default is **player**, so existing programs keep their
normal controls. This block keeps three
opponents and Fast speed; the game menu offers configurable race options.

```sig
racing.raceOnTrack(racing.Track.Monaco, 1, racing.RaceDriver.Player)
```

## Example

```blocks
racing.raceOnTrack(racing.Track.Monaco, 2, racing.RaceDriver.Player)
```

## Watch an AI race

Choose **AI** to let a trained AI drive the followed car for the selected number
of laps, with the same opponents, countdown, instruments, and results screen.
If only one AI is trained, it starts automatically. If more than one is trained,
a menu lists only the trained AIs so you can choose one. Use Up/Down to select
an AI and A to start the race; B does not cancel this block's picker.
The game menus still support B to go back.
Press B during an AI race to return, even if the AI gets stuck.

```blocks
racing.raceOnTrack(racing.Track.Monaco, 2, racing.RaceDriver.AI)
```

If no AI is trained, a styled **TRAIN AI** message explains that you must use a
training block first. Press A (**OK**) to dismiss the message; no race starts,
and the program continues with the next block. It never falls back to the game
menu or repeats the race. Use
[teach AI by driving one lap](../ai/docs/teach-driver.md) before this block to
train an AI first. Unsaved AIs trained in the current session can race too.

Watching never adds training examples or changes the player's saved race
records. AI results show lap times and placement without new-best markers.

## Player racing

The player drives with the normal racing controls and instruments. Completed-lap
timers stack above the position indicator on the right. A pink chevron centered
20 pixels ahead of the car uses two thick lines meeting at 80 degrees,
with a sharp mitered point, a single-pixel color-12 outer contour, and no trailing dots. Its corner points in
the player's movement direction, or their heading when stopped.
Any trained
saved bots join the race without learning new examples. The starting countdown
uses the outlined racing font with white letters and a color-12 outline,
displaying `3`, `2`, `1`, then `GO`. After the player finishes
the race, results remain visible until the heading and every timing row finish
animating. The `Press A` prompt then alternates between white and color 12.
Release the driving buttons, then
press A to continue. Holding A
through the finish or pressing it during the animation does not dismiss the
results. After A is released, the race scene closes and the program continues
with the next block.

The centered `RESULTS` title uses the racing font; the remaining text uses
Fancy Text's geometric sans fonts, with centered ordinal placements such as
`1st Place!` (with an exclamation point only for first place) and shared
columns for lap labels, times, and new-best markers. Time digits occupy equal
measured-width cells, keeping minutes, seconds, hundredths, colons, and decimal
points aligned between every lap and the total, even when their minute counts
have different lengths.
Each text row has its own rounded black background without a border. There is
no shared panel, leaving the ongoing race visible around and between the rows.

Race positions prioritize completed laps and checkpoints, then progress from
the last completed checkpoint toward the next. Cars waiting behind the starting
line do not count as nearly a lap ahead, and crossing checkpoints does not reset
their progress when the nearest road segment changes.

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
