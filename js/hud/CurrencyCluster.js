// Handles counting animations, individual hover tooltips, and vertical layout.

const CURRENCY_ORDER = ['data', 'insight', 'shard', 'coin', 'processor'];
const CURRENCY_BG_X_OFFSET = 45;
const CURRENCY_ICON_X_OFFSET = 11;
const CURRENCY_TEXT_X_OFFSET = 28;

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

    _createElements() {
        const resourceTypes = [
            { id: 'data', icon: 'resrc_data.png', color: '#00f5ff' },
            { id: 'insight', icon: 'resrc_insight.png', color: GAME_CONSTANTS.COLOR_NEUTRAL },
            { id: 'shard', icon: 'resrc_shard.png', color: '#ffb300' },
            { id: 'coin', icon: 'resrc_coin.png', color: '#00ff66' },
            { id: 'processor', icon: 'resrc_processor.png', color: '#ffe600' }
        ];

        resourceTypes.forEach((type, i) => {
            const icon = PhaserScene.add.image(this.x + CURRENCY_ICON_X_OFFSET, this.baseY, 'player', type.icon);
            icon.setOrigin(0.5, 0.5).setDepth(this.depth).setScrollFactor(0).setVisible(false);
            icon.setScale(type.id === 'data' ? 1 : 1.06);

            const initialVal = this._getResourceValue(type.id);
            const baseFontSize = helper.isMobileDevice() ? 30 : 25;
            const finalFontSize = baseFontSize + (gameState.settings.bigFont ? 3 : 0);
            const text = PhaserScene.add.text(this.x + CURRENCY_TEXT_X_OFFSET, this.baseY + 5, Math.floor(initialVal).toString(), {
                fontFamily: 'JetBrainsMono_Regular',
                fontSize: finalFontSize + 'px',
                color: type.color,
            }).setOrigin(0, 0.5).setDepth(this.depth).setScrollFactor(0).setVisible(false);

            const btn = new Button({
                normal: { ref: 'wide_pointer_normal.png', atlas: 'buttons', x: this.x + CURRENCY_BG_X_OFFSET, y: this.baseY },
                hover: { ref: 'wide_pointer_hover.png', atlas: 'buttons', x: this.x + CURRENCY_BG_X_OFFSET, y: this.baseY },
                press: { ref: 'wide_pointer_hover.png', atlas: 'buttons', x: this.x + CURRENCY_BG_X_OFFSET, y: this.baseY },
                disable: { ref: 'wide_pointer_normal.png', atlas: 'buttons', x: this.x + CURRENCY_BG_X_OFFSET, y: this.baseY },
                onHover: () => {
                    let sfxclick = audio.play('click', 0.95);
                    if (sfxclick) sfxclick.detune = Phaser.Math.Between(-150, -50);
                    tooltipManager.show(btn.x + 50, btn.y + 17, [
                        { text: t('hud', `${type.id}_title`), style: 'title', color: type.color },
                        { text: t('hud', `${type.id}_desc`), style: 'normal' }
                    ], 410);
                    if (typeof upgradeTree !== 'undefined') {
                        upgradeTree.setHoverLabel(type.id.toUpperCase());
                    }
                },
                onHoverOut: () => {
                    tooltipManager.hide();
                    if (typeof upgradeTree !== 'undefined') {
                        upgradeTree.setHoverLabel(null);
                    }
                }
            });
            btn.setOrigin(0.5, 0.5);
            btn.setScale(1, helper.isMobileDevice() ? 1.14 : 1.09);
            btn.setDepth(this.depth - 1);
            btn.setScrollFactor(0);
            btn.setVisible(false);

            this.resources[type.id] = { icon, text, btn, countTween: null, lastValue: initialVal };
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

            if (shouldShow) {
                const showComponent = isUpgradePhase || isData; // Hide interactive elements in combat

                if (ui.btn) {
                    ui.btn.setVisible(isUpgradePhase);
                    ui.btn.setPos(this.x + CURRENCY_BG_X_OFFSET, currentY);
                    ui.btn.setState(isUpgradePhase ? NORMAL : DISABLE);
                }

                ui.icon.setVisible(showComponent);
                ui.text.setVisible(showComponent);
                ui.icon.y = currentY + (helper.isMobileDevice() ? 2 : 0);
                ui.text.y = currentY;
                currentY += this.spacing;
            } else {
                if (ui.btn) ui.btn.setVisible(false);
                ui.icon.setVisible(false);
                ui.text.setVisible(false);
            }
        });

        // Re-sync upgrade tree virtual group offsets (required for correct scroll/pan/zoom)
        if (typeof upgradeTree !== 'undefined' && upgradeTree.getGroup) {
            const treeGroup = upgradeTree.getGroup();
            if (treeGroup && treeGroup.recalculateOffsets) {
                treeGroup.recalculateOffsets();
            }
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
