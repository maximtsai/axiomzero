if (!window.TRANSLATIONS) window.TRANSLATIONS = {};

window.TRANSLATIONS.es = {
    ui: {
        loading: 'Cargando...',
        title: 'Axiom Zero',
        yes: 'Sí',
        no: 'No',
        replay: 'Repetir',
        back: 'Volver',
        continue: 'CONTINUAR',
        retry: 'REINTENTAR',
        upgrades: 'MEJORAS',
        end_iteration: 'FINALIZAR ITERACIÓN',
        exp_percent: 'EXP {0}%',
        done: 'Hecho'
    },
    nodes: {
        awaken: { name: 'DESPERTAR', desc: 'Comienza la existencia.' },
        basic_pulse: { name: 'COGNICIÓN', desc: 'Tu cursor ahora ataca automáticamente.', popup: 'PULSO DESBLOQUEADO' },
        pulse_damage: { name: 'CONCENTRACIÓN', desc: '+2 daño del cursor', popup: '+2 DAÑO DEL CURSOR' },
        magnet: { name: 'CONVERGENCIA', desc: '+40% rango de recogida de recursos', popup: '+40% RANGO DE RECOGIDA' },
        pulse_expansion: { name: 'EXPANSIÓN', desc: '+30% tamaño de ataque del cursor', popup: '+30% TAMAÑO DEL CURSOR' },
        pulse_damage_3: { name: 'SOBRECARGA', desc: '+4 daño del cursor', popup: '+4 DAÑO DEL CURSOR' },
        integrity: { name: 'INTEGRIDAD', desc: '+5 salud máxima de la torre', popup: '+5 SALUD MÁXIMA' },
        intensity: { name: 'INTENSIDAD', desc: '+2 daño básico de la torre', popup: '+2 DAÑO' },
        focus: { name: 'INFLUENCIA', desc: '+20% alcance de ataque de la torre', popup: '+20% ALCANCE DE ATAQUE' },
        regen: { name: 'RECUPERACIÓN', desc: '+0.2 regeneración de salud', popup: '+0.2 REGENERACIÓN' },
        crypto_mine_unlock: { name: 'MINA CRIPTO', desc: 'Desbloquea la Mina Cripto.', popup: 'MINA DESBLOQUEADA' },
        armor: { name: 'SEGURIDAD', desc: 'Reduce el daño recibido en 1.', popup: '+1 ARMADURA' },
        lightning_weapon: { name: 'RAYO', desc: 'La torre dispara rayos cada 3s que encadenan enemigos.', popup: 'ARMA DE RAYO' },
        shockwave_weapon: { name: 'ONDA DE CHOQUE', desc: 'La torre libera una onda de choque cada 3s que daña enemigos cercanos.', popup: 'ARMA DE ONDA' },
        lightning_chain: { name: 'RAMIFICACIÓN', desc: '+1 objetivo de cadena de rayo', popup: '+1 CADENA' },
        lightning_boost: { name: 'VOLTAJE', desc: '+2 daño de rayo', popup: '+2 DAÑO DE RAYO' },
        lightning_static_charge: { name: 'CARGA ESTÁTICA', desc: 'El rayo inflige +50% daño por nivel a enemigos con más de 80% de vida', popup: 'CARGA ESTÁTICA' },
        shockwave_amplifier: { name: 'AMPLIFICADOR', desc: '+40% alcance de onda', popup: '+40% ALCANCE' },
        shockwave_resonance: { name: 'RESONANCIA', desc: 'La onda inflige +1 daño/nivel por cada enemigo golpeado', popup: 'FRECUENCIA DE RESONANCIA' },
        shockwave_seismic_crush: { name: 'APLASTAMIENTO SÍSMICO', desc: 'La onda inflige +50% daño por nivel a enemigos con menos de 50% de vida', popup: 'APLASTAMIENTO SÍSMICO' },
        base_hp_boost: { name: 'ESTABILIDAD', desc: '+10 salud máxima de la torre', popup: '+10 SALUD MÁXIMA' },
        overclock: { name: 'OVERCLOCK', desc: '-25% enfriamiento de ataque de torre', popup: '-25% ENFRIAMIENTO' },
        prismatic_array: { name: 'ARREGLO PRISMÁTICO', desc: '+25% probabilidad de disparar un proyectil extra', popup: 'ARREGLO PRISMÁTICO' },
        data_compression: { name: 'COMPRESIÓN DE DATOS', desc: '50% probabilidad de duplicar los DATA recogidos', popup: 'COMPRESIÓN DE DATOS' }
    },
    milestones: {
        kill_100: { name: 'Primer Centenar', desc: 'Elimina 100 enemigos' },
        kill_500: { name: 'Exterminador', desc: 'Elimina 500 enemigos' },
        kill_2000: { name: 'Aniquilador', desc: 'Elimina 2000 enemigos' },
        data_1000: { name: 'Acaparador de Datos', desc: 'Recolecta 1,000 DATA en total' },
        data_10000: { name: 'Bóveda de Datos', desc: 'Recolecta 10,000 DATA en total' },
        waves_10: { name: 'Veterano', desc: 'Completa 10 oleadas' },
        waves_50: { name: 'Experimentado', desc: 'Completa 50 oleadas' },
        nodes_5: { name: 'Ramificándose', desc: 'Compra 5 nodos' },
        nodes_15: { name: 'Red Neuronal', desc: 'Compra 15 nodos' },
        boss_1: { name: 'Anulación del Sistema', desc: 'Derrota a un jefe' }
    },
    tutorial: {
        combat_collect: 'RECOGE DATA ◈ PARA EVOLUCIONAR',
        upgrade_use: 'USA DATA ◈ PARA EVOLUCIONAR',
        unlock_shards: 'Desbloquea habilidades con ◆',
        duo_swap_free: 'CAMBIAR HABILIDADES ES GRATIS'
    },
    options: {
        title: '// CONFIGURACIÓN DE OPCIONES ',
        audio: 'AUDIO ',
        music_vol: 'VOLUMEN DE MÚSICA ',
        sfx_vol: 'VOLUMEN DE SFX ',
        visual: 'VISUAL ',
        chroma: 'ABERRACIÓN CROMÁTICA ',
        dmg_numbers: 'NÚMEROS DE DAÑO ',
        particles: 'PARTÍCULAS ',
        gameplay: 'JUGABILIDAD ',
        language: 'IDIOMA ',
        data_label: 'DATA',
        reset_progress: '[ ⚠ REINICIAR PROGRESO !! ]',
        confirm_reset: '[ HAZ CLIC OTRA VEZ PARA CONFIRMAR ]'
    },
    results: {
        iteration_complete: 'ITERACIÓN COMPLETA',
        boss_defeated: 'JEFE DERROTADO',
        no_resources: 'sin recursos',
        data_collected: '◈ DATA recogidos: {0}',
        insight_gained: '⦵ INSIGHT obtenido: {0}',
        shards_found: '♦ SHARDS encontrados: {0}',
        processors_salvaged: '■ PROCESSORS recuperados: {0}',
        anomaly_detected: 'ANOMALÍA DEL SISTEMA DETECTADA'
    },
    loading_screen: {
        status: 'Cargando... ({0})',
        slow: 'Carga lenta detectada',
        error: 'Error de carga, ¿ejecutar de todos modos?',
        run_anyways: 'EJECUTAR DE TODOS MODOS'
    },
    tooltips: {
        max: 'MÁX',
        active: 'ACTIVO',
        swap: 'HAZ CLIC PARA CAMBIAR',
        level: 'Nv. {0} / {1}'
    }
};
