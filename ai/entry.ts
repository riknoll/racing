namespace aiRacing {
    let running = false;

    /** Run one AI lesson in its own scene, then return to the original racing demo. */
    export function runActivity(): void {
        if (running) throw "The AI racing activity is already running";
        running = true;
        game.pushScene();
        try {
            teachDriver();
            testDriver();
            while (controller.A.isPressed() || controller.B.isPressed() || controller.up.isPressed()) pause(20);
        } finally {
            disposeActivity();
            game.popScene();
            running = false;
        }
    }
}
