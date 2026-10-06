// upgradeManager.js
// Holds upgrade definitions and handles purchase logic.
// Does NOT create any Phaser display objects — those live in gameHUD.
//
// Topics published:
//   'upgradePurchased'  — an upgrade was successfully bought (payload: id)

const upgradeManager = (() => {

    function init() {
        // TODO: define upgrade tree, load any persisted state
    }

    function buy(id) {
        // TODO: validate currency, apply upgrade effect, publish 'upgradePurchased'
    }

    return { init, buy };

})();
