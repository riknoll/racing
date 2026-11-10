# View memories

Open a trained AI's saved driving examples without driving another lap.

```sig
racing.viewMemories()
```

The block restores saved bots automatically, including after a simulator restart.
If one AI is trained, its memories open directly. If more than one is trained,
choose one with Up/Down and press A; B does not cancel the bot picker.
If none is trained, a styled **TRAIN AI** message explains that you must use a
training block first.

The **MEMORIES** chart starts with steering examples. Left/Right switches
between steering and pedal data. Press A (**Done**) or B to close the chart and
continue with the next block. This block never opens the game menu or starts a
race, and viewing does not change training examples or saved data.

## Tutorial steps

Simulator restarts run the program again. For a tutorial's data-reading step,
replace **teach AI by driving one lap** with **view memories** so the saved
examples are displayed without starting training again:

```blocks
racing.viewMemories()
```

Only successfully saved training survives a simulator restart. If saving failed,
the AI remains available in that simulator session only; the training activity
reports the save failure.

Use [teach AI by driving one lap](../ai/docs/teach-driver.md) to collect examples,
then [race on a track](race-on-track.md) to watch a trained AI drive.

```package
racing=github:riknoll/racing
```
