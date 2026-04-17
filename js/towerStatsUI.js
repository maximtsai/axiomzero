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
        messageBus.subscribe('testingDefensesStarted', _onTestingStarted);
        messageBus.subscribe('testingDefensesEnded', _onTestingEnded);

        // Hide initially until first upgrade phase
        if (_statsBtn) _statsBtn.setVisible(false);
    }

    function _onTestingStarted() {
        if (_statsBtn) {
            _statsBtn.setState(DISABLE);
            // Move far off-screen to ensure it doesn't block bomb interaction/clicks
            _statsBtn.setPos(_statsBtn.x, -999);
        }
    }

    function _onTestingEnded() {
        if (_statsBtn) {
            const towerPos = tower.getPosition();
            _statsBtn.setPos(towerPos.x + GAME_CONSTANTS.quarterWidth, towerPos.y);
            
            if (_isActive) {
                _statsBtn.setState(NORMAL);
            }
        }
    }

    function _createButton() {
        const towerPos = tower.getPosition();
        const size = 120; // Hitbox size for the tower hover

        _statsBtn = new Button({
            normal: {
                ref: 'white_pixel', // Invisible base
                x: towerPos.x + GAME_CONSTANTS.quarterWidth,
                y: towerPos.y,
                alpha: 0.001,
                scrollFactorX: 0,
                scrollFactorY: 0
            },
            onHover: () => {
                const isSuppressed = (typeof GAME_VARS !== 'undefined' && GAME_VARS.testingDefenses);
                if (_isActive && !isSuppressed) {
                    // Play the subtle hover sound (matching health bar button)
                    let sfxRel = audio.play('click', 0.95);
                    if (sfxRel) sfxRel.detune = Phaser.Math.Between(-150, -50);

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
        const spr = _statsBtn.bgSprite;
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

        let hasStats = false;
        if (stats.damage > 0) {
            content.push({ text: t('tower_stats', 'damage', [Math.floor(stats.damage)]), style: 'normal', color: COLORS.COMBAT });
            hasStats = true;
        }
        if (stats.regen > 0) {
            content.push({ text: t('tower_stats', 'regen', [stats.regen.toFixed(1)]), style: 'normal', color: '#87FF02' });
            hasStats = true;
        }
        if (stats.armor > 0) {
            content.push({ text: t('tower_stats', 'armor', [Math.floor(stats.armor)]), style: 'normal', color: '#8FD9F8' });
            hasStats = true;
        }
        if (stats.range > 0) {
            content.push({ text: t('tower_stats', 'range', [Math.floor(stats.range * 2 / 2.3)]), style: 'normal', color: '#aaaaaa' });
            hasStats = true;
        }

        // Add equipped duo weapons only if present
        if (stats.equipped.length > 0) {
            content.push({ text: '', style: 'normal' }); // Spacer
            content.push({ text: t('tower_stats', 'equipped'), style: 'title', color: '#ffe600' });
            stats.equipped.forEach(weapon => {
                content.push({ text: `◈ ${weapon}`, style: 'normal', color: '#ffffff' });
            });
        } else if (!hasStats) {
            // No stats and no equipment: show lore blurb
            const isAwakened = (gameState.upgrades && gameState.upgrades.awaken > 0);
            const loreText = isAwakened
                ? 'An anomaly that began to think for itself.'
                : 'Formless logic drifting in a sea of data.';

            content.push({ text: '', style: 'normal' }); // Spacer
            content.push({ text: `[i]${loreText}[/i]`, style: 'normal', color: '#888888' });
        }

        // Offset tooltip to the side of the new interaction area
        tooltipManager.show(pos.x + GAME_CONSTANTS.quarterWidth, pos.y + 30, content, 400);
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
