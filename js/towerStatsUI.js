// towerStatsUI.js
// Provides a hoverable interaction area over the tower during the Upgrade Phase.
// Displays core tower stats (HP, Damage, Regen, Armor, Range, Choice-Weapons).

const towerStatsUI = (() => {
    let _statsBtn = null;
    let _isActive = false;

    /** Initialized once by tower.js */
    function init() {
        _createButton();
        messageBus.subscribe('phaseChanged', _onPhaseChanged);

        // Hide initially until first upgrade phase
        if (_statsBtn) _statsBtn.setVisible(false);
    }

    function _createButton() {
        const towerPos = tower.getPosition();
        const size = 120; // Hitbox size for the tower hover

        _statsBtn = new Button({
            normal: {
                ref: 'white_pixel', // Invisible base
                x: towerPos.x + 400,
                y: towerPos.y,
                alpha: 0,
                scrollFactorX: 0,
                scrollFactorY: 0
            },
            onHover: () => {
                const isSuppressed = (typeof GAME_VARS !== 'undefined' && GAME_VARS.testingDefenses);
                if (_isActive && !isSuppressed) {
                    _showStatsTooltip();
                    upgradeTree.setHoverLabel(t('tower_stats', 'title'));
                }
            },
            onHoverOut: () => {
                tooltipManager.hide();
                upgradeTree.setHoverLabel(null);
            }
        });

        // Set dimensions and depth
        const spr = _statsBtn.imageRefs['white_pixel'];
        if (spr) spr.setDisplaySize(size, size);

        _statsBtn.setDepth(GAME_CONSTANTS.DEPTH_UPGRADE_TREE + 5);
        _statsBtn.setScrollFactor(0);
    }

    function _onPhaseChanged(phase) {
        _isActive = (phase === GAME_CONSTANTS.PHASE_UPGRADE);
        if (_statsBtn) {
            _statsBtn.setVisible(_isActive);
        }
    }

    function _showStatsTooltip() {
        const stats = _getStats();
        const pos = tower.getPosition();

        const content = [{ text: t('tower_stats', 'title'), style: 'title', color: '#ffffff' }];

        if (stats.damage > 0) {
            content.push({ text: t('tower_stats', 'damage', [Math.floor(stats.damage)]), style: 'normal', color: COLORS.COMBAT });
        }
        if (stats.regen > 0) {
            content.push({ text: t('tower_stats', 'regen', [stats.regen.toFixed(1)]), style: 'normal', color: '#87FF02' });
        }
        if (stats.armor > 0) {
            content.push({ text: t('tower_stats', 'armor', [Math.floor(stats.armor)]), style: 'normal', color: '#8FD9F8' });
        }
        if (stats.range > 0) {
            content.push({ text: t('tower_stats', 'range', [Math.floor(stats.range)]), style: 'normal', color: '#aaaaaa' });
        }

        content.push({ text: '', style: 'normal' }); // Spacer
        content.push({ text: t('tower_stats', 'equipped'), style: 'title', color: '#ffe600' });

        // Add equipped duo weapons
        if (stats.equipped.length === 0) {
            content.push({ text: t('tower_stats', 'none'), style: 'normal', color: '#666666' });
        } else {
            stats.equipped.forEach(weapon => {
                content.push({ text: `◈ ${weapon}`, style: 'normal', color: '#ffffff' });
            });
        }

        // Offset tooltip to the side of the new interaction area
        tooltipManager.show(pos.x + 400, pos.y + 25, content, 400);
    }

    function _getStats() {
        const ups = gameState.upgrades || {};

        const hp = tower.getHealth();
        const damage = tower.getDamage();
        const armor = tower.getArmor();
        const regen = tower.getRegen();
        const range = tower.getRange();

        // Use upgradeDispatcher.getLevel to ensure we respect branchActive (Duo choice)
        const get = (id) => (typeof upgradeDispatcher !== 'undefined') ? upgradeDispatcher.getLevel(id) : 0;

        // Equipped choice-weapons — only show if active branch
        const equipped = [];
        if (get('lightning_weapon')) equipped.push(t('nodes', 'lightning_weapon.name'));
        if (get('shockwave_weapon')) equipped.push(t('nodes', 'shockwave_weapon.name'));
        if (get('manual_pulse')) equipped.push(t('nodes', 'manual_pulse.name'));
        if (get('wide_pulse')) equipped.push(t('nodes', 'wide_pulse.name'));
        if (get('laser')) equipped.push(t('nodes', 'laser.name'));
        if (get('artillery')) equipped.push(t('nodes', 'artillery.name'));

        return {
            hp: hp,
            damage: damage,
            regen,
            armor,
            range,
            equipped
        };
    }

    return {
        init
    };
})();
