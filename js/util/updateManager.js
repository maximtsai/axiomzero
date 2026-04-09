/**
 * @fileoverview Per-frame update loop. Register callbacks to run every frame.
 * Pauses when GAME_VARS.timeScale < 0.01.
 * @module updateManager
 */

class UpdateManager {
    constructor() {
        this.listOfFunctions = [];
    }

    /** Called by Phaser's update(). Runs all registered callbacks. @param {number} delta */
    update(delta) {
        // Todo: kinda hacky way of pausing game
        if (GAME_VARS.timeScale < 0.01) {
            return;
        }

        const scaledDelta = delta * GAME_VARS.timeScale;

        for (let i = 0; i < this.listOfFunctions.length; i++) {
            try {
                this.listOfFunctions[i](scaledDelta);
            } catch (e) {
                console.error('Error in UpdateManager function:', e);
            }
        }
    }

    /** Register a function to run every frame (no-ops if already registered). @param {Function} func */
    addFunction(func) {
        // first check if the function already exists
        for (let i = 0; i < this.listOfFunctions.length; i++) {
            if (func === this.listOfFunctions[i]) {
                return;
            }
        }
        this.listOfFunctions.push(func);
        return func;
    }

    /** Unregister a previously added function. @param {Function} func */
    removeFunction(func) {
        for (let i = 0; i < this.listOfFunctions.length; i++) {
            if (func === this.listOfFunctions[i]) {
                this.listOfFunctions.splice(i, 1);
                break;
            }
        }
    }
}

const updateManager = new UpdateManager();
