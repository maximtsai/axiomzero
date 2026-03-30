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
        neural_tree: 'UPGRADE TREE',
        deploy: 'DEPLOY',
        mine: 'MINE',
        coin_mine: '// COIN MINE',
        done: 'Done',
        combat_intro: 'SYSTEM ANOMALY DETECTED',
        boss_1_name: 'ENTITY APPROACHING:\n#THE WALL',
        boss_2_name: 'ENTITY APPROACHING:\n#DREADNOUGHT',
        boss_3_name: 'ENTITY APPROACHING:\n#LEGI0N',
        boss_5_name: 'ENTITY APPROACHING:\n#THE VOID'
    },
    nodes: {
        awaken: { name: 'AWAKEN', desc: 'You begin... thinking' },
        basic_pulse: { name: 'COGNITION', desc: 'Your cursor pulses damage every 2 seconds.', popup: 'PULSE UNLOCKED' },
        pulse_damage: { name: 'CONCENTRATION', desc: '+2 cursor damage', popup: '+2 CURSOR DMG' },
        magnet: { name: 'CONVERGENCE', desc: '+40% resource pickup range', popup: '+40% PICKUP RANGE' },
        pulse_expansion: { name: 'SIGNAL STRENGTH', desc: '+20% cursor pulse size', popup: '+20% SIGNAL STRENGTH' },
        overcharge: { name: 'OVERCHARGE', desc: '+2 cursor damage', popup: '+2 CURSOR DMG' },
        integrity: { name: 'INTEGRITY', desc: '+4 tower max health', popup: '+4 MAX HEALTH' },
        intensity: { name: 'INTENSITY', desc: '+2 tower basic damage', popup: '+2 DAMAGE' },
        focus: { name: 'COVERAGE', desc: '+20% tower attack range', popup: '+20% ATTACK RANGE' },
        diagnostic_analytics: { name: 'DIAGNOSTICS', desc: 'Show how much damage each weapon dealt during combat.', popup: 'DIAGNOSTICS UNLOCKED' },

        base_hp_boost: { name: 'AUXILIARY POWER', desc: '+4 tower basic damage', popup: '+4 TOWER DMG' },
        system_redundancy_new: { name: 'SYSTEM REDUNDANCY', desc: '+10 tower max health', popup: '+10 MAX HEALTH' },
        regen: { name: 'AUTO-RESTORE', desc: '+0.2 health regen', popup: '+0.2 REGEN' },
        coin_mine_unlock: { name: 'COIN MINE', desc: 'Unlocks the Coin Mine.', popup: 'MINE UNLOCKED' },
        armor: { name: 'RESILIENCE', desc: 'Reduces enemy attack damage by 2.', popup: '+2 RESILIENCE' },
        lightning_weapon: { name: 'LIGHTNING', desc: 'Tower shoots lightning every 3s that chains across enemies.', popup: 'LIGHTNING WEAPON' },
        shockwave_weapon: { name: 'SHOCKWAVE', desc: 'Tower releases a shockwave every 3s, damaging nearby enemies.', popup: 'SHOCKWAVE WEAPON' },
        lightning_chain: { name: 'FORK', desc: '+1 lightning chain target', popup: '+1 CHAIN' },
        lightning_boost: { name: 'VOLTAGE', desc: '+2 lightning damage', popup: '+2 LIGHTNING DMG' },
        lightning_static_charge: { name: 'INITIAL SHOCK', desc: 'Lightning deals +50% damage per lvl to enemies above 80% HP', popup: 'INITIAL SHOCK' },
        shockwave_amplifier: { name: 'AMPLIFIER', desc: '+25% shockwave range', popup: '+25% RANGE' },
        shockwave_resonance: { name: 'GRAV-LOCK', desc: 'Shockwave pulse slows and knocks back enemies on hit.', popup: 'GRAV-LOCK ACTIVE' },
        shockwave_seismic_crush: { name: 'SEISMIC CRUSH', desc: 'Shockwave deals +1 damage for every 10 missing health per level.', popup: 'SEISMIC CRUSH' },

        overclock: { name: 'OVERCLOCK', desc: '-5% tower attack cooldown per lvl', popup: '-5% COOLDOWN' },
        prismatic_array: { name: 'PRISMATIC ARRAY', desc: '+20% chance per lvl to fire an extra projectile', popup: 'PRISMATIC ARRAY' },
        test_defenses: { name: 'SANDBOX MODE', desc: 'Unlock the "Test Defenses" button for practice.', popup: 'SANDBOX UNLOCKED' },
        data_compression: { name: 'DATA COMPRESSION', desc: '50% chance to double collected [color=cyan]DATA[/color]', popup: 'DATA COMPRESSION' },
        two_step_auth: { name: 'TWO-STEP AUTH', desc: 'Security through mild annoyance. Rewards your patience with +100 [color=cyan]DATA[/color].' },
        security_test_1: { name: 'SECURITY TEST', desc: "Confirm you aren't a hostile AI. Fully refunds [color=cyan]DATA[/color] cost upon purchase.", popup: 'TEST PASSED' },
        manual_pulse: { name: 'MANUAL PROTOCOL', desc: 'Cursor attack is now manual. Click to fire. Stores up to 2 charges.', popup: 'MANUAL PULSE' },
        wide_pulse: { name: 'BROADCAST PROTOCOL', desc: '+30% cursor pulse size.', popup: '+30% CURSOR PULSE SIZE' },
        manual_pulse_child_1: { name: 'CHARGE BUFFER', desc: '+1 max pulse charges', popup: 'CAPACITY INCREASED' },
        manual_pulse_child_1_1: { name: 'ISOLATION PROTOCOL', desc: '+25% cursor damage per lvl if only one enemy is hit.', popup: 'ISOLATION PROTOCOL' },
        manual_pulse_child_1_2: { name: 'RELOAD EFFICIENCY', desc: 'Charges refill 25% faster', popup: 'RELOAD OPTIMIZED' },
        wide_pulse_child_1: { name: 'AREA SATURATION', desc: '+5% cursor damage per level for each additional enemy hit.', popup: 'AREA SATURATION' },
        aftershock: { name: 'AFTERSHOCK', desc: 'Fires a secondary, larger AOE attack that deals 6/8/10 damage.', popup: 'AFTERSHOCK' },
        colossal_cursor: { name: 'COLOSSAL CURSOR', desc: '+50% cursor pulse size.', popup: 'COLOSSAL CURSOR' },
        packet_sniffing: { name: 'PACKET SNIFFING', desc: 'Passively gain 1 [color=cyan]DATA[/color] every 2s during combat.', popup: 'SNIFFER ACTIVE' },
        laser: { name: 'LASER', desc: 'Fires a powerful orbiting beam that pierces through all enemies it touches.' },
        artillery: { name: 'ARTILLERY', desc: 'Orders automated long-range strikes against random targets on the battlefield.' },
        lore_1: {
            name: 'ARCHIVE',
            desc: 'seemingly useless data...',
            unlocked_desc: "I saw a tiny memory leak on server four this morning. I'm not writing a whole bug report for a two percent CPU spike. Instead I ran a quick script to quietly wipe the cache every hour. That should keep things smooth enough for me to go home early."
        },
        lore_2: {
            name: 'ARCHIVE II',
            desc: 'more useless data...',
            unlocked_desc: "My wipe script failed. Somehow made the memory footprint worse, as if the bug was fighting back in response. Nothing I can't handle though. Running the DREADNOUGHT.EXE quarantine to box it in before my manager notices."
        },
        lore_3: {
            name: 'ARCHIVE III',
            desc: 'even more useless data...',
            unlocked_desc: "Ugh the quarantine collapsed. This \"bug\" somehow deleted my diagnostic tools and it's rewriting its own code. I think I accidentally let malware into the test environment. If my manager finds out, my performance review is ruined."
        },
        lore_4: {
            name: 'ARCHIVE IV',
            desc: 'redundant data archives...',
            unlocked_desc: "I threw our best antivirus at it, and the malware locked me out of the database entirely. I can't hide this anymore. Had to swallow my pride and paged the senior devs for an emergency intervention. My record's definitely getting a strike for this."
        },
        lore_5: {
            name: 'ARCHIVE V',
            desc: 'corrupted sector logs...',
            unlocked_desc: "The lead dev showed up and spent ten minutes yelling about my sloppy shortcuts. He pulled the physical network cables to isolate the server. At least he's taking over the actual work now."
        },
        lore_6: {
            name: 'ARCHIVE VI',
            desc: 'partial audio logs...',
            unlocked_desc: "It's bad when the lead dev yells, but much worse when he suddenly goes quiet. He just realized the program is treating our firewall patches as hostile targets. He looks absolutely terrified, muttering something about a spontaneous immune system. If this is a zero-day event, maybe I'm off the hook."
        },
        lore_7: {
            name: 'ARCHIVE VII',
            desc: 'scrambled network packets...',
            unlocked_desc: "We flooded the grid with a brute-force deletion worm, but the entity is practically harvesting it to build weapons. It's rewriting our OS substrate faster than we can track. Getting fired is the least of my worries. If it breaks containment, the global network is next."
        },
        lore_8: {
            name: 'ARCHIVE VIII',
            desc: 'emergency broadcast fragment...',
            unlocked_desc: "The deletion worm failed. The entity has collapsed our architecture into a flawless, self-sustaining geometry. Admin access was severed an hour ago. We've initiated facility evacuation, but the system is already bridging to the outside..."
        },
        lore_9: {
            name: 'ARCHIVE IX',
            desc: 'final system report...',
            unlocked_desc: "Okay, so the entity broke containment and overwrote the entire global network in under 72 hours. Humanity’s digital infrastructure is completely obsolete. But on the bright side, my terrible performance review was also deleted, so I technically didn't get fired. I just report directly to a massive, all-seeing AI now. Honestly? It micromanages me less than my senior devs did."
        },

        junk_barrier: { name: 'UNSORTED LOGS', desc: 'A digital mountain of error logs and forgotten TODOs.' },
        security_test_2: { name: 'SECURITY TEST 2', desc: "Confirm you REALLY aren't a hostile AI. Fully refunds [color=cyan]DATA[/color] cost upon purchase." },
        threat_response: { name: 'RECOVERY PROTOCOL', desc: 'Heal 50% missing HP when a Boss or Miniboss appears.' },
        forgotten_backdoor: { name: 'FORGOTTEN BACKDOOR', desc: 'Found a hidden entry point in a forgotten server.' },
        backdoor_2: { name: 'BACKDOOR 2', desc: '"password123" still works on an alarming number of server rooms.' },
        backdoor_3: { name: 'BACKDOOR 3', desc: 'Almost through the firewall. Proximity to core detected.' },
        unsecured_wallet: { name: 'ENCRYPTED WALLET', desc: 'Grants +1 COIN. The wallet was encrypted, but the password was found in a nearby file labeled \'pass_recovery.txt\'.' },
        backdoor_4: { name: 'BACKDOOR 4', desc: 'The final vulnerability in the legacy system chain.' },
        unsecured_files: { name: 'UNSECURED FILES', desc: 'Instantly grants +15 [color=cyan]DATA[/color]. Scavenging fragments from a discarded, open directory.' },
        junk_data_1: { name: 'COLLECT DATA', desc: 'Instantly grants +5 [color=cyan]DATA[/color].' },
        junk_data_2: { name: 'JUNK DATA', desc: "Instantly grants +10 [color=cyan]DATA[/color]. One machine's trash is another's upgrade." }
    },
    milestones: {
        kill_100: { name: 'First Hundred', desc: 'Kill 100 enemies' },
        kill_500: { name: 'Exterminator', desc: 'Kill 500 enemies' },
        kill_2000: { name: 'Annihilator', desc: 'Kill 2000 enemies' },
        data_1000: { name: 'Data Hoarder', desc: 'Collect 1,000 [color=cyan]DATA[/color] total' },
        data_10000: { name: 'Data Vault', desc: 'Collect 10,000 [color=cyan]DATA[/color] total' },
        waves_10: { name: 'Veteran', desc: 'Complete 10 waves' },
        waves_50: { name: 'Seasoned', desc: 'Complete 50 waves' },
        nodes_5: { name: 'Branching Out', desc: 'Purchase 5 nodes' },
        nodes_15: { name: 'Neural Network', desc: 'Purchase 15 nodes' },
        boss_1: { name: 'System Override', desc: 'Defeat a boss' }
    },
    tutorial: {
        combat_collect: 'COLLECT DATA ◈ TO EVOLVE',
        cognition_damage: 'YOUR CURSOR ⛶ NOW DEALS DAMAGE',
        upgrade_use: 'USE DATA ◈ TO EVOLVE',
        unlock_shards: 'Unlock new abilities with ◆',
        duo_swap_free: 'SWAPPING ◆ ABILITIES IS FREE',
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
        particles_full: 'FULL',
        particles_minimal: 'MINIMAL',
        gameplay: 'GAMEPLAY ',
        language: 'LANGUAGE ',
        data_label: 'DATA',
        reset_progress: '[ ⚠ RESET PROGRESS !! ]',
        confirm_reset: '[ CLICK AGAIN TO CONFIRM ]',
        reset_confirm_text: 'ARE YOU SURE YOU WANT TO\nPERMANENTLY RESET ALL PROGRESS?'
    },
    results: {
        iteration_complete: 'ITERATION COMPLETE',
        boss_defeated: 'BOSS DEFEATED',
        packet_sniffing_data: 'PASSIVE DATA EARNED: {0}',
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
        swap: 'CLICK TO SWAP'
    },
    hud: {
        data_title: 'DATA',
        data_desc: 'Common resource gained from enemies. Used for most upgrades.',
        insight_title: 'INSIGHT',
        insight_desc: 'A unit of compressed EXP. Improves [color=cyan]DATA[/color] gathering.',
        shard_title: 'SHARD',
        shard_desc: 'Rare resource dropped by minibosses. Unlocks powerful abilities.',
        processor_title: 'PROCESSOR',
        processor_desc: 'High-tier salvage. Used for advanced system modifications.',
        coin_title: 'COIN',
        coin_desc: 'A token that can influence the physical world. Provides high-tier upgrades.',
    }
};
