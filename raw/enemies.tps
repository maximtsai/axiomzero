<?xml version="1.0" encoding="UTF-8"?>
<data version="1.0">
    <struct type="Settings">
        <key>fileFormatVersion</key>
        <int>6</int>
        <key>texturePackerVersion</key>
        <string>7.2.0</string>
        <key>autoSDSettings</key>
        <array>
            <struct type="AutoSDSettings">
                <key>scale</key>
                <double>1</double>
                <key>extension</key>
                <string></string>
                <key>spriteFilter</key>
                <string></string>
                <key>acceptFractionalValues</key>
                <false/>
                <key>maxTextureSize</key>
                <QSize>
                    <key>width</key>
                    <int>-1</int>
                    <key>height</key>
                    <int>-1</int>
                </QSize>
            </struct>
        </array>
        <key>allowRotation</key>
        <false/>
        <key>shapeDebug</key>
        <false/>
        <key>dpi</key>
        <uint>72</uint>
        <key>dataFormat</key>
        <string>phaser-maxim</string>
        <key>textureFileName</key>
        <filename>../assets/sprites/enemies-{n}.webp</filename>
        <key>flipPVR</key>
        <false/>
        <key>pvrQualityLevel</key>
        <uint>3</uint>
        <key>astcQualityLevel</key>
        <uint>2</uint>
        <key>basisUniversalQualityLevel</key>
        <uint>2</uint>
        <key>etc1QualityLevel</key>
        <uint>70</uint>
        <key>etc2QualityLevel</key>
        <uint>70</uint>
        <key>dxtCompressionMode</key>
        <enum type="SettingsBase::DxtCompressionMode">DXT_PERCEPTUAL</enum>
        <key>ditherType</key>
        <enum type="SettingsBase::DitherType">NearestNeighbour</enum>
        <key>backgroundColor</key>
        <uint>0</uint>
        <key>libGdx</key>
        <struct type="LibGDX">
            <key>filtering</key>
            <struct type="LibGDXFiltering">
                <key>x</key>
                <enum type="LibGDXFiltering::Filtering">Linear</enum>
                <key>y</key>
                <enum type="LibGDXFiltering::Filtering">Linear</enum>
            </struct>
        </struct>
        <key>shapePadding</key>
        <uint>0</uint>
        <key>jpgQuality</key>
        <uint>80</uint>
        <key>pngOptimizationLevel</key>
        <uint>1</uint>
        <key>webpQualityLevel</key>
        <uint>93</uint>
        <key>textureSubPath</key>
        <string></string>
        <key>textureFormat</key>
        <enum type="SettingsBase::TextureFormat">webp</enum>
        <key>borderPadding</key>
        <uint>0</uint>
        <key>maxTextureSize</key>
        <QSize>
            <key>width</key>
            <int>2048</int>
            <key>height</key>
            <int>2048</int>
        </QSize>
        <key>fixedTextureSize</key>
        <QSize>
            <key>width</key>
            <int>-1</int>
            <key>height</key>
            <int>-1</int>
        </QSize>
        <key>algorithmSettings</key>
        <struct type="AlgorithmSettings">
            <key>algorithm</key>
            <enum type="AlgorithmSettings::AlgorithmId">MaxRects</enum>
            <key>freeSizeMode</key>
            <enum type="AlgorithmSettings::AlgorithmFreeSizeMode">Best</enum>
            <key>sizeConstraints</key>
            <enum type="AlgorithmSettings::SizeConstraints">AnySize</enum>
            <key>forceSquared</key>
            <false/>
            <key>maxRects</key>
            <struct type="AlgorithmMaxRectsSettings">
                <key>heuristic</key>
                <enum type="AlgorithmMaxRectsSettings::Heuristic">Best</enum>
            </struct>
            <key>basic</key>
            <struct type="AlgorithmBasicSettings">
                <key>sortBy</key>
                <enum type="AlgorithmBasicSettings::SortBy">Best</enum>
                <key>order</key>
                <enum type="AlgorithmBasicSettings::Order">Ascending</enum>
            </struct>
            <key>polygon</key>
            <struct type="AlgorithmPolygonSettings">
                <key>alignToGrid</key>
                <uint>1</uint>
            </struct>
        </struct>
        <key>dataFileNames</key>
        <map type="GFileNameMap">
            <key>json</key>
            <struct type="DataFile">
                <key>name</key>
                <filename>../assets/sprites/enemies.json</filename>
            </struct>
        </map>
        <key>multiPackMode</key>
        <enum type="SettingsBase::MultiPackMode">MultiPackAuto</enum>
        <key>forceIdenticalLayout</key>
        <false/>
        <key>outputFormat</key>
        <enum type="SettingsBase::OutputFormat">RGBA8888</enum>
        <key>alphaHandling</key>
        <enum type="SettingsBase::AlphaHandling">ClearTransparentPixels</enum>
        <key>contentProtection</key>
        <struct type="ContentProtection">
            <key>key</key>
            <string></string>
        </struct>
        <key>autoAliasEnabled</key>
        <true/>
        <key>trimSpriteNames</key>
        <false/>
        <key>prependSmartFolderName</key>
        <false/>
        <key>autodetectAnimations</key>
        <true/>
        <key>globalSpriteSettings</key>
        <struct type="SpriteSettings">
            <key>scale</key>
            <double>1</double>
            <key>scaleMode</key>
            <enum type="ScaleMode">Smooth</enum>
            <key>extrude</key>
            <uint>1</uint>
            <key>trimThreshold</key>
            <uint>1</uint>
            <key>trimMargin</key>
            <uint>1</uint>
            <key>trimMode</key>
            <enum type="SpriteSettings::TrimMode">Trim</enum>
            <key>tracerTolerance</key>
            <int>200</int>
            <key>heuristicMask</key>
            <false/>
            <key>defaultPivotPoint</key>
            <point_f>0.5,0.5</point_f>
            <key>writePivotPoints</key>
            <true/>
        </struct>
        <key>individualSpriteSettings</key>
        <map type="IndividualSpriteSettingsMap">
            <key type="filename">enemies/basic.png</key>
            <key type="filename">enemies/basic_enemy_glow.png</key>
            <key type="filename">enemies/bomb.png</key>
            <key type="filename">enemies/bomb_glow.png</key>
            <key type="filename">enemies/bullet.png</key>
            <key type="filename">enemies/chargeup.png</key>
            <key type="filename">enemies/enemy_glow.png</key>
            <key type="filename">enemies/fast.png</key>
            <key type="filename">enemies/heavy.png</key>
            <key type="filename">enemies/logic_stray.png</key>
            <key type="filename">enemies/projectile.png</key>
            <key type="filename">enemies/protector.png</key>
            <key type="filename">enemies/shooter.png</key>
            <key type="filename">enemies/sniper.png</key>
            <key type="filename">enemies/sniper_projectile.png</key>
            <key type="filename">enemies/sniper_projectile_big.png</key>
            <key type="filename">enemies/sniper_projectile_big1.png</key>
            <key type="filename">enemies/sniper_projectile_big2.png</key>
            <key type="filename">enemies/swarmer.png</key>
            <struct type="IndividualSpriteSettings">
                <key>pivotPoint</key>
                <point_f>0.5,0.5</point_f>
                <key>spriteScale</key>
                <double>1</double>
                <key>scale9Enabled</key>
                <false/>
                <key>scale9Borders</key>
                <rect>25,25,51,51</rect>
                <key>scale9Paddings</key>
                <rect>25,25,51,51</rect>
                <key>scale9FromFile</key>
                <false/>
            </struct>
            <key type="filename">enemies/basic_enemy_hp.png</key>
            <struct type="IndividualSpriteSettings">
                <key>pivotPoint</key>
                <point_f>0.5,0.5</point_f>
                <key>spriteScale</key>
                <double>1</double>
                <key>scale9Enabled</key>
                <false/>
                <key>scale9Borders</key>
                <rect>5,5,9,9</rect>
                <key>scale9Paddings</key>
                <rect>5,5,9,9</rect>
                <key>scale9FromFile</key>
                <false/>
            </struct>
            <key type="filename">enemies/bomb_hp.png</key>
            <struct type="IndividualSpriteSettings">
                <key>pivotPoint</key>
                <point_f>0.5,0.5</point_f>
                <key>spriteScale</key>
                <double>1</double>
                <key>scale9Enabled</key>
                <false/>
                <key>scale9Borders</key>
                <rect>9,9,19,19</rect>
                <key>scale9Paddings</key>
                <rect>9,9,19,19</rect>
                <key>scale9FromFile</key>
                <false/>
            </struct>
            <key type="filename">enemies/boss2_hp.png</key>
            <struct type="IndividualSpriteSettings">
                <key>pivotPoint</key>
                <point_f>0.5,0.5</point_f>
                <key>spriteScale</key>
                <double>1</double>
                <key>scale9Enabled</key>
                <false/>
                <key>scale9Borders</key>
                <rect>73,26,145,53</rect>
                <key>scale9Paddings</key>
                <rect>73,26,145,53</rect>
                <key>scale9FromFile</key>
                <false/>
            </struct>
            <key type="filename">enemies/boss3_attack.png</key>
            <key type="filename">enemies/boss3_attack_thick.png</key>
            <struct type="IndividualSpriteSettings">
                <key>pivotPoint</key>
                <point_f>0.5,0.5</point_f>
                <key>spriteScale</key>
                <double>1</double>
                <key>scale9Enabled</key>
                <false/>
                <key>scale9Borders</key>
                <rect>155,155,310,310</rect>
                <key>scale9Paddings</key>
                <rect>155,155,310,310</rect>
                <key>scale9FromFile</key>
                <false/>
            </struct>
            <key type="filename">enemies/boss5_hp.png</key>
            <struct type="IndividualSpriteSettings">
                <key>pivotPoint</key>
                <point_f>0.5,0.5</point_f>
                <key>spriteScale</key>
                <double>1</double>
                <key>scale9Enabled</key>
                <false/>
                <key>scale9Borders</key>
                <rect>94,94,187,187</rect>
                <key>scale9Paddings</key>
                <rect>94,94,187,187</rect>
                <key>scale9FromFile</key>
                <false/>
            </struct>
            <key type="filename">enemies/boss_1.png</key>
            <struct type="IndividualSpriteSettings">
                <key>pivotPoint</key>
                <point_f>0.5,0.5</point_f>
                <key>spriteScale</key>
                <double>1</double>
                <key>scale9Enabled</key>
                <false/>
                <key>scale9Borders</key>
                <rect>100,100,201,201</rect>
                <key>scale9Paddings</key>
                <rect>100,100,201,201</rect>
                <key>scale9FromFile</key>
                <false/>
            </struct>
            <key type="filename">enemies/boss_2.png</key>
            <struct type="IndividualSpriteSettings">
                <key>pivotPoint</key>
                <point_f>0.5,0.5</point_f>
                <key>spriteScale</key>
                <double>1</double>
                <key>scale9Enabled</key>
                <false/>
                <key>scale9Borders</key>
                <rect>125,125,250,250</rect>
                <key>scale9Paddings</key>
                <rect>125,125,250,250</rect>
                <key>scale9FromFile</key>
                <false/>
            </struct>
            <key type="filename">enemies/boss_2_turret.png</key>
            <struct type="IndividualSpriteSettings">
                <key>pivotPoint</key>
                <point_f>0.5,0.5</point_f>
                <key>spriteScale</key>
                <double>1</double>
                <key>scale9Enabled</key>
                <false/>
                <key>scale9Borders</key>
                <rect>53,23,105,45</rect>
                <key>scale9Paddings</key>
                <rect>53,23,105,45</rect>
                <key>scale9FromFile</key>
                <false/>
            </struct>
            <key type="filename">enemies/boss_3.png</key>
            <struct type="IndividualSpriteSettings">
                <key>pivotPoint</key>
                <point_f>0.5,0.5</point_f>
                <key>spriteScale</key>
                <double>0.96</double>
                <key>scale9Enabled</key>
                <false/>
                <key>scale9Borders</key>
                <rect>100,100,200,200</rect>
                <key>scale9Paddings</key>
                <rect>100,100,200,200</rect>
                <key>scale9FromFile</key>
                <false/>
            </struct>
            <key type="filename">enemies/boss_3_charge.png</key>
            <struct type="IndividualSpriteSettings">
                <key>pivotPoint</key>
                <point_f>0.5,0.5</point_f>
                <key>spriteScale</key>
                <double>0.96</double>
                <key>scale9Enabled</key>
                <false/>
                <key>scale9Borders</key>
                <rect>118,118,235,235</rect>
                <key>scale9Paddings</key>
                <rect>118,118,235,235</rect>
                <key>scale9FromFile</key>
                <false/>
            </struct>
            <key type="filename">enemies/boss_3_heal_packet.png</key>
            <struct type="IndividualSpriteSettings">
                <key>pivotPoint</key>
                <point_f>0.5,0.5</point_f>
                <key>spriteScale</key>
                <double>1</double>
                <key>scale9Enabled</key>
                <false/>
                <key>scale9Borders</key>
                <rect>25,25,50,50</rect>
                <key>scale9Paddings</key>
                <rect>25,25,50,50</rect>
                <key>scale9FromFile</key>
                <false/>
            </struct>
            <key type="filename">enemies/boss_3_hp.png</key>
            <struct type="IndividualSpriteSettings">
                <key>pivotPoint</key>
                <point_f>0.5,0.5</point_f>
                <key>spriteScale</key>
                <double>0.96</double>
                <key>scale9Enabled</key>
                <false/>
                <key>scale9Borders</key>
                <rect>34,20,68,40</rect>
                <key>scale9Paddings</key>
                <rect>34,20,68,40</rect>
                <key>scale9FromFile</key>
                <false/>
            </struct>
            <key type="filename">enemies/boss_5.png</key>
            <struct type="IndividualSpriteSettings">
                <key>pivotPoint</key>
                <point_f>0.5,0.5</point_f>
                <key>spriteScale</key>
                <double>1</double>
                <key>scale9Enabled</key>
                <false/>
                <key>scale9Borders</key>
                <rect>150,150,300,300</rect>
                <key>scale9Paddings</key>
                <rect>150,150,300,300</rect>
                <key>scale9FromFile</key>
                <false/>
            </struct>
            <key type="filename">enemies/boss_hp.png</key>
            <struct type="IndividualSpriteSettings">
                <key>pivotPoint</key>
                <point_f>0.5,0.5</point_f>
                <key>spriteScale</key>
                <double>1</double>
                <key>scale9Enabled</key>
                <false/>
                <key>scale9Borders</key>
                <rect>47,47,94,94</rect>
                <key>scale9Paddings</key>
                <rect>47,47,94,94</rect>
                <key>scale9FromFile</key>
                <false/>
            </struct>
            <key type="filename">enemies/bosscircle.png</key>
            <struct type="IndividualSpriteSettings">
                <key>pivotPoint</key>
                <point_f>0.5,0.5</point_f>
                <key>spriteScale</key>
                <double>1</double>
                <key>scale9Enabled</key>
                <false/>
                <key>scale9Borders</key>
                <rect>136,136,271,271</rect>
                <key>scale9Paddings</key>
                <rect>136,136,271,271</rect>
                <key>scale9FromFile</key>
                <false/>
            </struct>
            <key type="filename">enemies/bosscircle_hp.png</key>
            <struct type="IndividualSpriteSettings">
                <key>pivotPoint</key>
                <point_f>0.5,0.5</point_f>
                <key>spriteScale</key>
                <double>1</double>
                <key>scale9Enabled</key>
                <false/>
                <key>scale9Borders</key>
                <rect>82,82,165,165</rect>
                <key>scale9Paddings</key>
                <rect>82,82,165,165</rect>
                <key>scale9FromFile</key>
                <false/>
            </struct>
            <key type="filename">enemies/default_enemy_glow.png</key>
            <key type="filename">enemies/invis.png</key>
            <struct type="IndividualSpriteSettings">
                <key>pivotPoint</key>
                <point_f>0.5,0.5</point_f>
                <key>spriteScale</key>
                <double>1</double>
                <key>scale9Enabled</key>
                <false/>
                <key>scale9Borders</key>
                <rect>1,1,1,1</rect>
                <key>scale9Paddings</key>
                <rect>1,1,1,1</rect>
                <key>scale9FromFile</key>
                <false/>
            </struct>
            <key type="filename">enemies/explosion_anim0.png</key>
            <key type="filename">enemies/explosion_anim1.png</key>
            <key type="filename">enemies/explosion_anim10.png</key>
            <key type="filename">enemies/explosion_anim11.png</key>
            <key type="filename">enemies/explosion_anim2.png</key>
            <key type="filename">enemies/explosion_anim3.png</key>
            <key type="filename">enemies/explosion_anim4.png</key>
            <key type="filename">enemies/explosion_anim5.png</key>
            <key type="filename">enemies/explosion_anim6.png</key>
            <key type="filename">enemies/explosion_anim7.png</key>
            <key type="filename">enemies/explosion_anim8.png</key>
            <key type="filename">enemies/explosion_anim9.png</key>
            <struct type="IndividualSpriteSettings">
                <key>pivotPoint</key>
                <point_f>0.5,0.5</point_f>
                <key>spriteScale</key>
                <double>1</double>
                <key>scale9Enabled</key>
                <false/>
                <key>scale9Borders</key>
                <rect>30,30,59,59</rect>
                <key>scale9Paddings</key>
                <rect>30,30,59,59</rect>
                <key>scale9FromFile</key>
                <false/>
            </struct>
            <key type="filename">enemies/explosion_flash.png</key>
            <key type="filename">enemies/explosion_white.png</key>
            <key type="filename">enemies/warning_area.png</key>
            <struct type="IndividualSpriteSettings">
                <key>pivotPoint</key>
                <point_f>0.5,0.5</point_f>
                <key>spriteScale</key>
                <double>1</double>
                <key>scale9Enabled</key>
                <false/>
                <key>scale9Borders</key>
                <rect>118,118,235,235</rect>
                <key>scale9Paddings</key>
                <rect>118,118,235,235</rect>
                <key>scale9FromFile</key>
                <false/>
            </struct>
            <key type="filename">enemies/explosion_ray.png</key>
            <struct type="IndividualSpriteSettings">
                <key>pivotPoint</key>
                <point_f>0.5,0.5</point_f>
                <key>spriteScale</key>
                <double>1</double>
                <key>scale9Enabled</key>
                <false/>
                <key>scale9Borders</key>
                <rect>50,15,100,30</rect>
                <key>scale9Paddings</key>
                <rect>50,15,100,30</rect>
                <key>scale9FromFile</key>
                <false/>
            </struct>
            <key type="filename">enemies/explosion_ray_thin.png</key>
            <struct type="IndividualSpriteSettings">
                <key>pivotPoint</key>
                <point_f>0.5,0.5</point_f>
                <key>spriteScale</key>
                <double>1</double>
                <key>scale9Enabled</key>
                <false/>
                <key>scale9Borders</key>
                <rect>240,42,480,84</rect>
                <key>scale9Paddings</key>
                <rect>240,42,480,84</rect>
                <key>scale9FromFile</key>
                <false/>
            </struct>
            <key type="filename">enemies/fast_enemy_hp.png</key>
            <struct type="IndividualSpriteSettings">
                <key>pivotPoint</key>
                <point_f>0.5,0.5</point_f>
                <key>spriteScale</key>
                <double>1</double>
                <key>scale9Enabled</key>
                <false/>
                <key>scale9Borders</key>
                <rect>9,6,18,11</rect>
                <key>scale9Paddings</key>
                <rect>9,6,18,11</rect>
                <key>scale9FromFile</key>
                <false/>
            </struct>
            <key type="filename">enemies/fast_glow.png</key>
            <key type="filename">enemies/heavy_glow.png</key>
            <struct type="IndividualSpriteSettings">
                <key>pivotPoint</key>
                <point_f>0.5,0.5</point_f>
                <key>spriteScale</key>
                <double>1</double>
                <key>scale9Enabled</key>
                <false/>
                <key>scale9Borders</key>
                <rect>38,38,75,75</rect>
                <key>scale9Paddings</key>
                <rect>38,38,75,75</rect>
                <key>scale9FromFile</key>
                <false/>
            </struct>
            <key type="filename">enemies/heavy_hp.png</key>
            <struct type="IndividualSpriteSettings">
                <key>pivotPoint</key>
                <point_f>0.5,0.5</point_f>
                <key>spriteScale</key>
                <double>1</double>
                <key>scale9Enabled</key>
                <false/>
                <key>scale9Borders</key>
                <rect>19,21,37,43</rect>
                <key>scale9Paddings</key>
                <rect>19,21,37,43</rect>
                <key>scale9FromFile</key>
                <false/>
            </struct>
            <key type="filename">enemies/logic_stray_enemy_hp.png</key>
            <struct type="IndividualSpriteSettings">
                <key>pivotPoint</key>
                <point_f>0.5,0.5</point_f>
                <key>spriteScale</key>
                <double>1</double>
                <key>scale9Enabled</key>
                <false/>
                <key>scale9Borders</key>
                <rect>8,7,15,15</rect>
                <key>scale9Paddings</key>
                <rect>8,7,15,15</rect>
                <key>scale9FromFile</key>
                <false/>
            </struct>
            <key type="filename">enemies/miniboss_1.png</key>
            <struct type="IndividualSpriteSettings">
                <key>pivotPoint</key>
                <point_f>0.5,0.5</point_f>
                <key>spriteScale</key>
                <double>1</double>
                <key>scale9Enabled</key>
                <false/>
                <key>scale9Borders</key>
                <rect>50,50,101,101</rect>
                <key>scale9Paddings</key>
                <rect>50,50,101,101</rect>
                <key>scale9FromFile</key>
                <false/>
            </struct>
            <key type="filename">enemies/miniboss_1_enemy_hp.png</key>
            <struct type="IndividualSpriteSettings">
                <key>pivotPoint</key>
                <point_f>0.5,0.5</point_f>
                <key>spriteScale</key>
                <double>1</double>
                <key>scale9Enabled</key>
                <false/>
                <key>scale9Borders</key>
                <rect>11,13,21,25</rect>
                <key>scale9Paddings</key>
                <rect>11,13,21,25</rect>
                <key>scale9FromFile</key>
                <false/>
            </struct>
            <key type="filename">enemies/miniboss_2.png</key>
            <struct type="IndividualSpriteSettings">
                <key>pivotPoint</key>
                <point_f>0.5,0.5</point_f>
                <key>spriteScale</key>
                <double>1</double>
                <key>scale9Enabled</key>
                <false/>
                <key>scale9Borders</key>
                <rect>76,76,151,151</rect>
                <key>scale9Paddings</key>
                <rect>76,76,151,151</rect>
                <key>scale9FromFile</key>
                <false/>
            </struct>
            <key type="filename">enemies/miniboss_2_hp.png</key>
            <struct type="IndividualSpriteSettings">
                <key>pivotPoint</key>
                <point_f>0.5,0.5</point_f>
                <key>spriteScale</key>
                <double>1</double>
                <key>scale9Enabled</key>
                <false/>
                <key>scale9Borders</key>
                <rect>33,20,66,41</rect>
                <key>scale9Paddings</key>
                <rect>33,20,66,41</rect>
                <key>scale9FromFile</key>
                <false/>
            </struct>
            <key type="filename">enemies/miniboss_3.png</key>
            <struct type="IndividualSpriteSettings">
                <key>pivotPoint</key>
                <point_f>0.5,0.5</point_f>
                <key>spriteScale</key>
                <double>1</double>
                <key>scale9Enabled</key>
                <false/>
                <key>scale9Borders</key>
                <rect>86,86,171,171</rect>
                <key>scale9Paddings</key>
                <rect>86,86,171,171</rect>
                <key>scale9FromFile</key>
                <false/>
            </struct>
            <key type="filename">enemies/miniboss_3_hp.png</key>
            <struct type="IndividualSpriteSettings">
                <key>pivotPoint</key>
                <point_f>0.5,0.5</point_f>
                <key>spriteScale</key>
                <double>1</double>
                <key>scale9Enabled</key>
                <false/>
                <key>scale9Borders</key>
                <rect>38,43,75,85</rect>
                <key>scale9Paddings</key>
                <rect>38,43,75,85</rect>
                <key>scale9FromFile</key>
                <false/>
            </struct>
            <key type="filename">enemies/miniboss_sniper.png</key>
            <struct type="IndividualSpriteSettings">
                <key>pivotPoint</key>
                <point_f>0.5,0.5</point_f>
                <key>spriteScale</key>
                <double>1</double>
                <key>scale9Enabled</key>
                <false/>
                <key>scale9Borders</key>
                <rect>74,74,147,147</rect>
                <key>scale9Paddings</key>
                <rect>74,74,147,147</rect>
                <key>scale9FromFile</key>
                <false/>
            </struct>
            <key type="filename">enemies/miniboss_sniper_hp.png</key>
            <struct type="IndividualSpriteSettings">
                <key>pivotPoint</key>
                <point_f>0.5,0.5</point_f>
                <key>spriteScale</key>
                <double>1</double>
                <key>scale9Enabled</key>
                <false/>
                <key>scale9Borders</key>
                <rect>27,27,55,55</rect>
                <key>scale9Paddings</key>
                <rect>27,27,55,55</rect>
                <key>scale9FromFile</key>
                <false/>
            </struct>
            <key type="filename">enemies/pink_pulse.png</key>
            <struct type="IndividualSpriteSettings">
                <key>pivotPoint</key>
                <point_f>0.5,0.5</point_f>
                <key>spriteScale</key>
                <double>1</double>
                <key>scale9Enabled</key>
                <false/>
                <key>scale9Borders</key>
                <rect>35,35,70,70</rect>
                <key>scale9Paddings</key>
                <rect>35,35,70,70</rect>
                <key>scale9FromFile</key>
                <false/>
            </struct>
            <key type="filename">enemies/protector_aoe.png</key>
            <struct type="IndividualSpriteSettings">
                <key>pivotPoint</key>
                <point_f>0.5,0.5</point_f>
                <key>spriteScale</key>
                <double>1</double>
                <key>scale9Enabled</key>
                <false/>
                <key>scale9Borders</key>
                <rect>68,68,135,135</rect>
                <key>scale9Paddings</key>
                <rect>68,68,135,135</rect>
                <key>scale9FromFile</key>
                <false/>
            </struct>
            <key type="filename">enemies/protector_enemy_hp.png</key>
            <struct type="IndividualSpriteSettings">
                <key>pivotPoint</key>
                <point_f>0.5,0.5</point_f>
                <key>spriteScale</key>
                <double>1</double>
                <key>scale9Enabled</key>
                <false/>
                <key>scale9Borders</key>
                <rect>8,8,15,15</rect>
                <key>scale9Paddings</key>
                <rect>8,8,15,15</rect>
                <key>scale9FromFile</key>
                <false/>
            </struct>
            <key type="filename">enemies/shell.png</key>
            <struct type="IndividualSpriteSettings">
                <key>pivotPoint</key>
                <point_f>0.5,0.5</point_f>
                <key>spriteScale</key>
                <double>1</double>
                <key>scale9Enabled</key>
                <false/>
                <key>scale9Borders</key>
                <rect>28,15,55,30</rect>
                <key>scale9Paddings</key>
                <rect>28,15,55,30</rect>
                <key>scale9FromFile</key>
                <false/>
            </struct>
            <key type="filename">enemies/shell_glow.png</key>
            <struct type="IndividualSpriteSettings">
                <key>pivotPoint</key>
                <point_f>0.5,0.5</point_f>
                <key>spriteScale</key>
                <double>1</double>
                <key>scale9Enabled</key>
                <false/>
                <key>scale9Borders</key>
                <rect>50,35,100,70</rect>
                <key>scale9Paddings</key>
                <rect>50,35,100,70</rect>
                <key>scale9FromFile</key>
                <false/>
            </struct>
            <key type="filename">enemies/shell_hp.png</key>
            <struct type="IndividualSpriteSettings">
                <key>pivotPoint</key>
                <point_f>0.5,0.5</point_f>
                <key>spriteScale</key>
                <double>1</double>
                <key>scale9Enabled</key>
                <false/>
                <key>scale9Borders</key>
                <rect>23,13,45,25</rect>
                <key>scale9Paddings</key>
                <rect>23,13,45,25</rect>
                <key>scale9FromFile</key>
                <false/>
            </struct>
            <key type="filename">enemies/shooter_enemy_hp.png</key>
            <struct type="IndividualSpriteSettings">
                <key>pivotPoint</key>
                <point_f>0.5,0.5</point_f>
                <key>spriteScale</key>
                <double>1</double>
                <key>scale9Enabled</key>
                <false/>
                <key>scale9Borders</key>
                <rect>6,6,11,11</rect>
                <key>scale9Paddings</key>
                <rect>6,6,11,11</rect>
                <key>scale9FromFile</key>
                <false/>
            </struct>
            <key type="filename">enemies/sniper_enemy_hp.png</key>
            <struct type="IndividualSpriteSettings">
                <key>pivotPoint</key>
                <point_f>0.5,0.5</point_f>
                <key>spriteScale</key>
                <double>1</double>
                <key>scale9Enabled</key>
                <false/>
                <key>scale9Borders</key>
                <rect>8,8,17,17</rect>
                <key>scale9Paddings</key>
                <rect>8,8,17,17</rect>
                <key>scale9FromFile</key>
                <false/>
            </struct>
            <key type="filename">enemies/swarmer_enemy_hp.png</key>
            <struct type="IndividualSpriteSettings">
                <key>pivotPoint</key>
                <point_f>0.5,0.5</point_f>
                <key>spriteScale</key>
                <double>1</double>
                <key>scale9Enabled</key>
                <false/>
                <key>scale9Borders</key>
                <rect>4,4,8,8</rect>
                <key>scale9Paddings</key>
                <rect>4,4,8,8</rect>
                <key>scale9FromFile</key>
                <false/>
            </struct>
            <key type="filename">enemies/test.png</key>
            <struct type="IndividualSpriteSettings">
                <key>pivotPoint</key>
                <point_f>0.5,0.5</point_f>
                <key>spriteScale</key>
                <double>1</double>
                <key>scale9Enabled</key>
                <false/>
                <key>scale9Borders</key>
                <rect>35,35,71,71</rect>
                <key>scale9Paddings</key>
                <rect>35,35,71,71</rect>
                <key>scale9FromFile</key>
                <false/>
            </struct>
            <key type="filename">enemies/warning.png</key>
            <struct type="IndividualSpriteSettings">
                <key>pivotPoint</key>
                <point_f>0.5,0.5</point_f>
                <key>spriteScale</key>
                <double>1</double>
                <key>scale9Enabled</key>
                <false/>
                <key>scale9Borders</key>
                <rect>75,38,151,75</rect>
                <key>scale9Paddings</key>
                <rect>75,38,151,75</rect>
                <key>scale9FromFile</key>
                <false/>
            </struct>
            <key type="filename">enemies/warning_big.png</key>
            <struct type="IndividualSpriteSettings">
                <key>pivotPoint</key>
                <point_f>0.5,0.5</point_f>
                <key>spriteScale</key>
                <double>1</double>
                <key>scale9Enabled</key>
                <false/>
                <key>scale9Borders</key>
                <rect>75,63,151,125</rect>
                <key>scale9Paddings</key>
                <rect>75,63,151,125</rect>
                <key>scale9FromFile</key>
                <false/>
            </struct>
        </map>
        <key>fileLists</key>
        <map type="SpriteSheetMap">
            <key>default</key>
            <struct type="SpriteSheet">
                <key>files</key>
                <array>
                    <filename>enemies</filename>
                </array>
            </struct>
        </map>
        <key>ignoreFileList</key>
        <array/>
        <key>replaceList</key>
        <array/>
        <key>ignoredWarnings</key>
        <array/>
        <key>commonDivisorX</key>
        <uint>1</uint>
        <key>commonDivisorY</key>
        <uint>1</uint>
        <key>packNormalMaps</key>
        <false/>
        <key>autodetectNormalMaps</key>
        <true/>
        <key>normalMapFilter</key>
        <string></string>
        <key>normalMapSuffix</key>
        <string></string>
        <key>normalMapSheetFileName</key>
        <filename></filename>
        <key>exporterProperties</key>
        <map type="ExporterProperties"/>
    </struct>
</data>
