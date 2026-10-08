# Teach AI by driving one lap

Record a single driving attempt on Monaco. The AI learns from your current road
position and the controls you use, not from a replay of the lap.

```sig
aiRacing.teachDriver()
```

## Controls

- **A / Up:** accelerate.
- **B:** brake.
- **Left / Right:** steer. You can steer while accelerating or braking.
- **Down:** reverse. While moving forward this brakes first, then reverses.

Read the introduction, then press A to start. Completing one circuit of the
ordered checkpoints ends teaching automatically. Like the base race, checkpoint
tracking can advance to the second gate ahead if a corner's first gate was missed.
Examples are recorded about ten times per second and when the pedal action changes,
so a brief brake or acceleration tap is not missed. There is no finish-early
shortcut; Up is recorded as acceleration, just like A.

Try braking before corners. If you leave the road, demonstrate getting back:
brake, reverse while steering if needed, then drive forward. The AI cannot learn
reversing without reverse examples, and it can copy mistakes.

Starting another lesson replaces the previous examples and removes the previous
lesson's cars.

## Your AI's memories

After teaching, an animated dot chart shows the examples actually stored in the
model. **Left/Right** switches between steering and pedal views; **B** opens an
explanation and action counts; **A** continues to the AI attempt.

- Left/right on the chart is the aiming angle toward the road ahead.
- Higher dots mean faster forward speed; the bottom includes stops and reversing.
- Colors and marker shapes identify left/straight/right, or coast/accelerate/brake/reverse.
- Legend numbers count stored examples, not button presses. Steering and pedal
  totals each add up to the number of examples.

This is a two-dimensional view of seven inputs. Small aiming angles are spread
out to make patterns easier to see; extreme values are clipped to the plot.
The animation displays existing memories, not another training step. Viewing
the chart does not change the model.

## Example

```blocks
aiRacing.teachDriver()
aiRacing.testDriver()
```

## Reading the code

1. [track.ts](../track.ts) measures distance from the road centre, heading relative
   to the road, the angle to a point ahead, nearby and upcoming bends, signed speed,
   and off-road state. The point ahead is a sensor, not a steering command.
2. [driver.ts](../driver.ts) saves those observations with your steering and pedal
   actions. Its five-nearest-neighbour model looks for geometry matches for
   steering, and speed/bend/terrain matches for pedals. The two votes let it turn
   and accelerate together without confusing coasting at speed with being stopped.
3. [car.ts](../car.ts) records controls or asks the model for them, then delegates
   to the existing physics in [racer.ts](../../racer.ts).
4. [activity.ts](../activity.ts) connects teaching, testing, and the display.
   [visualization.ts](../visualization.ts) draws the post-training memory chart
   in its own temporary scene.
5. [entry.ts](../entry.ts) starts the activity without replacing the original
   racing demo and returns to it when the activity finishes.

The similarity weights and look-ahead distances are programmed settings.
The choices of driving actions come from your demonstrations.
