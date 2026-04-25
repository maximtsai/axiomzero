const CURRENCY_ORDER = ['data', 'insight', 'shard', 'coin', 'processor'];

const RESOURCE_DEFS = {
    data: { icon: 'resrc_data.png', color: '#00f5ff', scale: 1 },
    insight: { icon: 'resrc_insight.png', color: GAME_CONSTANTS.COLOR_NEUTRAL, scale: 1.06 },
    shard: { icon: 'resrc_shard.png', color: '#ffb300', scale: 1.06 },
    coin: { icon: 'resrc_coin.png', color: '#00ff66', scale: 1.06 },
    processor: { icon: 'resrc_processor.png', color: '#ffe600', scale: 1.06 }
};

const CONFIG = {
    BG_X_OFFSET: 45,
    ICON_X_OFFSET: 11,
    TEXT_X_OFFSET: 28,
    TEXT_Y_OFFSET: 5,
    TOOLTIP_WIDTH: 410,
    BTN_SCALE: helper.isMobileDevice() ? 1.14 : 1.09,
    ICON_MOBILE_Y_OFFSET: 2
};

class CurrencyCluster {
    /**
     * @param {Object} config
     * @param {number} config.x
     * @param {number} config.y
     * @param {number} config.depth
     * @param {number} config.spacing
     */
    constructor(config) {
        this.x = config.x;
        this.baseY = config.y;
        this.depth = config.depth;
        this.spacing = config.spacing;

        this.resources = {};
        this._createElements();

        messageBus.subscribe('settingChanged_bigFont', () => this.refreshFontSize());
    }

    _getFontSize() {
        const base = helper.isMobileDevice() ? 30 : 25;
        const extra = (typeof gameState !== 'undefined' && gameState.settings && gameState.settings.bigFont) ? 3 : 0;
        return (base + extra) + 'px';
    }

    _getResourceValue(id) {
        return helper.getResource(id);
    }

    _createElements() {
        CURRENCY_ORDER.forEach(id => {
            const def = RESOURCE_DEFS[id];
            const icon = PhaserScene.add.image(this.x + CONFIG.ICON_X_OFFSET, this.baseY, 'player', def.icon);
            icon.setOrigin(0.5, 0.5).setDepth(this.depth).setScrollFactor(0).setVisible(false);
            icon.setScale(def.scale);

            const initialVal = this._getResourceValue(id);
            const text = PhaserScene.add.text(this.x + CONFIG.TEXT_X_OFFSET, this.baseY + CONFIG.TEXT_Y_OFFSET, Math.floor(initialVal).toString(), {
                fontFamily: 'JetBrainsMono_Regular',
                fontSize: this._getFontSize(),
                color: def.color,
            }).setOrigin(0, 0.5).setDepth(this.depth).setScrollFactor(0).setVisible(false);

            const btn = new Button({
                normal: { ref: 'wide_pointer_normal.png', atlas: 'buttons', x: this.x + CONFIG.BG_X_OFFSET, y: this.baseY },
                hover: { ref: 'wide_pointer_hover.png', atlas: 'buttons', x: this.x + CONFIG.BG_X_OFFSET, y: this.baseY },
                press: { ref: 'wide_pointer_hover.png', atlas: 'buttons', x: this.x + CONFIG.BG_X_OFFSET, y: this.baseY },
                disable: { ref: 'wide_pointer_normal.png', atlas: 'buttons', x: this.x + CONFIG.BG_X_OFFSET, y: this.baseY },
                onHover: () => {
                    let sfxclick = audio.play('click', 0.95);
                    if (sfxclick) sfxclick.detune = Phaser.Math.Between(-150, -50);
                    tooltipManager.show(btn.x + 50, btn.y + 17, [
                        { text: t('hud', `${id}_title`), style: 'title', color: def.color },
                        { text: t('hud', `${id}_desc`), style: 'normal' }
                    ], CONFIG.TOOLTIP_WIDTH);
                    if (typeof upgradeTree !== 'undefined') {
                        upgradeTree.setHoverLabel(id.toUpperCase());
                    }
                },
                onHoverOut: () => {
                    tooltipManager.hide();
                    if (typeof upgradeTree !== 'undefined') {
                        upgradeTree.setHoverLabel(null);
                    }
                }
            });
            btn.setOrigin(0.5, 0.5).setScale(1, CONFIG.BTN_SCALE).setDepth(this.depth - 1).setScrollFactor(0).setVisible(false);

            this.resources[id] = { icon, text, btn, countTween: null, lastValue: initialVal };
        });
    }

    /**
     * Updates the vertical layout and visibility of resources.
     * @param {boolean} isVisible 
     * @param {boolean} isUpgradePhase 
     */
    updateLayout(isVisible, isUpgradePhase) {
        if (!isVisible) return;

        let currentY = this.baseY;

        CURRENCY_ORDER.forEach(id => {
            const ui = this.resources[id];
            if (!ui) return;

            const val = this._getResourceValue(id);
            const isData = (id === 'data');

            // Data is ALWAYS visible; other currencies only if quantity > 0 and in upgrade phase
            const shouldShow = isData || (val > 0 && isUpgradePhase);

            ui.icon.setVisible(shouldShow);
            ui.text.setVisible(shouldShow);
            if (ui.btn) {
                ui.btn.setVisible(shouldShow && isUpgradePhase);
                ui.btn.setState(isUpgradePhase ? NORMAL : DISABLE);
            }

            if (shouldShow) {
                const iconY = currentY + (helper.isMobileDevice() ? CONFIG.ICON_MOBILE_Y_OFFSET : 0);
                ui.icon.y = iconY;
                ui.text.y = currentY;
                if (ui.btn) ui.btn.setPos(this.x + CONFIG.BG_X_OFFSET, currentY);

                currentY += this.spacing;
            }
        });

        // Re-sync upgrade tree virtual group offsets
        if (typeof upgradeTree !== 'undefined' && upgradeTree.getGroup) {
            const treeGroup = upgradeTree.getGroup();
            if (treeGroup && treeGroup.recalculateOffsets) treeGroup.recalculateOffsets();
        }
    }

    /**
     * Called when a currency value changes or an upgrade is purchased.
     */
    refreshAll() {
        Object.keys(this.resources).forEach(id => {
            const val = this._getResourceValue(id);
            this.setStaticValue(id, val);
        });
    }

    /**
     * Plays a count-up animation for a specific currency.
     */
    animateToValue(id, targetVal) {
        const ui = this.resources[id];
        if (!ui || !ui.text) return;

        if (ui.countTween) {
            ui.countTween.stop();
            ui.countTween = null;
        }

        const duration = (id === 'data') ? 1000 : (250 + Math.floor(Math.random() * 250));
        const counter = { val: ui.lastValue || 0 };

        ui.countTween = PhaserScene.tweens.add({
            targets: counter,
            val: targetVal,
            duration: duration,
            ease: 'Quad.easeOut',
            onUpdate: () => {
                ui.text.setText(Math.floor(counter.val).toString());
            },
            onComplete: () => {
                ui.text.setText(Math.floor(targetVal).toString());
                ui.lastValue = targetVal;
                ui.countTween = null;
            }
        });
    }

    setStaticValue(id, val) {
        const ui = this.resources[id];
        if (!ui) return;

        if (ui.countTween) {
            ui.countTween.stop();
            ui.countTween = null;
        }
        ui.text.setText(Math.floor(val).toString());
        ui.lastValue = val;
    }

    refreshFontSize() {
        Object.values(this.resources).forEach(res => {
            if (!res.text) return;
            const baseFontSize = helper.isMobileDevice() ? 30 : 25;
            const targetSize = (baseFontSize + (gameState.settings.bigFont ? 3 : 0)) + 'px';
            if (res.text.style.fontSize !== targetSize) {
                res.text.setFontSize(targetSize);
            }
        });
    }

    setPos(x, y) {
        // testing if if does nothing for now
    }

    setDepth(depth) {
        this.depth = depth;
        Object.values(this.resources).forEach(res => {
            res.icon.setDepth(depth);
            res.text.setDepth(depth);
            if (res.btn) res.btn.setDepth(depth - 1);
        });
    }

    _getResourceValue(id) {
        if (typeof resourceManager === 'undefined') return 0;
        if (id === 'data') return resourceManager.getData();
        if (id === 'insight') return resourceManager.getInsight();
        if (id === 'shard') return resourceManager.getShards();
        if (id === 'processor') return resourceManager.getProcessors();
        if (id === 'coin') return resourceManager.getCoins();
        return 0;
    }

    setVisible(vis) {
        if (!vis) {
            Object.values(this.resources).forEach(res => {
                res.icon.setVisible(false);
                res.text.setVisible(false);
                if (res.btn) {
                    res.btn.setVisible(false);
                    res.btn.setState(DISABLE);
                }
            });
        } else {
            // this.updateLayout(true, true);
        }
    }

    setAlpha(alpha) {
        Object.values(this.resources).forEach(res => {
            res.icon.setAlpha(alpha);
            res.text.setAlpha(alpha);
            if (res.btn) res.btn.setAlpha(alpha);
        });
    }

    addToGroup(group) {
        if (!group) return;
        Object.values(this.resources).forEach(res => {
            group.add(res.icon);
            group.add(res.text);
            if (res.btn && res.btn.getContainer) group.add(res.btn.getContainer());

        });
    }
}
