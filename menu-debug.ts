namespace racing {
    let menuSequence: string[] = [];
    let menuSequenceIndex = 0;
    let repeatSequence = false;
    let skipPrompts = false;

    export function configureMenuTest(sequence: string[], repeat: boolean, skip: boolean): void {
        menuSequence = sequence.slice();
        menuSequenceIndex = 0;
        repeatSequence = repeat;
        skipPrompts = skip;
    }

    /** Undefined means normal interaction; -1 means the scripted Back choice. */
    export function scriptedMenuChoice(title: string, choices: string[], allowBack: boolean): number {
        if (menuSequenceIndex >= menuSequence.length) {
            if (!repeatSequence || !menuSequence.length) return undefined;
            menuSequenceIndex = 0;
        }
        const token = menuSequence[menuSequenceIndex++].trim().toLowerCase();
        if (token === "manual") return undefined;
        if (token === "back" || token === "cancel") {
            if (!allowBack) throw "Back is not available in " + title;
            return -1;
        }
        let found = -1;
        for (let i = 0; i < choices.length; i++) {
            const choice = choices[i].toLowerCase();
            if (choice === token || choice.substr(0, token.length + 1) === token + ":") {
                if (found >= 0) throw "Ambiguous menu test choice '" + token + "' in " + title;
                found = i;
            }
        }
        if (found < 0) throw "Menu test choice '" + token + "' is not in " + title + ": " + choices.join(", ");
        console.log("Menu test: " + title + " -> " + choices[found]);
        return found;
    }

    export function skipTestPrompts(): boolean {
        return skipPrompts;
    }
}
