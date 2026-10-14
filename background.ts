namespace racing {
    let tilesets = [
        [
            img`
                5 7 5 7 7 7 7 7 7 7 7 7 7 7 7 7
                7 7 7 7 7 7 7 7 7 7 7 7 7 1 7 7
                7 7 7 1 1 7 7 7 7 7 7 7 1 7 1 7
                7 7 3 1 1 3 7 7 7 5 7 7 6 1 6 7
                7 1 1 6 6 1 1 7 7 5 7 7 7 7 7 7
                7 D 1 7 7 1 D 7 7 6 7 7 7 7 7 7
                7 6 3 1 1 3 6 7 7 7 7 5 7 7 7 7
                7 7 6 D D 6 7 7 7 7 5 5 6 7 7 7
                7 7 7 7 7 7 7 1 7 7 5 6 7 7 7 7
                7 7 7 7 7 7 1 7 1 7 7 7 1 1 7 7
                7 7 1 7 7 7 6 1 6 7 7 3 1 1 3 7
                7 1 7 1 7 7 7 7 7 7 1 1 6 6 1 1
                7 6 1 6 7 7 7 7 7 7 D 1 7 7 1 D
                7 7 7 7 7 7 7 7 7 7 6 3 1 1 3 6
                7 7 7 7 7 7 7 7 7 7 7 6 D D 6 7
                7 7 5 7 7 7 7 7 7 7 7 7 7 7 7 7
            `,
            img`
                7 7 7 7 5 7 7 7 7 7 7 7 7 7 7 7
                7 7 5 7 5 5 7 7 7 7 7 7 7 7 7 7
                7 6 5 5 7 5 7 5 5 7 7 7 7 7 7 7
                7 7 6 5 7 7 5 5 6 7 7 7 7 7 7 7
                7 7 7 6 7 7 5 6 7 7 7 7 7 7 7 7
                7 7 7 7 7 7 7 7 7 7 7 7 5 7 7 7
                7 7 7 7 7 7 7 7 7 7 7 7 5 7 7 7
                7 7 7 7 7 7 7 7 7 7 7 7 6 7 7 7
                7 7 7 7 7 7 7 7 7 7 7 7 7 7 7 7
                7 7 7 7 7 7 7 7 7 7 7 7 7 7 7 7
                7 7 7 5 7 7 7 7 7 7 7 7 7 7 7 7
                7 7 7 5 7 7 7 7 7 7 7 7 7 7 7 7
                7 7 7 6 7 7 7 7 7 7 7 7 7 7 7 7
                7 7 7 7 7 7 7 7 7 7 7 7 7 5 7 7
                7 7 7 7 7 7 7 7 7 7 7 7 7 7 7 7
                7 7 7 7 7 7 7 7 7 7 7 7 7 7 7 7
            `,
            img`
                5 7 5 7 7 7 7 7 7 7 7 7 7 7 7 7
                7 7 7 7 7 7 7 7 7 7 7 7 7 7 7 7
                7 7 7 7 7 7 7 7 7 7 7 7 7 7 7 7
                7 7 7 7 7 5 7 7 7 7 7 7 7 7 7 7
                7 7 7 5 7 5 5 7 7 7 7 7 5 7 7 7
                7 7 6 5 5 7 5 7 5 5 7 7 7 7 7 7
                7 7 7 6 5 7 7 5 5 6 7 7 7 7 7 7
                7 7 7 7 6 7 7 5 6 7 7 7 7 7 7 7
                7 7 7 7 7 7 7 7 7 7 7 7 7 7 7 7
                7 7 5 7 7 7 7 7 7 7 7 7 7 7 7 7
                7 7 7 7 7 7 7 7 7 7 7 5 5 7 7 7
                7 7 7 7 7 7 7 7 7 7 5 5 6 7 7 7
                7 7 7 7 7 7 7 7 5 5 7 6 7 7 7 7
                7 7 7 7 7 7 7 7 7 5 5 7 7 7 7 7
                7 7 7 7 7 7 7 7 7 7 7 7 7 7 7 5
                7 7 5 7 7 7 7 7 7 7 7 7 7 7 7 5
            `,
            img`
                7 7 7 7 7 7 7 7 7 7 7 7 7 7 7 7
                7 7 7 7 7 7 7 7 7 7 7 7 7 7 7 7
                7 7 7 7 7 7 7 7 7 7 7 7 7 7 7 7
                7 7 7 7 7 7 7 7 7 7 7 7 7 7 7 7
                7 7 7 7 7 7 7 7 7 7 7 7 7 7 7 7
                7 7 7 7 7 7 7 7 7 7 7 7 7 7 7 7
                7 7 7 7 7 7 7 7 7 7 7 7 7 7 7 7
                7 7 7 7 7 7 7 7 7 7 7 7 7 7 7 7
                7 7 7 7 7 7 7 7 7 7 7 7 7 7 7 7
                7 7 7 7 7 7 7 7 7 7 7 7 7 7 7 7
                7 7 7 7 7 7 7 7 7 7 7 7 7 7 7 7
                7 7 7 7 7 7 7 7 7 7 7 7 7 7 7 7
                7 7 7 7 7 7 7 7 7 7 7 7 7 7 7 7
                7 7 7 7 7 7 7 7 7 7 7 7 7 7 7 7
                7 7 7 7 7 7 7 7 7 7 7 7 7 7 7 7
                7 7 7 7 7 7 7 7 7 7 7 7 7 7 7 7
            `,
        ],
        [
            img`
                7 6 7 6 6 6 6 6 6 6 6 6 6 6 6 6
                6 6 6 6 6 6 6 6 6 6 6 6 6 1 6 6
                6 6 6 1 1 6 6 6 6 6 6 6 1 6 1 6
                6 6 3 1 1 3 6 6 6 7 6 6 8 1 8 6
                6 1 1 8 8 1 1 6 6 7 6 6 6 6 6 6
                6 D 1 6 6 1 D 6 6 8 6 6 6 6 6 6
                6 8 3 1 1 3 8 6 6 6 6 7 6 6 6 6
                6 6 8 D D 8 6 6 6 6 7 7 8 6 6 6
                6 6 6 6 6 6 6 1 6 6 7 8 6 6 6 6
                6 6 6 6 6 6 1 6 1 6 6 6 1 1 6 6
                6 6 1 6 6 6 8 1 8 6 6 3 1 1 3 6
                6 1 6 1 6 6 6 6 6 6 1 1 8 8 1 1
                6 8 1 8 6 6 6 6 6 6 D 1 6 6 1 D
                6 6 6 6 6 6 6 6 6 6 8 3 1 1 3 8
                6 6 6 6 6 6 6 6 6 6 6 8 D D 8 6
                6 6 7 6 6 6 6 6 6 6 6 6 6 6 6 6
            `,
            img`
                7 6 7 6 6 6 6 6 6 6 6 6 6 6 6 6
                6 6 6 6 6 6 6 6 6 6 6 6 6 6 6 6
                6 6 6 6 6 6 6 6 6 6 6 6 6 6 6 6
                6 6 6 6 6 7 6 6 6 6 6 6 6 6 6 6
                6 6 6 7 6 7 7 6 6 6 6 6 7 6 6 6
                6 6 8 7 7 6 7 6 7 7 6 6 6 6 6 6
                6 6 6 8 7 6 6 7 7 8 6 6 6 6 6 6
                6 6 6 6 8 6 6 7 8 6 6 6 6 6 6 6
                6 6 6 6 6 6 6 6 6 6 6 6 6 6 6 6
                6 6 7 6 6 6 6 6 6 6 6 6 6 6 6 6
                6 6 6 6 6 6 6 6 6 6 6 7 7 6 6 6
                6 6 6 6 6 6 6 6 6 6 7 7 8 6 6 6
                6 6 6 6 6 6 6 6 7 7 6 8 6 6 6 6
                6 6 6 6 6 6 6 6 6 7 7 6 6 6 6 6
                6 6 6 6 6 6 6 6 6 6 6 6 6 6 6 7
                6 6 7 6 6 6 6 6 6 6 6 6 6 6 6 7
            `,
            img`
                6 6 6 6 7 6 6 6 6 6 6 6 6 6 6 6
                6 6 7 6 7 7 6 6 6 6 6 6 6 6 6 6
                6 8 7 7 6 7 6 7 7 6 6 6 6 6 6 6
                6 6 8 7 6 6 7 7 8 6 6 6 6 6 6 6
                6 6 6 8 6 6 7 8 6 6 6 6 6 6 6 6
                6 6 6 6 6 6 6 6 6 6 6 6 7 6 6 6
                6 6 6 6 6 6 6 6 6 6 6 6 7 6 6 6
                6 6 6 6 6 6 6 6 6 6 6 6 8 6 6 6
                6 6 6 6 6 6 6 6 6 6 6 6 6 6 6 6
                6 6 6 6 6 6 6 6 6 6 6 6 6 6 6 6
                6 6 6 7 6 6 6 6 6 6 6 6 6 6 6 6
                6 6 6 7 6 6 6 6 6 6 6 6 6 6 6 6
                6 6 6 8 6 6 6 6 6 6 6 6 6 6 6 6
                6 6 6 6 6 6 6 6 6 6 6 6 6 7 6 6
                6 6 6 6 6 6 6 6 6 6 6 6 6 6 6 6
                6 6 6 6 6 6 6 6 6 6 6 6 6 6 6 6
            `,
            img`
                6 6 6 6 6 6 6 6 6 6 6 6 6 6 6 6
                6 6 6 6 6 6 6 6 6 6 6 6 6 6 6 6
                6 6 6 6 6 6 6 6 6 6 6 6 6 6 6 6
                6 6 6 6 6 6 6 6 6 6 6 6 6 6 6 6
                6 6 6 6 6 6 6 6 6 6 6 6 6 6 6 6
                6 6 6 6 6 6 6 6 6 6 6 6 6 6 6 6
                6 6 6 6 6 6 6 6 6 6 6 6 6 6 6 6
                6 6 6 6 6 6 6 6 6 6 6 6 6 6 6 6
                6 6 6 6 6 6 6 6 6 6 6 6 6 6 6 6
                6 6 6 6 6 6 6 6 6 6 6 6 6 6 6 6
                6 6 6 6 6 6 6 6 6 6 6 6 6 6 6 6
                6 6 6 6 6 6 6 6 6 6 6 6 6 6 6 6
                6 6 6 6 6 6 6 6 6 6 6 6 6 6 6 6
                6 6 6 6 6 6 6 6 6 6 6 6 6 6 6 6
                6 6 6 6 6 6 6 6 6 6 6 6 6 6 6 6
                6 6 6 6 6 6 6 6 6 6 6 6 6 6 6 6
            `,
        ],
        [
            img`
                D D D D D D D D D D D D D D D D
                D D D 1 1 D D D D D D D D B D D
                D D D 1 1 D D D D D D D D D D D
                D D D D D D D D D D D D D D D D
                D D B D D D D D D B B D D D D D
                D D D D D D D D D B B D D D D D
                D D D D D D D D D D D D D D D D
                D D D D D D D D D D D D D D D D
                D D D D D B D D D D D D D D D D
                D D D D D D D D D D D D D D D D
                D D D D D D D D D D D D D D D D
                1 1 D D D D D D D D D D D D D D
                1 1 D D D D D D D D D D B D D D
                D D D D D D 1 D D D D D D D D D
                D D D D D D D D D D D D D D D D
                D D D D D D D D D D D D D D B D
            `,
            img`
                D D D D D D D D D D D D D D D D
                D D D 1 1 D D D D D D D D B D D
                D D D 1 1 D D D D D D D D D D D
                D D D D D D D D D D D D D D D D
                D D B D D D D 1 D D D D D D D D
                D D D D D 1 D 1 1 D D D D D D D
                D D D D B 1 1 D 1 D 1 1 D D D D
                D D D D D B 1 D D 1 1 B D D D D
                D D 1 D D D B D D 1 B D D D D D
                D D 1 D D D D D D D D D D D D D
                D D B D D D D D D D D D D D 1 D
                D D D D D D D D D D D D D D 1 D
                D D D D D D D D D D D D B D B D
                D D D D D D 1 D D D D D D D D D
                D D D D D D D D D D D D D D D D
                D D D D D D D D D D D D D D B D
            `,
            img`
                D D D D D D D D D D D D D D D D
                D D D D D D D D D D D D D D D D
                D D D D D D D D D D D D D D D D
                D D D D D D D D D D D D D D D D
                D D D D D D D D D D D D D D D D
                D D D D D D D D D D D D D D D D
                D D D D D D D D D D D D D D D D
                D D D D D D D D D D D D D D D D
                D D D D D D D D D D D D D D D D
                D D D D D D D D D D D D D D D D
                D D D D D D D D D D D D D D D D
                D D D D D D D D D D D D D D D D
                D D D D D D D D D D D D D D D D
                D D D D D D D D D D D D D D D D
                D D D D D D D D D D D D D D D D
                D D D D D D D D D D D D D D D D
            `,
            img`
                B D B D D D D D D D D D D D D D
                D D D D D D D D D D D D D 1 D D
                D D D 1 1 D D D D D D D 1 D 1 D
                D D 3 1 1 3 D D D B D D D 1 D D
                D 1 1 D D 1 1 D D B D D D D D D
                D B 1 D D 1 B D D D D D D D D D
                D D 3 1 1 3 D D D D D B D D D D
                D D D B B D D D D D B B D D D D
                D D D D D D D 1 D D B D D D D D
                D D D D D D 1 D 1 D D D 1 1 D D
                D D 1 D D D D 1 D D D 3 1 1 3 D
                D 1 D 1 D D D D D D 1 1 D D 1 1
                D D 1 D D D D D D D B 1 D D 1 B
                D D D D D D D D D D D 3 1 1 3 D
                D D D D D D D D D D D D B B D D
                D D B D D D D D D D D D D D D D
            `,
        ],
        [
            img`
                D 1 1 1 1 1 1 B D 1 1 1 1 1 1 B
                1 D D D D D D B 1 D D D D D D B
                1 D D D D D D B 1 D D D D D D B
                1 D D D D D D B 1 D D D D D D B
                1 D D D D D D B 1 D D D D D D B
                1 D D D D D D B 1 D D D D D D B
                1 D D D D D D D 1 D D D D D D D
                B B B B B B D E B B B B B B D E
                D 1 1 1 1 1 1 B D 1 1 1 1 1 1 B
                1 D D D D D D B 1 D D D D D D B
                1 D D D D D D B 1 D D D D D D B
                1 D D D D D D B 1 D D D D D D B
                1 D D D D D D B 1 D D D D D D B
                1 D D D D D D B 1 D D D D D D B
                1 D D D D D D D 1 D D D D D D D
                B B B B B B D E D B B B B B B E
            `,
            img`
                D 1 1 1 1 1 1 B D 1 1 1 1 1 1 B
                1 D D D D D D B 1 D D D D D B B
                1 D D D D D D B 1 D D D D B D B
                1 D D D D D D B 1 D D D 1 1 D B
                1 D D D D D D B 1 D D B D D D B
                1 D D D D D D B 1 D B B D D D B
                1 D D D D D D D 1 D B B D D D D
                B B B B B B D E B B B B B B D E
                D 1 1 1 1 1 1 B D 1 1 1 1 1 1 B
                1 D D D D D D B 1 D D D D D D B
                1 D D D D D D B 1 D D D D D D B
                1 D D D D D D B 1 D D D D D D B
                1 D D D D D B B 1 D D D D D D B
                1 D D D D B B B 1 D D D D D D B
                1 D D D D B B D 1 D D D D D D D
                B B B B B B B E B B B B B B B E
            `,
            img`
                D 1 1 1 1 1 1 B D 1 1 1 1 1 1 B
                1 D D D D D D B 1 D D D D D D B
                1 D D D D D 6 B 1 D D D D D D B
                1 D D D D D D 6 1 D D D D D D B
                1 D D D D D D 6 1 D D D D D D B
                1 D D 6 D D D B 1 D D D D D D B
                1 6 6 D D D D D 1 D D D D D D D
                B B 6 B B B 6 B 6 B 6 B B B D E
                D 1 1 1 1 D B 6 6 6 1 1 1 1 1 B
                1 D D D D D D E 6 1 D D D D D B
                1 D D D D D D E E D D D D D D B
                1 D D D D D D E B D D D D D B B
                1 D D D D D D B 1 D D D B D D B
                1 D D D D D D B 1 D D D B D D B
                1 D D D D D D D 1 D D B D D D D
                B B B B B B D E D B B B B B B E
            `,
            img`
                D 1 1 1 1 1 1 B D 1 1 1 1 1 1 B
                1 D D D D D D B 1 D D D D D D B
                1 D D D D D D B 1 D D D D D D B
                1 D D D D D D B 1 D D D D D D B
                1 D D D D D D B 1 D D D D D D B
                1 D D D D D D B 1 D D D D D D B
                1 D D D D D D D 1 D D D D D D D
                B B B B B B D E B B B B B B D E
                B D 1 1 1 1 1 1 B D 1 1 1 1 1 B
                B 1 D D D D D D B 1 D D D D D B
                B 1 D D D D D D B 1 D D D D D B
                B 1 D D D D D D B D D D D D D B
                B 1 D D D D D B 1 D D D D D D B
                B 1 D D D D D B 1 D D D D D D B
                B 1 D D D D D B D D D D D D D D
                B B B B B B B D E D B B B B B E
            `,
            img`
                D 1 1 1 1 B 1 1 1 1 1 1 1 1 1 B
                1 D D D D D B D D D D D D D D B
                1 D D D D D B D D D D D D D D B
                1 D D D D D D B D D D D D D D B
                1 D D D D D D B D D D D D D D B
                1 D D D D D D B D D D D D D D B
                1 D D D D D D D B D D D D D D B
                1 D D D D D D D D B D D D D D B
                1 D D D D D D D D B D D D D D B
                1 D D D D D D D B 1 B B D D D B
                1 D D D D D D D B 1 D D B B D B
                1 D D D D D D B 1 D D D D D B B
                1 D D D D D B B 1 D D D D D D B
                1 D D D D D B 1 D D D D D D D B
                1 D D D D B B 1 D D D D D D D B
                B B B B B B B B B B B B B B B B
            `,
            img`
                D 1 1 1 1 1 1 1 1 1 1 1 1 1 1 B
                1 D D D D D D D D D D D D D D B
                1 D D D D D D D D D D D D D D B
                1 D D D D D D D D D D D D D D B
                1 D D D D D D D D D D D D D D B
                1 D D D D D D D D D D D D D D B
                1 D D D D D D D D D D D D D D B
                1 D D D D D D D D D D D D D D B
                1 D D D D D D D D D D D D D D B
                1 D D D D D D D D D D D D D D B
                1 D D D D D D D D D D D D D D B
                1 D D D D D D D D D D D D D D B
                1 D D D D D D D D D D D D D D B
                1 D D D D D D D D D D D D D D B
                1 D D D D D D D D D D D D D D B
                B B B B B B B B B B B B B B B B
            `,
            img`
                D 1 1 1 1 1 1 B D 1 1 1 1 1 1 B
                1 D D D D D D B 1 D D D D D D B
                1 D D D D D D B 1 D D D D D D B
                1 D D D D D D B 1 D D D D D B B
                1 D D D D D D B 1 D D B B B C C
                1 D D D D D D D B B B C C C C C
                1 D D D D D D E B C 1 C C C C C
                B B B B B B E C C 1 D D C C C C
                C C C 1 C C C C C 1 D D C C C C
                C C C 1 1 C C C C C 1 D D C C C
                C C C 1 D D C C C C 1 D D C C C
                C C 1 D D D C C C C C D D D C C
                C C 1 D D D D C C C C D D B C C
                C C 1 D D D D D C C C B B C C C
                C C C B B B D D D B C C C C C C
                C C C C C C B B B C C C C C C C
            `,
        ],
        [
            img`
                B D D D D D D C B D D D D D D C
                D B B B B B B C D B B B B B B C
                D B B B B B B C D B B B B B B C
                D B B B B B B C D B B B B B B C
                D B B B B B B C D B B B B B B C
                D B B B B B B C D B B B B B B C
                D B B B B B B B D B B B B B B B
                C C C C C C B A C C C C C C B A
                B D D D D D D C B D D D D D D C
                D B B B B B B C D B B B B B B C
                D B B B B B B C D B B B B B B C
                D B B B B B B C D B B B B B B C
                D B B B B B B C D B B B B B B C
                D B B B B B B C D B B B B B B C
                D B B B B B B B D B B B B B B B
                C C C C C C B A B C C C C C C A
            `,
            img`
                B D D D D D D C B D D D D D D C
                D B B B B B B C D B B B B B C C
                D B B B B B B C D B B B B C B C
                D B B B B B B C D B B B D D B C
                D B B B B B B C D B B C B B B C
                D B B B B B B C D B C C B B B C
                D B B B B B B B D B C C B B B B
                C C C C C C B A C C C C C C B A
                B D D D D D D C B D D D D D D C
                D B B B B B B C D B B B B B B C
                D B B B B B B C D B B B B B B C
                D B B B B B B C D B B B B B B C
                D B B B B B C C D B B B B B B C
                D B B B B C C C D B B B B B B C
                D B B B B C C B D B B B B B B B
                C C C C C C C A C C C C C C C A
            `,
            img`
                B D D D D D D C C D D D D D D C
                D B B B B B C D D C B B B B B C
                D B B B B C D B B B C B B B B C
                D B B B C D B B B B B C B B B C
                D B B C D B B B B B B B C B B C
                D B C D B B B B B B B B B C B C
                D C D B B B B B B B B B B B C B
                C D B B B B B B B B B B B B B C
                C D B B B B B B B B B B B B C D
                D C B B B B B B B B B B B C D C
                D B C B B B B B B B B B C D B C
                D B B C B B B B B B B C D B B C
                D B B B C B B B B B C D B B B C
                D B B B B C B B B C D B B B B C
                D B B B B B C B C D B B B B B C
                C C C C C C B C D C C C C C C A
            `,
            img`
                B D D D D D D D D D D D D D D C
                D B B B B B B B B B B B B B B C
                D B B B B B B B B B B B B B B C
                D B B B B B B B B B B B B B B C
                D B B B B B B B B B B B B B B C
                D B B B B B B B B B B B B B B C
                D B B B B B B B B B B B B B B C
                D B B B B B B B B B B B B B B C
                D B B B B B B B B B B B B B B C
                D B B B B B B B B B B B B B B C
                D B B B B B B B B B B B B B B C
                D B B B B B B B B B B B B B B C
                D B B B B B B B B B B B B B B C
                D B B B B B B B B B B B B B B C
                D B B B B B B B B B B B B B B C
                C C C C C C C C C C C C C C C A
            `,
            img`
                B D D D D D D C B D D D D D D C
                D B B B B B B C D B B B B B C C
                D B B B B B B C D B B B B C B C
                D B B B B B B C D B B B D D B C
                D B B B B B B C D B B C B B B C
                D B B B B B B C D B C C B B B C
                D B B B B B B B D B C C B B B B
                C C C C C C B A C C C C C C B A
                B D D D D D D C B D D D D D D C
                D B B B B B B C D B B B B B B C
                D B B B B B B C D B B B B B B C
                D B B B B B B C D B B B B B B C
                D B B B B B C C D B B B B B B C
                D B B B B C C C D B B B B B B C
                D B B B B C C B D B B B B B B B
                C C C C C C C A C C C C C C C A
            `,
            img`
                B D D D D C D D D D D D D D D C
                D B B B B B C B B B B B B B B C
                D B B B B B C B B B B B B B B C
                D B B B B B B C B B B B B B B C
                D B B B B B B C B B B B B B B C
                D B B B B B B C B B B B B B B C
                D B B B B B B B C B B B B B B C
                D B B B B B B B B C B B B B B C
                D B B B B B B B B C B B B B B C
                D B B B B B B B C D C C B B B C
                D B B B B B B B C D B B C C B C
                D B B B B B B C D B B B B B C C
                D B B B B B C C D B B B B B B C
                D B B B B B C D B B B B B B B C
                D B B B B C C D B B B B B B B C
                C C C C C C C C C C C C C C C A
            `,
            img`
                B D D D D D D C B D D D D D D C
                D B B B B B B C D B B B B B B C
                D B B B B B B C D B B B B B B C
                D B B B B B B C D B B B B B C C
                D B B B B B B C D B B C C C C C
                D B B B B B B B C C C C C C C C
                D B B B B B B A C C D C C C C C
                C C C C C C A C C D B B C C C C
                C C C D C C C C C D B B C C C C
                C C C D D C C C C C D B B C C C
                C C C D B B C C C C D B B C C C
                C C D B B B C C C C C B B B C C
                C C D B B B B C C C C B B C C C
                C C D B B B B B C C C C C C C C
                C C C C C C B B B C C C C C C C
                C C C C C C C C C C C C C C C C
            `,
        ],
        [
            img`
                D 4 D 4 4 4 4 4 4 4 4 4 4 4 4 4
                4 4 4 4 4 4 4 4 4 4 4 4 4 4 4 4
                4 4 4 4 4 4 4 4 4 4 4 4 4 4 4 4
                4 4 4 4 4 D 4 4 4 4 4 4 4 4 4 4
                4 4 4 D 4 D D 4 4 4 4 4 D 4 4 4
                4 4 E D D 4 D 4 D D 4 4 4 4 4 4
                4 4 4 E D 4 4 D D E 4 4 4 4 4 4
                4 4 4 4 E 4 4 D E 4 4 4 4 4 4 4
                4 4 4 4 4 4 4 4 4 4 4 4 4 4 4 4
                4 4 D 4 4 4 4 4 4 4 4 4 4 4 4 4
                4 4 4 4 4 4 4 4 4 4 4 D D 4 4 4
                4 4 4 4 4 4 4 4 4 4 D D E 4 4 4
                4 4 4 4 4 4 4 4 D D 4 E 4 4 4 4
                4 4 4 4 4 4 4 4 4 D D 4 4 4 4 4
                4 4 4 4 4 4 4 4 4 4 4 4 4 4 4 D
                4 4 D 4 4 4 4 4 4 4 4 4 4 4 4 D
            `,
            img`
                4 4 4 4 D 4 4 4 4 4 4 4 4 4 4 4
                4 4 D 4 D D 4 4 4 4 4 4 4 4 4 4
                4 E D D 4 D 4 D D 4 4 4 4 4 4 4
                4 4 E D 4 4 D D E 4 4 4 4 4 4 4
                4 4 4 E 4 4 D E 4 4 4 4 4 4 4 4
                4 4 4 4 4 4 4 4 4 4 4 4 D 4 4 4
                4 4 4 4 4 4 4 4 4 4 4 4 D 4 4 4
                4 4 4 4 4 4 4 4 4 4 4 4 E 4 4 4
                4 4 4 4 4 4 4 4 4 4 4 4 4 4 4 4
                4 4 4 4 4 4 4 4 4 4 4 4 4 4 4 4
                4 4 4 D 4 4 4 4 4 4 4 4 4 4 4 4
                4 4 4 D 4 4 4 4 4 4 4 4 4 4 4 4
                4 4 4 E 4 4 4 4 4 4 4 4 4 4 4 4
                4 4 4 4 4 4 4 4 4 4 4 4 4 D 4 4
                4 4 4 4 4 4 4 4 4 4 4 4 4 4 4 4
                4 4 4 4 4 4 4 4 4 4 4 4 4 4 4 4
            `,
            img`
                D 4 D 4 4 4 4 4 4 4 4 4 4 4 4 4
                4 4 4 4 4 4 4 4 4 4 4 4 4 D 4 4
                4 4 4 D D 4 4 4 4 4 4 4 D 4 D 4
                4 4 5 D D 5 4 4 4 D 4 4 E D E 4
                4 D D E E D D 4 4 D 4 4 4 4 4 4
                4 B D 4 4 D B 4 4 E 4 4 4 4 4 4
                4 E 5 D D 5 E 4 4 4 4 D 4 4 4 4
                4 4 E B B E 4 4 4 4 D D E 4 4 4
                4 4 4 4 4 4 4 D 4 4 D E 4 4 4 4
                4 4 4 4 4 4 D 4 D 4 4 4 D D 4 4
                4 4 D 4 4 4 E D E 4 4 5 D D 5 4
                4 D 4 D 4 4 4 4 4 4 D D E E D D
                4 E D E 4 4 4 4 4 4 B D 4 4 D B
                4 4 4 4 4 4 4 4 4 4 E 5 D D 5 E
                4 4 4 4 4 4 4 4 4 4 4 E B B E 4
                4 4 D 4 4 4 4 4 4 4 4 4 4 4 4 4
            `,
            img`
                4 4 4 4 4 4 4 4 4 4 4 4 4 4 4 4
                4 4 4 4 4 4 4 4 4 4 4 4 4 4 4 4
                4 4 4 4 4 4 4 4 4 4 4 4 4 4 4 4
                4 4 4 4 4 4 4 4 4 4 4 4 4 4 4 4
                4 4 4 4 4 4 4 4 4 4 4 4 4 4 4 4
                4 4 4 4 4 4 4 4 4 4 4 4 4 4 4 4
                4 4 4 4 4 4 4 4 4 4 4 4 4 4 4 4
                4 4 4 4 4 4 4 4 4 4 4 4 4 4 4 4
                4 4 4 4 4 4 4 4 4 4 4 4 4 4 4 4
                4 4 4 4 4 4 4 4 4 4 4 4 4 4 4 4
                4 4 4 4 4 4 4 4 4 4 4 4 4 4 4 4
                4 4 4 4 4 4 4 4 4 4 4 4 4 4 4 4
                4 4 4 4 4 4 4 4 4 4 4 4 4 4 4 4
                4 4 4 4 4 4 4 4 4 4 4 4 4 4 4 4
                4 4 4 4 4 4 4 4 4 4 4 4 4 4 4 4
                4 4 4 4 4 4 4 4 4 4 4 4 4 4 4 4
            `,
        ],
        [
            img`
                3 B B B B B B B 3 C C C C C C 3
                B 1 1 1 1 1 1 D C 3 3 3 3 3 3 1
                B 1 1 1 1 1 1 D C 3 3 3 3 3 3 1
                B 1 1 1 1 1 1 D C 3 3 3 3 3 3 1
                B 1 1 1 1 1 1 D C 3 3 3 3 3 3 1
                B 1 1 1 1 1 1 D C 3 3 3 3 3 3 1
                B 1 1 1 1 1 1 D C 3 3 3 3 3 3 1
                D D D D D D D 3 3 1 1 1 1 1 1 3
                3 C C C C C C 3 3 B B B B B B B
                C 3 3 3 3 3 3 1 B 1 1 1 1 1 1 D
                C 3 3 3 3 3 3 1 B 1 1 1 1 1 1 D
                C 3 3 3 3 3 3 1 B 1 1 1 1 1 1 D
                C 3 3 3 3 3 3 1 B 1 1 1 1 1 1 D
                C 3 3 3 3 3 3 1 B 1 1 1 1 1 1 D
                C 3 3 3 3 3 3 1 B 1 1 1 1 1 1 D
                3 1 1 1 1 1 1 3 D D D D D D D 3
            `,
        ],
    ];


    export function generateBackground() {
        const i = image.create(160, 128);

        const tiles = tilesets[Math.floor(Math.random() * tilesets.length)];

        for (let x = 0; x < 160; x += 16) {
            for (let y = 0; y < 128; y += 16) {
                const tile = tiles[Math.floor(Math.random() * tiles.length)];
                i.drawImage(tile, x, y);
            }
        }
        return i;
    }
}