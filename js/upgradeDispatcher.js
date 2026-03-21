// upgradeDispatcher.js — Global dispatcher for applying upgrade effects to systems.
// Decouples upgrade definitions (nodeDefs.js) from system-specific logic.

const upgradeDispatcher = (() => {

    /** 
     * Returns the effective level of a node. 
     * If the node's path is inactive (e.g. the wrong Duo shard is chosen), returns 0.
     */
    function getLevel(nodeId) {
        if (typeof neuralTree !== 'undefined') {
            const node = neuralTree.getNode(nodeId);
            if (node) {
                return node.branchActive ? node.level : 0;
            }
        }
        // Safe fallback before tree initialization or if node not found
        const ups = gameState.upgrades || {};
        return ups[nodeId] || 0;
    }

    /** Recalculates total cursor damage from all pulse upgrade nodes. */
    function recalcPulseDamage() {
        let base = 4 + 2 * getLevel('pulse_damage') + 4 * getLevel('overcharge');
        pulseAttack.setDamage(base);
        
        pulseAttack.setIsolationLevel(getLevel('manual_pulse_child_1_1'));
        pulseAttack.setSaturationLevel(getLevel('wide_pulse_child_1'));
    }

    /** Recalculates aftershock level. */
    function recalcAftershock() {
        if (typeof pulseAttack !== 'undefined' && pulseAttack.setAftershockLevel) {
            pulseAttack.setAftershockLevel(getLevel('aftershock'));
        }
    }

    /** Recalculates pulse reload interval. */
    function recalcPulseReload() {
        const intervalBonus = getLevel('manual_pulse_child_1_2') > 0 ? 0.75 : 1.0;
        pulseAttack.setFireInterval(2000 * intervalBonus);
    }

    /** Recalculates total pulse size from all pulse upgrade nodes. */
    function recalcPulseSize() {
        const expansionLv = getLevel('pulse_expansion');
        const aoeBonus = getLevel('wide_pulse');
        const colossalBonus = getLevel('colossal_cursor');

        pulseAttack.setSize(100 * (1 + 0.2 * expansionLv + 0.3 * aoeBonus + 0.5 * colossalBonus));
    }

    /** Recalculates pulse manual mode. */
    function recalcPulseMode() {
        pulseAttack.setManualMode(getLevel('manual_pulse') > 0);
        recalcPulseCharges();
    }

    /** Recalculates max pulse charges. */
    function recalcPulseCharges() {
        pulseAttack.setMaxCharges(2 + getLevel('manual_pulse_child_1'));
    }

    /** Recalculates lightning chain count from upgrade nodes. */
    function recalcLightningChains() {
        lightningAttack.setChainCount(2 + getLevel('lightning_chain'));
    }

    /** Recalculates lightning damage from upgrade nodes. */
    function recalcLightningDamage() {
        lightningAttack.setDamage(6 + 2 * getLevel('lightning_boost'));
        lightningAttack.setStaticChargeLevel(getLevel('lightning_static_charge'));
    }

    /** Recalculates packet sniffing state. */
    function recalcPacketSniffing() {
        resourceManager.setPacketSniffing(getLevel('packet_sniffing') > 0);
    }

    /** Recalculates shockwave upgrades from upgrade nodes. */
    function recalcShockwaveStats() {
        if (typeof shockwaveAttack === 'undefined') return;
        shockwaveAttack.setAmplifierLevel(getLevel('shockwave_amplifier'));
        shockwaveAttack.setResonanceLevel(getLevel('shockwave_resonance'));
        shockwaveAttack.setSeismicCrushLevel(getLevel('shockwave_seismic_crush'));
    }

    /** Recalculates threat response healing on boss spawn. */
    function recalcThreatResponse() {
        // Subscription handled in gameInit.js
    }

    /** Recalculates all systems based on current upgrades. */
    function recalcEverything() {
        if (typeof pulseAttack !== 'undefined') {
            recalcPulseDamage();
            recalcPulseReload();
            recalcPulseSize();
            recalcPulseMode();
            recalcAftershock();
        }
        if (typeof lightningAttack !== 'undefined') {
            recalcLightningChains();
            recalcLightningDamage();
        }
        if (typeof shockwaveAttack !== 'undefined') {
            recalcShockwaveStats();
        }
        if (typeof resourceManager !== 'undefined') {
            recalcPacketSniffing();
        }
        recalcThreatResponse();
    }

    return {
        recalcEverything,
        recalcPulseDamage,
        recalcPulseReload,
        recalcPulseSize,
        recalcPulseMode,
        recalcPulseCharges,
        recalcLightningChains,
        recalcLightningDamage,
        recalcPacketSniffing,
        recalcShockwaveStats,
        recalcThreatResponse,
        recalcAftershock
    };
})();
