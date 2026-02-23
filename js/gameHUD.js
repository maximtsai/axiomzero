// gameHUD.js
// All Phaser UI for both the upgrade phase and wave phase.
// Responds to phase changes by swapping the active UI layer.
//
// Topics subscribed:
//   'phaseChanged'      — swap between wave HUD and upgrade screen
//   'enemyKilled'       — update kill counter display
//   'upgradePurchased'  — refresh upgrade button states

const gameHUD = (() => {

    function init() {
        messageBus.subscribe('phaseChanged', _onPhaseChanged);
        messageBus.subscribe('enemyKilled', _onEnemyKilled);
        messageBus.subscribe('upgradePurchased', _onUpgradePurchased);
    }

    function _onPhaseChanged(phase) {
        // TODO: swap active UI layer based on phase
    }

    function _onEnemyKilled() {
        // TODO: update kill counter display
    }

    function _onUpgradePurchased(id) {
        // TODO: refresh upgrade button states
    }

    return { init };

})();
