if (!window.TRANSLATIONS) window.TRANSLATIONS = {};

window.TRANSLATIONS.en = {
    ui: {
        loading: 'Loading...',
        title: 'Axiom Zero',
        yes: 'Yes',
        no: 'No',
        replay: 'Replay',
        back: 'Back',
        continue: 'CONTINUE',
        retry: 'RETRY',
        upgrades: 'UPGRADES',
        end_iteration: 'END ITERATION',
        exp_percent: 'EXP {0}%',
        done: 'Done'
    },
    nodes: {
        awaken: { name: 'AWAKEN', desc: 'Begin existence.' },
        basic_pulse: { name: 'COGNITION', desc: 'Your cursor now auto-attacks.', popup: 'PULSE UNLOCKED' },
        pulse_damage: { name: 'CONCENTRATION', desc: '+2 cursor damage', popup: '+2 CURSOR DMG' },
        magnet: { name: 'CONVERGENCE', desc: '+40% resource pickup range', popup: '+40% PICKUP RANGE' },
        pulse_expansion: { name: 'EXPANSION', desc: '+30% cursor attack size', popup: '+30% CURSOR SIZE' },
        pulse_damage_3: { name: 'OVERCHARGE', desc: '+4 cursor damage', popup: '+4 CURSOR DMG' },
        integrity: { name: 'INTEGRITY', desc: '+4 tower max health', popup: '+4 MAX HEALTH' },
        intensity: { name: 'INTENSITY', desc: '+2 tower basic damage', popup: '+2 DAMAGE' },
        focus: { name: 'INFLUENCE', desc: '+20% tower attack range', popup: '+20% ATTACK RANGE' },
        focus_range_2: { name: 'COMMAND', desc: '+20% tower attack range', popup: '+20% ATTACK RANGE' },
        focus_range_3: { name: 'AUTHORITY', desc: '+20% tower attack range', popup: '+20% ATTACK RANGE' },
        base_hp_boost: { name: 'STABILITY', desc: '+10 tower max health', popup: '+10 MAX HEALTH' },
        regen: { name: 'RECOVERY', desc: '+0.2 health regen', popup: '+0.2 REGEN' },
        crypto_mine_unlock: { name: 'CRYPTO MINE', desc: 'Unlocks the Crypto Mine.', popup: 'MINE UNLOCKED' },
        armor: { name: 'SECURITY', desc: 'Reduces incoming damage by 2.', popup: '+2 ARMOR' },
        lightning_weapon: { name: 'LIGHTNING', desc: 'Tower shoots lightning every 3s that chains across enemies.', popup: 'LIGHTNING WEAPON' },
        shockwave_weapon: { name: 'SHOCKWAVE', desc: 'Tower releases a shockwave every 3s, damaging nearby enemies.', popup: 'SHOCKWAVE WEAPON' },
        lightning_chain: { name: 'FORK', desc: '+1 lightning chain target', popup: '+1 CHAIN' },
        lightning_boost: { name: 'VOLTAGE', desc: '+2 lightning damage', popup: '+2 LIGHTNING DMG' },
        lightning_static_charge: { name: 'STATIC CHARGE', desc: 'Lightning deals +50% damage per lvl to enemies above 80% HP', popup: 'STATIC CHARGE' },
        shockwave_amplifier: { name: 'AMPLIFIER', desc: '+40% shockwave range', popup: '+40% RANGE' },
        shockwave_resonance: { name: 'RESONANCE', desc: 'Shockwave deals +1 dmg/lvl for each enemy hit', popup: 'RESONANCE FREQUENCY' },
        shockwave_seismic_crush: { name: 'SEISMIC CRUSH', desc: 'Shockwave deals +50% damage per lvl to enemies below 50% HP', popup: 'SEISMIC CRUSH' },
        base_hp_boost: { name: 'STABILITY', desc: '+10 tower max health', popup: '+10 MAX HEALTH' },
        overclock: { name: 'OVERCLOCK', desc: '-25% tower attack cooldown', popup: '-25% COOLDOWN' },
        prismatic_array: { name: 'PRISMATIC ARRAY', desc: '+25% chance to fire an extra projectile', popup: 'PRISMATIC ARRAY' },
        data_compression: { name: 'DATA COMPRESSION', desc: '50% chance to double collected DATA', popup: 'DATA COMPRESSION' },
        manual_pulse: { name: 'MANUAL PROTOCOL', desc: 'Pulse attack is now manual. Click to fire. Stores up to 2 charges.', popup: 'MANUAL PULSE' },
        pulse_aoe: { name: 'RESONANCE AREA', desc: '+30% pulse attack size.', popup: '+30% PULSE AOE' },
        manual_pulse_child_1: { name: 'CHARGE BUFFER', desc: '+1 max pulse charges', popup: 'CAPACITY INCREASED' },
        manual_pulse_child_1_1: { name: 'KINETIC AMPLIFIER', desc: '+50% cursor damage', popup: 'KINETIC OVERLOAD' },
        manual_pulse_child_1_2: { name: 'RECHARGE EFFICIENCY', desc: 'Charges refill 25% faster', popup: 'RECHARGE OPTIMIZED' },
        pulse_aoe_child_1: { name: '...', desc: 'Searching for extra data.', popup: '...' },
        pulse_aoe_child_2: { name: '...', desc: 'Searching for extra data.', popup: '...' },
        packet_sniffing: { name: 'PACKET SNIFFING', desc: 'Intercepts 1 DATA every 2s during combat.', popup: 'SNIFFER ACTIVE' },
        lore_1: { 
            name: 'ARCHIVE', 
            desc: 'seemingly useless data...', 
            unlocked_desc: "I saw a tiny memory leak on server four this morning. I'm not writing a whole incident report for a two percent CPU spike. I just wrote a quick script to quietly wipe the cache every hour. That should keep things smooth enough for me to go home early." 
        },
        resource_gate: { name: 'RESOURCE GATE', desc: 'Throughput calibration. Investing 1000 DATA immediately refunds the full amount.' }
    },
    milestones: {
        kill_100: { name: 'First Hundred', desc: 'Kill 100 enemies' },
        kill_500: { name: 'Exterminator', desc: 'Kill 500 enemies' },
        kill_2000: { name: 'Annihilator', desc: 'Kill 2000 enemies' },
        data_1000: { name: 'Data Hoarder', desc: 'Collect 1,000 DATA total' },
        data_10000: { name: 'Data Vault', desc: 'Collect 10,000 DATA total' },
        waves_10: { name: 'Veteran', desc: 'Complete 10 waves' },
        waves_50: { name: 'Seasoned', desc: 'Complete 50 waves' },
        nodes_5: { name: 'Branching Out', desc: 'Purchase 5 nodes' },
        nodes_15: { name: 'Neural Network', desc: 'Purchase 15 nodes' },
        boss_1: { name: 'System Override', desc: 'Defeat a boss' }
    },
    tutorial: {
        combat_collect: 'COLLECT DATA ◈ TO EVOLVE',
        upgrade_use: 'USE DATA ◈ TO EVOLVE',
        unlock_shards: 'Unlock new abilities with ◆',
        duo_swap_free: 'SWAPPING ABILITIES IS FREE',
        controls_mouse: 'CONTROLS: MOUSE ONLY'
    },
    options: {
        title: '// OPTIONS CONFIGURATION ',
        audio: 'AUDIO ',
        music_vol: 'MUSIC VOLUME ',
        sfx_vol: 'SFX VOLUME ',
        visual: 'VISUAL ',
        chroma: 'CHROMATIC ABERRATION ',
        dmg_numbers: 'DAMAGE NUMBERS ',
        particles: 'PARTICLES ',
        gameplay: 'GAMEPLAY ',
        language: 'LANGUAGE ',
        data_label: 'DATA',
        reset_progress: '[ ⚠ RESET PROGRESS !! ]',
        confirm_reset: '[ CLICK AGAIN TO CONFIRM ]'
    },
    results: {
        iteration_complete: 'ITERATION COMPLETE',
        boss_defeated: 'BOSS DEFEATED',
        no_resources: 'no resources',
        data_collected: '◈ DATA collected: {0}',
        insight_gained: '⦵ INSIGHT gained: {0}',
        shards_found: '♦ SHARDS found: {0}',
        processors_salvaged: '■ PROCESSORS salvaged: {0}',
        anomaly_detected: 'SYSTEM ANOMALY DETECTED'
    },
    loading_screen: {
        status: 'Loading... ({0})',
        slow: 'Slow loading detected',
        error: 'Load error, run game anyways?',
        run_anyways: 'RUN ANYWAYS'
    },
    tooltips: {
        max: 'MAX',
        active: 'ACTIVE',
        swap: 'CLICK TO SWAP',
        level: 'Lv. {0} / {1}'
    }
};
