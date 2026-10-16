namespace racing.drivingControls {
    export const a = img`
        . . 6 6 6 6 . .
        . 6 6 1 1 6 6 .
        6 6 1 6 6 1 6 6
        6 6 1 6 6 1 6 6
        6 6 1 1 1 1 6 6
        8 6 1 6 6 1 6 8
        . 8 6 6 6 6 8 .
        . . 8 8 8 8 . .
    `;
    export const b = img`
        . . 6 6 6 6 . .
        . 6 1 1 1 6 6 .
        6 6 1 6 6 1 6 6
        6 6 1 1 1 6 6 6
        6 6 1 6 6 1 6 6
        8 6 1 1 1 1 6 8
        . 8 6 6 6 6 8 .
        . . 8 8 8 8 . .
    `;
    export const up = img`
        . . . 1 1 . . .
        . . 1 1 1 1 . .
        . 1 1 1 1 1 1 .
        1 1 1 1 1 1 1 1
        1 1 1 1 1 1 1 1
        . . 1 1 1 1 . .
        . . 1 1 1 1 . .
        . . 1 1 1 1 . .
    `;
    export const down = up.clone();
    down.flipY();
    export const left = img`
        . . . 1 1 . . .
        . . 1 1 1 . . .
        . 1 1 1 1 1 1 1
        1 1 1 1 1 1 1 1
        1 1 1 1 1 1 1 1
        . 1 1 1 1 1 1 1
        . . 1 1 1 . . .
        . . . 1 1 . . .
    `;
    export const right = left.clone();
    right.flipX();
}
