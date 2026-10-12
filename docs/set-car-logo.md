# Set car logo

Draw an **8x8** sponsor badge in the block's image editor and stamp it on the
player's car. Transparent pixels leave the car visible underneath.

```sig
racing.setCarLogo(img`
    . . . . . . . .
    . . . . . . . .
    . . . . . . . .
    . . . . . . . .
    . . . . . . . .
    . . . . . . . .
    . . . . . . . .
    . . . . . . . .
`)
```

## Example

Design your own badge, then put the logo block before starting the game:

```blocks
racing.setCarLogo(img`
    . . 2 2 2 2 . .
    . 2 . . . . 2 .
    2 . . 2 2 . . 2
    2 . 2 . . 2 . 2
    2 . 2 2 2 2 . 2
    2 . 2 . . 2 . 2
    . 2 . . . . 2 .
    . . 2 2 2 2 . .
`)
racing.startGame()
```

If you name the image `raceLogo` in the image editor, TypeScript can also use
``racing.setCarLogo(assets.image`raceLogo`)``.

The logo rotates with the car's four poses and is kept inside its existing
silhouette. It appears during racing and human AI training, not on AI opponents.
It does not change speed, handling, collision shape, or the road sensors.

The drawing is copied: editing the original image afterward does not change
the badge until you call the block again. Replacing the logo takes effect on
the next player-car frame update. An entirely transparent 8x8 image removes it.
Images with other dimensions are rejected.

The logo lives in your program, not in the bot's settings buffer.
