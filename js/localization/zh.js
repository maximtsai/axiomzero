if (!window.TRANSLATIONS) window.TRANSLATIONS = {};

window.TRANSLATIONS.zh = {
    ui: {
        loading: '加载中...',
        title: '公理零',
        yes: '是',
        no: '否',
        replay: '重玩',
        back: '返回',
        continue: '继续',
        retry: '重试',
        upgrades: '升级',
        end_iteration: '结束迭代',
        exp_percent: '经验 {0}%',
        done: '完成'
    },
    nodes: {
        awaken: { name: '觉醒', desc: '开始存在。' },
        basic_pulse: { name: '认知', desc: '你的光标现在会自动攻击。', popup: '脉冲已解锁' },
        pulse_damage: { name: '专注', desc: '+2 光标伤害', popup: '+2 光标伤害' },
        magnet: { name: '汇聚', desc: '+40% 资源拾取范围', popup: '+40% 拾取范围' },
        pulse_expansion: { name: '扩展', desc: '+30% 光标攻击范围', popup: '+30% 光标大小' },
        pulse_damage_3: { name: '过载', desc: '+4 光标伤害', popup: '+4 光标伤害' },
        integrity: { name: '完整性', desc: '+5 塔最大生命值', popup: '+5 最大生命值' },
        intensity: { name: '强度', desc: '+2 塔基础伤害', popup: '+2 伤害' },
        focus: { name: '影响', desc: '+20% 塔攻击范围', popup: '+20% 攻击范围' },
        regen: { name: '恢复', desc: '+0.2 生命恢复', popup: '+0.2 回复' },
        crypto_mine_unlock: { name: '加密矿井', desc: '解锁加密矿井。', popup: '矿井已解锁' },
        armor: { name: '防护', desc: '受到的伤害减少 1。', popup: '+1 护甲' },
        lightning_weapon: { name: '闪电', desc: '塔每3秒释放闪电，在敌人之间连锁。', popup: '闪电武器' },
        shockwave_weapon: { name: '冲击波', desc: '塔每3秒释放一次冲击波，伤害附近敌人。', popup: '冲击波武器' },
        lightning_chain: { name: '分叉', desc: '+1 闪电连锁目标', popup: '+1 连锁' },
        lightning_boost: { name: '电压', desc: '+2 闪电伤害', popup: '+2 闪电伤害' },
        lightning_static_charge: { name: '静电充能', desc: '闪电对生命值高于80%的敌人每级造成+50%伤害', popup: '静电充能' },
        shockwave_amplifier: { name: '放大器', desc: '+40% 冲击波范围', popup: '+40% 范围' },
        shockwave_resonance: { name: '共振', desc: '冲击波每击中一个敌人每级+1伤害', popup: '共振频率' },
        shockwave_seismic_crush: { name: '地震粉碎', desc: '冲击波对生命低于50%的敌人每级+50%伤害', popup: '地震粉碎' },
        base_hp_boost: { name: '稳定性', desc: '+10 塔最大生命值', popup: '+10 最大生命值' },
        overclock: { name: '超频', desc: '-25% 塔攻击冷却', popup: '-25% 冷却' },
        prismatic_array: { name: '棱镜阵列', desc: '+25% 概率发射额外弹体', popup: '棱镜阵列' },
        data_compression: { name: '数据压缩', desc: '50% 概率使收集的DATA翻倍', popup: '数据压缩' }
    },
    milestones: {
        kill_100: { name: '第一百', desc: '击杀100个敌人' },
        kill_500: { name: '歼灭者', desc: '击杀500个敌人' },
        kill_2000: { name: '毁灭者', desc: '击杀2000个敌人' },
        data_1000: { name: '数据囤积者', desc: '累计收集1000 DATA' },
        data_10000: { name: '数据宝库', desc: '累计收集10000 DATA' },
        waves_10: { name: '老兵', desc: '完成10波' },
        waves_50: { name: '资深者', desc: '完成50波' },
        nodes_5: { name: '初步扩展', desc: '购买5个节点' },
        nodes_15: { name: '神经网络', desc: '购买15个节点' },
        boss_1: { name: '系统覆写', desc: '击败一个Boss' }
    },
    tutorial: {
        combat_collect: '收集 DATA ◈ 以进化',
        upgrade_use: '使用 DATA ◈ 进化',
        unlock_shards: '使用 ◆ 解锁新能力',
        duo_swap_free: '切换能力是免费的'
    },
    options: {
        title: '// 选项配置 ',
        audio: '音频 ',
        music_vol: '音乐音量 ',
        sfx_vol: '音效音量 ',
        visual: '视觉 ',
        chroma: '色差效果 ',
        dmg_numbers: '伤害数字 ',
        particles: '粒子效果 ',
        gameplay: '游戏玩法 ',
        language: '语言 ',
        data_label: 'DATA',
        reset_progress: '[ ⚠ 重置进度 !! ]',
        confirm_reset: '[ 再次点击确认 ]'
    },
    results: {
        iteration_complete: '迭代完成',
        boss_defeated: 'Boss 已击败',
        no_resources: '无资源',
        data_collected: '◈ 收集 DATA: {0}',
        insight_gained: '⦵ 获得 INSIGHT: {0}',
        shards_found: '♦ 发现 SHARDS: {0}',
        processors_salvaged: '■ 回收 PROCESSORS: {0}',
        anomaly_detected: '检测到系统异常'
    },
    loading_screen: {
        status: '加载中... ({0})',
        slow: '检测到加载缓慢',
        error: '加载错误，仍然运行游戏？',
        run_anyways: '仍然运行'
    },
    tooltips: {
        max: '最大',
        active: '激活',
        swap: '点击切换',
        level: '等级 {0} / {1}'
    }
};
