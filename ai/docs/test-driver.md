# Watch a trained AI

Reset a second car to the start and let the trained model attempt one lap.

From the starting menu, **View AI** opens the selected bot's steering/pedal
graphs. Press A there and choose **Watch a lap** to run that bot on the track
it was trained on, or **Watch another track** to choose a different course.
The picker includes the six regular maps and Test Track, excluding the bot's
training track. Back from the picker returns to the action menu without starting
a watch. The watch ends after a lap or its time limit; B returns early.
It returns to the graphs without changing the saved model or its training-track
metadata. A model may struggle on an unfamiliar course. **Back** from the
action menu returns to the starting menu.

From TypeScript, an optional course chooses the watch track:

```typescript
aiRacing.watchBotLap(0, racing.getCourses()[3]) // Watch Bot 1 on Monaco
```

For a TypeScript-only single-lap lesson and attempt, teach the model first:

```typescript
aiRacing.teachDriver()
aiRacing.testDriver()
```

For each decision, the AI finds the five most similar stored driving situations.
Steering emphasizes road position and aiming angle. Pedals emphasize speed,
approaching bends, and terrain: a stopped car should not copy a moving car's
coasting just because their positions match. Off-road and reverse comparisons
also include road position, heading, and aiming angle to distinguish continuing
to back up from ending a recovery. Closer examples receive stronger
votes. It chooses **left / straight / right** and **accelerate / brake / reverse /
coast** separately, then uses the same control flags and physics as your car.

This is imitation learning, not a scripted waypoint driver. The road geometry
helps it observe the situation; it does not supply steering commands. There is
no automatic rescue driver when the AI makes a mistake.

## Ending the attempt

The attempt ends after one lap or when its time limit is reached. The limit is
the longer of three minutes or 1.5 times your teaching time. There is no manual
finish-early shortcut. Only one attempt runs automatically.

The report shows elapsed time, on-road percentage, and checkpoints reached.
An incomplete attempt is not presented as a completed lap. Predictions and
results do not add training examples.

## Limits and experiments

- The prototype records up to 2,400 examples. Regular samples cover roughly four
  minutes, but frequent pedal changes fill the buffer sooner. Beyond that, the
  oldest examples are replaced.
- Training stays in memory across menu choices and is saved by bot slot. A
  successfully saved slot is restored after restart; an unsaved `*` slot is
  session-only. Menu races never retrain it.
- Clean racing laps rarely teach reversing. Include a recovery demonstration
  if you want the model to learn that action.
- Try changing the similarity weights in [driver.ts](../driver.ts). Does giving
  heading more importance improve corners or make the car weave?
- Smaller neighbour counts copy individual examples more closely; larger
  counts smooth decisions but may hide brief braking or recovery actions.

For TypeScript experiments, `aiRacing.addRacer(colorIndex)` creates another racer
using the same examples and car stats. Color indices are 0 through 6. Each car
keeps its own checkpoint progress and decision timer. This prototype does not
add overtaking or collision-avoidance training.
