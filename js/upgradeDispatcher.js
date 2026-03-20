// upgradeDispatcher.js — Global dispatcher for applying upgrade effects to systems.
// Decouples upgrade definitions (nodeDefs.js) from system-specific logic.

const upgradeDispatcher = (() => {

    /** Recalculates total cursor damage from all pulse upgrade nodes. */
    function recalcPulseDamage() {
        const ups = gameState.upgrades || {};
        const ampLv = ups.pulse_damage || 0;
        const overchargeLv = ups.overcharge || 0;

        let base = 4 + 2 * ampLv + 4 * overchargeLv;
        pulseAttack.setDamage(base);
        
        const manualActive = (gameState.activeShards && gameState.activeShards[2] === 'manual_pulse');
        const wideActive = (gameState.activeShards && gameState.activeShards[2] === 'wide_pulse');

        const isolationLv = manualActive ? (ups.manual_pulse_child_1_1 || 0) : 0;
        pulseAttack.setIsolationLevel(isolationLv);

        const saturationLv = wideActive ? (ups.wide_pulse_child_1 || 0) : 0;
        pulseAttack.setSaturationLevel(saturationLv);
    }

    /** Recalculates pulse recharge interval. */
    function recalcPulseRecharge() {
        const ups = gameState.upgrades || {};
        const manualActive = (gameState.activeShards && gameState.activeShards[2] === 'manual_pulse');
        const intervalBonus = (manualActive && ups.manual_pulse_child_1_2) ? 0.75 : 1.0;
        pulseAttack.setFireInterval(2000 * intervalBonus);
    }

    /** Recalculates total pulse size from all pulse upgrade nodes. */
    function recalcPulseSize() {
        const ups = gameState.upgrades || {};
        const expansionLv = ups.pulse_expansion || 0;

        // Only apply Resonance Area size bonus if it is the active selection for Duo Tier 2
        const aoeActive = (gameState.activeShards && gameState.activeShards[2] === 'wide_pulse');
        const aoeBonus = aoeActive ? (ups.wide_pulse || 0) : 0;

        pulseAttack.setSize(100 * (1 + 0.2 * expansionLv + 0.3 * aoeBonus));
    }

    /** Recalculates pulse manual mode. */
    function recalcPulseMode() {
        const ups = gameState.upgrades || {};

        // Only enable manual mode if Manual Protocol is the active selection for Duo Tier 2
        const manualActive = (gameState.activeShards && gameState.activeShards[2] === 'manual_pulse');
        const manualLv = manualActive ? (ups.manual_pulse || 0) : 0;

        pulseAttack.setManualMode(manualLv > 0);
        recalcPulseCharges();
    }

    /** Recalculates max pulse charges. */
    function recalcPulseCharges() {
        const ups = gameState.upgrades || {};
        const manualActive = (gameState.activeShards && gameState.activeShards[2] === 'manual_pulse');
        const extraCharges = manualActive ? (ups.manual_pulse_child_1 || 0) : 0;
        pulseAttack.setMaxCharges(2 + extraCharges);
    }

    /** Recalculates lightning chain count from upgrade nodes. */
    function recalcLightningChains() {
        const ups = gameState.upgrades || {};
        const chainLv = ups.lightning_chain || 0;
        lightningAttack.setChainCount(2 + chainLv);
    }

    /** Recalculates lightning damage from upgrade nodes. */
    function recalcLightningDamage() {
        const ups = gameState.upgrades || {};
        const boostLv = ups.lightning_boost || 0;
        const staticLv = ups.lightning_static_charge || 0;
        lightningAttack.setDamage(6 + 2 * boostLv);
        lightningAttack.setStaticChargeLevel(staticLv);
    }

    /** Recalculates packet sniffing state. */
    function recalcPacketSniffing() {
        const ups = gameState.upgrades || {};
        const hasSniffing = (ups.packet_sniffing || 0) > 0;
        resourceManager.setPacketSniffing(hasSniffing);
    }

    /** Recalculates shockwave upgrades from upgrade nodes. */
    function recalcShockwaveStats() {
        if (typeof shockwaveAttack === 'undefined') return;
        const ups = gameState.upgrades || {};
        const ampLv = ups.shockwave_amplifier || 0;
        const resLv = ups.shockwave_resonance || 0;
        const crushLv = ups.shockwave_seismic_crush || 0;
        shockwaveAttack.setAmplifierLevel(ampLv);
        shockwaveAttack.setResonanceLevel(resLv);
        shockwaveAttack.setSeismicCrushLevel(crushLv);
    }

    /** Recalculates threat response healing on boss spawn. */
    function recalcThreatResponse() {
        // Subscription handled in gameInit.js
    }

    /** Recalculates all systems based on current upgrades. */
    function recalcEverything() {
        if (typeof pulseAttack !== 'undefined') {
            recalcPulseDamage();
            recalcPulseRecharge();
            recalcPulseSize();
            recalcPulseMode();
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
        recalcPulseRecharge,
        recalcPulseSize,
        recalcPulseMode,
        recalcPulseCharges,
        recalcLightningChains,
        recalcLightningDamage,
        recalcPacketSniffing,
        recalcShockwaveStats,
        recalcThreatResponse
    };
})();
