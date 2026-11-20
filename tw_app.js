// ---------------------------------------------------------------------------
// tw_app.js -- ThreeWay respected FreeWay（three.js）
//
// クラシックスクリプト。index.html のインライン module が three と addons を import し
// ThreeWayApp.start(THREE, addons) を呼ぶ（file:// でも動かすため）。
// ---------------------------------------------------------------------------
(function (global) {
'use strict';

// === 調整パラメータ ==========================================================
var P = {
    segLen:     1.0,      // コアの 1 区間 = 1 m
    unitHalf:   6.0,      // 横位置 ±405 単位に対応させる半幅。曲率と操舵の換算専用（道路幅とは独立）
    roadHalf:   9.3,      // 舗装の半幅 = 地覆の内面 [m]
    medianHalf: 0.6,      // 中央分離帯の半幅 [m]
    medianH:    0.22,     // 分離帯の縁石の高さ [m]
    innerLine:  1.15,     // 内側線（実線）の横位置
    laneDiv:    4.6,      // 車線境界線（破線）の横位置
    outerLine:  8.1,      // 外側線（実線）の横位置
    curbW:      0.45,     // 地覆の幅
    curbH:      0.25,     // 地覆の高さ
    fasciaH:    2.2,      // 桁の側面の高さ（路面から下へ）
    groundY:   -23.0,     // 地面の高さ（世界座標）。普段の高架の高さ ~22.6 m、道のりの 99.9% で桁下 9 m 以上（README 参照）
    curveScale: 0.8,      // コアの曲がりから曲率への倍率
    hillScale:  1.5,      // コアの起伏の倍率
    bankMax:    0.07,     // バンク角 [rad]（カーブ値 4 のとき）
    eyeH:       1.3,      // 視点の高さ [m]
    bikeEyeH:   1.15,     // v7: バイクの目の高さ [m]（路面の接地点から）
    bikeHeadH:  0.95,     // v7: バイクのヘッドライトの高さ [m]
    bikeHeadK:  0.88,     // v7: 一灯の光度（車の 1 灯に対する倍率。2 つを同じ位置に置くので、絞った配光と合わせ総光量は車の約 2/3）
    icMinR:     220,      // v8: IC の密着区間（減速車線・加速車線）の曲率半径の下限 [m]（設計は 600 m。この道はカーブが多く、600 m では 10 km 以上置けない）
    leanMax:    40,       // v7: ロールの上限 [度]
    encHfov:    74,       // v7: 出会いの統計で使う水平画角 [度]（横長 16:9 の画角 79° より少し内側。縦長の確認用に変えられる）
    bikeLatK:   0.11,     // v7: 車線移動の横加速度に掛ける倍率（ロールの大きさの調整）
    laneX:     -6.35,     // 走行位置（左側車道の左車線の中央）[m]
    latMin:    -7.3,      // ←/→ で動ける範囲
    latMax:    -2.0,
    yaw:        0,        // 確認用: 視線の水平回転 [度]（正 = 右）
    pitch:      0,        // 確認用: 視線の上下 [度]（負 = 下）
    speedKmh:   100,
    lookAhead:  14,       // 視線を向ける前方距離 [m]
    viewLen:    2300,     // 描く道路の長さ [m]
    backLen:    36,
    lampPeriod: 36,       // 街灯間隔 [m]
    lampPhase:  3,
    lampLat:    7.4,      // 灯具の横位置 [m]
    poleLat:    9.62,     // ポールの横位置（地覆の上）
    lampH:      11.0,     // 灯具の高さ [m]
    lampI:      420,      // 街灯の光度
    lampCol:    [1.0, 0.62, 0.22],
    railLat:    9.42,     // 外側ガードレールの横位置
    railY:      0.20,     // ガードレール断面の持ち上げ（地覆・縁石の上）
    pierPeriod: 36,       // 橋脚の間隔（道のり ≡ pierPhase mod 36。伸縮継手も同じ位置）
    pierPhase:  21,
    headI:      11000,
    headCol:    [1.0, 0.93, 0.80],
    retroPaint: 0.001,
    eClamp:     5,        // 街灯 1 灯あたりの照度の上限（灯具直下の白飛び防止）
    headClamp:  2.0,      // ヘッドライト 1 灯あたりの照度の上限（車両直前の白飛び防止）
    fogDensity: 0.0010,   // 地表での霧の密度 [1/m]
    fogH:       20,       // 霧の高さスケール [m]（exp(-h/fogH) で薄くなる）
    winGain:    1.0,      // ビルの窓明かりの強さ
    fogBase:    [0.012, 0.015, 0.026],
    fogGlow:    0.05,
    glowCol:    [1.0, 0.55, 0.28],
    glowStrength: 0.3,
    zenith:     [0.0045, 0.0065, 0.016],
    horizon:    [0.020, 0.025, 0.042],
    ground:     [0.005, 0.0055, 0.0075],
    ambient:    [0.006, 0.008, 0.014],
    milkyCol:   [0.55, 0.60, 0.80],
    milkyStrength: 0.012,   // 都会の光害でほぼ見えない程度
    wet:        0.85,
    roadGlow:   0.8,      // 路面に落ちる街灯の光の倍率（↑↓ で 0.5〜1.2 の 5 段階、保存）
    specK:      0.12,     // 濡れた路面の街灯の映り込みの芯を圧縮する係数 x/(1+kx)
    exposure:   0.7,
    bloomStrength: 0.38, bloomThreshold: 1.0, bloomKnee: 0.5,
    bloomClamp: 12,       // ブルームの前処理で輝度をここで頭打ち（1 画素の超高輝度が暴れない）
    vignette:   0.35, grain: 0.006,
    cityRadius: [4500, 7500],
    bldDebug: 0,          // 確認用: 0 より大きいと近い建物の壁をこの線形輝度で一様に塗る（明るさの校正用）
    bldRoadLight: 10.0,   // v6: 道路の街灯が沿道の建物の壁を照らす強さ（線光源の式の係数）
    bldStreetLight: 24.0, // v6: 足元の街路灯が壁を照らす強さ
    twinkle:    0.5,      // 星の瞬きの強さ（0 で瞬きなし）。S キーで 0〜1.0 を巡回し保存
    meteorMin: 40, meteorMax: 80,
    anchorReset: 4000,    // 世界固定物の基準点を取り直す距離 [m]（検査用に小さくできる）
    forceResEvery: 0      // 検査用: この秒数ごとに描画解像度を強制的に切り替える（0 = しない）
};

// 道のりの折り返し周期 [m]。シェーダの周期ノイズ（fbmP など）はこの周期で繰り返す
var STA_WRAP = 1440;

var QUALITY = [
    null,
    { name: 'Low',   prMax: 0.75, msaa: 0, bloom: true, bloomLevels: 4, lamps: 8,  normalNoise: false, cones: 0,  stars: 3000,  windows: 20000, trees: 500 },
    { name: 'Mid',   prMax: 1.0,  msaa: 0, bloom: true, bloomLevels: 5, lamps: 16, normalNoise: true,  cones: 8,  stars: 6000,  windows: 35000, trees: 900 },
    { name: 'High',  prMax: 1.25, msaa: 2, bloom: true, bloomLevels: 6, lamps: 24, normalNoise: true,  cones: 16, stars: 9000,  windows: 50000, trees: 1400 },
    { name: 'Ultra', prMax: 1.5,  msaa: 4, bloom: true, bloomLevels: 6, lamps: 32, normalNoise: true,  cones: 24, stars: 12000, windows: 70000, trees: 2000 }
];

// === 乱数（シーン生成用、道路コアとは別） ===================================
function mulberry32(a) {
    return function () {
        a |= 0; a = a + 0x6D2B79F5 | 0;
        var t = Math.imul(a ^ a >>> 15, 1 | a);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
}
function gauss(rng) { var u = 1 - rng(), v = rng(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(6.2831853 * v); }

function start(THREE, A) {
    var S = global.TW_SHADERS;
    var q = parseParams();
    var Q_ICDUMP = !!q.icdump, ARROW_LOG = [], Q_OLDRAIL = !!q.oldrail;
    var errBox = document.getElementById('err');
    function logErr(m) { if (errBox) { errBox.textContent += m + '\n'; errBox.style.display = 'block'; } }
    if (q.debug || q.shot) {
        var ce = console.error.bind(console), cw = console.warn.bind(console);
        console.error = function () { logErr('[error] ' + Array.prototype.join.call(arguments, ' ')); ce.apply(null, arguments); };
        console.warn  = function () { logErr('[warn] '  + Array.prototype.join.call(arguments, ' ')); cw.apply(null, arguments); };
    }

    // --- ユーザー設定（S: 星の瞬き、↑↓: 路面の明るさ）。localStorage は file:// で使えない場合があるので try/catch ---
    var SETTINGS_KEY = 'threeWay.settings';
    var settings = {};
    try { settings = JSON.parse(global.localStorage.getItem(SETTINGS_KEY) || '{}') || {}; } catch (e) { settings = {}; }
    function saveSettings() { try { global.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch (e) { /* 保存できなくても動く */ } }
    // URL の p.xxx が最優先、次に保存値、なければ既定
    if (!q.pSet.twinkle && typeof settings.twinkle === 'number') P.twinkle = settings.twinkle;
    var U_TWINKLE = { value: P.twinkle };
    if (!q.pSet.roadGlow && typeof settings.roadGlow === 'number') P.roadGlow = settings.roadGlow;
    var ROAD_LEVELS = [0.5, 0.65, 0.8, 1.0, 1.2];

    var seed = q.seed;
    var rng = mulberry32(seed * 7919 + 17);
    var qi = Math.min(4, Math.max(1, q.q || 3));
    var Q = QUALITY[qi];

    // --- 派生定数 -------------------------------------------------------------
    var unitM = P.unitHalf / 405;                            // 横位置 1 単位 [m]（道路幅を広げてもカーブは変わらない）
    var curveGain = unitM / 8 / P.segLen * P.curveScale;     // rad / 区間 / カーブ単位
    var hillGain  = (1.6 / 14) * unitM * P.hillScale;        // m / 丘単位
    var bankGain  = P.bankMax / 4;
    var GROUND_Y  = P.groundY;                               // 地面の高さ（世界座標）

    var track = new global.TwTrack({
        segLen: P.segLen, curveGain: curveGain, hillGain: hillGain, bankGain: bankGain, seed: seed
    });

    // --- レンダラ --------------------------------------------------------------
    var canvas = document.getElementById('gl');
    var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: false, powerPreference: 'high-performance', stencil: false });
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = P.exposure;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.autoClear = true;
    var dpr = global.devicePixelRatio || 1;
    var pointMax = (function () { try { var r = renderer.getContext().getParameter(renderer.getContext().ALIASED_POINT_SIZE_RANGE); return r ? r[1] : 64; } catch (e) { return 64; } })();

    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(50, 16 / 9, 0.3, 12000);
    scene.add(camera);

    // --- 共有ユニフォーム ----------------------------------------------------------
    var NLMAX = 32;
    var lampArr = [];
    for (var li = 0; li < NLMAX; li++) lampArr.push(new THREE.Vector4(0, 0, 0, 0));
    var cityTex = new THREE.DataTexture(new Uint8Array(512 * 4), 512, 1, THREE.RGBAFormat, THREE.UnsignedByteType);
    cityTex.wrapS = THREE.RepeatWrapping; cityTex.wrapT = THREE.ClampToEdgeWrapping;
    cityTex.magFilter = THREE.LinearFilter; cityTex.minFilter = THREE.LinearFilter;

    var U = {
        uCamPos:   { value: new THREE.Vector3() },
        uHeadPos0: { value: new THREE.Vector3() },
        uHeadPos1: { value: new THREE.Vector3() },
        uCarFwd:   { value: new THREE.Vector3(0, 0, -1) },
        uCarRight: { value: new THREE.Vector3(1, 0, 0) },
        uCarUp:    { value: new THREE.Vector3(0, 1, 0) },
        uHeadI:    { value: P.headI },
        uHeadW:    { value: 5.0 },
        uHeadCol:  { value: new THREE.Vector3().fromArray(P.headCol) },
        uLamps:    { value: lampArr },
        uLampCol:  { value: new THREE.Vector3().fromArray(P.lampCol) },
        uFogDensity: { value: P.fogDensity },
        uFogH:     { value: P.fogH },
        uOriginY:  { value: 0 },
        uFogBase:  { value: new THREE.Vector3().fromArray(P.fogBase) },
        uGlowCol:  { value: new THREE.Vector3().fromArray(P.glowCol) },
        uFogGlow:  { value: P.fogGlow },
        uCityTex:  { value: cityTex },
        uAmbient:  { value: new THREE.Vector3().fromArray(P.ambient) },
        uTime:     { value: 0 },
        uEClamp:   { value: P.eClamp },
        uHeadClamp: { value: P.headClamp },
        uPR:       { value: 1 },
        uPointMax: { value: pointMax },
        uLampPeriod: { value: P.lampPeriod },
        uLampPhase:  { value: P.lampPhase },
        uLampLat:    { value: P.lampLat },
        uLampH:      { value: P.lampH },
        uLampI:      { value: P.lampI },
        uExpMin:     { value: 0 },
        uExpMax:     { value: 0 }
    };
    // v7: 縦長の画面（携帯）では縦の画角を広げ、水平の画角を保つ（16:9 では従来どおり 50°。縦の画角は 80° まで）。
    // 縦の画角 50° のままだと 390×844 で水平 24° しかなく、横 27 m の並走線の電車は 100 m より先でしか画面に入らない
    function fovFor(aspect) {
        var vf = 2 * Math.atan(Math.tan(32 * Math.PI / 180) / Math.max(aspect, 0.1)) * 180 / Math.PI;
        return Math.max(50, Math.min(80, vf));
    }
    function uni(extra) { var o = {}; for (var k in U) o[k] = U[k]; if (extra) for (var k2 in extra) o[k2] = extra[k2]; return o; }
    function v3(a) { return new THREE.Vector3().fromArray(a); }

    // --- 空 ------------------------------------------------------------------------
    var skyGroup = new THREE.Group(); scene.add(skyGroup);
    var milkyM4 = new THREE.Matrix4().makeRotationY(rng() * 6.2831853)
        .premultiply(new THREE.Matrix4().makeRotationZ(1.08));
    var milkyRot = new THREE.Matrix3().setFromMatrix4(milkyM4);
    var milkyInv = new THREE.Matrix3().setFromMatrix4(new THREE.Matrix4().copy(milkyM4).transpose());
    var skyMat = new THREE.ShaderMaterial({
        vertexShader: S.skyVert, fragmentShader: S.skyFrag, side: THREE.BackSide, depthWrite: false, depthTest: false,
        uniforms: {
            uZenith: { value: v3(P.zenith) }, uHorizon: { value: v3(P.horizon) }, uGround: { value: v3(P.ground) },
            uGlowCol: U.uGlowCol, uGlowStrength: { value: P.glowStrength }, uCityTex: U.uCityTex,
            uMilkyRot: { value: milkyRot }, uMilkyCol: { value: v3(P.milkyCol) }, uMilkyStrength: { value: P.milkyStrength }
        }
    });
    var sky = new THREE.Mesh(new THREE.SphereGeometry(9000, 64, 32), skyMat);
    sky.renderOrder = -10; sky.frustumCulled = false; skyGroup.add(sky);

    // --- 星 --------------------------------------------------------------------------
    var starsObj = null;
    function buildStars(n) {
        if (starsObj) { skyGroup.remove(starsObj); starsObj.geometry.dispose(); }
        var total = n + 120;
        var pos = new Float32Array(total * 3), col = new Float32Array(total * 3), size = new Float32Array(total);
        var ph = new Float32Array(total), tw = new Float32Array(total);
        var r = 8500, k = 0;
        var tmp = new THREE.Vector3();
        var srng = mulberry32(seed * 131 + 5);
        for (var i = 0; i < n; i++) {
            var inBand = srng() < 0.32;
            if (inBand) {
                var u = srng() * 6.2831853, v = gauss(srng) * 0.13;
                tmp.set(Math.sin(u) * Math.cos(v), Math.sin(v), Math.cos(u) * Math.cos(v)).applyMatrix3(milkyInv);
                if (tmp.y < 0.0) tmp.y = -tmp.y;
            } else {
                var y = srng(), az = srng() * 6.2831853, rr = Math.sqrt(1 - y * y);
                tmp.set(rr * Math.sin(az), y, -rr * Math.cos(az));
            }
            pos[k * 3] = tmp.x * r; pos[k * 3 + 1] = tmp.y * r; pos[k * 3 + 2] = tmp.z * r;
            var t = srng();
            var cr, cg, cb;
            if (t < 0.25)      { cr = 0.72; cg = 0.80; cb = 1.00; }
            else if (t < 0.70) { cr = 0.92; cg = 0.94; cb = 1.00; }
            else if (t < 0.93) { cr = 1.00; cg = 0.92; cb = 0.78; }
            else               { cr = 1.00; cg = 0.72; cb = 0.52; }
            // 等級: 暗い星が圧倒的多数の急な偏り。大きさはほぼ全部 1 画素で、明るさで等級差を出す（v5）
            var rr0 = srng(), m = Math.pow(rr0, 6.0);                          // 大きさを決める等級（急な偏り）
            var br = 0.35 + 0.6 * rr0 * rr0 * rr0;                            // 明るさは少し緩い偏り（点の集まりとして読める）
            if (srng() < 0.0012) br = 1.6 + 0.7 * srng();                     // ブルームの閾値を超えるのは最も明るい数個だけ
            if (inBand) br *= 0.6;
            var keepS = rr0 > 0.45 || br >= 1.6;                               // 都会の空: 暗い星から間引き 5 割強を残す（乱数の消費は同じなので残る星の並びは変わらない）
            var sz = 1.0 + 1.1 * Math.max(0, Math.min(1, (m - 0.75) / 0.25)) * Math.max(0, Math.min(1, (m - 0.75) / 0.25)) * (3 - 2 * Math.max(0, Math.min(1, (m - 0.75) / 0.25)));
            col[k * 3] = cr * br; col[k * 3 + 1] = cg * br; col[k * 3 + 2] = cb * br;
            size[k] = sz; ph[k] = srng(); tw[k] = 0.6 + 0.4 * srng();          // 瞬きの強さのばらつき
            if (keepS) k++;
        }
        // コアが決めた 120 個の明るい星（方位・仰角・色）
        for (var j = 0; j < track.core.stars.length; j++) {
            var CS = track.core.stars[j], azo = CS.az, el = CS.el;
            tmp.set(Math.sin(azo) * Math.cos(el), Math.sin(el), -Math.cos(azo) * Math.cos(el));
            pos[k * 3] = tmp.x * r; pos[k * 3 + 1] = tmp.y * r; pos[k * 3 + 2] = tmp.z * r;
            var pr = CS.rgb[0], pg = CS.rgb[1], pb = CS.rgb[2];
            var bo = 1.3;
            col[k * 3] = pr * bo + 0.15; col[k * 3 + 1] = pg * bo; col[k * 3 + 2] = pb * bo;
            size[k] = 1.3; ph[k] = srng(); tw[k] = 1.2;                        // 明るい星は少し強く瞬く
            k++;                                                               // 明るい星はすべて残す
        }
        var g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        g.setAttribute('aCol', new THREE.BufferAttribute(col, 3));
        g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
        g.setAttribute('aPhase', new THREE.BufferAttribute(ph, 1));
        g.setAttribute('aTw', new THREE.BufferAttribute(tw, 1));
        g.setDrawRange(0, k);
        var mat = new THREE.ShaderMaterial({
            vertexShader: S.starVert, fragmentShader: S.starFrag, transparent: true,
            blending: THREE.AdditiveBlending, depthWrite: false, depthTest: true,
            uniforms: { uPR: U.uPR, uTime: U.uTime, uTwinkle: U_TWINKLE }
        });
        starsObj = new THREE.Points(g, mat);
        starsObj.renderOrder = -9; starsObj.frustumCulled = false;
        skyGroup.add(starsObj);
    }

    // --- 大都会（3 層）と遠い丘陵 ---------------------------------------------------------
    // 遠景: カメラに追従する半径 4.5〜7.5 km のリング（超高層群）、地平線の光の帯、丘陵のシルエット
    // 中景: 半径 2.3〜3.6 km のリング。カメラの移動に半分だけ追従させて層の間に視差を出す
    // 近景: 軌道沿いの世界座標に固定した街区（道路脇 700〜1800 m）。本当の視差で流れていく
    var cityGroup = new THREE.Group(); scene.add(cityGroup);
    var cityDens = new Float32Array(512);
    var crng = mulberry32(seed * 977 + 3);
    var A0 = crng() * 6.2831853;
    var clusters = [
        { az: A0, spread: 0.30, w: 1.0, tall: 1.0 },
        { az: A0 + 2.4 + crng() * 0.6, spread: 0.22, w: 0.5, tall: 0.55 },
        { az: A0 - 1.9 - crng() * 0.5, spread: 0.16, w: 0.35, tall: 0.4 }
    ];
    var cityMat = new THREE.ShaderMaterial({
        vertexShader: S.cityVert, fragmentShader: S.cityFrag,
        uniforms: {
            uCamPos: U.uCamPos, uFogDensity: U.uFogDensity, uFogH: U.uFogH, uOriginY: U.uOriginY,
            uFogBase: U.uFogBase, uGlowCol: U.uGlowCol, uFogGlow: U.uFogGlow, uCityTex: U.uCityTex,
            uBuilding: { value: new THREE.Vector3(0.0028, 0.0032, 0.0055) }, uWinGain: { value: P.winGain }
        }
    });
    function addDens(az, w, h, rad) {
        var ang = w / rad;
        var c0 = Math.floor(((az / 6.2831853) % 1 + 1) % 1 * 512);
        var span = Math.max(1, Math.round(ang / 6.2831853 * 512 * 3));
        for (var s = -span; s <= span; s++) cityDens[(c0 + s + 512) % 512] += h * w / 60000;
    }
    // リング状の層を生成。tallScale で高さ、rMin/rMax で半径
    function genRing(n, rMin, rMax, hBase, hTall, rngL) {
        var list = [];
        for (var i = 0; i < n; i++) {
            var pick = rngL(), az, h, tall;
            if (pick < 0.22) {
                az = rngL() * 6.2831853; tall = 0;
                h = hBase * (0.6 + rngL() * 1.2);
            } else {
                var cw = rngL() * 1.85, c = clusters[0];
                if (cw > 1.0) c = clusters[1];
                if (cw > 1.5) c = clusters[2];
                az = c.az + gauss(rngL) * c.spread;
                tall = c.tall * Math.exp(-Math.pow((az - c.az) / c.spread, 2) * 0.5);
                var hh = rngL(); hh = hh * hh;
                h = hBase * (0.8 + rngL() * 1.2) + hTall * hh * tall + hTall * 0.3 * tall;
            }
            var rad = rMin + rngL() * (rMax - rMin) - (tall > 0.3 ? (rMax - rMin) * 0.15 : 0);
            var w = 22 + rngL() * 55, d = 22 + rngL() * 55;
            var type = rngL() < (0.35 + 0.45 * tall) ? 0 : 1;          // 中心ほどオフィス
            var lit = type === 0 ? 0.25 + 0.45 * rngL() : 0.2 + 0.35 * rngL();
            list.push({ x: Math.sin(az) * rad, z: -Math.cos(az) * rad, y: 0, yaw: -az, w: w, d: d, h: h,
                        seed: rngL() * 100, type: type, lit: lit, az: az, r: rad });
            addDens(az, w, h, rad);
        }
        return list;
    }
    function makeLayer(list, group, capacity) {
        var n = capacity || list.length;
        var box = new THREE.BoxGeometry(1, 1, 1); box.translate(0, 0.5, 0);
        var aSeed = new Float32Array(n), aType = new Float32Array(n), aLit = new Float32Array(n);
        box.setAttribute('aSeed', new THREE.InstancedBufferAttribute(aSeed, 1).setUsage(THREE.DynamicDrawUsage));
        box.setAttribute('aType', new THREE.InstancedBufferAttribute(aType, 1).setUsage(THREE.DynamicDrawUsage));
        box.setAttribute('aLit',  new THREE.InstancedBufferAttribute(aLit, 1).setUsage(THREE.DynamicDrawUsage));
        var mesh = new THREE.InstancedMesh(box, cityMat, n);
        mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        mesh.frustumCulled = false;
        var m4 = new THREE.Matrix4(), pos = new THREE.Vector3(), qt = new THREE.Quaternion(), sc = new THREE.Vector3();
        for (var k = 0; k < list.length; k++) {
            var B = list[k];
            pos.set(B.x, B.y, B.z);
            qt.setFromAxisAngle(yAxis0, B.yaw);
            sc.set(B.w, B.h, B.d);
            m4.compose(pos, qt, sc);
            mesh.setMatrixAt(k, m4);
            aSeed[k] = B.seed; aType[k] = B.type; aLit[k] = B.lit;
        }
        mesh.count = list.length;
        mesh.instanceMatrix.needsUpdate = true;
        group.add(mesh);
        return mesh;
    }
    var yAxis0 = new THREE.Vector3(0, 1, 0);
    var farList = genRing(700, P.cityRadius[0], P.cityRadius[1], 40, 380, crng);
    // 密度テクスチャ（空の光害グローと霧の色に使う）
    (function () {
        for (var pass = 0; pass < 6; pass++) {
            var tmpD = new Float32Array(512);
            for (var b = 0; b < 512; b++) tmpD[b] = (cityDens[(b + 511) % 512] + cityDens[b] * 2 + cityDens[(b + 1) % 512]) * 0.25;
            cityDens = tmpD;
        }
        var mx = 0; for (var b2 = 0; b2 < 512; b2++) mx = Math.max(mx, cityDens[b2]);
        var data = cityTex.image.data;
        for (var b3 = 0; b3 < 512; b3++) {
            var v = Math.pow(Math.min(1, cityDens[b3] / mx), 0.7);
            cityDens[b3] = v;
            data[b3 * 4] = Math.round(v * 255); data[b3 * 4 + 1] = 0; data[b3 * 4 + 2] = 0; data[b3 * 4 + 3] = 255;
        }
        cityTex.needsUpdate = true;
    })();
    makeLayer(farList, cityGroup);

    // 中景リング（カメラに半分追従）と近景の街区は廃止。世界座標に固定した街区（genBlock）が引き継ぐ
    // （半追従のリングは定常状態で前方 ~1 km まで寄って道路と交差していた）

    // 遠い丘陵のシルエット（半径 7.6〜8.6 km、高さ 0〜400 m）
    var hillPeaks = [];
    (function buildHills() {
        var N = 360, hrng = mulberry32(seed * 199 + 4);
        var ph1 = hrng() * 100, ph2 = hrng() * 100;
        var pos = new Float32Array(N * 2 * 3), nrm = new Float32Array(N * 2 * 3), idx = [];
        function fbm1(x) { var v = 0, a = 0.5, f = 1; for (var o = 0; o < 4; o++) { v += a * (Math.sin(x * f * 1.7 + ph1 * f) * 0.5 + Math.sin(x * f * 2.9 + ph2 + o) * 0.5); a *= 0.5; f *= 2.1; } return v; }
        for (var i = 0; i < N; i++) {
            var az = i / N * 6.2831853;
            // どの方位にも必ず稜線が出るよう、低い基準の丘に高い丘を重ねる
            var hv = fbm1(az), h = 70 + Math.max(0, hv + 0.05) * 420 + Math.max(0, hv - 0.2) * 700 + Math.max(0, fbm1(az * 3.0 + 7.0)) * 60;
            var r = 7600 + 1000 * (0.5 + 0.5 * Math.sin(az * 2.3 + ph2));
            var sx = Math.sin(az), cz = -Math.cos(az);
            pos[(i * 2) * 3] = sx * r; pos[(i * 2) * 3 + 1] = -150; pos[(i * 2) * 3 + 2] = cz * r;
            pos[(i * 2 + 1) * 3] = sx * r; pos[(i * 2 + 1) * 3 + 1] = h; pos[(i * 2 + 1) * 3 + 2] = cz * r;
            for (var v = 0; v < 2; v++) { nrm[(i * 2 + v) * 3] = -sx * 0.9; nrm[(i * 2 + v) * 3 + 1] = 0.44; nrm[(i * 2 + v) * 3 + 2] = -cz * 0.9; }
            var a = i * 2, b = ((i + 1) % N) * 2;
            idx.push(a, b, a + 1, b, b + 1, a + 1);
        }
        var g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
        g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(N * 2 * 2), 2));
        g.setIndex(idx);
        var hills = new THREE.Mesh(g, cityMat); hills.frustumCulled = false;
        cityGroup.add(hills);
        // 山の頂上の航空障害灯: 稜線の極大点（前後 ±8 サンプルで最大、高さ 180 m 以上）を高い順に最大 9 か所
        var hs = [], pk = [];
        for (var i2 = 0; i2 < N; i2++) hs.push(pos[(i2 * 2 + 1) * 3 + 1]);
        for (var i3 = 0; i3 < N; i3++) {
            var isMax = hs[i3] >= 180;
            for (var o2 = -8; o2 <= 8 && isMax; o2++) if (o2 && hs[(i3 + o2 + N) % N] > hs[i3]) isMax = false;
            if (isMax) pk.push(i3);
        }
        pk.sort(function (a, b) { return hs[b] - hs[a]; });
        var tw = [];
        pk.slice(0, 9).forEach(function (i4, n) {
            var x = pos[(i4 * 2 + 1) * 3], z = pos[(i4 * 2 + 1) * 3 + 2], h = hs[i4];
            var tower = hrng() < 0.5, steady = (n % 3) === 2;
            var th2 = tower ? 40 + 30 * hrng() : 0;
            hillPeaks.push({ x: x, z: z, h: h, tower: tower, th: th2, steady: steady, rateK: 1 + Math.floor(hrng() * 7), ph: hrng() });
            if (tower) { tw.push(x, h - 5, z, x, h + th2, z); }
        });
        if (tw.length) {
            var tg = new THREE.BufferGeometry(); tg.setAttribute('position', new THREE.Float32BufferAttribute(tw, 3));
            var towers = new THREE.LineSegments(tg, new THREE.LineBasicMaterial({ color: new THREE.Color(0.012, 0.012, 0.016) }));
            towers.frustumCulled = false; cityGroup.add(towers);        // 細い鉄塔（暗い線。空に対してかろうじて見える）
        }
    })();

    // 点光: 地平線の灯り 130 個（コアが決める）、航空障害灯、地平線の光の帯
    var cityPoints = null;
    function buildCityPoints() {
        var prng = mulberry32(seed * 313 + 11);
        var far = [];
        for (var o = 0; o < track.core.lights.length; o++) {
            var CL = track.core.lights[o], azo = CL.az, hgt = CL.h, bo = 1.5;
            far.push([Math.sin(azo) * 5200, hgt, -Math.cos(azo) * 5200, CL.rgb[0] * bo, CL.rgb[1] * bo, CL.rgb[2] * bo, 2.4, 0, 0]);
        }
        farList.forEach(function (B) { if (B.h > 160) far.push([B.x, B.h + 2, B.z, 2.2, 0.12, 0.06, 2.4, 1, prng()]); });
        // 山の頂上の航空障害灯（山ごとに周期 1.2〜1.8 秒・位相が違う。3 か所に 1 か所は常時点灯の暗い赤）。
        // aPhase の整数部 = 周期の番号（mode 1 で使う）、小数部 = 位相
        hillPeaks.forEach(function (p) {
            var sz = 1.6 + 0.4 * prng();
            if (p.steady) { far.push([p.x, p.h + 8, p.z, 0.55, 0.03, 0.015, sz, 0, 0]); return; }
            var c = [2.2 * 0.6, 0.12 * 0.6, 0.06 * 0.6];
            if (p.tower) {
                far.push([p.x, p.h + p.th, p.z, c[0], c[1], c[2], sz, 1, p.rateK + p.ph]);
                far.push([p.x, p.h + p.th * 0.5, p.z, c[0], c[1], c[2], sz, 1, p.rateK + p.ph]);   // 塔の 2 灯は同時に点滅
            } else far.push([p.x, p.h + 8, p.z, c[0], c[1], c[2], sz, 1, p.rateK + p.ph]);
        });
        // 地平線の光の帯: 遠い平野に散る灯り（都市の反対側にも必ず帯が出るよう、密度に依らない下限を持つ）
        for (var i = 0; i < 4200; i++) {
            var az = prng() * 6.2831853, r = 6900 + prng() * 600;
            var t = prng(), rr, gg, bb;
            if (t < 0.5) { rr = 1.0; gg = 0.78; bb = 0.5; } else if (t < 0.85) { rr = 0.9; gg = 0.9; bb = 1.0; } else { rr = 1.0; gg = 0.6; bb = 0.25; }
            var br = 0.16 + 0.45 * prng() * (0.6 + 0.4 * cityDens[Math.floor(((az / 6.2831853) % 1 + 1) % 1 * 512)]);
            far.push([Math.sin(az) * r, 2 + prng() * 24, -Math.cos(az) * r, rr * br, gg * br, bb * br, 1.0 + 0.7 * prng(), 0, 0]);
        }
        function mk(list) {
            var n = list.length;
            var pos = new Float32Array(n * 3), col = new Float32Array(n * 3), size = new Float32Array(n), mode = new Float32Array(n), ph = new Float32Array(n);
            for (var k = 0; k < n; k++) {
                var e = list[k];
                pos[k * 3] = e[0]; pos[k * 3 + 1] = e[1]; pos[k * 3 + 2] = e[2];
                col[k * 3] = e[3]; col[k * 3 + 1] = e[4]; col[k * 3 + 2] = e[5];
                size[k] = e[6]; mode[k] = e[7]; ph[k] = e[8];
            }
            var geo = new THREE.BufferGeometry();
            geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
            geo.setAttribute('aCol', new THREE.BufferAttribute(col, 3));
            geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
            geo.setAttribute('aMode', new THREE.BufferAttribute(mode, 1));
            geo.setAttribute('aPhase', new THREE.BufferAttribute(ph, 1));
            var p = new THREE.Points(geo, glowMat); p.frustumCulled = false;
            return p;
        }
        cityPoints = mk(far); cityGroup.add(cityPoints);
    }

    // --- 点光マテリアル（共有） ---------------------------------------------------------
    var glowMat = new THREE.ShaderMaterial({
        vertexShader: S.glowVert, fragmentShader: S.glowFrag, transparent: true,
        blending: THREE.AdditiveBlending, depthWrite: false, depthTest: true,
        uniforms: uni({ uRetroGain: { value: 1.0 }, uHaloGain: { value: 12.0 } })
    });

    // --- 路面 -------------------------------------------------------------------------
    var NBACK = 12, NF = 260, NR = NBACK + NF;
    var rowD = new Float32Array(NR);
    for (var ri = 0; ri < NBACK; ri++) rowD[ri] = -P.backLen + ri * (P.backLen / NBACK);
    for (var rj = 0; rj <= NF - 1; rj++) { var t = rj / (NF - 1); rowD[NBACK + rj] = P.viewLen * Math.pow(t, 2.2); }

    function makeRibbon(nRows, nAcross, extraAttrs) {
        var g = new THREE.BufferGeometry();
        var nv = nRows * nAcross;
        g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(nv * 3), 3).setUsage(THREE.DynamicDrawUsage));
        g.setAttribute('normal',   new THREE.BufferAttribute(new Float32Array(nv * 3), 3).setUsage(THREE.DynamicDrawUsage));
        g.setAttribute('aSta',     new THREE.BufferAttribute(new Float32Array(nv), 1).setUsage(THREE.DynamicDrawUsage));
        g.setAttribute('aLat',     new THREE.BufferAttribute(new Float32Array(nv), 1).setUsage(THREE.DynamicDrawUsage));
        if (extraAttrs) {
            g.setAttribute('aTan',   new THREE.BufferAttribute(new Float32Array(nv * 3), 3).setUsage(THREE.DynamicDrawUsage));
            g.setAttribute('aRight', new THREE.BufferAttribute(new Float32Array(nv * 3), 3).setUsage(THREE.DynamicDrawUsage));
        }
        var idx = [];
        for (var r = 0; r < nRows - 1; r++) {
            for (var c = 0; c < nAcross - 1; c++) {
                var a = r * nAcross + c, b = a + 1, c2 = a + nAcross, d = c2 + 1;
                idx.push(a, b, c2, b, d, c2);
            }
        }
        g.setIndex(idx);
        return g;
    }
    function makeSplitRibbon(nRows, groups) { // groups: [[v0,v1,v2],[v3,v4,v5]] 連続する頂点の帯を別々に貼る
        var nAcross = 0; groups.forEach(function (gr) { nAcross += gr.length; });
        var g = makeRibbon(nRows, nAcross, false);
        var idx = [];
        for (var r = 0; r < nRows - 1; r++) {
            groups.forEach(function (gr) {
                for (var c = 0; c < gr.length - 1; c++) {
                    var a = r * nAcross + gr[c], b = r * nAcross + gr[c + 1], c2 = a + nAcross, d = b + nAcross;
                    idx.push(a, b, c2, b, d, c2);
                }
            });
        }
        g.setIndex(idx);
        return g;
    }

    var roadMat = new THREE.ShaderMaterial({
        vertexShader: S.roadVert, fragmentShader: S.roadFrag, side: THREE.DoubleSide,
        defines: { NL: Q.lamps },
        uniforms: uni({
            uMedianHalf: { value: P.medianHalf }, uInnerLine: { value: P.innerLine }, uLaneDiv: { value: P.laneDiv },
            uOuterLine: { value: P.outerLine }, uRoadHalf: { value: P.roadHalf },
            uRetro: { value: P.retroPaint }, uWet: { value: P.wet },
            uRoadGlow: { value: P.roadGlow }, uSpecGain: { value: P.roadGlow * 0.75 }, uSpecK: { value: P.specK }
        })
    });
    var roadGeo = makeRibbon(NR, 2, true);
    var road = new THREE.Mesh(roadGeo, roadMat); road.frustumCulled = false; scene.add(road);

    // 汎用ライト付き材質。uUnder = 高架の下の街明かりによる下からの仰ぎ光（既定 0）
    function litMat(albedo, rough, f0, noise, hasStation, emissive) {
        var m = new THREE.ShaderMaterial({
            vertexShader: S.litVert, fragmentShader: S.litFrag, side: hasStation ? THREE.DoubleSide : THREE.FrontSide,
            defines: { NL: Q.lamps },
            uniforms: uni({
                uAlbedo: { value: v3(albedo) }, uRough: { value: rough }, uF0: { value: v3(f0) },
                uNoiseAmt: { value: noise }, uEmissive: { value: v3(emissive || [0, 0, 0]) },
                uUnder: { value: new THREE.Vector3(0, 0, 0) }
            })
        });
        if (hasStation) m.defines.HAS_STATION = 1;
        return m;
    }
    var UNDER_COL = [0.010, 0.0075, 0.0050];          // 下の街の明かりの仰ぎ光（暖色、ごく弱い）

    // 桁・地覆・分離帯: 面ごとに頂点を分けた帯（各帯 2 頂点、法線は面法線）を軌道に沿って押し出す
    var RH = P.roadHalf, CW = P.curbW, CH = P.curbH, FH = P.fasciaH, MH = P.medianHalf, MHH = P.medianH;
    var DECK_BANDS = [          // [x0, y0, x1, y1, nx, ny]（路面ローカル: x = 右、y = 上）
        [-RH, 0, -RH, CH, 1, 0], [-RH, CH, -(RH + CW), CH, 0, 1], [-(RH + CW), CH, -(RH + CW), -FH, -1, 0],
        [-MH, 0, -MH, MHH, -1, 0], [-MH, MHH, MH, MHH, 0, 1], [MH, MHH, MH, 0, 1, 0],
        [RH, 0, RH, CH, -1, 0], [RH, CH, RH + CW, CH, 0, 1], [RH + CW, CH, RH + CW, -FH, 1, 0],
        [-(RH + CW), -FH, RH + CW, -FH, 0, -1]
    ];
    var NDV = DECK_BANDS.length * 2;
    var deckGeo = makeSplitRibbon(NR, DECK_BANDS.map(function (b, i) { return [i * 2, i * 2 + 1]; }));
    deckGeo.setAttribute('aHt', new THREE.BufferAttribute(new Float32Array(NR * NDV), 1));
    (function () {   // 高さ属性は行によらず一定
        var ah = deckGeo.attributes.aHt.array;
        for (var r = 0; r < NR; r++) for (var b = 0; b < DECK_BANDS.length; b++) {
            ah[r * NDV + b * 2] = DECK_BANDS[b][1]; ah[r * NDV + b * 2 + 1] = DECK_BANDS[b][3];
        }
    })();
    var deckMat = litMat([0.055, 0.055, 0.053], 0.85, [0.04, 0.04, 0.04], 0.35, true);
    deckMat.defines.DECK = 1;
    deckMat.uniforms.uGap = null; deckMat.defines.NGAP = 8;   // 補修区間の支柱の切り跡（下で U_GAP を入れる）
    deckMat.defines.FASCIA_LAT = (RH + CW * 0.5).toFixed(3);      // これより外の面 = 桁の外側面
    deckMat.uniforms.uUnder.value.fromArray(UNDER_COL);
    var deck = new THREE.Mesh(deckGeo, deckMat); deck.frustumCulled = false; scene.add(deck);

    // v9: 壁高欄（A・B の区間で見える）。断面（x = 横、y = 路面から）: 道路側の下 0.25 m の段、上はわずかな勾配、天端 0.25 m、外面は鉛直。
    // 天端の鋼管の手すり（A だけ、天端 +0.15 m、直径 0.11 m を 4 面で）。左右とも同じ帯を鏡写し
    var WALL_PROF = [[9.28, 0.0, 9.28, 0.25, 1, 0], [9.28, 0.25, 9.36, 0.30, 0.5, 0.86], [9.36, 0.30, 9.50, 1.10, 0.98, 0.17], [9.50, 1.10, 9.75, 1.10, 0, 1], [9.75, 1.10, 9.75, 0.25, -1, 0]];
    // 天端の手すり: 直径 0.11 m の鋼管を 8 面で、頂点ごとの法線を管の中心から外向きにして丸く見せる（[x0, y0, x1, y1, nx, ny, n0x, n0y, n1x, n1y]、法線の x は道路側が正）
    (function () { var cx = 9.625, cy = 1.255, rr = 0.055;
        for (var k = 0; k < 8; k++) { var a0 = k / 8 * 2 * Math.PI, a1 = (k + 1) / 8 * 2 * Math.PI;
            WALL_PROF.push([cx + rr * Math.cos(a0), cy + rr * Math.sin(a0), cx + rr * Math.cos(a1), cy + rr * Math.sin(a1), -Math.cos((a0 + a1) / 2), Math.sin((a0 + a1) / 2),
                            -Math.cos(a0), Math.sin(a0), -Math.cos(a1), Math.sin(a1)]); } })();
    var WALL_BANDS = [];
    [-1, 1].forEach(function (sd) { WALL_PROF.forEach(function (b) { var w = [sd * b[0], b[1], sd * b[2], b[3], -sd * b[4], b[5]]; if (b.length > 6) w.push(-sd * b[6], b[7], -sd * b[8], b[9]); WALL_BANDS.push(w); }); });
    var NWV = WALL_BANDS.length * 2;
    var wallGeo = makeSplitRibbon(NR, WALL_BANDS.map(function (b, i) { return [i * 2, i * 2 + 1]; }));
    wallGeo.setAttribute('aHt', new THREE.BufferAttribute(new Float32Array(NR * NWV), 1));
    (function () { var ah = wallGeo.attributes.aHt.array; for (var r = 0; r < NR; r++) for (var b = 0; b < WALL_BANDS.length; b++) { ah[r * NWV + b * 2] = WALL_BANDS[b][1]; ah[r * NWV + b * 2 + 1] = WALL_BANDS[b][3]; } })();
    var wallMat = litMat([0.30, 0.30, 0.29], 0.9, [0.04, 0.04, 0.04], 0.0, true);
    wallMat.defines.WALL = 1; wallMat.defines.HEAD_GAIN = '0.1';   // 壁に当たるヘッドライトを抑える（にじんだ白い塊にしない）
    var wallMesh = new THREE.Mesh(wallGeo, wallMat); wallMesh.frustumCulled = false; scene.add(wallMesh);
    // v9: 遮音壁（B）と鋼製高欄（C）: 横 ±9.62 m の鉛直の板、高さ 0.30〜4.10 m。透明物として最後に描く
    // 先端改良型の折れ（上 0.5 m が道路側へ 20°）: 遮音壁の高さ 2.0 / 2.5 / 3.0 m ごとに 1 本ずつ帯を持ち、シェーダが区間の高さと合う帯だけを描く
    var PFOLD_H = [2.0, 2.5, 3.0], PFOLD_DX = 0.5 * Math.sin(20 * Math.PI / 180), PFOLD_DY = 0.5 * Math.cos(20 * Math.PI / 180), NPV = 16;
    var panelGeo = makeSplitRibbon(NR, [[0, 1], [2, 3], [4, 5], [6, 7], [8, 9], [10, 11], [12, 13], [14, 15]]);
    panelGeo.setAttribute('aHt', new THREE.BufferAttribute(new Float32Array(NR * NPV), 1));
    panelGeo.setAttribute('aFold', new THREE.BufferAttribute(new Float32Array(NR * NPV), 1));
    (function () { var ah = panelGeo.attributes.aHt.array, af = panelGeo.attributes.aFold.array; for (var r = 0; r < NR; r++) { ah[r * NPV] = 0.30; ah[r * NPV + 1] = 4.10; ah[r * NPV + 2] = 0.30; ah[r * NPV + 3] = 4.10;
        for (var f = 0; f < 6; f++) { var Hf = PFOLD_H[f % 3]; ah[r * NPV + 4 + f * 2] = 1.10 + Hf - 0.5; ah[r * NPV + 5 + f * 2] = 1.10 + Hf; af[r * NPV + 4 + f * 2] = Hf; af[r * NPV + 5 + f * 2] = Hf; } } })();
    var secAL = [], secBL = [], secAR = [], secBR = [];
    for (var si0 = 0; si0 < 16; si0++) { secAL.push(new THREE.Vector4(-1e6, -1e6, 3, 0)); secBL.push(new THREE.Vector4(3, 3, 0, 0)); secAR.push(new THREE.Vector4(-1e6, -1e6, 3, 0)); secBR.push(new THREE.Vector4(3, 3, 0, 0)); }
    var U_SEC = { uSecAL: { value: secAL }, uSecBL: { value: secBL }, uSecAR: { value: secAR }, uSecBR: { value: secBR } };
    var panelMat = new THREE.ShaderMaterial({
        vertexShader: S.panelVert, fragmentShader: S.panelFrag, side: THREE.DoubleSide, transparent: true, depthWrite: false,
        blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
        defines: { NL: Q.lamps }, uniforms: uni(U_SEC)
    });
    if (q.pdbg) panelMat.defines.PDBG = q.pdbg;
    var panelMesh = new THREE.Mesh(panelGeo, panelMat); panelMesh.frustumCulled = false; panelMesh.renderOrder = 8; scene.add(panelMesh);
    // 同じ板の不透明な部分だけを、奥行きを書いて先に描く（後から描く街の光の点が金属板・支柱を透けて見えないように）
    var panelOpMat = new THREE.ShaderMaterial({ vertexShader: S.panelVert, fragmentShader: S.panelFrag, side: THREE.DoubleSide, defines: { NL: Q.lamps, OPAQUE_PASS: 1 }, uniforms: panelMat.uniforms });
    if (q.pdbg) panelOpMat.defines.PDBG = q.pdbg;
    var panelOpMesh = new THREE.Mesh(panelGeo, panelOpMat); panelOpMesh.frustumCulled = false; scene.add(panelOpMesh);
    [wallMat, deckMat].forEach(function (m) { for (var k in U_SEC) m.uniforms[k] = U_SEC[k]; });

    // ガードレール: W 型ビームの断面（張り出し x, 高さ y）を軌道に沿って押し出す。亜鉛めっきの金属
    var RAIL_PROF = [[0.00, 0.885], [0.045, 0.862], [0.062, 0.822], [0.022, 0.750], [0.062, 0.678], [0.045, 0.638], [0.00, 0.615]];
    var RAIL_NRM = RAIL_PROF.map(function (p, i, a) {
        var p0 = a[Math.max(0, i - 1)], p1 = a[Math.min(a.length - 1, i + 1)];
        var tx = p1[0] - p0[0], ty = p1[1] - p0[1], l = Math.sqrt(tx * tx + ty * ty) || 1;
        var nx = ty / l, ny = -tx / l;                 // 断面の接線に直交。x>0 = 張り出し側
        if (nx < 0) { nx = -nx; ny = -ny; }
        nx = nx * 0.75 + 0.25;                         // わずかに張り出し側へ寄せて継ぎ目の陰影を柔らかく
        var nl = Math.sqrt(nx * nx + ny * ny); return [nx / nl, ny / nl];
    });
    var NRP = RAIL_PROF.length;
    // 4 本: 左右の外側（車道側へ張り出す）と、分離帯の背中合わせ 2 本。x = xb + fs * 張り出し
    var RAILS = [{ xb: -P.railLat, fs: 1 }, { xb: P.railLat, fs: -1 }, { xb: -0.08, fs: -1 }, { xb: 0.08, fs: 1 }];
    var railMat = litMat([0.05, 0.05, 0.052], 0.30, [0.55, 0.55, 0.55], 0.0, true);
    railMat.defines.RAIL = 1; railMat.side = THREE.DoubleSide;
    var NRAIL = NBACK + 110;                                         // ガードレールは ~700 m まで
    var railGeo = makeSplitRibbon(NRAIL, RAILS.map(function (r, k) { var a = []; for (var c = 0; c < NRP; c++) a.push(k * NRP + c); return a; }));
    railGeo.setAttribute('aHt', new THREE.BufferAttribute(new Float32Array(NRAIL * RAILS.length * NRP), 1));
    (function () {   // v7.1: 断面の高さ（ボルトの段の位置に使う）。行によらず一定
        var ah = railGeo.attributes.aHt.array;
        for (var r = 0; r < NRAIL; r++) for (var k = 0; k < RAILS.length; k++) for (var c = 0; c < NRP; c++) ah[(r * RAILS.length + k) * NRP + c] = RAIL_PROF[c][1];
    })();
    var rails = new THREE.Mesh(railGeo, railMat); rails.frustumCulled = false; scene.add(rails);

    // 支柱: 鈍い亜鉛めっき。下ほど泥はね・錆で暗く、レールの陰に入る帯も暗い（シェーダ側 POST）
    var postMat = litMat([0.026, 0.026, 0.027], 0.82, [0.035, 0.035, 0.035], 0.0, false);
    postMat.defines.POST = 1;
    var NPOST = 380;
    var postGeo = new THREE.CylinderGeometry(0.057, 0.057, 0.95, 12); postGeo.translate(0, 0.475, 0);
    var posts = new THREE.InstancedMesh(postGeo, postMat, NPOST);
    posts.instanceMatrix.setUsage(THREE.DynamicDrawUsage); posts.frustumCulled = false; scene.add(posts);

    // --- 中央分離帯の補修区間: 壊れたガードレールを外し、ラバーポールを並べて仮復旧した区間 ---
    // 絶対の道のりで決定的に決める（240 m ごとに約 22% のブロックに 1 区間、長さ 24〜96 m、4 m の倍数）。
    // 見えている区間を折り返し後の道のりで uGap[8] に入れ、分離帯のガードレールのシェーダが区間内を discard する
    var NGAP = 8, GAP_BLOCK = 240;
    var gapArr = []; for (var gi0 = 0; gi0 < NGAP; gi0++) gapArr.push(new THREE.Vector2(-1e6, -1e6));
    var U_GAP = { value: gapArr };
    function gapHash(b, k) {
        var h = (b * 2246822519 + k * 3266489917 + seed * 668265263) | 0;
        h = Math.imul(h ^ (h >>> 15), 2246822519); h ^= h >>> 13; h = Math.imul(h, 3266489917); h ^= h >>> 16;
        return (h >>> 0) / 4294967296;
    }
    function gapOfBlock(b) {
        if (b < 0 || gapHash(b, 1) >= 0.22) return null;
        if (icNear(b * GAP_BLOCK, 300) || icNear(b * GAP_BLOCK + GAP_BLOCK, 300)) return null;   // v8: IC の区間には置かない
        var len = 4 * (6 + Math.floor(gapHash(b, 2) * 19));                  // 24〜96 m
        var s0 = b * GAP_BLOCK + 4 * Math.floor(gapHash(b, 3) * ((GAP_BLOCK - len) / 4)) + 1;   // 支柱（≡ 1 mod 4）の位置から
        return [s0, s0 + len];
    }
    // v7.1: 分離帯の開口部（非常時の転回用、長さ 32〜40 m、2〜5 km ごと）。ガードレールを外してラバーポールで塞ぐ。補修区間とは重ねない
    var NOPEN = 4, openArr = []; for (var oi0 = 0; oi0 < NOPEN; oi0++) openArr.push(new THREE.Vector2(-1e6, -1e6));
    var U_OPEN = { value: openArr }, openS = [];
    function openAt(n) {                                                 // n 番目の開口部 [s0, s1]（支柱 ≡ 1 mod 4 から）
        while (openS.length <= n) {
            var k = openS.length, prev = k === 0 ? 1200 : openS[k - 1][1];
            var len = 32 + 4 * Math.floor(gapHash(k, 71) * 3), s0 = 4 * Math.floor((prev + 2000 + 3000 * gapHash(k, 72)) / 4) + 1;
            for (var tries = 0; tries < 200 && (inGapRaw(s0 - 8) || inGapRaw(s0 + len / 2) || inGapRaw(s0 + len + 8) || icNear(s0, 300) || icNear(s0 + len, 300)); tries++) s0 += 40;
            openS.push([s0, s0 + len]);
        }
        return openS[n];
    }
    function inGapRaw(s) { var g = gapOfBlock(Math.floor(s / GAP_BLOCK)); return g && s > g[0] - 0.5 && s < g[1] + 0.5; }
    function inOpen(s) { for (var n = 0; n < 10000; n++) { var o = openAt(n); if (o[0] > s + 1) return false; if (s > o[0] - 0.5 && s < o[1] + 0.5) return true; } return false; }
    function inGap(s) { return inGapRaw(s) || inOpen(s); }
    railMat.uniforms.uGap = U_GAP; railMat.defines.NGAP = NGAP; deckMat.uniforms.uGap = U_GAP;
    railMat.uniforms.uOpen = U_OPEN; railMat.defines.NOPEN = NOPEN;
    // v8: IC の区間（本線の道のり、折り返し後）。左 = 自車側、右 = 反対車線側
    var rampLArr = [], rampRArr = []; for (var ri0 = 0; ri0 < 4; ri0++) { rampLArr.push(new THREE.Vector2(-1e6, -1e6)); rampRArr.push(new THREE.Vector2(-1e6, -1e6)); }
    var U_RAMPL = { value: rampLArr }, U_RAMPR = { value: rampRArr };
    [roadMat, deckMat, railMat, wallMat, panelMat].forEach(function (m) { m.uniforms.uRampL = U_RAMPL; m.uniforms.uRampR = U_RAMPR; });
    for (var ksec in U_SEC) railMat.uniforms[ksec] = U_SEC[ksec];
    function inRampZone(s, side) {                                       // 本線の道のり s が、その側の出入口の区間か
        for (var i = 0; i < icList.length; i++) {
            var ic = icList[i]; if (!ic.ramps) continue; var z = side < 0 ? ic.zoneL : ic.zoneR;
            if ((s > z[0] && s < z[1]) || (s > z[2] && s < z[3])) return true;
        }
        return false;
    }
    // ラバーポール: 直径 8 cm × 高さ 80 cm、台座 φ20 × 6 cm、頭は半球。橙の本体に白の反射帯 2 本（シェーダ側 RPOLE）
    var rpoleGeo = (function () {
        var body = new THREE.CylinderGeometry(0.04, 0.04, 0.74, 16); body.translate(0, 0.06 + 0.37, 0);
        var head = new THREE.SphereGeometry(0.04, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2); head.translate(0, 0.80, 0);
        var base = new THREE.CylinderGeometry(0.09, 0.1, 0.06, 16); base.translate(0, 0.03, 0);
        var gs = [body, head, base].map(function (g) { return g.index ? g.toNonIndexed() : g; });
        gs.forEach(function (g) { for (var k in g.attributes) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k); });
        return A.BufferGeometryUtils.mergeGeometries(gs);
    })();
    var NRPOLE = 400;
    rpoleGeo.setAttribute('aFade', new THREE.InstancedBufferAttribute(new Float32Array(NRPOLE), 1).setUsage(THREE.DynamicDrawUsage));
    var rpoleMat = litMat([0.35, 0.13, 0.03], 0.55, [0.04, 0.04, 0.04], 0.0, false);
    rpoleMat.defines.RPOLE = 1;
    rpoleMat.uniforms.uRetroPole = { value: 0.0006 };
    var rpoles = new THREE.InstancedMesh(rpoleGeo, rpoleMat, NRPOLE);
    rpoles.instanceMatrix.setUsage(THREE.DynamicDrawUsage); rpoles.frustumCulled = false; rpoles.count = 0; scene.add(rpoles);
    var tiltQ = new THREE.Quaternion(), tiltAx = new THREE.Vector3();
    // v7.1: 袖ビーム（分離帯の背中合わせのガードレールの端を丸く巻き込んだ部材）: 半円筒、半径 0.14 m、高さ = ビームの幅
    var endGeo = new THREE.CylinderGeometry(0.14, 0.14, 0.27, 14, 1, true, 0, Math.PI); endGeo.translate(0, 0.75 + P.railY - P.medianH + 0.0, 0);
    var endMat = litMat([0.05, 0.05, 0.052], 0.30, [0.55, 0.55, 0.55], 0.0, false); endMat.side = THREE.DoubleSide;
    var NEND = 2 * (NGAP + NOPEN);
    var railEnds = new THREE.InstancedMesh(endGeo, endMat, NEND);
    railEnds.instanceMatrix.setUsage(THREE.DynamicDrawUsage); railEnds.frustumCulled = false; railEnds.count = 0; scene.add(railEnds);

    // 街灯のポール: 根元（地覆の上）を原点に、アームが +x（車道側）へ伸びる単位ジオメトリ。
    // 実物どおり鉛直に立て（回転はヨーのみ）、右側はヨーを 180° 回して使う（鏡像にしない）
    var poleMat = litMat([0.07, 0.072, 0.075], 0.38, [0.45, 0.45, 0.45], 0.0, false);
    var ARM = P.poleLat - P.lampLat, LH = P.lampH - P.curbH;        // アームの張り出し、根元から灯具までの高さ
    // 灯具の発光面の位置（ポール単位ジオメトリ上）。ハロー・光源・光の円錐はすべてこれを行列で変換して求める
    var LAMP_LOCAL = new THREE.Vector3(ARM, LH - 0.12, 0);
    var poleGeo = (function () {
        var hp = LH - 0.6;
        var pole = new THREE.CylinderGeometry(0.07, 0.14, hp, 18);
        pole.translate(0, hp / 2, 0);
        var base = new THREE.CylinderGeometry(0.15, 0.17, 0.45, 18);
        base.translate(0, 0.225, 0);
        var curve = new THREE.QuadraticBezierCurve3(
            new THREE.Vector3(0, hp - 0.05, 0),
            new THREE.Vector3(0.1, LH + 0.45, 0),
            new THREE.Vector3(ARM + 0.3, LH + 0.05, 0));
        var arm = new THREE.TubeGeometry(curve, 16, 0.045, 10, false);
        var head = new THREE.BoxGeometry(0.8, 0.13, 0.3);
        head.translate(ARM, LH, 0);
        var dome = new THREE.CylinderGeometry(0.13, 0.13, 0.62, 12);
        dome.rotateZ(Math.PI / 2); dome.translate(ARM + 0.04, LH + 0.1, 0);
        var geos = [pole, base, arm, head, dome].map(function (g) { return g.index ? g.toNonIndexed() : g; });
        geos.forEach(function (g) { for (var k in g.attributes) if (k !== 'position' && k !== 'normal' && k !== 'uv') g.deleteAttribute(k); });
        return A.BufferGeometryUtils.mergeGeometries(geos);
    })();
    var NPOLE = 130;
    var poles = new THREE.InstancedMesh(poleGeo, poleMat, NPOLE);
    poles.instanceMatrix.setUsage(THREE.DynamicDrawUsage); poles.frustumCulled = false; scene.add(poles);

    // 橋脚: 柱（横 2.4 × 奥行 2.0、梁の下から地面まで）と梁（幅 15 × 高さ 1.6 × 奥行 2.2）。上面が原点の単位箱
    var pierMat = litMat([0.075, 0.075, 0.072], 0.9, [0.04, 0.04, 0.04], 0.0, false);
    pierMat.defines.NO_LIGHTS = 1; pierMat.defines.PIER = 1;
    pierMat.uniforms.uUnder.value.fromArray(UNDER_COL);
    var NPIER = 72;
    function pierBox(chamfer) {
        // 縦の稜を面取りした箱（角ばった箱に見えないように）。上面 y = 0、下面 y = -1
        var c = chamfer, h = 0.5;
        var shape = new THREE.Shape();
        shape.moveTo(-h + c, -h); shape.lineTo(h - c, -h); shape.lineTo(h, -h + c); shape.lineTo(h, h - c);
        shape.lineTo(h - c, h); shape.lineTo(-h + c, h); shape.lineTo(-h, h - c); shape.lineTo(-h, -h + c); shape.closePath();
        var g = new THREE.ExtrudeGeometry(shape, { depth: 1, bevelEnabled: false });
        g.rotateX(Math.PI / 2);
        g = g.index ? g.toNonIndexed() : g;
        g.computeVertexNormals();
        return g;
    }
    var pierCols = new THREE.InstancedMesh(pierBox(0.12), pierMat, NPIER);
    var pierBeams = new THREE.InstancedMesh(pierBox(0.06), pierMat, NPIER);
    [pierCols, pierBeams].forEach(function (m) { m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.frustumCulled = false; scene.add(m); });

    // 地面: 世界座標 y = groundY の水平面 1 枚（16 km 四方、カメラの XZ に追従）
    var groundMat = litMat([0.012, 0.012, 0.012], 0.95, [0.02, 0.02, 0.02], 0.0, false);
    groundMat.defines.NO_LIGHTS = 1;
    var groundGeo = new THREE.PlaneGeometry(16000, 16000, 1, 1); groundGeo.rotateX(-Math.PI / 2);
    var ground = new THREE.Mesh(groundGeo, groundMat); ground.frustumCulled = false; scene.add(ground);

    // 街灯のハロー（点）
    function makeGlowPoints(n, size, colArr, mode) {
        var g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3).setUsage(THREE.DynamicDrawUsage));
        var col = new Float32Array(n * 3), sz = new Float32Array(n), md = new Float32Array(n), ph = new Float32Array(n);
        for (var i = 0; i < n; i++) { col[i * 3] = colArr[0]; col[i * 3 + 1] = colArr[1]; col[i * 3 + 2] = colArr[2]; sz[i] = size; md[i] = mode; ph[i] = 0; }
        g.setAttribute('aCol', new THREE.BufferAttribute(col, 3));
        g.setAttribute('aSize', new THREE.BufferAttribute(sz, 1));
        g.setAttribute('aMode', new THREE.BufferAttribute(md, 1));
        g.setAttribute('aPhase', new THREE.BufferAttribute(ph, 1));
        g.setDrawRange(0, 0);
        var pts = new THREE.Points(g, glowMat); pts.frustumCulled = false;
        return pts;
    }
    var halos = makeGlowPoints(NPOLE, 1.0, P.lampCol, 2); halos.renderOrder = 10; scene.add(halos);
    // === v8: IC の描画（ランプの路面・構造・ガードレール・橋脚・街灯・信号・クッションドラム・標識） ======================
    var rampSurfMat = litMat([0.04, 0.04, 0.042], 0.35, [0.04, 0.04, 0.04], 0.0, true); rampSurfMat.defines.RAMP = 1; rampSurfMat.uniforms.uRoadTxt = { value: null }; rampSurfMat.polygonOffset = true; rampSurfMat.polygonOffsetFactor = -2; rampSurfMat.polygonOffsetUnits = -8;   // 本線の床版の上面と同じ高さで重なる所（減速車線）で、遠くでも路面の標示が負けないように if (q.adbg) rampSurfMat.defines.ADBG = 1; rampSurfMat.side = THREE.DoubleSide;
    var rampStructMat = litMat([0.075, 0.075, 0.072], 0.85, [0.04, 0.04, 0.04], 0.0, false); rampStructMat.side = THREE.DoubleSide;
    rampStructMat.uniforms.uUnder.value.fromArray(UNDER_COL);
    var rampRailMat = litMat([0.05, 0.05, 0.052], 0.30, [0.55, 0.55, 0.55], 0.0, false); rampRailMat.side = THREE.DoubleSide;
    var drumMat = litMat([0.4, 0.3, 0.02], 0.5, [0.04, 0.04, 0.04], 0.0, false); drumMat.defines.DRUM = 1;
    var icRoot = new THREE.Group(); scene.add(icRoot);
    var NRPIER = 400, NRLAMP = 200, NDRUM = 24;
    var rPierGeo = new THREE.CylinderGeometry(0.8, 0.9, 1, 12); rPierGeo.translate(0, -0.5, 0);
    var rPiers = new THREE.InstancedMesh(rPierGeo, pierMat, NRPIER); rPiers.frustumCulled = false; rPiers.count = 0; rPiers.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(rPiers);
    var rPoles = new THREE.InstancedMesh(poleGeo, poleMat, NRLAMP); rPoles.frustumCulled = false; rPoles.count = 0; rPoles.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(rPoles);
    var rHalos = makeGlowPoints(NRLAMP + 32, 1.0, P.lampCol, 2); rHalos.renderOrder = 10; scene.add(rHalos);
    var drumGeo = new THREE.CylinderGeometry(0.45, 0.45, 1.0, 16); drumGeo.translate(0, 0.5, 0);
    var drums = new THREE.InstancedMesh(drumGeo, drumMat, NDRUM); drums.frustumCulled = false; drums.count = 0; drums.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(drums);
    // ランプ 1 本のメッシュ（路面・構造・ガードレール）。座標は先頭の点からの相対で、毎フレーム原点相対へ置く
    function buildRampMesh(R) {
        var n = R.n, pts = R.pts;
        // 各行の外向き（道路から離れる横向き）
        var OX = new Float64Array(n), OZ = new Float64Array(n);
        for (var i = 0; i < n; i++) {
            var a = Math.max(0, i - 1), b = Math.min(n - 1, i + 1), tx = R.X[b] - R.X[a], tz = R.Z[b] - R.Z[a], tl = Math.hypot(tx, tz) || 1;
            tx /= tl; tz /= tl;
            var ox = tz, oz = -tx;                                       // 接線に直交
            var refX, refZ;
            if (i === 0 || pts[i].r.att) { var th = pts[i].r.th !== undefined ? pts[i].r.th : 0; refX = Math.cos(th) * R.side; refZ = Math.sin(th) * R.side; }
            else { refX = OX[i - 1]; refZ = OZ[i - 1]; }
            if (ox * refX + oz * refZ < 0) { ox = -ox; oz = -oz; }
            OX[i] = ox; OZ[i] = oz;
        }
        var x0 = R.X[0], y0 = R.Y[0], z0 = R.Z[0];
        function tiltY(k, x) { var pk0 = pts[k]; return pk0.bf ? -pk0.bf * pk0.sbk * x : 0; }   // 横位置 x（外向き）での、本線の傾きによる高さの差
        // 路面: 4 頂点（内側の縁、内側の車線端、外側の車線端、外側の縁）
        var sp = [], sn = [], ss = [], sl = [], si = [], sr = [];
        var iN = 0; for (var jn = 0; jn < n; jn++) if (pts[jn].r.u <= 0) iN = jn;   // ノーズの行
        var isExit = R.k === 0 || R.k === 3, uNose = R.U[iN];
        if (Q_ICDUMP && isExit) { var arS = []; [95, 58].forEach(function (b) { for (var ja = 0; ja < n; ja++) if (R.U[ja] >= uNose - b) { arS.push(Math.round(pts[ja].r.s)); break; } }); ARROW_LOG.push('k' + R.k + ':' + arS.join('/') + ' nose ' + Math.round(pts[iN].r.s)); }
        var inner = [], outer = [];
        for (var j = 0; j < n; j++) {
            var r = pts[j].r, lat = r.lat;
            var inn = (r.att || pts[j].goreZone) ? Math.min(-0.55, MAIN_EDGE - lat) : -2.5;
            if (r.att) inn = (P.outerLine + 0.2) - LANE_C;                  // 減速・加速車線は本線の外側線のすぐ脇からランプの路面で描く（車線の途中に路面の継ぎ目を出さない）
            var out = r.att ? Math.max(inn, Math.max(P.outerLine + 4.5 * r.tp, MAIN_EDGE) - LANE_C) : 2.75;   // すりつけでも舗装の外縁（地覆・ガードレール）は本線の舗装端より内へ寄せない（狭まるのは車線だけ）
            inner.push(inn); outer.push(out);
            var offs = [inn, Math.max(inn, Math.min(out, -1.75)), Math.max(inn, Math.min(out, 1.75)), out];
            for (var q = 0; q < 4; q++) {
                var yv = R.Y[j] + tiltY(j, offs[q]);                       // 本線と同じ横の傾き（内側の縁は本線の舗装の高さに一致する）
                sp.push(R.X[j] + OX[j] * offs[q] - x0, yv - y0, R.Z[j] + OZ[j] * offs[q] - z0);
                sn.push(0, 1, 0); ss.push(R.U[j]); sl.push(offs[q]); sr.push(r.tp, isExit ? 0 : 1, uNose);
            }
            if (j) for (var q2 = 0; q2 < 3; q2++) { var a0 = (j - 1) * 4 + q2, b0 = j * 4 + q2; si.push(a0, b0, a0 + 1, a0 + 1, b0, b0 + 1); }
        }
        var gS = new THREE.BufferGeometry();
        gS.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3)); gS.setAttribute('normal', new THREE.Float32BufferAttribute(sn, 3));
        gS.setAttribute('aSta', new THREE.Float32BufferAttribute(ss, 1)); gS.setAttribute('aLat', new THREE.Float32BufferAttribute(sl, 1)); gS.setAttribute('aRamp', new THREE.Float32BufferAttribute(sr, 3)); gS.setIndex(si);
        // 構造（地覆・床版の側面と下面・箱桁・低い所の擁壁）と、ガードレール（帯）
        var cp = [], cn = [], gp = [], gn = [];
        function quad(arrP, arrN, j, xa, ya, xb, yb, nx, ny) {          // 行 j-1 → j の帯（横位置 x・高さ y は行ごとの関数）
            for (var t = 0; t < 2; t++) { }
            var A = [], B = [];
            [j - 1, j].forEach(function (k) {
                var pa = [R.X[k] + OX[k] * xa(k) - x0, R.Y[k] + ya(k) + tiltY(k, xa(k)) - y0, R.Z[k] + OZ[k] * xa(k) - z0];
                var pb = [R.X[k] + OX[k] * xb(k) - x0, R.Y[k] + yb(k) + tiltY(k, xb(k)) - y0, R.Z[k] + OZ[k] * xb(k) - z0];
                A.push(pa); B.push(pb);
            });
            var nxw = OX[j] * nx, nzw = OZ[j] * nx;
            [A[0], B[0], A[1], A[1], B[0], B[1]].forEach(function (v) { arrP.push(v[0], v[1], v[2]); arrN.push(nxw, ny, nzw); });
        }
        function deep(k) { return R.pts[k].h < 3 ? -Math.max(0.6, R.pts[k].h) : -0.6; }
        for (var k = 1; k < n; k++) {
            var afterNose = R.noseTip >= 0 && k >= R.noseTip;
            var pk = R.pts[k], inClear = Math.abs(pk.r.lat) - 2.6 >= MAIN_EDGE + 0.3 || pk.roadY === undefined || Math.abs(R.Y[k] - pk.roadY) > 2.0;   // 内側の地覆・ガードレールが本線の舗装の上に出ない所だけ（ノーズの直後で本線に近い所は本線のガードレールに任せる）
            var oF = function (kk) { return outer[kk]; }, oF2 = function (kk) { return outer[kk] + 0.45; };
            quad(cp, cn, k, oF, function () { return 0; }, oF, function () { return 0.25; }, -1, 0);           // 外側の地覆の内面
            quad(cp, cn, k, oF, function () { return 0.25; }, oF2, function () { return 0.25; }, 0, 1);      // 上面
            quad(cp, cn, k, oF2, function () { return 0.25; }, oF2, deep, 1, 0);                             // 外面（低い所は地面まで＝擁壁）
            var iE = afterNose ? function (kk) { return -2.95; } : function (kk) { return inner[kk]; };
            quad(cp, cn, k, oF2, deep, iE, deep, 0, -1);                                                     // 床版の下面
            if (afterNose && (inClear || Q_OLDRAIL)) {
                var iA = function () { return -2.5; };
                quad(cp, cn, k, iA, function () { return 0; }, iA, function () { return 0.25; }, 1, 0);
                quad(cp, cn, k, iA, function () { return 0.25; }, iE, function () { return 0.25; }, 0, 1);
                quad(cp, cn, k, iE, function () { return 0.25; }, iE, deep, -1, 0);
            }
            if (R.pts[k].h >= 3) {                                                                          // 箱桁（幅 4 m、床版の下 1.6 m）
                var gL = function () { return -2.0; }, gR2 = function () { return 2.0; }, gb = function () { return -2.2; }, gt = function () { return -0.6; };
                quad(cp, cn, k, gL, gt, gL, gb, -1, 0); quad(cp, cn, k, gR2, gt, gR2, gb, 1, 0); quad(cp, cn, k, gL, gb, gR2, gb, 0, -1);
            }
            // ガードレール（外側は全区間、内側はノーズから先）。帯 0.62〜0.9 m（地覆の上）
            var ro = function (kk) { return outer[kk] + 0.1; };
            quad(gp, gn, k, ro, function () { return 0.85; }, ro, function () { return 1.13; }, -1, 0);
            if (afterNose && (inClear || Q_OLDRAIL)) { var ri = function () { return -2.6; }; quad(gp, gn, k, ri, function () { return 0.85; }, ri, function () { return 1.13; }, 1, 0); }
        }
        var gC = new THREE.BufferGeometry(); gC.setAttribute('position', new THREE.Float32BufferAttribute(cp, 3)); gC.setAttribute('normal', new THREE.Float32BufferAttribute(cn, 3));
        var gG = new THREE.BufferGeometry(); gG.setAttribute('position', new THREE.Float32BufferAttribute(gp, 3)); gG.setAttribute('normal', new THREE.Float32BufferAttribute(gn, 3));
        var grp = new THREE.Group();
        [new THREE.Mesh(gS, rampSurfMat), new THREE.Mesh(gC, rampStructMat), new THREE.Mesh(gG, rampRailMat)].forEach(function (m) { m.frustumCulled = false; grp.add(m); });
        // 橋脚（22 m ごと、高さ 3 m 以上、本線から 14 m 以上離れた所）・街灯（36 m ごと、外側）・信号（地上の端）
        var piers = [], lamps = [];
        for (var u = 11; u < R.U[n - 1]; u += 22) {
            var ip = idxAtU(R, u); if (R.pts[ip].h < 3 || R.pts[ip].r.att || !(R.pts[ip].r.lat > 14)) continue;
            if (!clearOfRail(R.X[ip], R.Z[ip], 0, PIER_RAIL_CLEAR)) continue;    // 線路の上に橋脚を立てない
            piers.push([R.X[ip], R.Y[ip] - 2.2, R.Z[ip], R.pts[ip].h - 2.2]);
        }
        for (var u2 = 18; u2 < R.U[n - 1]; u2 += 36) {
            var il = idxAtU(R, u2), off = outer[il] + 0.7;
            lamps.push([R.X[il] + OX[il] * off, R.Y[il] + 0.25 + tiltY(il, off), R.Z[il] + OZ[il] * off, Math.atan2(OZ[il], -OX[il])]);   // 腕（ポールの +x）がランプの方を向く回転
        }
        // v8: 付属物（ランプの先頭の点からの相対座標で grp に入れる）
        function at(i, off, dy) { return new THREE.Vector3(R.X[i] + OX[i] * off - x0, R.Y[i] + (dy || 0) + tiltY(i, off) - y0, R.Z[i] + OZ[i] * off - z0); }
        function tang(i) { var a2 = Math.max(0, i - 1), b2 = Math.min(n - 1, i + 1), tx = R.X[b2] - R.X[a2], tz = R.Z[b2] - R.Z[a2], tl = Math.hypot(tx, tz) || 1; return [tx / tl, tz / tl]; }
        function yawFacing(tx, tz) { return Math.atan2(-tx, -tz); }      // 板（+z が表）が、tx,tz の向きに進んでくる車の方を向く回転
        makeSmallTex();
        if (R.noseTip > 0) {
            // ランプの内側のガードレールの始まりの袖ビーム（丸みを導流帯の側＝進行の逆へ）
            var tN = tang(R.noseTip), we = new THREE.Mesh(endGeo, endMat);
            we.position.copy(at(R.noseTip, -2.6, 0.26 - (0.75 + P.railY - P.medianH) + 0.73)); we.position.y = R.Y[R.noseTip] + 0.26 - y0;
            we.rotation.y = Math.atan2(tN[1], -tN[0]); grp.add(we);
            if (isExit) {                                                // ノーズの小さな「出口」標識（ドラムの後ろ）
                var ns = new THREE.Group(), post = new THREE.Mesh(nosePostGeo, signPoleMat); ns.add(post);
                var nb = new THREE.Mesh(noseBoardGeo, signMat(noseTex)); nb.position.y = 1.9; ns.add(nb);
                ns.position.copy(at(R.noseTip, -6.4, 0)); ns.position.y = R.Y[R.noseTip] - y0;
                ns.rotation.y = yawFacing(tN[0], tN[1]); grp.add(ns); nb.material.uniforms.uLight.value = 0.2; nb.material.userData.own = true;
            }
        }
        if (!isExit && iN > 20) {                                        // 入口: ノーズの 80 m 手前に「合流注意」（黄色の菱形、記号だけ）
            var iw = idxAtU(R, Math.max(0, R.U[R.noseTip > 0 ? R.noseTip : iN] - 80)) ;
            var tw = tang(iw), ws = new THREE.Group(), wp = new THREE.Mesh(nosePostGeo, signPoleMat); wp.scale.y = 1.2; ws.add(wp);
            var wb = new THREE.Mesh(warnBoardGeo, signMat(warnTex)); wb.position.y = 2.3; wb.rotation.z = Math.PI / 4; ws.add(wb);
            ws.position.copy(at(iw, outer[iw] + 0.8, 0.25)); ws.rotation.y = yawFacing(R.k === 1 ? -tw[0] : -tw[0], R.k === 1 ? -tw[1] : -tw[1]); grp.add(ws); wb.material.uniforms.uLight.value = 0.2; wb.material.userData.own = true;
        }
        // 料金所の屋根（地上の端の 60 m 手前。屋根の下の天井照明の光が地面に落ちる明るい矩形）
        var it = idxAtU(R, Math.max(0, R.U[n - 1] - 70)), tt = tang(it);
        var tb = new THREE.Group(); tb.position.copy(at(it, 0, 0)); tb.position.y = P.groundY + 0.2 - y0; tb.rotation.y = Math.atan2(tt[0], tt[1]);
        var roof = new THREE.Mesh(tollRoofGeo, rampStructMat); roof.position.y = 6.2; tb.add(roof);
        var glow = new THREE.Mesh(tollGlowGeo, tollGlowMat); glow.position.y = 0.06; glow.rotation.x = -Math.PI / 2; tb.add(glow);
        var under = new THREE.Mesh(tollGlowGeo, tollUnderMat); under.position.y = 5.85; under.rotation.x = Math.PI / 2; tb.add(under);
        [-5, 0, 5].forEach(function (bx) { var bo = new THREE.Mesh(tollBoothGeo, rampStructMat); bo.position.set(bx, 1.2, 0); tb.add(bo); });
        grp.add(tb);
        var e = n - 1;
        return { k: R.k, grp: grp, x0: x0, y0: y0, z0: z0, piers: piers, lamps: lamps,
                 sig: [R.X[e] + OX[e] * 4 + (R.X[e] - R.X[e - 1]) * 2, R.Y[e] + 4.5, R.Z[e] + OZ[e] * 4 + (R.Z[e] - R.Z[e - 1]) * 2],
                 nose: R.noseTip >= 0 ? [R.X[R.noseTip], R.Y[R.noseTip], R.Z[R.noseTip], OX[R.noseTip], OZ[R.noseTip], R.X[Math.max(0, R.noseTip - 1)], R.Z[Math.max(0, R.noseTip - 1)]] : null };
    }
    var nosePostGeo = new THREE.CylinderGeometry(0.05, 0.05, 2.2, 8); nosePostGeo.translate(0, 1.1, 0);
    var noseBoardGeo = new THREE.PlaneGeometry(1.3, 0.75), warnBoardGeo = new THREE.PlaneGeometry(0.85, 0.85);
    var tollRoofGeo = new THREE.BoxGeometry(16, 0.7, 26), tollGlowGeo = new THREE.PlaneGeometry(15, 24), tollBoothGeo = new THREE.BoxGeometry(1.4, 2.4, 3.0);
    var tollGlowMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.10, 0.095, 0.085), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
    var tollUnderMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.55, 0.55, 0.52) });
    var icSharedGeo = new Set([endGeo, nosePostGeo, noseBoardGeo, warnBoardGeo, tollRoofGeo, tollGlowGeo, tollBoothGeo]);   // IC を消すときに捨てない共有ジオメトリ
    function smallTex(draw, w, h) { var cv = document.createElement('canvas'); cv.width = w; cv.height = h; draw(cv.getContext('2d'), w, h); var t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.NoColorSpace; t.anisotropy = maxAniso; t.minFilter = THREE.LinearMipmapLinearFilter; return t; }
    var noseTex = null, warnTex = null, roadTxtTex = null;
    function drawRoadTxt(c, W, H) {                                      // 減速車線の路面の文字（白、黒地）。1 マス 128×128 に 1 文字、上が奥。シェーダーで進行方向へ 4 倍に伸ばす
        c.fillStyle = '#000'; c.fillRect(0, 0, W, H); c.fillStyle = '#fff'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = '900 118px ' + SIGN_FONT;
        '速度落とせ'.split('').forEach(function (ch, i) { c.fillText(ch, W / 2, i * 128 + 66); });
    }
    function makeSmallTex() {                                            // 標識の書体・異方性の値が決まってから作る
    if (noseTex) return;
    rampSurfMat.uniforms.uRoadTxt.value = roadTxtTex = smallTex(drawRoadTxt, 128, 640);
    noseTex = smallTex(function (c, W, H) {
        c.fillStyle = '#00703c'; c.fillRect(0, 0, W, H); c.strokeStyle = '#fff'; c.lineWidth = 6; roundRect(c, 6, 6, W - 12, H - 12, 12); c.stroke();
        c.fillStyle = '#fff'; c.font = '900 64px ' + SIGN_FONT; c.fillText('出口', 22, 86); c.font = '700 28px ' + SIGN_FONT; c.fillText('EXIT', 30, 124); drawArrow(c, W - 62, 72, 44);
    }, 256, 148);
    warnTex = smallTex(function (c, W, H) {
        c.fillStyle = '#f2c200'; c.fillRect(0, 0, W, H); c.strokeStyle = '#111'; c.lineWidth = 8; c.strokeRect(10, 10, W - 20, H - 20);
        c.lineWidth = 14; c.lineCap = 'round'; c.beginPath(); c.moveTo(W * 0.62, H * 0.82); c.lineTo(W * 0.62, H * 0.2); c.moveTo(W * 0.3, H * 0.82); c.quadraticCurveTo(W * 0.32, H * 0.45, W * 0.6, H * 0.36); c.stroke();
    }, 128, 128);
    }
    // v9: 見えている区間を uniform へ。遮音壁（B）は、その側に並走線がある区間・くぐる線の交差点の前後 150 m では壁高欄（A）にする。
    // 川の橋は反対側も鋼製高欄（C）にする（川の範囲を先に入れるので、こちらが優先される）
    function secTypeEff(o) {
        if (o.ty !== 1) return o.ty;
        for (var kk in railCache) {
            var L = railCache[kk];
            if (L.par) { if (L.side === o.side && o.s1 > L.sA - 200 && o.s0 < L.sL + 200) return 0; }
            else if (o.s1 > L.sc - 150 && o.s0 < L.sc + 150) return 0;
        }
        return 1;
    }
    // 遮音壁（B）の区間を、並走線（同じ側）の区間と、くぐる線の交差点の前後 150 m だけ壁高欄（A）にして分ける
    function splitB(o) {
        var cuts = [];
        for (var kk in railCache) {
            var L = railCache[kk];
            if (L.par) { if (L.side === o.side) cuts.push([L.sA - 200, L.sL + 200]); }
            else cuts.push([L.sc - 150, L.sc + 150]);
        }
        cuts = cuts.filter(function (c) { return c[1] > o.s0 && c[0] < o.s1; }).sort(function (x, y) { return x[0] - y[0]; });
        var out = [], cur = o.s0;
        cuts.forEach(function (c) {
            var c0 = Math.max(o.s0, c[0]), c1 = Math.min(o.s1, c[1]);
            if (c1 <= cur) return;
            if (c0 > cur) out.push([cur, c0, 1]);
            out.push([Math.max(cur, c0), c1, 0]); cur = c1;
        });
        if (cur < o.s1) out.push([cur, o.s1, 1]);
        return out;
    }
    function fillSecs(sBase) {
        if (q.nov9) { [secAL, secAR].forEach(function (A2) { A2.forEach(function (v) { v.set(-1e6, -1e6, 3, 0); }); }); return; }   // 確認用: v8 と同じ側面（ガードレール）で描く
        [-1, 1].forEach(function (side) {
            var A2 = side < 0 ? secAL : secAR, B2 = side < 0 ? secBL : secBR, n = 0, L = secs[side];
            rivers.concat(groads).forEach(function (R) { if (n < 16 && R.s1 > sCam - 200 && R.s0 < sCam + P.viewLen) { A2[n].set(R.s0 - sBase, R.s1 - sBase, 2, 0); B2[n].set(0, 0, 0.5, 0.5); n++; } });
            for (var i = 0; i < L.length && n < 16; i++) {
                var o = L[i]; if (o.s1 < sCam - 200 || o.s0 > sCam + P.viewLen) continue;
                var pv = L[i - 1], nx = L[i + 1];
                var pieces = o.ty === 1 ? splitB(o) : [[o.s0, o.s1, o.ty]];          // 遮音壁は、避ける所だけ壁高欄にする
                for (var pi = 0; pi < pieces.length && n < 16; pi++) {
                    var pc = pieces[pi], prevT = pi > 0 ? pieces[pi - 1][2] : (pv ? pv.ty : 0), nextT = pi < pieces.length - 1 ? pieces[pi + 1][2] : (nx ? nx.ty : 0);
                    A2[n].set(pc[0] - sBase, pc[1] - sBase, pc[2], o.H);
                    B2[n].set(prevT, nextT, o.vr, o.rv); n++;
                }
            }
            for (; n < 16; n++) { A2[n].set(-1e6, -1e6, 3, 0); B2[n].set(3, 3, 0, 0); }
        });
    }
    // === v9: 壁高欄の付属物（視線誘導標・キロポスト・非常電話・消火器箱）と川 ===
    var delin = makeGlowPoints(260, 0.55, [1, 1, 1], 5); delin.renderOrder = 10; scene.add(delin);
    var kpTex = [], kpMeshes = [], kpGeo = new THREE.PlaneGeometry(0.42, 0.26), kpGeoK = new THREE.PlaneGeometry(0.6, 0.36);
    var phoneTex = null, phoneMeshes = [], phoneBoxGeo = new THREE.BoxGeometry(0.55, 0.8, 0.35), phoneLampGeo = new THREE.PlaneGeometry(0.75, 0.32);
    var riverMeshes = {};
    var waterMat = new THREE.ShaderMaterial({ vertexShader: S.waterVert, fragmentShader: S.waterFrag,
        uniforms: { uCamPos: U.uCamPos, uLampCol: U.uLampCol, uTime: U.uTime, uFogDensity: U.uFogDensity, uFogBase: U.uFogBase,
                    uRivO: { value: new THREE.Vector3() }, uRivA: { value: new THREE.Vector3() }, uRivC: { value: new THREE.Vector3() }, uRivW: { value: 60 } } });
    var bankLamps = makeGlowPoints(200, 1.0, P.lampCol, 2); bankLamps.renderOrder = 10; scene.add(bankLamps);
    var groadMeshes = {}, groadGeo = null;
    function groadMatNew() {                                              // 道路ごとの材質（霧・カメラは共有の uniform）
        return new THREE.ShaderMaterial({ vertexShader: S.groadVert, fragmentShader: S.groadFrag, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4,
            uniforms: uni({ uRivO: { value: new THREE.Vector3() }, uRivA: { value: new THREE.Vector3() }, uRivC: { value: new THREE.Vector3() }, uW: { value: 24 }, uXi: { value: 0 }, uHalf: { value: GR_HALF }, uGrCol: { value: new THREE.Vector3() } }) });
    }
    var grLamps = makeGlowPoints(160, 0.9, [0.85, 0.92, 1.0], 2); grLamps.renderOrder = 10; scene.add(grLamps);
    var grSigs = makeGlowPoints(32, 0.45, [1, 1, 1], 2); grSigs.renderOrder = 10; scene.add(grSigs);
    var grPoles = new THREE.InstancedMesh(poleGeo, poleMat, 160); grPoles.frustumCulled = false; grPoles.count = 0; grPoles.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(grPoles);   // 本線の街灯の形を 0.82 倍（高さ 9 m、腕 1.8 m）
    function updateGroads() {
        var hl = grLamps.geometry.attributes.position.array, cl = grLamps.geometry.attributes.aCol.array, nL2 = 0;
        var hs = grSigs.geometry.attributes.position.array, cs = grSigs.geometry.attributes.aCol.array, nS2 = 0;
        groads.forEach(function (R) {
            var near = Math.hypot(R.x - O.x, R.z - O.z) < 4000;
            if (!near) { if (groadMeshes[R.n]) { scene.remove(groadMeshes[R.n]); groadMeshes[R.n].material.dispose(); delete groadMeshes[R.n]; } return; }
            if (!groadMeshes[R.n]) {
                if (!groadGeo) { groadGeo = new THREE.PlaneGeometry(GR_HALF * 2, 184, 1, 1); groadGeo.rotateX(-Math.PI / 2); }
                var m = new THREE.Mesh(groadGeo, groadMatNew()); m.frustumCulled = false; m.rotation.y = Math.atan2(R.dx, R.dz) - Math.PI / 2; scene.add(m); groadMeshes[R.n] = m;
                var u = m.material.uniforms; u.uW.value = R.w; u.uXi.value = R.xi; u.uGrCol.value.fromArray(R.led ? [0.85, 0.92, 1.0] : COL_NA).multiplyScalar(0.6);
            }
            var M = groadMeshes[R.n];
            M.position.set(R.x - O.x, R.y + 0.06 - O.y, R.z - O.z);
            M.material.uniforms.uRivO.value.set(R.x - O.x, R.y - O.y, R.z - O.z); M.material.uniforms.uRivA.value.set(R.dx, 0, R.dz); M.material.uniforms.uRivC.value.set(R.dz, 0, -R.dx);
            var lc = R.led ? [0.85, 0.92, 1.0] : COL_NA;
            for (var sd = -1; sd <= 1; sd += 2) for (var k2 = -12; k2 <= 12 && nL2 < 156; k2++) {        // 街路灯（シェーダの照明と同じ位置）
                var la = k2 * 32 + (sd > 0 ? 16 : 0); if (Math.abs(la) > GR_HALF - 40) continue;
                var cc = sd * (R.w / 2 - 5);
                hl[nL2 * 3] = R.x + R.dx * la + R.dz * cc - O.x; hl[nL2 * 3 + 1] = R.y + 9 - O.y; hl[nL2 * 3 + 2] = R.z + R.dz * la - R.dx * cc - O.z;
                var cp = sd * (R.w / 2 - 3.2);                                    // ポールは歩道の車道寄り、腕が車道の側を向く
                tmpV.set(R.x + R.dx * la + R.dz * cp - O.x, R.y - O.y, R.z + R.dz * la - R.dx * cp - O.z); tmpQr.setFromAxisAngle(yAxis, Math.atan2(-sd * R.dx, -sd * R.dz));
                tmpM.compose(tmpV, tmpQr, tmpS2.set(0.82, 0.82, 0.82)); grPoles.setMatrixAt(nL2, tmpM);
                cl[nL2 * 3] = lc[0]; cl[nL2 * 3 + 1] = lc[1]; cl[nL2 * 3 + 2] = lc[2]; nL2++;
            }
            // 信号: 交差点の 4 隅、高さ 5.5 m。本線 40 秒青・3 秒黄・27 秒赤、細い道はその逆（両方赤の 2 秒をはさむ）
            var t = (timeSec + R.ph) % 70, mainC, crossC;
            var G = [0.05, 0.85, 0.55], Y = [1.0, 0.55, 0.04], Rr = [1.0, 0.06, 0.04];
            mainC = t < 40 ? G : t < 43 ? Y : Rr; crossC = (t >= 45 && t < 65) ? G : (t >= 65 && t < 68) ? Y : Rr;
            for (var q3 = 0; q3 < 4 && nS2 < 32; q3++) {
                var sa = (q3 & 1) ? 1 : -1, sc2 = (q3 & 2) ? 1 : -1, aa = R.xi + sa * 6.5, c3 = sc2 * (R.w / 2 - 1.0), col3 = (q3 === 0 || q3 === 3) ? mainC : crossC;
                hs[nS2 * 3] = R.x + R.dx * aa + R.dz * c3 - O.x; hs[nS2 * 3 + 1] = R.y + 5.5 - O.y; hs[nS2 * 3 + 2] = R.z + R.dz * aa - R.dx * c3 - O.z;
                cs[nS2 * 3] = col3[0] * 0.6; cs[nS2 * 3 + 1] = col3[1] * 0.6; cs[nS2 * 3 + 2] = col3[2] * 0.6; nS2++;
            }
        });
        grPoles.count = nL2; grPoles.instanceMatrix.needsUpdate = true;
        grLamps.geometry.setDrawRange(0, nL2); grLamps.geometry.attributes.position.needsUpdate = true; grLamps.geometry.attributes.aCol.needsUpdate = true;
        grSigs.geometry.setDrawRange(0, nS2); grSigs.geometry.attributes.position.needsUpdate = true; grSigs.geometry.attributes.aCol.needsUpdate = true;
    }
    function kpTexFor(i, txt) {
        if (!kpTex[i]) { var cv = document.createElement('canvas'); cv.width = 128; cv.height = 80; kpTex[i] = { cv: cv, t: new THREE.CanvasTexture(cv), txt: null }; kpTex[i].t.colorSpace = THREE.NoColorSpace; kpTex[i].t.anisotropy = maxAniso; }
        var K = kpTex[i];
        if (K.txt !== txt) {
            var c = K.cv.getContext('2d'); c.fillStyle = '#00703c'; c.fillRect(0, 0, 128, 80); c.strokeStyle = '#fff'; c.lineWidth = 4; c.strokeRect(4, 4, 120, 72);
            c.fillStyle = '#fff'; c.font = '900 46px ' + SIGN_FONT; c.textAlign = 'center'; c.fillText(txt, 64, 56); K.txt = txt; K.t.needsUpdate = true;
        }
        return K.t;
    }
    function updateWallParts(sBase) {
        // 壁高欄には光る点を付けない（視線誘導標・消火器箱の表示灯は外した。実際のコンクリートの壁では目立たないため）
        var nD = 0;
        delin.geometry.setDrawRange(0, nD); delin.geometry.attributes.position.needsUpdate = true; delin.geometry.attributes.aCol.needsUpdate = true;
        // キロポスト（100 m ごと、壁の道路側の面、km ごとに大きい板）。数字は架空の起点からの距離
        var nK = 0;
        for (var ks = Math.ceil((sCam - 10) / 100) * 100; ks < sCam + 400; ks += 100) {
            var oK = secAtS(-1, ks); if (!oK || secTypeEff(oK) > 1 || inRampZone(ks, -1) || inRiver(ks)) continue;
            if (!kpMeshes[nK]) { kpMeshes[nK] = new THREE.Mesh(kpGeo, signMat(backTex)); kpMeshes[nK].material.uniforms.uLight.value = 0.07; scene.add(kpMeshes[nK]); }
            var mK = kpMeshes[nK], km = 12.0 + ks / 1000;
            mK.material.uniforms.map.value = kpTexFor(nK, km.toFixed(1)); mK.geometry = (ks % 1000 === 0) ? kpGeoK : kpGeo;
            frameAt(ks, FR); place(FR, -9.30, 0.75, mK.position); mK.rotation.set(0, -FR.th + Math.PI / 2, 0); mK.visible = true; nK++;
        }
        for (var kh = nK; kh < kpMeshes.length; kh++) kpMeshes[kh].visible = false;
        // 非常電話（500 m ごと、壁の切り欠きの箱と、天端の上の「非常電話」の行灯）
        if (!phoneTex) phoneTex = smallTex(function (c, W, H) { c.fillStyle = '#00703c'; c.fillRect(0, 0, W, H); c.fillStyle = '#fff'; c.font = '900 52px ' + SIGN_FONT; c.textAlign = 'center'; c.fillText('非常電話', W / 2, 66); }, 256, 96);
        var nP2 = 0;
        for (var ps2 = Math.ceil((sCam - 10) / 500) * 500; ps2 < sCam + 600; ps2 += 500) {
            for (var sd3 = -1; sd3 <= 1; sd3 += 2) {
                var oP = secAtS(sd3, ps2); if (!oP || secTypeEff(oP) > 1 || inRampZone(ps2, sd3) || inRiver(ps2)) continue;
                if (!phoneMeshes[nP2]) {
                    var gph = new THREE.Group(), box = new THREE.Mesh(phoneBoxGeo, signPoleMat); box.position.y = 0.6; gph.add(box);
                    var lamp = new THREE.Mesh(phoneLampGeo, signMat(phoneTex)); lamp.material.uniforms.uLight.value = 0.05; lamp.position.set(0, 1.55, 0); gph.add(lamp);
                    var lampB = new THREE.Mesh(phoneLampGeo, signMat(phoneTex)); lampB.material.uniforms.uLight.value = 0.05; lampB.position.set(0, 1.55, -0.01); lampB.rotation.y = Math.PI; gph.add(lampB);
                    phoneMeshes[nP2] = gph; scene.add(gph);
                }
                var G2 = phoneMeshes[nP2]; frameAt(ps2, FR); place(FR, sd3 * 9.45, 0.0, G2.position); G2.rotation.set(0, -FR.th, 0); G2.visible = true; nP2++;
            }
        }
        for (var ph = nP2; ph < phoneMeshes.length; ph++) phoneMeshes[ph].visible = false;
        // 川: 見える川のメッシュを作り、原点相対に置く。両岸の街灯
        var hb = bankLamps.geometry.attributes.position.array, nB = 0;
        rivers.forEach(function (R) {
            var near = Math.hypot(R.x - O.x, R.z - O.z) < 4000;
            if (!near) { if (riverMeshes[R.n]) { scene.remove(riverMeshes[R.n]); riverMeshes[R.n].geometry.dispose(); riverMeshes[R.n].material.dispose(); delete riverMeshes[R.n]; } return; }
            if (!riverMeshes[R.n]) {
                var gw = new THREE.PlaneGeometry(RIV_HALF * 2, R.w, 40, 4); gw.rotateX(-Math.PI / 2);
                var pa = gw.attributes.position.array, rv = new Float32Array(pa.length / 3 * 2), ang = Math.atan2(R.dx, R.dz);
                for (var vi = 0; vi < pa.length / 3; vi++) { rv[vi * 2] = pa[vi * 3]; rv[vi * 2 + 1] = pa[vi * 3 + 2]; }
                gw.setAttribute('aRiv', new THREE.BufferAttribute(rv, 2));
                var mw = new THREE.Mesh(gw, waterMat.clone()); mw.frustumCulled = false; mw.rotation.y = ang - Math.PI / 2; scene.add(mw); riverMeshes[R.n] = mw;
                mw.material.uniforms.uRivW.value = R.w;
            }
            var M = riverMeshes[R.n]; M.position.set(R.x - O.x, R.y + 0.08 - O.y, R.z - O.z);
            M.material.uniforms.uRivO.value.set(R.x - O.x, R.y - O.y, R.z - O.z); M.material.uniforms.uRivA.value.set(R.dx, 0, R.dz); M.material.uniforms.uRivC.value.set(R.dz, 0, -R.dx);
            M.material.uniforms.uCamPos = U.uCamPos; M.material.uniforms.uTime = U.uTime;
            for (var al = -RIV_HALF + 30; al <= RIV_HALF - 30 && nB < 196; al += 30) for (var sb = -1; sb <= 1; sb += 2) {
                var bx = R.x + R.dx * al + R.dz * sb * (R.w / 2 + 6), bz = R.z + R.dz * al - R.dx * sb * (R.w / 2 + 6);
                if (Math.abs(al) < 20) continue;                              // 橋の真下は除く
                hb[nB * 3] = bx - O.x; hb[nB * 3 + 1] = R.y + 8 - O.y; hb[nB * 3 + 2] = bz - O.z; nB++;
            }
        });
        bankLamps.geometry.setDrawRange(0, nB); bankLamps.geometry.attributes.position.needsUpdate = true;
        updateGroads();
    }
    // 線路の鉄橋（下路式の鋼トラス、暗い灰色）: くぐる線が川を渡る所。両側に上弦材・下弦材・垂直材・斜材、両端に橋台
    var trussGeo = new THREE.BoxGeometry(1, 1, 1);
    var trussMat = litMat([0.045, 0.047, 0.05], 0.6, [0.2, 0.2, 0.2], 0.0, false);
    var NTRUSS = 1500, truss = new THREE.InstancedMesh(trussGeo, trussMat, NTRUSS); truss.frustumCulled = false; truss.count = 0; truss.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(truss);
    var tA3 = new THREE.Vector3(), tB3 = new THREE.Vector3(), tM4 = new THREE.Matrix4(), tQ4 = new THREE.Quaternion(), tS3 = new THREE.Vector3(), zAx = new THREE.Vector3(0, 0, 1);
    function trussMember(n, ax, ay, az, bx, by, bz, w) {           // 世界座標の 2 点を結ぶ角材
        if (n >= NTRUSS) return n;
        tA3.set(ax - O.x, ay - O.y, az - O.z); tB3.set(bx - O.x, by - O.y, bz - O.z);
        var len = tA3.distanceTo(tB3); tS3.subVectors(tB3, tA3).normalize(); tQ4.setFromUnitVectors(zAx, tS3);
        tM4.compose(tA3.add(tB3).multiplyScalar(0.5), tQ4, new THREE.Vector3(w, w, len)); truss.setMatrixAt(n, tM4);
        return n + 1;
    }
    function updateTruss() {
        var n = 0, gy0 = P.groundY + RAIL_Y;
        for (var kk in railCache) {
            var L = railCache[kk]; if (L.par || lineDist(L, O.x, O.z) > 3000) continue;
            rivers.forEach(function (R) {
                if (Math.hypot(R.x - L.cx, R.z - L.cz) > RAIL_HALF + RIV_HALF) return;
                var u0 = 1e9, u1 = -1e9;
                for (var u = -RAIL_HALF; u <= RAIL_HALF; u += 2) {
                    var x = L.cx + L.dx * u, z = L.cz + L.dz * u, ex = x - R.x, ez = z - R.z;
                    if (Math.abs(ex * R.dx + ez * R.dz) < RIV_HALF && Math.abs(ex * R.dz - ez * R.dx) < R.w / 2 + 8) { u0 = Math.min(u0, u); u1 = Math.max(u1, u); }
                }
                if (u1 < u0) return;
                var nP = Math.max(2, Math.round((u1 - u0) / 6)), du = (u1 - u0) / nP;
                for (var sd = -1; sd <= 1; sd += 2) {
                    var ox = L.rx * 3.4 * sd, oz = L.rz * 3.4 * sd;
                    var P0 = function (u, h) { return [L.cx + L.dx * u + ox, gy0 + h, L.cz + L.dz * u + oz]; };
                    var a0 = P0(u0, 0.4), a1 = P0(u1, 0.4), t0 = P0(u0 + du, 6.5), t1 = P0(u1 - du, 6.5);
                    n = trussMember(n, a0[0], a0[1], a0[2], a1[0], a1[1], a1[2], 0.5);            // 下弦材
                    n = trussMember(n, t0[0], t0[1], t0[2], t1[0], t1[1], t1[2], 0.45);           // 上弦材
                    for (var i = 0; i <= nP; i++) {
                        var ub = u0 + du * i, b = P0(ub, 0.4), tp = P0(ub, 6.5);
                        if (i > 0 && i < nP) n = trussMember(n, b[0], b[1], b[2], tp[0], tp[1], tp[2], 0.28);   // 垂直材
                        if (i < nP) { var nx = P0(ub + du, i === 0 ? 0.4 : 6.5), bb = i === 0 ? P0(ub, 0.4) : P0(ub, 0.4); var tt = P0(ub + du, 6.5); n = trussMember(n, bb[0], bb[1], bb[2], tt[0], tt[1], tt[2], 0.25); }   // 斜材
                    }
                }
                // 橋台（両端のコンクリートの塊）
                [u0, u1].forEach(function (ue) { var c = [L.cx + L.dx * ue, gy0 - 1.0, L.cz + L.dz * ue]; n = trussMember(n, c[0] - L.rx * 4.5, c[1], c[2] - L.rz * 4.5, c[0] + L.rx * 4.5, c[1], c[2] + L.rz * 4.5, 2.2); });
            });
        }
        truss.count = n; truss.instanceMatrix.needsUpdate = true;
    }
    // 点検通路（A・B の区間の 2 割の径間）: 桁の外側の下寄りに吊ったグレーチングの床（幅 0.7 m）、外側の手すり（1.1 m）、2.5 m ごとの持送り。暗い作業灯は 1 km に 1 個程度
    var walkMat = litMat([0.05, 0.05, 0.052], 0.7, [0.1, 0.1, 0.1], 0.0, false);
    var NWALK = 900, walk = new THREE.InstancedMesh(trussGeo, walkMat, NWALK); walk.frustumCulled = false; walk.count = 0; walk.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(walk);
    var workLights = makeGlowPoints(8, 0.8, [0.9, 0.95, 1.0], 5); scene.add(workLights);
    var walkFirst = false, walkList = [];
    function updateWalkway() {
        walkList.length = 0;
        var n = 0, wl = workLights.geometry.attributes.position.array, nw = 0, s0 = Math.floor((sCam - 50 - P.pierPhase) / P.pierPeriod) * P.pierPeriod + P.pierPhase;
        function box(F, x, y, sl, w, h, len) {                            // 道路のフレームの (x, y) に、道路の向きの長さ len の箱
            if (n >= NWALK) return;
            place(F, x, y, tmpV); tmpQ.setFromAxisAngle(yAxis, -F.th);
            tmpM.compose(tmpV, tmpQ, tmpS2.set(w, h, len)); walk.setMatrixAt(n++, tmpM);
        }
        for (var sp = s0; sp < sCam + 600; sp += P.pierPeriod) {
            for (var sd = -1; sd <= 1; sd += 2) {
                if (gapHash(Math.round(sp / P.pierPeriod) * 2 + (sd > 0 ? 1 : 0), 98) > 0.2) continue;
                var o = secAtS(sd, sp + 18); if (!o || o.ty > 1 || inRampZone(sp + 18, sd) || inRiver(sp + 18)) continue;
                frameAt(sp + 18, FR); walkList.push(Math.round(sp) + (sd < 0 ? 'L' : 'R'));
                box(FR, sd * 10.15, -1.75, 0, 0.7, 0.05, P.pierPeriod);           // グレーチングの床
                box(FR, sd * 10.48, -0.65, 0, 0.05, 0.05, P.pierPeriod);          // 手すり（上）
                box(FR, sd * 10.48, -1.2, 0, 0.04, 0.04, P.pierPeriod);           // 手すり（中）
                for (var b = -14.0; b <= 14.0; b += 2.5) { frameAt(sp + 18 + b, FR); box(FR, sd * 10.1, -1.8, 0, 0.8, 0.12, 0.08); box(FR, sd * 10.48, -1.2, 0, 0.05, 1.1, 0.05); }   // 持送りと手すりの支柱
                if (nw < 8 && gapHash(Math.round(sp / 1000), 99) < 0.9 && Math.abs((sp % 1000) - 500) < P.pierPeriod / 2) { frameAt(sp + 18, FR); place(FR, sd * 10.2, -0.9, tmpV); wl[nw * 3] = tmpV.x; wl[nw * 3 + 1] = tmpV.y; wl[nw * 3 + 2] = tmpV.z; nw++; }
            }
        }
        walk.count = n; walk.instanceMatrix.needsUpdate = true; walkFirst = n > 0;
        workLights.geometry.setDrawRange(0, nw); workLights.geometry.attributes.position.needsUpdate = true;
    }
    // 壁高欄（A）の天端の手すりの支柱（2 m ごと、天端 1.10 m から手すりの下 1.20 m まで）。区間の端で壁が斜めに下がる所・出入口・川の橋には置かない
    var hpMat = litMat([0.10, 0.10, 0.10], 0.4, [0.3, 0.3, 0.3], 0.0, false);
    var NHP = 640, hPosts = new THREE.InstancedMesh(trussGeo, hpMat, NHP); hPosts.frustumCulled = false; hPosts.count = 0; hPosts.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(hPosts);
    var hpFrame = 0;
    function wallTypeAt(sd, s) {                                          // その道のりの側面の種類（fillSecs と同じ切り分け）と、前後の種類・端
        var L = secs[sd];
        for (var i = L.length - 1; i >= 0; i--) {
            var o = L[i]; if (!(o.s0 <= s && s < o.s1)) continue;
            var pcs = o.ty === 1 ? (o._pcsAt === hpFrame ? o._pcs : (o._pcsAt = hpFrame, o._pcs = splitB(o))) : [[o.s0, o.s1, o.ty]];
            for (var k = 0; k < pcs.length; k++) if (pcs[k][0] <= s && s < pcs[k][1])
                return { t: pcs[k][2], a: pcs[k][0], b: pcs[k][1], pv: k > 0 ? pcs[k - 1][2] : (L[i - 1] ? L[i - 1].ty : 0), nx: k < pcs.length - 1 ? pcs[k + 1][2] : (L[i + 1] ? L[i + 1].ty : 0) };
        }
        return null;
    }
    function updateHandPosts() {
        var n = 0; hpFrame++;
        for (var sd = -1; sd <= 1; sd += 2) {
            for (var s = Math.floor((sCam - 30) / 2) * 2 + 1; s < sCam + 360 && n < NHP; s += 2) {
                var w = wallTypeAt(sd, s); if (!w || w.t !== 0 || inRiver(s) || inRampZone(s, sd)) continue;
                if ((w.pv > 1 && s - w.a < 2.3) || (w.nx > 1 && w.b - s < 2.3) || s - w.a < 0.3 || w.b - s < 0.3) continue;
                frameAt(s, FR); place(FR, sd * 9.625, 1.155, tmpV); tmpQ.setFromAxisAngle(yAxis, -FR.th);
                tmpM.compose(tmpV, tmpQ, tmpS2.set(0.05, 0.11, 0.05)); hPosts.setMatrixAt(n++, tmpM);
            }
        }
        hPosts.count = n; hPosts.instanceMatrix.needsUpdate = true;
    }
    function inRiver(s) {                                                // 川・地上の道路をまたぐ橋の区間（両側とも鋼製高欄）
        for (var i = 0; i < rivers.length; i++) if (s > rivers[i].s0 && s < rivers[i].s1) return true;
        for (var j = 0; j < groads.length; j++) if (s > groads[j].s0 && s < groads[j].s1) return true;
        return false;
    }
    function idxAtU(R, u) { var lo = 0, hi = R.n - 1; while (hi - lo > 1) { var m = (lo + hi) >> 1; if (R.U[m] < u) lo = m; else hi = m; } return lo; }

    // --- 標識（片持ち式）: 支柱・腕・板（表は IC ごとの文字のテクスチャ、裏はアルミの灰色） ---
    var SIGN_VERT = [
        'varying vec2 vUv; varying vec3 vW;',
        'void main() { vUv = uv; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }'
    ].join('\n');
    var SIGN_FRAG = [
        'uniform sampler2D map; uniform float uLight; uniform vec3 uCamPos; uniform float uFogDensity; uniform vec3 uFogBase;',
        'varying vec2 vUv; varying vec3 vW;',
        'void main() {',
        '    vec3 c = texture2D(map, vUv).rgb; c = pow(c, vec3(2.2));',
        '    vec3 col = c * uLight;',
        '    float d = length(vW - uCamPos);',
        '    col = mix(uFogBase * 1.5, col, exp(-d * uFogDensity * 0.6));',
        '    gl_FragColor = vec4(col, 1.0);',
        '}'
    ].join('\n');
    var maxAniso = renderer.capabilities.getMaxAnisotropy ? renderer.capabilities.getMaxAnisotropy() : 1;
    var SIGN_FONT = '"Noto Sans JP", "Yu Gothic", "YuGothic", "Hiragino Sans", "Meiryo", sans-serif';
    var fontsReady = false;
    try { if (document.fonts && document.fonts.load) Promise.race([document.fonts.load('900 80px "Noto Sans JP"'), new Promise(function (r) { setTimeout(r, 4000); })]).then(function () { fontsReady = true; redrawSigns(); }); } catch (e) { /* フォントが読めなくてもシステムの書体で描く */ }
    var liveSigns = [];
    function roundRect(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
    function drawArrow(c, x, y, s) {                                      // 左上向きの矢印（↖）
        c.save(); c.translate(x, y); c.rotate(-Math.PI / 4);
        c.beginPath(); c.moveTo(0, -s); c.lineTo(s * 0.55, -s * 0.35); c.lineTo(s * 0.18, -s * 0.35); c.lineTo(s * 0.18, s * 0.9); c.lineTo(-s * 0.18, s * 0.9); c.lineTo(-s * 0.18, -s * 0.35); c.lineTo(-s * 0.55, -s * 0.35); c.closePath();
        c.fill(); c.restore();
    }
    function drawSign(cv, ic, kind) {
        var c = cv.getContext('2d'), W = cv.width, H = cv.height;
        c.fillStyle = '#00703c'; c.fillRect(0, 0, W, H);
        c.strokeStyle = '#ffffff'; c.lineWidth = 10; roundRect(c, 12, 12, W - 24, H - 24, 26); c.stroke();
        c.fillStyle = '#ffffff'; c.textBaseline = 'alphabetic';
        if (kind === 'exit') {
            c.font = '900 150px ' + SIGN_FONT; c.fillText('出口', 70, 210);
            c.font = '700 70px ' + SIGN_FONT; c.fillText('EXIT', 80, 300);
            c.font = '900 96px ' + SIGN_FONT; c.fillText(ic.name[0], 70, 430);
            c.font = '700 40px ' + SIGN_FONT; c.fillText(ic.name[1], 76, 478);
            drawArrow(c, W - 190, 210, 120);
            return;
        }
        // 出口番号（白い角丸の枠、緑の数字）
        c.fillStyle = '#ffffff'; roundRect(c, 50, 46, 120, 90, 16); c.fill();
        c.fillStyle = '#00703c'; c.font = '900 72px ' + SIGN_FONT; c.textAlign = 'center'; c.fillText(String(ic.no), 110, 117); c.textAlign = 'left';
        c.fillStyle = '#ffffff';
        c.font = '900 104px ' + SIGN_FONT; c.fillText(ic.name[0], 196, 134);
        c.font = '700 38px ' + SIGN_FONT; c.fillText(ic.name[1], 202, 180);
        c.font = '900 72px ' + SIGN_FONT; c.fillText(ic.d1[0], 70, 300); c.fillText(ic.d2[0], 70, 420);
        c.font = '700 32px ' + SIGN_FONT; c.fillText(ic.d1[1], 74, 340); c.fillText(ic.d2[1], 74, 460);
        c.font = '900 150px ' + SIGN_FONT; c.textAlign = 'right'; c.fillText(kind.replace('km', '').replace('m', ''), W - 170, 440);
        c.font = '900 76px ' + SIGN_FONT; c.fillText(kind.indexOf('km') > 0 ? 'km' : 'm', W - 60, 440); c.textAlign = 'left';
        drawArrow(c, W - 130, 150, 80);
    }
    var backTex = (function () {
        var cv = document.createElement('canvas'); cv.width = 256; cv.height = 128; var c = cv.getContext('2d');
        c.fillStyle = '#5e6266'; c.fillRect(0, 0, 256, 128);
        c.fillStyle = '#44484c'; c.fillRect(0, 34, 256, 10); c.fillRect(0, 86, 256, 10);   // 補強の横材
        c.fillStyle = '#7a7e82'; for (var i = 0; i < 16; i++) { c.fillRect(8 + i * 16, 37, 3, 3); c.fillRect(8 + i * 16, 89, 3, 3); }
        for (var j = 0; j < 400; j++) { c.fillStyle = 'rgba(30,30,30,' + (Math.random() * 0.08).toFixed(3) + ')'; c.fillRect(Math.random() * 256, Math.random() * 128, 6, 2); }
        var t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.NoColorSpace; t.anisotropy = maxAniso; return t;
    })();
    function signMat(tex) {
        return new THREE.ShaderMaterial({ vertexShader: SIGN_VERT, fragmentShader: SIGN_FRAG,
            uniforms: { map: { value: tex }, uLight: { value: 0.05 }, uCamPos: U.uCamPos, uFogDensity: U.uFogDensity, uFogBase: U.uFogBase } });
    }
    var signPoleGeo = (function () {
        var gs = [];
        var pole = new THREE.CylinderGeometry(0.2, 0.2, 7.5, 12); pole.translate(0, 3.75, 0); gs.push(pole);
        var base = new THREE.BoxGeometry(0.9, 0.3, 0.9); base.translate(0, 0.15, 0); gs.push(base);
        [6.35, 7.25].forEach(function (y) { var arm = new THREE.CylinderGeometry(0.08, 0.08, 6.0, 8); arm.rotateZ(Math.PI / 2); arm.translate(3.0, y, 0); gs.push(arm); });
        for (var i = 0; i < 6; i++) { var d = new THREE.CylinderGeometry(0.035, 0.035, 1.15, 6); d.rotateZ(i % 2 ? 0.66 : -0.66); d.translate(0.5 + i * 1.0, 6.8, 0); gs.push(d); }
        [-1.2, 1.2].forEach(function (y) { var b = new THREE.BoxGeometry(5.0, 0.12, 0.12); b.translate(3.65, 6.3 + y * 0.6, -0.12); gs.push(b); });   // 板の裏の横桁
        gs = gs.map(function (g) { return g.index ? g.toNonIndexed() : g; });
        gs.forEach(function (g) { for (var k in g.attributes) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k); });
        return A.BufferGeometryUtils.mergeGeometries(gs);
    })();
    var signPoleMat = litMat([0.05, 0.052, 0.055], 0.5, [0.3, 0.3, 0.3], 0.0, false);
    var boardGeo = new THREE.PlaneGeometry(5.0, 2.6);
    function makeSign(ic, sg) {
        var g = new THREE.Group();
        var pole = new THREE.Mesh(signPoleGeo, signPoleMat); pole.position.x = -10.0; g.add(pole);    // 支柱は左の路肩の外（横 10 m）、腕は道路の上へ
        var tex = null, front;
        if (sg.side < 0) {
            var cv = document.createElement('canvas'); cv.width = 1024; cv.height = 512; drawSign(cv, ic, sg.kind);
            tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.NoColorSpace; tex.anisotropy = maxAniso; tex.generateMipmaps = true; tex.minFilter = THREE.LinearMipmapLinearFilter;
            front = new THREE.Mesh(boardGeo, signMat(tex)); sg.cv = cv;
        } else front = new THREE.Mesh(boardGeo, signMat(backTex));     // 反対車線用の標識は、こちらからは見えない（表は向こう向き）
        front.position.set(P.laneX, 6.3, 0.0); g.add(front);
        var back = new THREE.Mesh(boardGeo, signMat(backTex)); back.rotation.y = Math.PI; back.position.set(P.laneX, 6.3, -0.02); g.add(back);
        pole.position.z = -0.25;
        g.rotation.y = -sg.th + (sg.side > 0 ? Math.PI : 0);
        icRoot.add(g);
        return { g: g, sg: sg, ic: ic, tex: tex, front: front, back: back };
    }
    function redrawSigns() { if (roadTxtTex) { drawRoadTxt(roadTxtTex.image.getContext('2d'), 128, 640); roadTxtTex.needsUpdate = true; } liveSigns.forEach(function (L) { if (L.tex) { drawSign(L.sg.cv, L.ic, L.sg.kind); L.tex.needsUpdate = true; } }); }
    // 毎フレーム: 近い IC のメッシュ・標識を作り、遠ざかったものを捨て、原点相対に置き直す
    var icLive = {};
    var tmpQr = new THREE.Quaternion();
    function updateICs() {
        var nP = 0, nL = 0, nD = 0, hp = rHalos.geometry.attributes.position.array;
        for (var i = 0; i < icList.length; i++) {
            var ic = icList[i]; if (!ic.ramps) continue;
            var near = ic.zA - 3200 < sCam && ic.zB + 1500 > sCam;
            var L = icLive[ic.n];
            if (!near) { if (L) { L.meshes.forEach(function (m) { icRoot.remove(m.grp); m.grp.traverse(function (o) { if (o.geometry && o.geometry !== boardGeo && o.geometry !== signPoleGeo && !icSharedGeo.has(o.geometry)) o.geometry.dispose(); if (o.material && o.material.userData && o.material.userData.own) o.material.dispose(); }); });
                (L.wings || []).forEach(function (w) { icRoot.remove(w); });
                L.signs.forEach(function (S2) { icRoot.remove(S2.g); if (S2.tex) S2.tex.dispose(); S2.front.material.dispose(); S2.back.material.dispose(); liveSigns.splice(liveSigns.indexOf(S2), 1); });
                delete icLive[ic.n]; } continue; }
            if (!L) {
                L = icLive[ic.n] = { meshes: ic.ramps.filter(function (R) { return !R.empty; }).map(buildRampMesh), signs: ic.signs.map(function (sg) { return makeSign(ic, sg); }) };
                L.meshes.forEach(function (m) { icRoot.add(m.grp); });
                L.signs.forEach(function (S2) { liveSigns.push(S2); });
                L.wings = (ic.mainEnds || []).map(function (me) { var w = new THREE.Mesh(endGeo, endMat); w.userData.me = me; icRoot.add(w); return w; });
            }
            L.meshes.forEach(function (m) {
                var k = m.k;
                m.grp.position.set(m.x0 - O.x, m.y0 - O.y, m.z0 - O.z);
                m.piers.forEach(function (pp) { if (nP >= NRPIER) return; tmpV.set(pp[0] - O.x, pp[1] - O.y, pp[2] - O.z); tmpM.compose(tmpV, tmpQ.identity(), tmpS2.set(1, pp[3], 1)); rPiers.setMatrixAt(nP++, tmpM); });
                m.lamps.forEach(function (lp) {
                    if (nL >= NRLAMP) return;
                    tmpV.set(lp[0] - O.x, lp[1] - O.y, lp[2] - O.z); tmpQr.setFromAxisAngle(yAxis, lp[3]);
                    tmpM.compose(tmpV, tmpQr, tmpS2.set(1, 0.92, 1)); rPoles.setMatrixAt(nL, tmpM);
                    tmpV2.copy(LAMP_LOCAL).applyMatrix4(tmpM); hp[nL * 3] = tmpV2.x; hp[nL * 3 + 1] = tmpV2.y; hp[nL * 3 + 2] = tmpV2.z; nL++;
                });
                if (m.nose && (k === 0 || k === 3) && nD < NDRUM - 3) {       // 出口のノーズのクッションドラム（3 個、ノーズから導流帯の方へ 1.1 m おき）
                    var nx = m.nose, tx = nx[0] - nx[5], tz = nx[2] - nx[6], tl = Math.hypot(tx, tz) || 1;
                    for (var dd = 0; dd < 3; dd++) {
                        var px = nx[0] - nx[3] * 3.6 - tx / tl * (1.2 + dd * 1.1), pz = nx[2] - nx[4] * 3.6 - tz / tl * (1.2 + dd * 1.1);
                        tmpV.set(px - O.x, nx[1] - O.y, pz - O.z); tmpM.compose(tmpV, tmpQ.identity(), tmpS2.set(1, 1, 1)); drums.setMatrixAt(nD++, tmpM);
                    }
                }
            });
            (L.wings || []).forEach(function (w) {
                var me = w.userData.me; w.position.set(me.x - O.x, me.y + P.curbH - 0.03 - O.y, me.z - O.z);
                var fx = Math.sin(me.th) * me.fwd, fz = -Math.cos(me.th) * me.fwd;   // 丸みの向き（前 = 道路の進行方向）
                w.rotation.y = Math.atan2(-fz, fx);
            });
            L.signs.forEach(function (S2) {
                var sg = S2.sg; S2.g.position.set(sg.x - O.x, sg.y - O.y, sg.z - O.z);
                // 明るさ: 街灯の照り返し（弱い）＋ ヘッドライトの再帰反射（200 m から近づくほど）。表が自分に向いている時だけ。ブルームの閾値を超えない
                var dx = sg.x - camera.position.x - O.x, dz = sg.z - camera.position.z - O.z, d = Math.hypot(dx, dz);
                var facing = sg.side < 0 && (Math.sin(sg.th) * dx - Math.cos(sg.th) * dz) > 0;
                var head = facing ? Math.max(0, Math.min(1, (220 - d) / 160)) : 0;
                S2.front.material.uniforms.uLight.value = 0.035 + 0.62 * head * head;
                S2.back.material.uniforms.uLight.value = 0.03;
            });
        }
        // 信号（ランプの地上の端、赤と緑を 30 秒ごとに切り替え）は街灯のハローの後ろに入れる
        var t30 = Math.floor(timeSec / 30) % 2, nS = nL;
        for (var i2 = 0; i2 < icList.length; i2++) {
            var L2 = icLive[icList[i2].n]; if (!L2) continue;
            L2.meshes.forEach(function (m, k) { if (nS >= NRLAMP + 32) return; hp[nS * 3] = m.sig[0] - O.x; hp[nS * 3 + 1] = m.sig[1] - O.y; hp[nS * 3 + 2] = m.sig[2] - O.z; nS++; });
        }
        if (q.icdump) { if (errBox) errBox.textContent = ''; logErr('SIGNS ' + liveSigns.map(function (S2) { return S2.sg.kind + (S2.sg.side < 0 ? 'L' : 'R') + '@' + S2.sg.s + ' d=' + Math.hypot(S2.sg.x - O.x - camera.position.x, S2.sg.z - O.z - camera.position.z).toFixed(0); }).join(' ') + ' camS=' + sCam.toFixed(0)); logErr('ARROWS ' + ARROW_LOG.join(' ') + ' | ' + 'ICDUMP walk=' + walkList.join(',') + ' truss=' + truss.count + ' live=' + Object.keys(icLive).join(',') + ' piers=' + nP + ' lamps=' + nL + ' drums=' + nD + ' sigs=' + (nS - nL) + ' zoneL=' + rampLArr.map(function (v) { return v.x.toFixed(0) + '..' + v.y.toFixed(0); }).join(' ') + ' sCam=' + sCam.toFixed(0) + (Object.keys(icLive).length ? ' m0pos=' + icLive[Object.keys(icLive)[0]].meshes[0].grp.position.toArray().map(function (v) { return v.toFixed(1); }).join(',') + ' nlamps0=' + icLive[Object.keys(icLive)[0]].meshes[0].lamps.length : '')); }
        rPiers.count = nP; rPiers.instanceMatrix.needsUpdate = true;
        rPoles.count = nL; rPoles.instanceMatrix.needsUpdate = true;
        drums.count = nD; drums.instanceMatrix.needsUpdate = true;
        var hc = rHalos.geometry.attributes.aCol.array;
        for (var h = 0; h < nS; h++) {
            if (h < nL) { hc[h * 3] = P.lampCol[0]; hc[h * 3 + 1] = P.lampCol[1]; hc[h * 3 + 2] = P.lampCol[2]; }
            else { var red = ((h + t30) % 2) === 0; hc[h * 3] = red ? 1.0 : 0.05; hc[h * 3 + 1] = red ? 0.05 : 0.9; hc[h * 3 + 2] = red ? 0.03 : 0.5; }
        }
        rHalos.geometry.setDrawRange(0, nS); rHalos.geometry.attributes.position.needsUpdate = true; rHalos.geometry.attributes.aCol.needsUpdate = true;
    }

    // --- 沿道の街（高架の下。世界座標に固定し、通り過ぎたら捨てる） ----------------------------
    // 道のり 40 m ごとのチャンクで生成。乱数はチャンク番号と左右から決定的（同じ場所は同じ街）。
    // 座標は世界座標の anchor からの相対でインスタンスに入れ、毎フレームは sideGroup.position = anchor - O だけ書く
    var sideGroup = new THREE.Group(); scene.add(sideGroup);
    var CHUNK = 40, SIDE_MESH_LEN = 1300, SIDE_LIGHT_LEN = 2300, POOL_LEN = 900;   // 各層の表示限界（水平距離、ここでフェードが 0）
    var NHOUSE = 3600, NBLDG = 1200, NPART = 4000, NTREE_MAX = 2000, NSPT = 12000, NPOOL = 2400;   // 容量（超えて切り捨てると突然現れる原因になるので selftest で確認）
    var anchor = { x: 0, y: 0, z: 0, set: false };
    var POOL_R = 10;                                  // 光だまりの最大半径（楕円の長い方）。離隔判定もこの値で
    var SPT_GAIN = 4.0;                               // 街路の点光の輝度（光だまりは灯の色そのまま）
    var chunkCache = {}, sideKey = null;

    // v6: 建物の壁を照らす光の強さ（道路の街灯の線光源、足元の街路灯）
    var U_ROADLK = { value: P.bldRoadLight }, U_STREETLK = { value: P.bldStreetLight };
    // 近景用のビル材質（cityMat と同じユニフォームを共有し、壁を少し明るく、地面近くを街路灯で暖色に）
    var cityMatNear = new THREE.ShaderMaterial({
        vertexShader: S.cityVert, fragmentShader: S.cityFrag, defines: { NEAR: 1, FADE: 1 },
        uniforms: {
            uCamPos: U.uCamPos, uFogDensity: U.uFogDensity, uFogH: U.uFogH, uOriginY: U.uOriginY,
            uFogBase: U.uFogBase, uGlowCol: U.uGlowCol, uFogGlow: U.uFogGlow, uCityTex: U.uCityTex,
            uBuilding: cityMat.uniforms.uBuilding, uWinGain: cityMat.uniforms.uWinGain, uFadeFar: { value: SIDE_MESH_LEN },
            uAmbient: U.uAmbient, uLampCol: U.uLampCol, uRoadLK: U_ROADLK, uStreetLK: U_STREETLK, uBldDebug: { value: P.bldDebug }
        }
    });
    cityMatNear.defines.LITBLD = 1;
    // 街区のビル材質（遠景と同じ窓格子、距離 BLOCK_FADE でフェード）
    var blockMat = new THREE.ShaderMaterial({
        vertexShader: S.cityVert, fragmentShader: S.cityFrag, defines: { FADE: 1 },
        uniforms: {
            uCamPos: U.uCamPos, uFogDensity: U.uFogDensity, uFogH: U.uFogH, uOriginY: U.uOriginY,
            uFogBase: U.uFogBase, uGlowCol: U.uGlowCol, uFogGlow: U.uFogGlow, uCityTex: U.uCityTex,
            uBuilding: cityMat.uniforms.uBuilding, uWinGain: cityMat.uniforms.uWinGain, uFadeFar: { value: 6000 },
            uAmbient: U.uAmbient, uLampCol: U.uLampCol, uRoadLK: U_ROADLK, uStreetLK: U_STREETLK
        }
    });
    blockMat.defines.LITBLD = 1;
    function addInstAttrs(geo, n) {
        ['aSeed', 'aType', 'aLit'].forEach(function (k) {
            geo.setAttribute(k, new THREE.InstancedBufferAttribute(new Float32Array(n), 1).setUsage(THREE.DynamicDrawUsage));
        });
        // v6: 外壁の基本色（反射率）、最寄りの道路（向き xz・距離・道路の地面からの高さ）、近い街路灯 3 個（建物の原点からの位置と強さ。負 = ナトリウム色）
        geo.setAttribute('aWall', new THREE.InstancedBufferAttribute(new Float32Array(n * 4), 4).setUsage(THREE.DynamicDrawUsage));
        ['aRoad', 'aL0', 'aL1', 'aL2'].forEach(function (k) {
            geo.setAttribute(k, new THREE.InstancedBufferAttribute(new Float32Array(n * 4), 4).setUsage(THREE.DynamicDrawUsage));
        });
    }
    // 外壁の色（反射率 0.25〜0.6 程度。夜でも照らされれば分かる彩度）。棟ごとに 1 つ選ぶ
    var WALL_PAL = {
        mansion: [[0.15, [0.40, 0.38, 0.33]], [0.38, [0.40, 0.30, 0.19]], [0.25, [0.30, 0.31, 0.33]], [0.22, [0.36, 0.17, 0.11]]],
        office:  [[0.35, [0.30, 0.31, 0.34]], [0.20, [0.17, 0.17, 0.18]], [0.15, [0.40, 0.40, 0.38]], [0.30, [0.13, 0.24, 0.27]]],
        shop:    [[0.5, [0.40, 0.40, 0.41]], [0.5, [0.40, 0.35, 0.23]]],
        house:   [[0.2, [0.40, 0.39, 0.35]], [0.35, [0.40, 0.32, 0.21]], [0.2, [0.32, 0.32, 0.31]], [0.19, [0.27, 0.18, 0.11]], [0.03, [0.28, 0.36, 0.28]], [0.03, [0.25, 0.30, 0.38]]]
    };
    function pickWall(kind, u) {
        var P2 = WALL_PAL[kind], acc = 0;
        for (var i = 0; i < P2.length; i++) { acc += P2[i][0]; if (u < acc) return P2[i][1]; }
        return P2[P2.length - 1][1];
    }
    // 建物に光の情報を付ける: 最寄りの道路（向き・距離・高さ）と、近い街路灯 3 個
    function attachLights(o, lights, roadDirX, roadDirZ, roadDist, deckH) {
        o.road = [roadDirX, roadDirZ, roadDist, deckH];
        var near = [];
        if (lights) for (var i = 0; i < lights.length; i++) {
            var L = lights[i], dx = L.x - o.x, dz = L.z - o.z, d2 = dx * dx + dz * dz;
            if (d2 < 60 * 60) near.push([d2, L]);
        }
        near.sort(function (a, b) { return a[0] - b[0]; });
        o.lamps = [];
        for (var k = 0; k < 3; k++) {
            if (k < near.length) {
                var L2 = near[k][1], led = L2.c[2] > L2.c[0] * 0.6;
                o.lamps.push([L2.x - o.x, L2.y, L2.z - o.z, led ? 1 : -1]);
            } else o.lamps.push([0, 0, 0, 0]);
        }
    }
    // 住宅の単位ジオメトリ: 壁の箱（y 0〜0.72）＋切妻屋根（y 0.72〜1.0、棟は z 方向、軒を張り出す）。非インデックス
    var houseGeo = (function () {
        var pos = [], nrm = [], uv = [];
        function tri(a, b, c, ua, ub, uc, ctr) {
            var e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
            var n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
            var l = Math.sqrt(n[0] * n[0] + n[1] * n[1] + n[2] * n[2]) || 1; n = [n[0] / l, n[1] / l, n[2] / l];
            var mx = (a[0] + b[0] + c[0]) / 3 - ctr[0], my = (a[1] + b[1] + c[1]) / 3 - ctr[1], mz = (a[2] + b[2] + c[2]) / 3 - ctr[2];
            if (n[0] * mx + n[1] * my + n[2] * mz < 0) { var t = b; b = c; c = t; var tu = ub; ub = uc; uc = tu; n = [-n[0], -n[1], -n[2]]; }
            [a, b, c].forEach(function (p) { pos.push(p[0], p[1], p[2]); nrm.push(n[0], n[1], n[2]); });
            uv.push(ua[0], ua[1], ub[0], ub[1], uc[0], uc[1]);
        }
        function quad(a, b, c, d, ua, ub, uc, ud, ctr) { tri(a, b, c, ua, ub, uc, ctr); tri(a, c, d, ua, uc, ud, ctr); }
        var H = 0.72, W = [0, 0.4, 0], Z0 = [0, 0, 0];
        // 壁 4 面（uv.x = 面に沿って 0〜1、uv.y = 高さ）
        quad([-0.5, 0, 0.5], [0.5, 0, 0.5], [0.5, H, 0.5], [-0.5, H, 0.5], [0, 0], [1, 0], [1, H], [0, H], W);
        quad([0.5, 0, -0.5], [-0.5, 0, -0.5], [-0.5, H, -0.5], [0.5, H, -0.5], [0, 0], [1, 0], [1, H], [0, H], W);
        quad([0.5, 0, 0.5], [0.5, 0, -0.5], [0.5, H, -0.5], [0.5, H, 0.5], [0, 0], [1, 0], [1, H], [0, H], W);
        quad([-0.5, 0, -0.5], [-0.5, 0, 0.5], [-0.5, H, 0.5], [-0.5, H, -0.5], [0, 0], [1, 0], [1, H], [0, H], W);
        // 妻の三角形（窓なし）
        tri([-0.5, H, 0.5], [0.5, H, 0.5], [0, 1, 0.5], Z0, Z0, Z0, W);
        tri([0.5, H, -0.5], [-0.5, H, -0.5], [0, 1, -0.5], Z0, Z0, Z0, W);
        // 屋根 2 面（軒 0.07、けらば 0.05 張り出す）
        var o = 0.07, oz = 0.55, ye = H - o * (1 - H) / 0.5;
        quad([-0.5 - o, ye, oz], [0, 1, oz], [0, 1, -oz], [-0.5 - o, ye, -oz], Z0, Z0, Z0, Z0, [0, 0.3, 0]);
        quad([0.5 + o, ye, -oz], [0, 1, -oz], [0, 1, oz], [0.5 + o, ye, oz], Z0, Z0, Z0, Z0, [0, 0.3, 0]);
        var g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
        g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
        return g;
    })();
    addInstAttrs(houseGeo, NHOUSE);
    var houseMesh = new THREE.InstancedMesh(houseGeo, cityMatNear, NHOUSE);
    var bldgGeo = new THREE.BoxGeometry(1, 1, 1); bldgGeo.translate(0, 0.5, 0);
    addInstAttrs(bldgGeo, NBLDG);
    var bldgMesh = new THREE.InstancedMesh(bldgGeo, cityMatNear, NBLDG);
    // v6: 屋上の部品（パラペット・塔屋・高架水槽・室外機・アンテナ）。700 m でフェードする別の材質で 1 回の描画
    var partGeo = new THREE.BoxGeometry(1, 1, 1); partGeo.translate(0, 0.5, 0);
    addInstAttrs(partGeo, NPART);
    var partMat = cityMatNear.clone();
    partMat.uniforms = cityMatNear.uniforms; partMat.uniforms = Object.assign({}, cityMatNear.uniforms, { uFadeFar: { value: 700 } });
    partMat.defines = Object.assign({}, cityMatNear.defines);
    var partMesh = new THREE.InstancedMesh(partGeo, partMat, NPART);
    var blockGeo = new THREE.BoxGeometry(1, 1, 1); blockGeo.translate(0, 0.5, 0);
    addInstAttrs(blockGeo, 1600);
    var blockMesh = new THREE.InstancedMesh(blockGeo, blockMat, 1600);

    // 木: 正二十面体（detail 1）の塊 4 個を結合し、頂点を位置の関数で ±12% ずらして輪郭をいびつにする。
    // 法線は塊の中心からの放射（滑らか）にして多面体の角を出さない。幹は作らない
    var treeGeo = (function () {
        var trng = mulberry32(seed * 37 + 101);
        var blobs = [[0, 0.52, 0, 0.36], [0.17, 0.66, 0.08, 0.27], [-0.15, 0.62, -0.1, 0.28], [0.03, 0.82, -0.02, 0.22], [0.02, 0.32, 0.05, 0.25]];
        var geos = blobs.map(function (b) {
            var g = new THREE.IcosahedronGeometry(1, 1);
            var p = g.attributes.position.array, nr = new Float32Array(p.length);
            for (var i = 0; i < p.length; i += 3) {
                var x = p[i], y = p[i + 1], z = p[i + 2];
                // 同じ頂点（面ごとに複製されている）は同じだけずらす: 方向の決定的なハッシュ
                var h = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719 + b[0] * 91.7 + b[1] * 13.1) * 43758.5453;
                h = (h - Math.floor(h)) - 0.5;
                var h2 = Math.sin(x * 4.1 + y * 5.3 + z * 3.7 + b[2] * 17.0) * 0.5;
                var r = b[3] * (1 + 0.24 * h + 0.10 * h2);
                nr[i] = x; nr[i + 1] = y; nr[i + 2] = z;
                p[i] = b[0] + x * r * 1.05; p[i + 1] = b[1] + y * r * 0.9; p[i + 2] = b[2] + z * r * 1.05;
            }
            g.setAttribute('normal', new THREE.BufferAttribute(nr, 3));
            g.deleteAttribute('uv');
            return g;
        });
        trng();
        return A.BufferGeometryUtils.mergeGeometries(geos);
    })();
    var treeMat = litMat([0.020, 0.030, 0.012], 0.9, [0.03, 0.03, 0.03], 0.0, false);
    treeMat.defines.TREE = 1; treeMat.defines.FADE = 1;
    treeMat.uniforms.uFadeFar = { value: SIDE_MESH_LEN };
    treeMat.uniforms.uUnder.value.set(0.018, 0.013, 0.008);
    var treeMesh = new THREE.InstancedMesh(treeGeo, treeMat, NTREE_MAX);

    [houseMesh, bldgMesh, treeMesh, blockMesh, partMesh].forEach(function (m) {
        m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.frustumCulled = false; m.count = 0; sideGroup.add(m);
    });
    // 街路の点光（glowMat の mode 5）
    // 世界固定の点光は、水平距離 uFadeFar でフェードする専用の材質を使う
    function fadeGlowMat(far) {
        return new THREE.ShaderMaterial({
            vertexShader: S.glowVert, fragmentShader: S.glowFrag, transparent: true, defines: { FADE: 1 },
            blending: THREE.AdditiveBlending, depthWrite: false, depthTest: true,
            uniforms: uni({ uRetroGain: { value: 1.0 }, uHaloGain: { value: 12.0 }, uFadeFar: { value: far } })
        });
    }
    function worldPts(n, mode, far) {
        var p = makeGlowPoints(n, 1.0, [1, 1, 1], mode);
        ['aCol', 'aSize', 'aMode', 'aPhase'].forEach(function (a) { p.geometry.attributes[a].setUsage(THREE.DynamicDrawUsage); });
        p.material = fadeGlowMat(far);
        sideGroup.add(p);
        return p;
    }
    var sidePts = worldPts(NSPT, 5, SIDE_LIGHT_LEN);
    var blockPts = worldPts(6000, 0, 6000);
    // 地面の光だまり: 街路灯の真下に半径 7 m の水平な円盤（加算、中心から 2 乗で減衰）
    var poolGeo = new THREE.CircleGeometry(1, 20); poolGeo.rotateX(-Math.PI / 2);
    poolGeo.setAttribute('aPoolCol', new THREE.InstancedBufferAttribute(new Float32Array(NPOOL * 3), 3).setUsage(THREE.DynamicDrawUsage));
    var poolMat = new THREE.ShaderMaterial({
        vertexShader: S.poolVert, fragmentShader: S.poolFrag, transparent: true, defines: { FADE: 1 },
        blending: THREE.AdditiveBlending, depthWrite: false, depthTest: true,
        uniforms: uni({ uPoolGain: { value: 0.018 }, uFadeFar: { value: POOL_LEN } })
    });
    var poolMesh = new THREE.InstancedMesh(poolGeo, poolMat, NPOOL);
    // v6: 電柱（細い円柱、高さ 10 m。街路灯はこれに付く）。暗い金属・コンクリート色で、街の環境光だけ受ける
    var NUPOLE = 2500;
    var upoleGeo = new THREE.CylinderGeometry(0.13, 0.17, 10, 8); upoleGeo.translate(0, 5, 0);
    var upoleMat = litMat([0.10, 0.10, 0.10], 0.8, [0.03, 0.03, 0.03], 0.0, false);
    upoleMat.defines.NO_LIGHTS = 1; upoleMat.defines.FADE = 1; upoleMat.uniforms.uFadeFar = { value: POOL_LEN };
    upoleMat.uniforms.uUnder.value.set(0.05, 0.045, 0.04);
    var upoles = new THREE.InstancedMesh(upoleGeo, upoleMat, NUPOLE);
    upoles.instanceMatrix.setUsage(THREE.DynamicDrawUsage); upoles.frustumCulled = false; upoles.count = 0; sideGroup.add(upoles);
    poolMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); poolMesh.frustumCulled = false; poolMesh.count = 0;
    poolMesh.renderOrder = 5; sideGroup.add(poolMesh);

    // 区画の種類: 道のり 360 m ブロック × 左右ごと。0 住宅地 / 1 マンション / 2 公園 / 3 混在
    function hashInt(a, b, c) {
        var h = (a * 374761393 + b * 668265263 + c * 2147483647 + seed * 1274126177) | 0;
        h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16;
        return h >>> 0;
    }
    function zoneOf(st, side) {
        var r = hashInt(Math.floor(st / 360), side + 7, 11) / 4294967296;
        return r < 0.45 ? 0 : r < 0.70 ? 1 : r < 0.82 ? 2 : 3;
    }
    var HOUSE_ROWS = [24, 40, 58, 76, 96, 118, 142, 168, 196, 226];
    var PAR_ST = [32, 67, 107, 155, 210];
    var COL_LED = [0.85, 0.92, 1.0], COL_NA = [1.0, 0.62, 0.25], COL_PARK = [0.75, 1.0, 0.85];
    var FS = new Frame();
    var TMASK = track.a.length - 1;                       // 軌道の保持区間（tw_track.js の RING）のマスク
    var DECK_EDGE = P.roadHalf + P.curbW;                 // 道路の中心線から桁の外縁まで

    // 軌道との離隔判定（世界固定で置く物はすべてこれを通す）。
    // 中心線を 20 m ごとに [sFrom, sTo] で調べ、水平距離 < 桁の外縁 + radius + margin の点が 1 つでもあれば false。
    // topY（世界座標の上端の高さ）を渡した物は、その地点の桁下より低ければ道路の下にあっても重ならないとみなす（木）
    function clearOfTrack(x, z, radius, sFrom, sTo, margin, topY) {
        if (!clearOfRail(x, z, radius, RAIL_CLEAR)) return false;          // 線路の中心線から 9 m 以内にも置かない
        if (rampNear(x, z, RAIL_CLEAR + radius) < RAIL_CLEAR + radius) return false;   // v8: ランプの中心線から 9 m 以内にも置かない
        if (riverDist(x, z) < 10 + radius) return false;                    // v9: 川と両岸 10 m
        if (groadDist(x, z) < 3 + radius) return false;                     // v9: 橋の下の地上の道路と歩道
        var lim = DECK_EDGE + radius + margin, l2 = lim * lim;
        track.ensure(sTo + 4);
        var s0 = Math.ceil(Math.max(sFrom, track.minStation()) / 20) * 20;
        for (var s2 = s0; s2 <= sTo; s2 += 20) {
            var idx = s2 & TMASK, dx = track.px[idx] - x, dz = track.pz[idx] - z;
            if (dx * dx + dz * dz < l2) {
                if (topY !== undefined && topY < track.py[idx] - P.fasciaH) continue;
                return false;
            }
        }
        return true;
    }

    // 沿道チャンクの寿命: 生成 = カメラの SIDE_GEN 先、破棄 = カメラの SIDE_DROP 後ろ。
    // この間に見えうる道路 [st - SIDE_GEN - 50, st + SIDE_DROP + viewLen + 50] を離隔判定の範囲にする
    var SIDE_GEN = SIDE_LIGHT_LEN + 600, SIDE_DROP = 500;
    // --- パチンコ店（沿道に点在）: 道のり 700 m ごとの枠に 70%（置けない所を除くと 1 km に 0.7 軒ほど）。道路から 70〜400 m、間口 55〜75 m・奥行 32〜42 m・高さ 18〜26 m（立体駐車場併設の 5〜7 階建て）。
    // 道路側の角に縦長の袖看板（縦の「パチンコ」、上端は屋上 + 2 m）、屋上の道路側の縁に横長の看板（架空の店名＋「パチンコ」）。どちらもネオン管と縁の電球。
    // 高架の路面は地上 20〜25 m あり、壁の上端が目より高いので、地上の低い看板は見えない。看板は建物の高さに付ける（高い柱は立てない）
    // 位置はチャンクより先に決め、敷地（駐車場を含む）には住宅・木・ほかの建物を置かない
    var PACHI_SLOT = 700, hallList = [], hallSlot = -1, hallMade = 0, FPH = new Frame();
    var PACHI_NAMES = ['ニュー銀河', '金星', 'ラッキー', '太陽', 'ニュー佐渡', 'スター'];
    var PACHI_COLB = [[0.30, 1.30, 2.10], [0.40, 1.90, 0.60], [2.00, 1.55, 0.30], [1.40, 0.40, 2.10]];
    function ensureHalls(sUpTo) {
        while ((hallSlot + 1) * PACHI_SLOT < sUpTo + PACHI_SLOT) {
            hallSlot++;
            var r = mulberry32(hashInt(hallSlot, 21, 777));
            var has = r() < 0.7, sH = hallSlot * PACHI_SLOT + 120 + r() * (PACHI_SLOT - 240), side = r() < 0.5 ? -1 : 1;
            var lat0 = 70 + 330 * r(), w = 55 + 20 * r(), d = 32 + 10 * r(), h = 18 + 8 * r(), nm = Math.floor(r() * PACHI_NAMES.length), cb = Math.floor(r() * PACHI_COLB.length), ph = r(), hp = 0; r();
            hp = h + 2;                                                        // 袖看板の上端
            if (q.pachiAt && hallSlot === Math.floor(q.pachiAt / PACHI_SLOT)) { has = true; sH = q.pachiAt; lat0 = 80; }
            if (!has) continue;
            var kH = Math.floor(sH / CHUNK), st = kH * CHUNK;
            if (st < track.minStation() + 10) continue;
            frameAt(st, FPH);
            var ct = Math.cos(FPH.th), sn = Math.sin(FPH.th), lc = lat0 + d / 2, al = CHUNK * 0.5;
            var x = FPH.c.x + ct * side * lc + sn * al, z = FPH.c.z + sn * side * lc - ct * al;
            if (!clearOfTrack(x, z, 0.5 * Math.hypot(w, d) + 12, Math.max(st - 1500, track.minStation()), st + 2500, 12)) continue;
            hallList.push({ id: hallSlot, k: kH, side: side, lat0: lat0, w: w, d: d, h: h, x: x, z: z, ct: ct, sn: sn, name: PACHI_NAMES[nm], colB: PACHI_COLB[cb], ph: ph, hp: hp, ok: false });
        }
        while (hallList.length && hallList[0].k * CHUNK < sCam - 4000) hallList.shift();
    }
    function inHall(x, z, rad) {                                          // 店の敷地（建物＋前の駐車場、外側 8 m）
        for (var i = 0; i < hallList.length; i++) { var H = hallList[i]; if (Math.hypot(x - H.x, z - H.z) < rad + 0.5 * Math.hypot(H.w, H.d) + 22) return true; }
        return false;
    }
    function hallOf(k, side) { for (var i = 0; i < hallList.length; i++) if (hallList[i].k === k && hallList[i].side === side) return hallList[i]; return null; }
    function genChunk(k) {
        var st = k * CHUNK;
        ensureHalls(st);
        // 生成より前の道路は見えないので、生成時点のカメラより後ろは調べない（保持区間の外も読まない）
        var sFrom = Math.max(st - SIDE_GEN - 50, sCam - 100, track.minStation()), sTo = st + SIDE_DROP + CHUNK + P.viewLen + 50;   // 捨てるのはチャンク単位なので最大 CHUNK 遅れる
        track.ensure(sTo + 4);
        frameAt(st, FS);
        var th = FS.th, ct = Math.cos(th), sn = Math.sin(th);
        var cx = FS.c.x, cz = FS.c.z;
        var a = track.curveAt(st), R = a !== 0 ? 1 / (Math.abs(a) * curveGain) : 1e9;
        var ch = { st: st, houses: [], bldgs: [], trees: [], lights: [], aprons: [] };
        for (var side = -1; side <= 1; side += 2) {
            var r = mulberry32(hashInt(k, side + 3, 5));
            var inner = a * side > 0;
            var zone = zoneOf(st, side);
            var pos = function (lat, along) { return [cx + ct * side * lat + sn * along, cz + sn * side * lat - ct * along]; };
            var thin = function (lat) { return inner ? Math.max(0, 1 - lat / R) : 1; };   // カーブ内側は詰まるので間引く
            var addTree = function (lat, along, h) {
                if (r() > thin(lat)) return;
                var p = pos(lat, along);
                var wdt = h * (0.55 + 0.25 * r()), dz2 = wdt * (0.85 + 0.3 * r());
                if (inHall(p[0], p[1], 0.45 * Math.max(wdt, dz2))) return;
                if (!clearOfTrack(p[0], p[1], 0.45 * Math.max(wdt, dz2), sFrom, sTo, 4, GROUND_Y + h)) return;
                ch.trees.push({ x: p[0], z: p[1], yaw: r() * 6.283, sx: wdt, sy: h, sz: dz2, rk: r() });
            };
            var addLight = function (lat, along, col, size, pool, hgt, streetDir) {
                var p = pos(lat, along);
                var b = 0.9 + 0.5 * r();
                var poolOk = pool && lat <= 260;
                if (!clearOfTrack(p[0], p[1], poolOk ? POOL_R : 0, sFrom, sTo, 2)) return;
                // v6: 生活道路の街路灯の光だまりは、道路に沿った楕円（streetDir: 1 = 高速道路と平行な街路、2 = 直交する街路）
                var pyaw = streetDir === 1 ? -th : (streetDir === 2 ? -th + Math.PI / 2 : undefined);
                ch.lights.push({ x: p[0], z: p[1], y: hgt === undefined ? 5 + r() : hgt, c: [col[0] * b, col[1] * b, col[2] * b], s: size, pool: poolOk, lat: lat, pyaw: pyaw, pole: !!streetDir });
            };
            var addHouse = function (lat, along) {
                if (r() > thin(lat)) return;
                var w = 7 + 3 * r(), d = 6 + 3 * r(), h = 6 + 2.5 * r();
                var p = pos(lat, along);
                if (inHall(p[0], p[1], 0.5 * Math.sqrt(w * w + d * d))) return;
                if (!clearOfTrack(p[0], p[1], 0.5 * Math.sqrt(w * w + d * d) + 0.4, sFrom, sTo, 4)) return;
                var yaw = -th + (r() - 0.5) * 0.3 + (r() < 0.3 ? Math.PI / 2 : 0);
                ch.houses.push({ x: p[0], z: p[1], yaw: yaw, w: d, h: h, d: w, lit: 0.25 + 0.3 * r(), seed: r() * 100, lat: lat, side: side, wall: pickWall('house', r()) });
            };
            var addBldg = function (lat, along, w, d, h, type, lit, parallel, isHall) {
                var p = pos(lat, along);
                // v6: 判定半径は基壇（1.06 × 1.14 倍）とセットバックの部品まで含めた大きさ。部品はこの円の中に収まる
                // L 字（マンションの 3 割）: 端から直角に袖を出す。判定半径は袖まで含める
                var wing = (type === 2 && r() < 0.3) ? { len: w * (0.35 + 0.15 * r()), sx: r() < 0.5 ? -1 : 1, sz: r() < 0.5 ? -1 : 1, hf: 0.75 + 0.25 * r() } : null;
                var dz = wing ? d + 2 * wing.len : d;
                var rad = 0.5 * Math.sqrt(1.06 * 1.06 * w * w + 1.14 * 1.14 * dz * dz);
                if (!isHall && inHall(p[0], p[1], rad)) return false;
                if (!clearOfTrack(p[0], p[1], rad, sFrom, sTo, 12)) return false;
                var yaw = -th + (parallel ? Math.PI / 2 : 0) + (r() < 0.5 ? Math.PI : 0) + (r() - 0.5) * 0.08;
                ch.bldgs.push({ genS: sCam, x: p[0], z: p[1], yaw: yaw, w: w, h: h, d: d, type: type, lit: lit, seed: r() * 100, lat: lat, side: side, rad: rad, wing: wing,
                                wall: pickWall(type === 2 ? 'mansion' : 'shop', r()) });
                // v6: エントランス灯・駐車場灯（道路側の足元、外側 3 m に 1〜2 個）。壁の下部に光の溜まりを作る
                var ha = parallel ? d / 2 : w / 2, alongLen = parallel ? w : d, nE = 1 + (r() < 0.5 ? 1 : 0);
                for (var e = 0; e < nE; e++) addLight(lat - ha - 3, along + (e - (nE - 1) / 2) * Math.min(14, alongLen * 0.35), [1.0, 0.88, 0.70], 1.6, true, 3.2);
                return true;
            };
            // 住宅の列（prob: 1 軒ごとの確率、skip: その範囲の列は置かない）
            var houseRows = function (prob, latFrom, skipA, skipB) {
                for (var ri = 0; ri < HOUSE_ROWS.length; ri++) {
                    var L0 = HOUSE_ROWS[ri];
                    if (L0 < latFrom || (L0 > skipA && L0 < skipB)) continue;
                    var pr = prob * (1 - 0.035 * ri);
                    for (var j = 0; j < 3; j++) {
                        var rr = r(), lj = L0 + (r() - 0.5) * 6, aj = (j + 0.5) * (CHUNK / 3) + (r() - 0.5) * 3;
                        if (rr < pr) addHouse(lj, aj);
                    }
                }
            };

            // 高架沿いの緑地帯（lat 12〜17、1〜2 本、高さ 9〜15 m）。頭は桁下より 0.5 m 低く抑える
            var deckH = FS.c.y - GROUND_Y;                     // この地点の路面の地面からの高さ
            for (var gi = 0; gi < 2; gi++) if (r() < 0.75) addTree(12 + 5 * r(), r() * CHUNK, Math.min(9 + 6 * r(), deckH - P.fasciaH - 0.5));
            // 道路と平行な街路の灯（40 m ごと 1 灯。消失点へ向かう光の列）。街路ごとに LED / ナトリウムを決める
            for (var pi = 0; pi < PAR_ST.length; pi++) {
                var na = hashInt(Math.floor(st / 360), side * 10 + pi, 3) / 4294967296 < 0.3;
                addLight(PAR_ST[pi] + (r() - 0.5) * 1.0, 10 + (r() - 0.5) * 1.5, na ? COL_NA : COL_LED, 2.6, true, undefined, 1);
            }
            // 直交する街路（80 m ごと）: lat 20 から 410 まで 30 m おき
            if ((k & 1) === 0) {
                var naX = r() < 0.3;
                for (var xl = 20; xl <= 410; xl += 30) addLight(xl + (r() - 0.5) * 2, 30 + (r() - 0.5) * 1.0, naX ? COL_NA : COL_LED, 2.6, true, undefined, 2);
            }
            // 遠くのまばらな暖色の点
            for (var fi = 0; fi < 3; fi++) {
                var wb = 0.5 + 0.5 * r();
                addLight(260 + 190 * r(), r() * CHUNK, [1.0 * wb, 0.75 * wb, 0.45 * wb], 1.4, false, 2 + 4 * r());
            }

            if (zone === 0) {                                  // 住宅地
                houseRows(0.8, 0, 1e9, -1e9);
            } else if (zone === 1) {                           // マンション: 80 m に 1 棟（偶数チャンクと次のチャンクで共有）
                var pr2 = mulberry32(hashInt(k >> 1, side + 3, 9));
                var mLat = 40 + 160 * pr2(), mW = 35 + 35 * pr2(), mD = 12 + 4 * pr2(), mH = (6 + Math.floor(pr2() * 9)) * 3.0;
                var par = pr2() < 0.6;
                var halfAcross = par ? mD / 2 : mW / 2;
                if ((k & 1) === 0) {
                    if (addBldg(mLat + halfAcross, CHUNK, mW, mD, mH, 2, 0.3 + 0.3 * pr2(), par)) {
                        for (var ti = 0; ti < 3; ti++) addTree(mLat - 6 - 4 * r(), CHUNK + (r() - 0.5) * 50, 7 + 5 * r());
                        for (var li2 = 0; li2 < 3; li2++) addLight(mLat - 10 - 6 * r(), CHUNK + (r() - 0.5) * 50, COL_LED, 2.0, true, 4 + r());
                    }
                }
                houseRows(0.35, 0, mLat - 12, mLat + 2 * halfAcross + 10);
            } else if (zone === 2) {                           // 公園・緑地
                for (var t2 = 0; t2 < 6; t2++) addTree(20 + 130 * r(), r() * CHUNK, 6 + 8 * r());
                if (r() < 0.5) addLight(25 + 100 * r(), r() * CHUNK, COL_PARK, 2.0, true, 4 + r());
                houseRows(0.3, 120, 1e9, -1e9);
            } else {                                           // 混在: 住宅 50%、ときどき低い店舗・倉庫と看板の灯
                var sLat = -1e9, sW = 0;
                if (r() < 0.35) {
                    sLat = 30 + 150 * r(); sW = 20 + 20 * r();
                    var sD = 15 + 10 * r(), sH = 6 + 4 * r();
                    if (addBldg(sLat + sD / 2, CHUNK * 0.5, sW, sD, sH, 0, 0.12, r() < 0.5)) {
                        var sc = r() < 0.5 ? [1.6, 0.25, 0.15] : (r() < 0.5 ? [0.3, 0.7, 1.6] : [1.4, 1.1, 0.4]);
                        addLight(sLat, CHUNK * 0.5, sc, 2.4, false, sH + 1.5);
                    }
                }
                houseRows(0.5, 0, sLat - 10, sLat + sW + 10);
            }
            var HS = hallOf(k, side);
            if (HS && !addBldg(HS.lat0 + HS.d / 2, CHUNK * 0.5, HS.w, HS.d, HS.h, 0, 0.06, true, true)) HS.fail = true;   // 建物を置けなかった店は看板も出さない
            else if (HS) {
                HS.ok = true; hallMade++;                                                  // ネオンの照り返し（駐車場の地面に色の光だまり）
                addLight(HS.lat0 - 10, CHUNK * 0.5 + HS.w * 0.35, [1.3, 0.18, 0.30], 2.6, true, 5);
                addLight(HS.lat0 - 6, CHUNK * 0.5 - HS.w * 0.15, [HS.colB[0] * 0.6, HS.colB[1] * 0.6, HS.colB[2] * 0.6], 2.6, true, HS.h + 2);
            }
        }
        // 光の情報: 最寄りの道路はこの地点の道路（向き = 道路の中心へ、距離 = 横位置）、街路灯はこのチャンクの灯から
        var deckH0 = FS.c.y - GROUND_Y;
        ch.houses.concat(ch.bldgs).forEach(function (o) {
            attachLights(o, ch.lights, -o.side * ct, -o.side * sn, Math.max(1, o.lat), deckH0);
        });
        ch.bldgs.forEach(function (o) { buildParts(o, mulberry32(hashInt(Math.floor(o.seed * 1000), 7, 31))); });
        // v6: 中高層の足元の敷地（植栽の帯とエントランス前の床）がほのかに明るい。建物が黒い地面に浮いて見えないように
        ch.bldgs.forEach(function (o) {
            ch.aprons.push({ x: o.x, z: o.z, y: 0, c: [3.6, 3.2, 2.6], s: 0, pool: true, pyaw: o.yaw, psx: o.w * 0.5 + 12, psz: o.d * 0.5 + 12, apron: true, owner: o });
        });
        return ch;
    }

    // v6: 1 棟を部品で組む。o.mass = 本体の分節（セットバックの上部、基壇。本体と同じ距離まで描く）、
    // o.parts = 屋上の部品（パラペット、塔屋、高架水槽、室外機、アンテナ。700 m でフェード）。
    // 部品は建物の足元（o.x, o.z）を原点に、建物の向き（yaw）で回した位置に置く
    function partAt(o, ox, oz, y0, w, h, d, type, extra) {
        var cy = Math.cos(o.yaw), sy = Math.sin(o.yaw);
        // three の Y 軸回転: ローカル x → (cos, 0, -sin)、ローカル z → (sin, 0, cos)
        var p = { x: o.x + ox * cy + oz * sy, z: o.z - ox * sy + oz * cy, y0: y0, yaw: o.yaw, w: w, h: h, d: d, type: type,
                  lit: o.lit, seed: o.seed + 0.37 * (ox + oz + y0), wall: o.wall, par: o, isPart: true };   // 道路・街路灯の情報は描く時に親から、部品の原点へずらして使う (v6.1)
        if (extra) for (var k in extra) p[k] = extra[k];
        return p;
    }
    function buildParts(o, r, blockMode) {
        o.mass = []; o.parts = [];
        if (o.wing) {                                                       // L 字の袖（本体と同じ向きの箱を端に足す）
            o.mass.push(partAt(o, o.wing.sx * (o.w / 2 - o.d / 2), o.wing.sz * (o.d / 2 + o.wing.len / 2), 0, o.d, o.h * o.wing.hf, o.wing.len, o.type));
        }
        var topH = o.h, topW = o.w, topD = o.d, topY = 0;
        if (o.h > 30 && r() < 0.4) {                                        // セットバック: 上部 1/4〜1/3 を一回り小さく
            var f = 0.25 + 0.08 * r(), hMain = o.h * (1 - f);
            o.hDraw = hMain;
            topW = o.w * (0.72 + 0.12 * r()); topD = o.d * (0.75 + 0.1 * r()); topH = o.h * f; topY = hMain;
            o.mass.push(partAt(o, (r() - 0.5) * (o.w - topW) * 0.6, 0, hMain, topW, topH, topD, o.type, { setback: true }));
            topH = topY + topH;
        }
        if (!blockMode && o.h > 12 && r() < 0.5) {                          // 基壇: 1〜2 階ぶんを少し張り出す（店舗・エントランス）
            o.mass.push(partAt(o, 0, 0, 0, o.w * 1.06, 3.6 + 2.6 * r(), o.d * 1.14, 3));
        }
        // 屋上（最上部の箱の上）: パラペット 4 辺、塔屋 1〜2、高架水槽、室外機の列、アンテナ
        var sb = null; o.mass.forEach(function (m) { if (m.setback) sb = m; });
        var roofY = sb ? topH : (o.hDraw || o.h);
        var rw = sb ? topW : o.w, rd = sb ? topD : o.d;
        var rox = sb ? (sb.x - o.x) * Math.cos(o.yaw) - (sb.z - o.z) * Math.sin(o.yaw) : 0;
        var ph = 0.6 + 0.4 * r(), th = 0.25;
        o.parts.push(partAt(o, rox, rd / 2 - th / 2, roofY, rw, ph, th, 4));
        o.parts.push(partAt(o, rox, -rd / 2 + th / 2, roofY, rw, ph, th, 4));
        o.parts.push(partAt(o, rox + rw / 2 - th / 2, 0, roofY, th, ph, rd - 2 * th, 4));
        o.parts.push(partAt(o, rox - rw / 2 + th / 2, 0, roofY, th, ph, rd - 2 * th, 4));
        var nT = 1 + (r() < 0.5 ? 1 : 0);
        for (var i = 0; i < nT; i++) {                                    // 塔屋（階段室・機械室）: 屋上面積の 5〜12%
            var tw = Math.min(rw * 0.3, 4 + 4 * r()), td = Math.min(rd * 0.45, 4 + 3 * r());
            o.parts.push(partAt(o, rox + (r() - 0.5) * (rw - tw - 2), (r() - 0.5) * (rd - td - 2), roofY, tw, 3.0 + 0.8 * r(), td, 5));
        }
        if (blockMode) return;
        if (r() < 0.7) {                                                  // 高架水槽（架台＋水槽）
            var kx = rox + (r() - 0.5) * (rw - 6), kz = (r() - 0.5) * (rd - 6);
            o.parts.push(partAt(o, kx, kz, roofY, 2.4, 1.6, 2.4, 6));
            o.parts.push(partAt(o, kx, kz, roofY + 1.6, 3.0, 2.2, 3.0, 5));
        }
        var nAC = 3 + Math.floor(r() * 5), acx = rox + (r() - 0.5) * rw * 0.4, acz = (r() < 0.5 ? -1 : 1) * rd * 0.3;
        for (var a = 0; a < nAC; a++) o.parts.push(partAt(o, acx + (a - nAC / 2) * 1.3, acz, roofY, 1.0, 0.9, 0.7, 5));   // 室外機の列
        if (r() < 0.6) o.parts.push(partAt(o, rox + (r() - 0.5) * rw * 0.6, (r() - 0.5) * rd * 0.6, roofY, 0.12, 4 + 4 * r(), 0.12, 6));   // アンテナ・避雷針
        if (o.type === 0 && r() < 0.15) {                                 // 店舗・オフィスの屋上看板の骨組み
            o.parts.push(partAt(o, rox, rd * 0.2, roofY, rw * 0.6, 3.0, 0.3, 7));
        }
    }

    // --- 街区（旧「近景の街区」と「中景リング」の後継）: 道のり 500 m ごとに左右で抽選し、lat 500〜3800 m に置く ---
    // カメラの BLOCK_GEN 先で生成し、BLOCK_DROP 後ろで捨てる。表示は水平距離 BLOCK_FADE で 0 になるフェード付き
    var BLOCK = 500, BLOCK_GEN = 10000, BLOCK_DROP = 1500, BLOCK_FADE = 6000, BLOCK_KEEP = 6000;   // 通り過ぎた街区は、見える距離から外れるか BLOCK_KEEP 後ろで捨てる
    var NBLK = 1600, NBPT = 6000;
    var cityAz = clusters[0].az;
    // --- 遠くの観覧車: 道のり 18 km ごとの枠に 55% で 1 基、道路から 1.8〜3.3 km（街の側に寄せる）。直径 76〜100 m、ハブは地上 R + 9 m。
    // 街区より先（その街区を作る前）に決め、街区の棟は観覧車の敷地に置かない
    var wheels = [], wheelSlot = -1, wheelMade = 0, WHEEL_SLOT = 18000, FWH = new Frame();
    function ensureWheels(sUpTo) {
        while ((wheelSlot + 1) * WHEEL_SLOT < sUpTo) {
            wheelSlot++;
            var r = mulberry32(hashInt(wheelSlot, 13, 4242));
            var has = r() < 0.55, sw = wheelSlot * WHEEL_SLOT + 2500 + r() * 13000, sideR = r(), L = 1800 + 1500 * r(), R = 38 + 12 * r(), ph = r(), yawJ = (r() - 0.5) * 1.2;
            if (q.wheelAt && wheelSlot === Math.floor(q.wheelAt / WHEEL_SLOT)) { has = true; sw = q.wheelAt; L = 1800; }
            if (!has || sw < track.minStation() + 10) continue;
            frameAt(sw, FWH);
            var ct = Math.cos(FWH.th), sn = Math.sin(FWH.th), cx = FWH.c.x, cz = FWH.c.z;
            var wS = function (sd) { return 0.5 + 0.5 * Math.cos(Math.atan2(ct * sd, -sn * sd) - cityAz); };
            var side = sideR < (wS(-1) > wS(1) ? 0.75 : 0.25) ? -1 : 1;
            // 観覧車は遠景だけに置く: 前後 8 km の道路から 1.4 km 以上離す（曲がって戻ってきた道路の真横に来ないように）。だめなら奥へずらして試す
            var x = 0, z = 0, ok = false;
            for (var tl = 0; tl < 3 && !ok; tl++) { x = cx + ct * side * (L + 700 * tl); z = cz + sn * side * (L + 700 * tl); ok = clearOfTrack(x, z, R + 20, Math.max(sw - 8000, track.minStation()), sw + 8000, 1400); }
            if (!ok) continue;
            var ny = Math.atan2(cz - z, cx - x) + yawJ;                      // 車輪の面の法線（おおむね道路の方を向く）
            wheelMade++; wheels.push({ s: sw, x: x, z: z, y: GROUND_Y + R + 9, R: R, ax: -Math.sin(ny), az: Math.cos(ny), ph: ph });
        }
        while (wheels.length && wheels[0].s < sCam - 12000) wheels.shift();
    }
    // --- 郊外の大型スーパーの箱型看板（遠景の光だけ）: 道のり 2.5 km ごとの枠に 55%。道路から 0.5〜2 km、柱の上（地上 36〜46 m）に
    // 幅 16〜22 m・高さ 7〜9 m の内照式の箱。上の帯が店の色、下は白。店名は描かない（遠くて読めない大きさ）
    var MART_SLOT = 2500, martList = [], martSlot = -1, FMT = new Frame();
    var MART_COL = [[1.6, 0.25, 0.9], [0.25, 0.6, 1.8], [1.7, 0.45, 0.12], [0.3, 1.3, 0.45], [1.7, 0.2, 0.2]];
    function ensureMarts(sUpTo) {
        while ((martSlot + 1) * MART_SLOT < sUpTo) {
            martSlot++;
            var r = mulberry32(hashInt(martSlot, 31, 9191));
            var has = r() < 0.55, sm = martSlot * MART_SLOT + 300 + r() * (MART_SLOT - 600), side = r() < 0.5 ? -1 : 1, L = 500 + 1500 * r();
            var w = 16 + 6 * r(), hb = 7 + 2 * r(), hy = 36 + 10 * r(), col = MART_COL[Math.floor(r() * MART_COL.length)], ph = r();
            if (q.martAt && martSlot === Math.floor(q.martAt[0] / MART_SLOT)) { has = true; sm = q.martAt[0]; L = q.martAt[1] || 800; side = 1; }
            if (!has || sm < track.minStation() + 10) continue;
            frameAt(sm, FMT);
            var ct = Math.cos(FMT.th), sn = Math.sin(FMT.th), x = FMT.c.x + ct * side * L, z = FMT.c.z + sn * side * L;
            if (!clearOfTrack(x, z, 40, Math.max(sm - 4000, track.minStation()), sm + 4000, 300)) continue;
            martList.push({ s: sm, x: x, z: z, tx: sn, tz: -ct, w: w, hb: hb, y: GROUND_Y + hy, col: col, ph: ph });
        }
        while (martList.length && martList[0].s < sCam - 6000) martList.shift();
    }
    function nearWheel(x, z, rad) { for (var i = 0; i < wheels.length; i++) if (Math.hypot(x - wheels[i].x, z - wheels[i].z) < rad + wheels[i].R + 15) return true; return false; }
    function genBlock(b) {
        var st = b * BLOCK;
        var sFrom = Math.max(st - BLOCK_GEN - 50, sCam - 100, track.minStation()), sTo = st + BLOCK_KEEP + BLOCK + P.viewLen + 50;  // 街区が残っている間（最長 BLOCK_KEEP 後ろ）にカメラが通る道路
        track.ensure(sTo + 4);
        ensureWheels(st + BLOCK + 1500);
        frameAt(st, FS);
        var th = FS.th, ct = Math.cos(th), sn = Math.sin(th), cx = FS.c.x, cz = FS.c.z;
        var blk = { st: st, bldgs: [], pts: [] };
        var bornNear = function (x, z) { return railInit && Math.hypot(x - O.x, z - O.z) < BLOCK_FADE + 100; };   // 道路が曲がって、生まれた時にもう見える距離にある物は置かない（いきなり現れる）
        for (var side = -1; side <= 1; side += 2) {
            var r = mulberry32(hashInt(b, side + 3, 77));
            // 都市方向（遠景リングの中心 clusters[0]）に近い側ほど密に・高く
            var az = Math.atan2(ct * side, -sn * side);
            var w = 0.5 + 0.5 * Math.cos(az - cityAz);
            var pos = function (lat, along) { return [cx + ct * side * lat + sn * along, cz + sn * side * lat - ct * along]; };
            if (r() < 0.35 + 0.45 * w) {
                var L = 500 + 3300 * Math.pow(r(), 1.2), along0 = r() * BLOCK;
                var tL = Math.min(1, Math.max(0, (L - 700) / 2500));            // 0 = 旧近景、1 = 旧中景の分布
                var count = Math.round((6 + 34 * tL) * (0.6 + 0.8 * w) * (0.7 + 0.6 * r()));
                var spreadA = 90 + 180 * r() + L * 0.05, spreadL = 60 + 160 * r() + L * 0.03;
                var cType = r() < 0.3 + 0.4 * w ? 0 : 1;
                for (var i = 0; i < count; i++) {
                    var dl = (r() - 0.5) * 2 * spreadL, da = (r() - 0.5) * 2 * spreadA;
                    var hNear = 12 + r() * 30; if (r() < 0.1) hNear += 40 + r() * 50;
                    var hh = r(); hh = hh * hh;
                    var hMid = 22 * (0.8 + 1.2 * r()) + 110 * hh * w + 33 * w;
                    var h = (hNear + (hMid - hNear) * tL) * (0.7 + 0.6 * w);
                    if (L + dl > 2000 && r() < 0.25) h = 60 + 50 * r();
                    var sz = 14 + 32 * r() + (8 + 23 * r()) * tL, sz2 = 14 + 32 * r() + (8 + 23 * r()) * tL;
                    var p = pos(L + dl, along0 + da);
                    if (bornNear(p[0], p[1]) || nearWheel(p[0], p[1], 0.5 * Math.sqrt(sz * sz + sz2 * sz2)) || !clearOfTrack(p[0], p[1], 0.5 * Math.sqrt(sz * sz + sz2 * sz2), sFrom, sTo, 30)) continue;
                    var o = { x: p[0], z: p[1], yaw: -th + (r() - 0.5) * 0.6, w: sz, h: h, d: sz2, type: cType, lit: 0.2 + r() * 0.4, seed: r() * 100,
                              wall: pickWall(cType === 0 ? 'office' : 'mansion', r()) };
                    // v8 前: 近接用の作りかどうかは、層ではなく道路からの距離で決める。この街区が残っている間にカメラが通る道路（sFrom〜sTo）への
                    // 最短距離が 750 m 未満の棟は、沿道の棟と同じく近接用（道路の街灯の情報・屋上の部品一式）を持ち、近づくと近接用の材質で描く
                    var rd = roadNearest(o.x, o.z, sFrom, sTo);
                    o.roadMin = rd.d;
                    o.genS = sCam; o.genRamp = rampNear(o.x, o.z, 200); o.genIC = icList.length;
                    if (rd.d < 1300 * Math.min(2.6, Math.max(1, h / 45)) + 50) {         // 近接用の材質に切り替わる距離より道路に近づく棟は近接用の作り（遠景用の簡単な形を近くで見せない）
                        o.nearCap = true;
                        attachLights(o, null, (rd.x - o.x) / Math.max(rd.d, 1), (rd.z - o.z) / Math.max(rd.d, 1), Math.max(1, rd.d), rd.y - GROUND_Y);
                        buildParts(o, mulberry32(hashInt(Math.floor(o.seed * 1000), 9, 33)), false);
                    } else {
                        attachLights(o, null, 0, 0, 1e4, 0);                 // 道路から 750 m 以上離れたままの棟（遠景用の作りで足りる）
                        buildParts(o, mulberry32(hashInt(Math.floor(o.seed * 1000), 9, 33)), true);   // セットバック・パラペット・塔屋だけ
                    }
                    blk.bldgs.push(o);
                    if (h > 95) blk.pts.push({ x: p[0], z: p[1], y: h + 2, c: [2.2, 0.12, 0.06], s: 2.6, mode: 1, ph: r() });   // 航空障害灯
                }
            }
            // 集落・工場の灯（旧 中景の点の分布）
            if (r() < 0.3) {
                var tL2 = 1500 + 2300 * r(), tA = r() * BLOCK, factory = r() < 0.3;
                var nL = factory ? 10 + Math.floor(r() * 18) : 12 + Math.floor(r() * 40);
                var spread = factory ? 90 : 180 + r() * 220;
                for (var j = 0; j < nL; j++) {
                    var q2 = pos(tL2 + gauss(r) * spread * 0.6, tA + gauss(r) * spread);
                    if (bornNear(q2[0], q2[1]) || !clearOfTrack(q2[0], q2[1], 0, sFrom, sTo, 2)) continue;
                    var tb = 0.25 + 0.6 * r();
                    if (factory) blk.pts.push({ x: q2[0], z: q2[1], y: 4 + r() * 14, c: [0.85 * tb, 0.92 * tb, 1.0 * tb], s: 1.4 + r(), mode: 0, ph: 0 });
                    else blk.pts.push({ x: q2[0], z: q2[1], y: 3 + r() * 7, c: [1.0 * tb, 0.78 * tb, 0.48 * tb], s: 1.2 + 0.8 * r(), mode: r() < 0.1 ? 4 : 0, ph: r() });
                }
                if (factory) {
                    var qf = pos(tL2, tA);
                    if (!bornNear(qf[0], qf[1]) && clearOfTrack(qf[0], qf[1], 0, sFrom, sTo, 2)) blk.pts.push({ x: qf[0], z: qf[1], y: 40 + r() * 30, c: [2.2, 0.12, 0.06], s: 2.4, mode: 1, ph: r() });
                }
            }
        }
        var xs = 0, zs = 0, nb = 0, rad = 0;                                     // 街区の外接円（捨てる判定に使う）
        blk.bldgs.concat(blk.pts).forEach(function (o) { xs += o.x; zs += o.z; nb++; });
        blk.cx = nb ? xs / nb : cx; blk.cz = nb ? zs / nb : cz;
        blk.bldgs.concat(blk.pts).forEach(function (o) { rad = Math.max(rad, Math.hypot(o.x - blk.cx, o.z - blk.cz) + (o.w ? 0.7 * Math.max(o.w, o.d) : 0)); });
        blk.rad = rad;
        return blk;
    }
    var blockCache = {};
    // 道のり [sFrom, sTo] の道路の中心線への最短距離（20 m ごとの点で近似）
    function roadNearest(x, z, sFrom, sTo) {
        var best = { d: 1e18, x: 0, z: 0, y: 0 };
        for (var s = Math.ceil(sFrom / 20) * 20; s <= sTo; s += 20) {
            var i = s & TMASK, dx = track.px[i] - x, dz = track.pz[i] - z, d = dx * dx + dz * dz;
            if (d < best.d) { best.d = d; best.x = track.px[i]; best.z = track.pz[i]; best.y = track.py[i]; }
        }
        best.d = Math.sqrt(best.d);
        return best;
    }

    // いま描く物の一覧（水平距離で決める。フェードが 0 になる距離 + 60 m 以内）。selftest も同じ一覧を使う
    var drawn = { poles: [], parts: [], houses: [], bldgs: [], trees: [], lights: [], pools: [], blocks: [], bpts: [], trunc: 0 };
    function collectDrawn() {
        ensureLines();                                                      // 線路を先に決める（離隔判定に使う）
        var k0 = Math.floor((sCam - SIDE_DROP) / CHUNK), k1 = Math.floor((sCam + SIDE_GEN) / CHUNK);
        for (var kk in chunkCache) if (+kk < k0) delete chunkCache[kk];
        var b0 = Math.floor((sCam - BLOCK_DROP) / BLOCK), b1 = Math.floor((sCam + BLOCK_GEN) / BLOCK), bHard = Math.floor((sCam - BLOCK_KEEP) / BLOCK);
        for (var bb in blockCache) {                                         // 通り過ぎた街区は、見える距離から外れてから捨てる（かたまりごと消えないように）
            var bc = blockCache[bb];
            if (+bb < bHard || (+bb < b0 && Math.hypot(bc.cx - O.x, bc.cz - O.z) - bc.rad > BLOCK_FADE + 100)) delete blockCache[bb];
        }
        var D = drawn;
        D.parts.length = 0; D.poles.length = 0;
        D.houses.length = D.bldgs.length = D.trees.length = D.lights.length = D.pools.length = D.blocks.length = D.bpts.length = 0;
        D.trunc = 0; D.tb = { poles: 0, parts: 0, houses: 0, bldgs: 0, trees: 0, lights: 0, pools: 0, blocks: 0, bpts: 0 };
        function cut(kind) { D.trunc++; D.tb[kind]++; }
        // 画質の木の本数は、上限で切らずに決定的に間引いて合わせる（High の 1400 本で全部）
        var cxC = O.x, czC = O.z, treeCap = NTREE_MAX, treeFrac = Math.min(1, Q.trees / 1400);
        function near(o, lim) { var dx = o.x - cxC, dz = o.z - czC; return dx * dx + dz * dz < lim * lim; }
        var mLim = SIDE_MESH_LEN + 60, lLim = SIDE_LIGHT_LEN + 60, pLim = POOL_LEN + 60;
        for (var k = k0; k <= k1; k++) {
            var ch = chunkCache[k] || (chunkCache[k] = genChunk(k));
            ch.houses.forEach(function (o) { if (near(o, mLim)) { if (D.houses.length < NHOUSE) D.houses.push(o); else cut('houses'); } });
            ch.bldgs.forEach(function (o) {
                if (!near(o, mLim)) return;
                if (D.bldgs.length < NBLDG) D.bldgs.push(o); else cut('bldgs');
                if (o.mass) o.mass.forEach(function (m) { if (D.bldgs.length < NBLDG) D.bldgs.push(m); else cut('bldgs'); });
                if (o.parts && near(o, 760)) o.parts.forEach(function (m) { if (D.parts.length < NPART) D.parts.push(m); else cut('parts'); });
            });
            ch.trees.forEach(function (o) { if (o.rk < treeFrac && near(o, mLim)) { if (D.trees.length < treeCap) D.trees.push(o); else cut('trees'); } });
            ch.lights.forEach(function (o) {
                if (!near(o, lLim)) return;
                if (D.lights.length < NSPT) D.lights.push(o); else cut('lights');
                if (o.pool && near(o, pLim)) { if (D.pools.length < NPOOL) D.pools.push(o); else cut('pools'); }
                if (o.pole && near(o, pLim)) { if (D.poles.length < NUPOLE) D.poles.push(o); else cut('poles'); }
            });
            ch.aprons.forEach(function (o) {
                if (ch.bldgs.indexOf(o.owner) < 0 || !near(o, pLim)) return;          // 取り除かれた建物の敷地は描かない
                if (D.pools.length < NPOOL) D.pools.push(o); else cut('pools');
            });
        }
        var bLim = BLOCK_FADE + 60;
        for (var bg = b0; bg <= b1; bg++) if (!blockCache[bg]) blockCache[bg] = genBlock(bg);
        var bKeys = Object.keys(blockCache).map(Number).sort(function (x, y) { return x - y; });
        for (var bi = 0; bi < bKeys.length; bi++) {
            var blk = blockCache[bKeys[bi]];
            blk.bldgs.forEach(function (o) {
                if (!near(o, bLim)) return;
                if (o.nearCap && near(o, 1300 * Math.min(2.6, Math.max(1, o.h / 45)))) {   // 近接用の作りが消える距離（高さで伸びる）より外で材質を切り替える                            // 近づいた街区の棟は、沿道の棟と同じ近接用の材質・部品で描く
                    if (D.bldgs.length < NBLDG) D.bldgs.push(o); else cut('bldgs');
                    if (o.mass) o.mass.forEach(function (m) { if (D.bldgs.length < NBLDG) D.bldgs.push(m); else cut('bldgs'); });
                    if (o.parts && near(o, 760)) o.parts.forEach(function (m) { if (D.parts.length < NPART) D.parts.push(m); else cut('parts'); });
                    return;
                }
                if (D.blocks.length < NBLK) D.blocks.push(o); else cut('blocks');
                if (o.mass && near(o, 1300)) o.mass.forEach(function (m) { if (D.blocks.length < NBLK) D.blocks.push(m); else cut('blocks'); });
                if (o.parts && near(o, 760)) o.parts.forEach(function (m) { if (D.parts.length < NPART) D.parts.push(m); else cut('parts'); });
            });
            blk.pts.forEach(function (o) { if (near(o, bLim)) { if (D.bpts.length < NBPT) D.bpts.push(o); else cut('bpts'); } });
        }
        return D;
    }

    function writeSide() {
        var D = collectDrawn();
        var m4 = tmpM, qt = tmpQ, pv = tmpV, sv = tmpS2;
        var gy = GROUND_Y - anchor.y, ax = anchor.x, az = anchor.z;
        function inst(mesh, list, attrsGeo, typeOf) {
            var S1 = attrsGeo ? attrsGeo.attributes.aSeed.array : null, T1 = attrsGeo ? attrsGeo.attributes.aType.array : null, L1 = attrsGeo ? attrsGeo.attributes.aLit.array : null;
            var W1 = attrsGeo ? attrsGeo.attributes.aWall.array : null, R1 = attrsGeo ? attrsGeo.attributes.aRoad.array : null;
            var LA = attrsGeo ? [attrsGeo.attributes.aL0.array, attrsGeo.attributes.aL1.array, attrsGeo.attributes.aL2.array] : null;
            for (var i = 0; i < list.length; i++) {
                var o = list[i];
                pv.set(o.x - ax, gy + (o.y0 || 0), o.z - az); qt.setFromAxisAngle(yAxis, o.yaw);
                if (o.sx !== undefined) sv.set(o.sx, o.sy, o.sz); else sv.set(o.w, o.hDraw || o.h, o.d);
                m4.compose(pv, qt, sv); mesh.setMatrixAt(i, m4);
                if (S1) {
                    S1[i] = o.seed; T1[i] = typeOf(o); L1[i] = o.lit;
                    var wc = o.wall || [0.4, 0.4, 0.4]; W1[i * 4] = wc[0]; W1[i * 4 + 1] = wc[1]; W1[i * 4 + 2] = wc[2]; W1[i * 4 + 3] = o.y0 || 0;
                    var src = o.par || o, ox2 = o.x - src.x, oz2 = o.z - src.z;
                    var rd = src.road || [0, 0, 1e4, 0]; for (var k = 0; k < 4; k++) R1[i * 4 + k] = rd[k];
                    if (o.par && src.road) R1[i * 4 + 2] = rd[2] - (ox2 * rd[0] + oz2 * rd[1]);
                    for (var j = 0; j < 3; j++) {
                        var lp = src.lamps ? src.lamps[j] : null;
                        LA[j][i * 4] = lp ? lp[0] - ox2 : 0; LA[j][i * 4 + 1] = lp ? lp[1] : 0; LA[j][i * 4 + 2] = lp ? lp[2] - oz2 : 0; LA[j][i * 4 + 3] = lp ? lp[3] : 0;
                    }
                }
            }
            mesh.count = list.length; mesh.instanceMatrix.needsUpdate = true;
            if (attrsGeo) ['aSeed', 'aType', 'aLit', 'aWall', 'aRoad', 'aL0', 'aL1', 'aL2'].forEach(function (a) { attrsGeo.attributes[a].needsUpdate = true; });
        }
        inst(houseMesh, D.houses, houseGeo, function () { return 1; });
        inst(bldgMesh, D.bldgs, bldgGeo, function (o) { return o.type; });
        inst(partMesh, D.parts, partGeo, function (o) { return o.type; });
        inst(treeMesh, D.trees, null);
        inst(blockMesh, D.blocks, blockGeo, function (o) { return o.type; });
        function pts(obj, list, gain, isBlock) {
            var g = obj.geometry, lp = g.attributes.position.array, lc = g.attributes.aCol.array, ls = g.attributes.aSize.array;
            var lm = g.attributes.aMode.array, lph = g.attributes.aPhase.array;
            for (var i = 0; i < list.length; i++) {
                var o = list[i];
                lp[i * 3] = o.x - ax; lp[i * 3 + 1] = gy + o.y; lp[i * 3 + 2] = o.z - az;
                lc[i * 3] = o.c[0] * gain; lc[i * 3 + 1] = o.c[1] * gain; lc[i * 3 + 2] = o.c[2] * gain; ls[i] = o.s;
                if (isBlock) { lm[i] = o.mode; lph[i] = o.ph; }
            }
            g.setDrawRange(0, list.length);
            ['position', 'aCol', 'aSize', 'aMode', 'aPhase'].forEach(function (a) { g.attributes[a].needsUpdate = true; });
        }
        pts(sidePts, D.lights, SPT_GAIN, false);
        pts(blockPts, D.bpts, 1.0, true);
        var pc = poolGeo.attributes.aPoolCol.array;
        for (var i = 0; i < D.pools.length; i++) {
            var o = D.pools[i];
            pv.set(o.x - ax, gy + 0.5, o.z - az);
            if (o.psx !== undefined) { qt.setFromAxisAngle(yAxis, o.pyaw); sv.set(o.psx, 1, o.psz); }
            else if (o.pyaw !== undefined) { qt.setFromAxisAngle(yAxis, o.pyaw); sv.set(5, 1, POOL_R); } else { qt.identity(); sv.set(7, 1, 7); }
            m4.compose(pv, qt, sv); poolMesh.setMatrixAt(i, m4);
            pc[i * 3] = o.c[0]; pc[i * 3 + 1] = o.c[1]; pc[i * 3 + 2] = o.c[2];
        }
        poolMesh.count = D.pools.length; poolMesh.instanceMatrix.needsUpdate = true; poolGeo.attributes.aPoolCol.needsUpdate = true;
        for (var ip = 0; ip < D.poles.length; ip++) {
            var op = D.poles[ip];
            pv.set(op.x - ax + 0.6, gy, op.z - az); qt.identity(); sv.set(1, Math.max(0.55, (op.y + 1.5) / 10), 1);
            m4.compose(pv, qt, sv); upoles.setMatrixAt(ip, m4);
        }
        upoles.count = D.poles.length; upoles.instanceMatrix.needsUpdate = true;
        writeRailStatic();
        writeParStatic();
        sideKey = Math.floor(sCam / CHUNK);
    }
    function updateSide() {
        var AR = P.anchorReset, reAnchor = !anchor.set || Math.abs(O.x - anchor.x) > AR || Math.abs(O.z - anchor.z) > AR || Math.abs(O.y - anchor.y) > AR;
        if (reAnchor && anchor.set) anchorResets++;
        if (reAnchor) anchorVer++;
        if (reAnchor) { anchor.x = O.x; anchor.y = O.y; anchor.z = O.z; anchor.set = true; }
        if (reAnchor || sideKey !== Math.floor(sCam / CHUNK) || sideQ !== qi) { sideQ = qi; writeSide(); }
        sideGroup.position.set(anchor.x - O.x, anchor.y - O.y, anchor.z - O.z);
    }
    var sideQ = -1, anchorResets = 0;

    // --- 高架の下をくぐる在来線（世界固定のまっすぐな複線）と電車 ----------------------------------------------
    // 道のり 2500〜5000 m ごとに 1 本。交差点 = その道のりの軌道点、向き = 道路の向き ± 18〜70°。交差点から両側 5 km。
    // 建物などの離隔判定に使うため、カメラの RAIL_AHEAD 先まで決めておく（街区の生成 10 km 先 + 線路の半長 5 km より先）
    var RAIL_HALF = 5000, RAIL_AHEAD = 60000, RAIL_CLEAR = 9, PIER_RAIL_CLEAR = 7, RAIL_FADE = 6000;
    var CAR_LEN = 20, CAR_GAP = 0.5, NCARS = 11, TRAIN_LEN = NCARS * (CAR_LEN + CAR_GAP);
    // v7.1: 両数は線ごとに 1 つ（4 両 15%、6 両 25%、8 両 25%、10 両 25%、11 両 10%）。1 両 20 m はそのまま
    function pickCars(h) { return h < 0.15 ? 4 : h < 0.40 ? 6 : h < 0.65 ? 8 : h < 0.90 ? 10 : 11; }
    function tLen(L) { return L.nc * (CAR_LEN + CAR_GAP); }
    var RAIL_Y = 0.6 + 0.17;                                  // 地面からレール面まで（盛土 0.6 m ＋レール）
    var BAND_COLS = [[0.45, 0.80, 0.15], [0.30, 0.70, 0.95], [1.0, 0.45, 0.10], [1.0, 0.82, 0.10], [0.60, 0.08, 0.20]];   // 黄緑・水色・橙・黄・えんじ
    var railStations = [], railCache = {};
    function railStation(k) {
        while (railStations.length <= k) {
            var n = railStations.length, prev = n === 0 ? 900 : railStations[n - 1];
            // v6.1: 最初の交差点は起動から 1 分ほど（1.7〜2.3 km）、以後 5〜8.5 km ごと
            railStations.push(n === 0 ? 550 + 150 * gapHash(n, 41) : prev + 1500 + 1200 * gapHash(n, 41));   // v8: 最初は IC の予告標識より手前へ。以後 1.5〜2.7 km ごと（実機の指摘「電車に会わなすぎる」で 3〜5.5 km から縮めた）
        }
        return railStations[k];
    }
    // 線路の交差点は、同じ seed で先行して回す専用の軌道から求める（決定的なので位置は本体と同じ）。
    // 道路は曲がりくねるので、ずっと先で交差する線路でも置いた建物の近くを通りうる。60 km 先まで決めておく
    var railTrack = new global.TwTrack({ segLen: P.segLen, curveGain: curveGain, hillGain: hillGain, bankGain: bankGain, seed: seed });
    var rsmp = { x: 0, y: 0, z: 0, th: 0, bank: 0, slope: 0 };
    // v6.1: 交差点と、その手前 450〜50 m の運転席の位置を、最初に決めた時（先行軌道の範囲内）に覚えておく。
    // 見送った線をあとで使う時は、先行軌道がもう 32 km 以上先へ進んでいてリングバッファから消えているため
    var railSmp = {};
    function railSamples(k) {
        var R = railSmp[k];
        if (R) return R;
        var sc = railStation(k);
        if (sc > railTrack.last - 4) railTrack.ensure(sc + 5);
        railTrack.sample(sc, rsmp);
        R = { x: rsmp.x, z: rsmp.z, th: rsmp.th, eyes: [] };
        for (var q3 = 0; q3 < 17; q3++) { railTrack.sample(sc - 450 + q3 * 25, alS); R.eyes.push(setEye({}, alS.x, alS.y, alS.z, alS.th)); }
        railSmp[k] = R;
        return R;
    }
    function genLine(k, att) {
        att = att || 0;
        var sc = railStation(k), R0 = railSamples(k);
        rsmp.x = R0.x; rsmp.z = R0.z; rsmp.th = R0.th;
        // v6.1: 角度が合わない（カメラの近くを通る）ときは、別の角度・向きで引き直す（att = 引き直しの回数）
        var ang = (18 + 52 * gapHash(k * 7 + att, 42)) * Math.PI / 180, sg = gapHash(k * 7 + att, 43) < 0.5 ? -1 : 1;
        var phi = rsmp.th + sg * ang;
        var dx = Math.sin(phi), dz = -Math.cos(phi);
        var v = (65 + 15 * gapHash(k, 44)) / 3.6;
        var D0 = 3500 + 2000 * gapHash(k, 45), D1 = 3500 + 2000 * gapHash(k, 46);   // 運転間隔（位相を合わせた 1 本のほかに、偶然の出会いも増える）
        var L = { k: k, sc: sc, cx: rsmp.x, cz: rsmp.z, dx: dx, dz: dz, rx: -dz, rz: dx, angDeg: ang * 180 / Math.PI * sg,
                 col: BAND_COLS[Math.floor(gapHash(k, 47) * 5) % 5], v: v, D: [D0, D1], ph: [gapHash(k, 48) * D0, gapHash(k, 49) * D1], nc: pickCars(gapHash(k, 50)) };
        return L;
    }
    // --- v6.1: 電車と出会うための見え方の判定と、くぐる線の位相合わせ ---
    // 運転席（左車線、路面 + 1.3 m）から点 (x, y, z) が「前方の画面内（水平画角の内側）・400 m 以内・桁の縁より上の視線」で見えるか。
    // 桁の縁（地覆の外 9.75 m）を通る視線の高さが路面 + 0.3 m より上なら見える（ガードレールの支柱の間・上から）。道路は直線とみなす
    var TAN_HFOV = Math.tan((P.encHfov / 2) * Math.PI / 180), DECK_EDGE_X = P.roadHalf + P.curbW;
    var visE = { x: 0, y: 0, z: 0, fx: 0, fz: 1, rx: 1, rz: 0 };
    function setEye(E, x, y, z, th) {                                    // 軌道点 (x, y, z) と向き th から運転席の視点を作る
        E.fx = Math.sin(th); E.fz = -Math.cos(th); E.rx = Math.cos(th); E.rz = Math.sin(th);
        E.x = x + E.rx * P.laneX; E.z = z + E.rz * P.laneX; E.y = y + P.eyeH;
        return E;
    }
    function seenFrom(E, x, y, z) {
        var ex = x - E.x, ez = z - E.z, f = ex * E.fx + ez * E.fz, l = ex * E.rx + ez * E.rz;
        if (f <= 0 || Math.abs(l) > f * TAN_HFOV || f * f + l * l > 400 * 400) return false;
        var edge = l < 0 ? DECK_EDGE_X + P.laneX : DECK_EDGE_X - P.laneX, al = Math.abs(l), hy = y - E.y;
        if (al <= edge) return hy > -P.eyeH + 0.3;                         // 道路の上（桁の幅の中）: 路面より上なら見える
        return P.eyeH + hy * (edge / al) > 0.3;
    }
    var WIN_H = 2.0;                                                     // 電車の窓の高さ（レール面から）
    var alS = { x: 0, y: 0, z: 0, th: 0, bank: 0, slope: 0 }, alE = { x: 0, y: 0, z: 0, fx: 0, fz: 1, rx: 1, rz: 0 };
    // くぐる線: カメラが交差点の 450〜50 m 手前を走る間に、どちらか一方の向きの電車が最も長く見えるように位相を決める
    var alignStat = { n: 0, zero: 0, sum: 0 }; var crossLog = [], crossAcc = [];
    function alignCross(L) {
        var spd = speed > 0 ? speed : 27.8, tc0 = trainClock || 0;
        var sT0 = L.sc - 450, NS = 17, eyes = railSamples(L.k).eyes;
        var yW = P.groundY + RAIL_Y + WIN_H, best = -1, bestDir = 0, bestH = 0;
        for (var dir = 0; dir < 2; dir++) {
            var sg = dir === 0 ? 1 : -1, ox = L.rx * (dir === 0 ? -2.0 : 2.0), oz = L.rz * (dir === 0 ? -2.0 : 2.0);
            for (var h0 = -RAIL_HALF + 300; h0 <= RAIL_HALF - 300; h0 += 20) {         // カメラが sT0 にいる時の先頭の位置（線の座標）
                var sc2 = 0;
                for (var q4 = 0; q4 < NS; q4++) {
                    var hU = h0 + sg * L.v * (q4 * 25 / spd), E = eyes[q4], hit = false;
                    for (var c = 0; c < L.nc && !hit; c += 2) {
                        var uc = hU - sg * (c * (CAR_LEN + CAR_GAP) + CAR_LEN / 2);
                        if (Math.abs(uc) > RAIL_HALF - 200) continue;
                        hit = seenFrom(E, L.cx + L.dx * uc + ox, yW, L.cz + L.dz * uc + oz);
                    }
                    if (hit) sc2++;
                }
                if (sc2 > best) { best = sc2; bestDir = dir; bestH = h0; }
            }
        }
        L.alignScore = best; alignStat.n++; if (best <= 0) alignStat.zero++; else alignStat.sum += best;
        if (best <= 0) return;                                           // どの位置でも見えない線（角度が深く右側だけを通る等）
        var tA = tc0 + (sT0 - sCam) / spd, D = L.D[bestDir];
        var hu = bestDir === 0 ? bestH : -bestH;                            // updateTrains: headU = sg * hu
        L.ph[bestDir] = (((hu + RAIL_HALF - L.v * tA) % D) + D) % D;
    }
    var railK0 = 0, railSkip = {}, railInit = false;
    // 新しく決めた線路の近くにある（まだ見えていない）世界固定物を取り除く
    function purgeForLine(L) {
        function ok(o, r) { return lineDist(L, o.x, o.z) >= RAIL_CLEAR + r; }
        function diag(o) { return 0.5 * Math.sqrt(o.w * o.w + o.d * o.d); }
        for (var ck in chunkCache) {
            var ch = chunkCache[ck];
            ch.houses = ch.houses.filter(function (o) { return ok(o, diag(o)); });
            ch.bldgs = ch.bldgs.filter(function (o) { return ok(o, o.rad || diag(o)); });
            ch.trees = ch.trees.filter(function (o) { return ok(o, 0.45 * Math.max(o.sx, o.sz)); });
            ch.lights = ch.lights.filter(function (o) { return ok(o, o.pool ? POOL_R : 0); });
        }
        for (var bk in blockCache) {
            var b = blockCache[bk];
            b.bldgs = b.bldgs.filter(function (o) { return ok(o, diag(o)); });
            b.pts = b.pts.filter(function (o) { return ok(o, 0); });
        }
    }
    // くぐる線の交差点が、採用した並走線の区間の 600 m 以内にあるか（並走線を優先し、そのくぐる線は使わない）
    function crossBlockedByPar(sc) {
        // v8: IC の区間でも、ランプから離れて通るくぐる線は許す（ランプとの離隔は tryLine の lineHitsRamp で形で調べる）
        for (var kk in railCache) { var Lp = railCache[kk]; if (Lp.par && sc > Lp.sA - 600 && sc < Lp.sL + 600) return true; }
        for (var kk2 in parKept) { var Lq = parKept[kk2]; if (sc > Lq.sA - 600 && sc < Lq.sL + 600) return true; }
        return false;
    }
    var railPend = {}, railPendAt = -1e9;
    function lineHitsRiver(L) {
        for (var i = 0; i < rivers.length; i++) {
            var R = rivers[i];
            for (var u = -RAIL_HALF; u <= RAIL_HALF; u += 10) { var x = L.cx + L.dx * u, z = L.cz + L.dz * u; var ex = x - R.x, ez = z - R.z; if (Math.abs(ex * R.dx + ez * R.dz) < RIV_HALF && Math.abs(ex * R.dz - ez * R.dx) < R.w / 2 + 10) return true; }
        }
        return false;
    }
    function lineHitsRoad(L) {
        for (var i = 0; i < groads.length; i++) {
            var R = groads[i]; if (lineDist(L, R.x, R.z) > GR_HALF + 200 && Math.hypot(L.cx - R.x, L.cz - R.z) > RAIL_HALF + GR_HALF + 200) continue;
            for (var u = -RAIL_HALF; u <= RAIL_HALF; u += 5) if (groadDistOne(R, L.cx + L.dx * u, L.cz + L.dz * u) < 8) return true;
        }
        return false;
    }
    function lineHitsRamp(L) {
        for (var i = 0; i < icList.length; i++) {
            var ic = icList[i]; if (!ic.ramps) continue;
            for (var k = 0; k < 4; k++) {
                var R = ic.ramps[k];
                var bx = Math.max(R.minX - L.cx, 0, L.cx - R.maxX), bz = Math.max(R.minZ - L.cz, 0, L.cz - R.maxZ);
                if (bx * bx + bz * bz > (RAIL_HALF + 300) * (RAIL_HALF + 300)) continue;   // 線の範囲に入らないランプは調べない
                for (var j = 0; j < R.n; j++) if (lineDist(L, R.X[j], R.Z[j]) < RAIL_CLEAR + 5 && R.Y[j] - 2.2 < P.groundY + RAIL_Y + 6.5) return true;   // 桁下がレール面から 6.5 m 以上ならくぐってよい
            }
        }
        return false;
    }
    function tryLine(k) {                                                // 12 通りの角度で試し、カメラから十分離れた線を採用する
        for (var att = 0; att < 12; att++) {
            var L = genLine(k, att); L.genAt = sCam;
            if (railInit && lineDist(L, O.x, O.z) < RAIL_FADE + 600) continue;
            if (lineHitsRamp(L)) continue;                                   // v8: ランプと交わる・寄る角度は使わない
            if (lineHitsRoad(L)) continue;                                   // v9: 地上の道路と踏切で交わる角度は使わない
            // v9 の後: 線路は川を鉄橋で渡ってよい
            alignCross(L);
            if (L.alignScore <= 0 && att < 11) continue;                  // どの位置でも電車が見えない角度なら引き直す
            if (railInit) purgeForLine(L);
            railCache[k] = L; crossAcc.push(L.sc);
            if (q.encdbg) crossLog.push((L.sc / 1000).toFixed(1) + '/' + L.alignScore + '/' + Math.round(Math.abs(L.angDeg)) + '/' + L.nc + 'c');
            return true;
        }
        return false;
    }
    function parBlockEnd(sc) {                                           // sc を塞いでいる並走線の区間の終わり
        var e = sc;
        for (var kk in railCache) { var Lp = railCache[kk]; if (Lp.par && sc > Lp.sA - 600 && sc < Lp.sL + 600) e = Math.max(e, Lp.sL + 600); }
        for (var kk2 in parKept) { var Lq = parKept[kk2]; if (sc > Lq.sA - 600 && sc < Lq.sL + 600) e = Math.max(e, Lq.sL + 600); }
        return e;
    }
    function ensureLines() {
        ensurePars();                                                        // 並走する高架線を先に（より遠くまで）決める
        var k = railK0;
        while (railStation(k) <= sCam + RAIL_AHEAD) {
            if (!railCache[k] && !railSkip[k]) {
                if (crossBlockedByPar(railStation(k))) {
                    // v6.1: 並走線の区間にかかる交差点は、その区間の 700 m 先へずらす（次の交差点まで 2.5 km 以上空く時だけ）。ずらせなければ使わない
                    var nS = parBlockEnd(railStation(k)) + 700;
                    if (railStations.length > k + 1 || crossBlockedByPar(nS)) { railSkip[k] = { skipWhy: 'par' }; k++; continue; }
                    railStations[k] = nS; delete railSmp[k];
                    if (railStation(k + 1) < nS + 1500) railStations[k + 1] = nS + 1500 + 1000 * gapHash(k + 1, 41);
                    continue;                                                // ずらした道のりで、もう一度判定する
                }
                // 道路は曲がりくねるので、ずっと先で交差する線路でも今のカメラの近くを通ることがある。
                // そのまま使うと線路がいきなり現れるので、別の角度で 12 回まで引き直し、だめならカメラが離れてから試し直す（起動直後は全体が一度に現れるので例外）
                if (!tryLine(k)) {
                    // v6.1: 交差点を 0.6〜2.4 km 先へずらして試す（次の交差点がまだ決まっていない時だけ）。だめなら元の位置で、カメラが離れたら試し直す
                    var s0k = railStations[k], okk = false;
                    if (railStations.length === k + 1) for (var off = 600; off <= 2400 && !okk; off += 600) {
                        if (crossBlockedByPar(s0k + off)) break;
                        railStations[k] = s0k + off; delete railSmp[k];
                        okk = tryLine(k);
                    }
                    if (!okk) {
                        railStations[k] = s0k; delete railSmp[k]; railSkip[k] = { skipWhy: 'near' }; railPend[k] = true;
                        if (railStations.length === k + 1) railStations.push(s0k + 1500 + 800 * gapHash(k + 1, 41));   // 次の交差点を近づけて間を埋める
                    }
                }
            }
            k++;
        }
        railInit = true;
        // v6.1: カメラの近くを通るので見送った線を、カメラが 200 m 進むごとに試し直す（交差点の 6.6 km 以上手前で、線全体が 6.6 km 以上離れたら使える）
        if (Math.abs(sCam - railPendAt) > 200) {
            railPendAt = sCam;
            for (var pk in railPend) {
                if (railStation(+pk) < sCam + RAIL_FADE) { delete railPend[pk]; continue; }   // もう間に合わない
                if (crossBlockedByPar(railStation(+pk))) { delete railPend[pk]; railSkip[pk].skipWhy = 'par'; continue; }
                if (tryLine(+pk)) { delete railPend[pk]; delete railSkip[pk]; railSkip[pk] = { skipWhy: 'late' }; }
            }
        }
        // 十分後ろに過ぎて、カメラからも遠い線路は捨てる
        for (var kk in railCache) {
            var L = railCache[kk];
            if (!L.par && L.sc < sCam - 12000 && lineDist(L, O.x, O.z) > 8000) { delete railCache[kk]; delete railSmp[kk]; if (+kk >= railK0) railK0 = +kk + 1; }
        }
    }
    function lineDist(L, x, z) {
        if (L.par) return parNearest(L, x, z, 80).d;
        var tx = x - L.cx, tz = z - L.cz, t = tx * L.dx + tz * L.dz;
        t = Math.max(-RAIL_HALF, Math.min(RAIL_HALF, t));
        var ex = tx - t * L.dx, ez = tz - t * L.dz;
        return Math.sqrt(ex * ex + ez * ez);
    }
    // 線路の中心線から clr + radius 以内なら false
    function clearOfRail(x, z, radius, clr) {
        for (var kk in railCache) if (lineDist(railCache[kk], x, z) < clr + radius) return false;
        return true;
    }

    // 路盤（盛土＋砕石＋枕木＋レール）: 1 本の線路 = 1 インスタンス
    var railbedGeo = (function () {
        var X = [-6, -4.5, 4.5, 6], Y = [0, 0.6, 0.6, 0], pos = [], nrm = [], idx = [];
        for (var zi = 0; zi < 2; zi++) for (var i = 0; i < 4; i++) {
            pos.push(X[i], Y[i], zi);
            var ny = i === 0 || i === 3 ? 0.93 : 1, nx = i === 0 ? -0.37 : i === 3 ? 0.37 : 0;
            nrm.push(nx, ny, 0);
        }
        for (var j = 0; j < 3; j++) idx.push(j, j + 1, 4 + j, j + 1, 5 + j, 4 + j);
        var g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
        g.setIndex(idx);
        return g;
    })();
    var railbedMat = new THREE.ShaderMaterial({
        vertexShader: S.railbedVert, fragmentShader: S.railbedFrag, side: THREE.DoubleSide,
        uniforms: uni({ uUnder: { value: new THREE.Vector3(0.010, 0.0075, 0.005) }, uFadeFar: { value: RAIL_FADE } })
    });
    var NRAILBED = 64;
    var railbeds = new THREE.InstancedMesh(railbedGeo, railbedMat, NRAILBED);
    railbeds.instanceMatrix.setUsage(THREE.DynamicDrawUsage); railbeds.frustumCulled = false; railbeds.count = 0; sideGroup.add(railbeds);

    // 架線柱: 50 m ごとの門型（両側の柱＋梁）、高さ 7 m。細く暗い
    var portalGeo = (function () {
        var gs = [];
        [-3.6, 3.6].forEach(function (x) { var c = new THREE.CylinderGeometry(0.11, 0.14, 7.0, 10); c.translate(x, 0.6 + 3.5, 0); gs.push(c); });
        var b = new THREE.CylinderGeometry(0.08, 0.08, 7.4, 8); b.rotateZ(Math.PI / 2); b.translate(0, 0.6 + 6.85, 0); gs.push(b);
        var b2 = new THREE.CylinderGeometry(0.05, 0.05, 7.4, 6); b2.rotateZ(Math.PI / 2); b2.translate(0, 0.6 + 6.3, 0); gs.push(b2);
        gs = gs.map(function (g) { g = g.index ? g.toNonIndexed() : g; for (var k in g.attributes) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k); return g; });
        return A.BufferGeometryUtils.mergeGeometries(gs);
    })();
    var portalMat = litMat([0.05, 0.05, 0.052], 0.6, [0.2, 0.2, 0.2], 0.0, false);
    portalMat.defines.NO_LIGHTS = 1; portalMat.defines.FADE = 1;
    portalMat.uniforms.uFadeFar = { value: 4500 };
    portalMat.uniforms.uUnder.value.set(0.02, 0.015, 0.01);
    var NPORTAL = 900;
    var portals = new THREE.InstancedMesh(portalGeo, portalMat, NPORTAL);
    portals.instanceMatrix.setUsage(THREE.DynamicDrawUsage); portals.frustumCulled = false; portals.count = 0; sideGroup.add(portals);

    // 電車の 1 両: 断面（裾をすぼめ、屋根の肩を丸めた）を 20 m 押し出した車体＋屋根の冷房装置＋床下機器＋パンタグラフ
    var carGeo = (function () {
        var parts = [];
        function tag(g, part) {
            g = g.index ? g.toNonIndexed() : g;
            for (var k in g.attributes) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
            var n = g.attributes.position.count, a = new Float32Array(n); a.fill(part);
            g.setAttribute('aPart', new THREE.BufferAttribute(a, 1));
            parts.push(g);
        }
        var hw = 1.475, sh = new THREE.Shape();
        sh.moveTo(-hw * 0.94, 0.95); sh.lineTo(hw * 0.94, 0.95); sh.lineTo(hw, 1.2); sh.lineTo(hw, 3.25);
        for (var i = 1; i <= 6; i++) { var a = i / 6 * Math.PI / 2; sh.lineTo(1.1 + (hw - 1.1) * Math.cos(a), 3.25 + 0.33 * Math.sin(a)); }
        sh.lineTo(0, 3.62);
        for (var i2 = 6; i2 >= 0; i2--) { var a2 = i2 / 6 * Math.PI / 2; sh.lineTo(-(1.1 + (hw - 1.1) * Math.cos(a2)), 3.25 + 0.33 * Math.sin(a2)); }
        sh.lineTo(-hw, 1.2);
        var body = new THREE.ExtrudeGeometry(sh, { depth: CAR_LEN, bevelEnabled: false, curveSegments: 1 });
        body.computeVertexNormals();
        tag(body, 0);
        // 冷房装置（角を落とした箱）
        var acS = new THREE.Shape(); var aw = 0.9, ah = 0.36, c = 0.08;
        acS.moveTo(-aw, 0); acS.lineTo(aw, 0); acS.lineTo(aw, ah - c); acS.lineTo(aw - c, ah); acS.lineTo(-aw + c, ah); acS.lineTo(-aw, ah - c);
        var ac = new THREE.ExtrudeGeometry(acS, { depth: 2.8, bevelEnabled: false }); ac.translate(0, 3.56, CAR_LEN / 2 - 1.4);
        tag(ac, 1);
        // 床下: 台車 2 個と機器箱 3 個
        [2.6, 17.4].forEach(function (z) { var b = new THREE.BoxGeometry(2.3, 0.75, 2.6); b.translate(0, 0.5, z); tag(b, 2); });
        [6.4, 10.0, 13.6].forEach(function (z) { var b = new THREE.BoxGeometry(2.2, 0.45, 2.8); b.translate(0, 0.7, z); tag(b, 2); });
        // パンタグラフ（菱形の細い腕と、横方向の集電舟）
        function bar(p, q, r) {
            var d = new THREE.Vector3().subVectors(q, p), len = d.length();
            var g = new THREE.CylinderGeometry(r, r, len, 5);
            g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()));
            g.translate((p.x + q.x) / 2, (p.y + q.y) / 2, (p.z + q.z) / 2);
            tag(g, 3);
        }
        var zc = 4.2, V3 = function (x, y, z) { return new THREE.Vector3(x, y, z); };
        [-0.35, 0.35].forEach(function (x) {
            var b0 = V3(x, 3.72, zc), l = V3(x, 4.3, zc - 0.75), t = V3(x, 4.9, zc), r = V3(x, 4.3, zc + 0.75);
            bar(b0, l, 0.025); bar(l, t, 0.02); bar(t, r, 0.02); bar(r, b0, 0.025);
        });
        bar(V3(-0.85, 4.92, zc), V3(0.85, 4.92, zc), 0.035);
        bar(V3(-0.6, 3.68, zc - 0.6), V3(0.6, 3.68, zc - 0.6), 0.04); bar(V3(-0.6, 3.68, zc + 0.6), V3(0.6, 3.68, zc + 0.6), 0.04);
        return A.BufferGeometryUtils.mergeGeometries(parts);
    })();
    var NTRAINCAR = 640;
    carGeo.setAttribute('aCarInfo', new THREE.InstancedBufferAttribute(new Float32Array(NTRAINCAR * 4), 4).setUsage(THREE.DynamicDrawUsage));
    carGeo.setAttribute('aBand', new THREE.InstancedBufferAttribute(new Float32Array(NTRAINCAR * 3), 3).setUsage(THREE.DynamicDrawUsage));
    var trainMat = new THREE.ShaderMaterial({
        vertexShader: S.trainVert, fragmentShader: S.trainFrag,
        uniforms: uni({ uTrainAmb: { value: new THREE.Vector3(0.22, 0.20, 0.18) }, uFadeFar: { value: RAIL_FADE } })
    });
    var trainCars = new THREE.InstancedMesh(carGeo, trainMat, NTRAINCAR);
    trainCars.instanceMatrix.setUsage(THREE.DynamicDrawUsage); trainCars.frustumCulled = false; trainCars.count = 0; sideGroup.add(trainCars);
    // 電車の光が線路脇に落ちる帯・前照灯の前方の光だまり
    var tglowGeo = new THREE.PlaneGeometry(2, 1); tglowGeo.rotateX(-Math.PI / 2); tglowGeo.translate(0, 0, 0.5);
    var NTGLOW = 720;
    tglowGeo.setAttribute('aKind', new THREE.InstancedBufferAttribute(new Float32Array(NTGLOW), 1).setUsage(THREE.DynamicDrawUsage));
    tglowGeo.setAttribute('aFadeG', new THREE.InstancedBufferAttribute(new Float32Array(NTGLOW), 1).setUsage(THREE.DynamicDrawUsage));
    var tglowMat = new THREE.ShaderMaterial({
        vertexShader: S.tglowVert, fragmentShader: S.tglowFrag, transparent: true,
        blending: THREE.AdditiveBlending, depthWrite: false, depthTest: true,
        uniforms: uni({ uGain: { value: 1.0 }, uFadeFar: { value: RAIL_FADE } })
    });
    var tglows = new THREE.InstancedMesh(tglowGeo, tglowMat, NTGLOW);
    tglows.instanceMatrix.setUsage(THREE.DynamicDrawUsage); tglows.frustumCulled = false; tglows.count = 0; tglows.renderOrder = 6; sideGroup.add(tglows);
    // 前照灯・尾灯・信号・保守用の灯（点光、距離でフェード）
    var railPts = worldPts(3000, 5, RAIL_FADE);

    // 路盤と架線柱（世界固定）は沿道と同じタイミングで書き直す
    function writeRailStatic() {
        var gy = GROUND_Y - anchor.y, nb = 0, np = 0;
        for (var kk in railCache) {
            var L = railCache[kk];
            if (L.par || lineDist(L, O.x, O.z) > RAIL_FADE + 200) continue;
            var phi = Math.atan2(L.dx, L.dz);
            tmpQ.setFromAxisAngle(yAxis, phi);
            if (nb < NRAILBED) {
                tmpV.set(L.cx - L.dx * RAIL_HALF - anchor.x, gy + 0.03, L.cz - L.dz * RAIL_HALF - anchor.z);
                tmpM.compose(tmpV, tmpQ, tmpS2.set(1, 1, RAIL_HALF * 2)); railbeds.setMatrixAt(nb++, tmpM);
            }
            for (var u = -3500; u <= 3500 && np < NPORTAL; u += 50) {
                var px = L.cx + L.dx * u, pz = L.cz + L.dz * u;
                var ddx = px - O.x, ddz = pz - O.z;
                if (ddx * ddx + ddz * ddz > 4600 * 4600) continue;
                tmpV.set(px - anchor.x, gy, pz - anchor.z);
                tmpM.compose(tmpV, tmpQ, tmpS); portals.setMatrixAt(np++, tmpM);
            }
        }
        railbeds.count = nb; portals.count = np;
        railbeds.instanceMatrix.needsUpdate = true; portals.instanceMatrix.needsUpdate = true;
    }

    // 電車の位置は時刻から決定的に決める（各線路の上下 2 方向、間隔 D で等間隔に走り続ける）

    // === 並走する高架線（v5）: 道路の道のり s に沿って、横位置 lat(s) と高さ h(s) を持つ複線 ===========================
    // 区間: 両端の先 2500 m（lat 170、地面）→ 接近（lat 170→27、地面→道路 −0.4 m）→ 並走（lat 27）→ 離脱 → 両端の先。
    // 経路は道のり 10 m ごとの折れ線。同じ seed で並走線専用に先行して回す軌道から作る（線路用の先行と追い越し合わないように別に持つ）
    var PAR_KEEP = 17000;                                                 // 並走線を必ず捨てる距離（区間の終わりから）
    var PAR_LAT_RUN = 27, PAR_LAT_FAR = 170, PAR_EXT = 1200, PAR_STEP = 10, PAR_HALF_W = 5.2, PAR_GRID = 80;   // v6.1: 両端の先 2.5 km → 1.2 km（並走線を増やすため）
    var parTrack = new global.TwTrack({ segLen: P.segLen, curveGain: curveGain, hillGain: hillGain, bankGain: bankGain, seed: seed });
    var parStations = [], parSkip = {}, parJ0 = 0, parKept = {};
    var parSideEnd = { '-1': -1e9, '1': -1e9 }, parSideN = [0, 0], parAnyEnd = -1e9;   // parAnyEnd: 反対側でも並走区間（接近〜離脱）は重ねない                          // v6.1: 左右それぞれ最後に採用した並走線の終わり（同じ側では区間を重ねない）
    // 道路の中心線の記録（道のり 20 m ごと、起動から全部）。並走線と「その線が存在する間に見えうる道路」との重なりを調べるのに使う
    var roadRecX = [], roadRecZ = [];
    function recordRoad() {
        var T = parTrack, MK = T.a.length - 1;
        while ((roadRecX.length) * 20 <= T.last - 2) { var ix = (roadRecX.length * 20) & MK; roadRecX.push(T.px[ix]); roadRecZ.push(T.pz[ix]); }
    }
    function parStation(j) {
        while (parStations.length <= j) {
            var n = parStations.length, prev = n === 0 ? 1500 : parStations[n - 1];
            parStations.push(prev + 3500 + 2500 * gapHash(n, 61));          // v6.1: 7〜12 km → 3.5〜6 km ごと（同じ側の前の線と重なる時は後ろへずらす）
        }
        return parStations[j];
    }
    function sstep(x) { x = Math.max(0, Math.min(1, x)); return x * x * x * (x * (x * 6 - 15) + 10); }   // smootherstep
    function crossNear(a, b) {                                            // くぐる線の交差点が [a, b] の 600 m 以内にあるか
        for (var k = 0; railStation(k) < b + 600; k++) if (railStation(k) > a - 600) return true;
        return false;
    }
    function genPar(j, flip, shift) {
        var T = parTrack, MK = T.a.length - 1;
        var side = gapHash(j, 62) < 0.75 ? -1 : 1;                        // 左 75%（視点が左側車道なのでよく見える）
        if (flip) side = -side;                                          // v6.1: 道路の構造物と重なる等で使えない時は反対側で試す
        var runLen = 1200 + 1200 * gapHash(j, 63);   // v8: IC の間に収まるよう短く（1.2〜2.4 km）
        var sA = Math.ceil((Math.max(parStation(j), parSideEnd[side] + 200 + PAR_EXT, parAnyEnd + 300) + (shift || 0)) / PAR_STEP) * PAR_STEP, ok = false, LA = 900, sR = 0, sE = 0, sL = 0;
        for (var tr = 0; tr < 40 && !ok; tr++, sA += 200) {
            T.ensure(sA + 9000); recordRoad();
            // 高さの差から接近区間の長さを決める（smootherstep の最大勾配 1.875 倍で 3% 以内）
            var dh = Math.max(0, (T.py[(sA + 900) & MK] - 0.4) - (P.groundY + 0.6));
            LA = Math.min(1800, Math.max(900, Math.ceil(1.875 * dh / 0.028 / PAR_STEP) * PAR_STEP));
            sR = sA + LA; sE = sR + Math.round(runLen / PAR_STEP) * PAR_STEP; sL = sE + LA;
            ok = true;
            // きついカーブで並走線が内側に来る区間を並走区間に含めない（カーブ値 4 = 道路の半径 169 m、内側の線路は 142 m になる）。
            // この道はカーブが 1〜2 km おきに来るので、設計の「半径 250 m 未満は不可」では並走区間が収まらない
            for (var s = sR - 100; s <= sE + 100 && ok; s += 5) { var av = T.a[s & MK]; if (Math.abs(av) >= 4 && av * side > 0) ok = false; }
            // v8: 並走線も IC の区間を一律には避けず、ランプとの離隔を形で調べる（parHitsRamp）
        }
        if (!ok) return null;
        var s0 = sA - PAR_EXT, s1 = sL + PAR_EXT;
        T.ensure(s1 + PAR_KEEP + P.viewLen + 1000); recordRoad();
        var n = Math.round((s1 - s0) / PAR_STEP) + 1;
        var X = new Float64Array(n), Y = new Float64Array(n), Z = new Float64Array(n), CUM = new Float64Array(n), H = new Float32Array(n);
        function roadSmoothY(s) { var a = 0, c = 0; for (var d = -100; d <= 100; d += 10) { a += T.py[Math.max(0, s + d) & MK]; c++; } return a / c; }
        var gR = P.groundY + 0.6;
        // 横位置: 区間ごとの値を、内側のカーブでは半径の 0.6 倍までに抑え（折れ線が折り返さないように）、±100 m でならす
        var latRaw = new Float64Array(n), latS = new Float64Array(n);
        for (var i0 = 0; i0 < n; i0++) {
            var sq0 = s0 + i0 * PAR_STEP;
            var f0 = sq0 < sR ? sstep((sq0 - sA) / LA) : (sq0 <= sE ? 1 : sstep(1 - (sq0 - sE) / LA));
            var lt = PAR_LAT_FAR + (PAR_LAT_RUN - PAR_LAT_FAR) * f0;
            var am = 0; for (var dd = -60; dd <= 60; dd += 10) am += T.a[(sq0 + dd) & MK]; am /= 13;
            if (am * side > 0) lt = Math.min(lt, 0.6 / (Math.abs(am) * curveGain));
            latRaw[i0] = Math.max(PAR_LAT_RUN, lt);
        }
        for (var i1 = 0; i1 < n; i1++) { var acc = 0, cnt = 0; for (var k1 = -10; k1 <= 10; k1++) { var ii = Math.max(0, Math.min(n - 1, i1 + k1)); acc += latRaw[ii]; cnt++; } latS[i1] = acc / cnt; }
        for (var i = 0; i < n; i++) {
            var s2 = s0 + i * PAR_STEP, ix = s2 & MK;
            var f = s2 < sR ? sstep((s2 - sA) / LA) : (s2 <= sE ? 1 : sstep(1 - (s2 - sE) / LA));
            var lat = latS[i];
            var th = T.th[ix], rx = Math.cos(th), rz = Math.sin(th);
            X[i] = T.px[ix] + rx * side * lat; Z[i] = T.pz[ix] + rz * side * lat;
            Y[i] = gR + ((roadSmoothY(s2) - 0.4) - gR) * f;
            H[i] = Y[i] - P.groundY;                                       // 地面からのレール面の高さ
            if (i) { var ddx = X[i] - X[i - 1], ddz = Z[i] - Z[i - 1]; CUM[i] = CUM[i - 1] + Math.sqrt(ddx * ddx + ddz * ddz); }
        }
        // 線路の勾配を 3% 以内に: 前後 2 回の制限（丘では道路の高さから少しずれるのを許す）。地面より下にはしない
        for (var ip = 1; ip < n; ip++) { var gdx = 0.03 * (CUM[ip] - CUM[ip - 1]); Y[ip] = Math.max(Y[ip - 1] - gdx, Math.min(Y[ip - 1] + gdx, Y[ip])); }
        for (var iq = n - 2; iq >= 0; iq--) { var gdx2 = 0.03 * (CUM[iq + 1] - CUM[iq]); Y[iq] = Math.max(Y[iq + 1] - gdx2, Math.min(Y[iq + 1] + gdx2, Y[iq])); }
        for (var ir = 0; ir < n; ir++) { Y[ir] = Math.max(Y[ir], gR); H[ir] = Y[ir] - P.groundY; }
        var L = { par: true, nc: pickCars(gapHash(j, 69)), j: j, side: side, s0: s0, s1: s1, sA: sA, sR: sR, sE: sE, sL: sL, sc: (sR + sE) / 2, n: n, X: X, Y: Y, Z: Z, CUM: CUM, H: H,
                  col: BAND_COLS[Math.floor(gapHash(j, 64) * 5) % 5], v: (68 + 10 * gapHash(j, 65)) / 3.6, D: [6000 + 3000 * gapHash(j, 66), 6000 + 3000 * gapHash(j, 67)], ph: [0, gapHash(j, 68) * 3000] };
        // 勾配の最大値（selftest 用）
        var gmax = 0; for (var i2 = 1; i2 < n; i2++) gmax = Math.max(gmax, Math.abs(Y[i2] - Y[i2 - 1]) / Math.max(1e-3, CUM[i2] - CUM[i2 - 1])); L.gmax = gmax;
        // 格子（80 m）: 各セルに入る線分の番号
        L.grid = new Map(); L.minX = 1e18; L.maxX = -1e18; L.minZ = 1e18; L.maxZ = -1e18;
        for (var i3 = 0; i3 < n - 1; i3++) {
            var cx0 = Math.floor(Math.min(X[i3], X[i3 + 1]) / PAR_GRID), cx1 = Math.floor(Math.max(X[i3], X[i3 + 1]) / PAR_GRID);
            var cz0 = Math.floor(Math.min(Z[i3], Z[i3 + 1]) / PAR_GRID), cz1 = Math.floor(Math.max(Z[i3], Z[i3 + 1]) / PAR_GRID);
            for (var gx = cx0; gx <= cx1; gx++) for (var gz = cz0; gz <= cz1; gz++) { var key = gx * 1000003 + gz, a2 = L.grid.get(key); if (!a2) { a2 = []; L.grid.set(key, a2); } a2.push(i3); }
            L.minX = Math.min(L.minX, X[i3]); L.maxX = Math.max(L.maxX, X[i3]); L.minZ = Math.min(L.minZ, Z[i3]); L.maxZ = Math.max(L.maxZ, Z[i3]);
        }
        // 道路の構造物との重なり: 高架部分（レール面が地面から 1 m 超）が、自分の地点から 200 m 以上離れた道路の中心線の 20 m 以内に入らない
        // 調べる道路: いまのカメラの少し後ろから、この線が捨てられる（s1 + 3000 をカメラが過ぎる）までに見えうる先端まで
        L.roadHit = 0;
        for (var rs = Math.max(0, Math.floor((sCam - 100) / 20) * 20); rs <= s1 + PAR_KEEP + P.viewLen + 200; rs += 20) {
            var rk = rs / 20; if (rk >= roadRecX.length) break;
            var rxw = roadRecX[rk], rzw = roadRecZ[rk];
            var nearI = parNearest(L, rxw, rzw, 20 + PAR_HALF_W);
            if (nearI.d < 9.75 + PAR_HALF_W + 5 && L.H[nearI.i] > 1.0 && Math.abs(s0 + nearI.i * PAR_STEP - rs) > 200) L.roadHit++;
        }
        // 並走区間では必ず 2 回電車と出会う（v6.1）: 逆向きの電車と並走区間の始め（sR + 50 m）ですれ違い、
        // 同じ向きの電車は並走区間の終わり（sE − 30 m）で追い越し終える（追い越す 45 秒ほど前から前方に見える）。
        // 時刻はカメラがその道のりに着く見込み（いまの速さのまま走った場合）
        var spd = speed > 0 ? speed : 27.8, tc0 = trainClock || 0;
        var iSame = Math.round((sE - 30 - s0) / PAR_STEP), tSame = tc0 + (sE - 30 - sCam) / spd;
        L.ph[0] = (((CUM[iSame] + 10 - L.v * tSame) % L.D[0]) + L.D[0]) % L.D[0];
        var iOpp = Math.round((sR + 50 - s0) / PAR_STEP), tOpp = tc0 + (sR + 50 - sCam) / spd, totP = CUM[n - 1];
        L.ph[1] = (((totP - CUM[iOpp] - L.v * tOpp) % L.D[1]) + L.D[1]) % L.D[1];
        return L;
    }
    // 折れ線への最近点（lim より遠い候補しか無ければ d = 1e9）
    function parNearest(L, x, z, lim) {
        var best = { d: 1e9, i: 0 };
        if (x < L.minX - lim - PAR_GRID || x > L.maxX + lim + PAR_GRID || z < L.minZ - lim - PAR_GRID || z > L.maxZ + lim + PAR_GRID) return best;
        var gx = Math.floor(x / PAR_GRID), gz = Math.floor(z / PAR_GRID), R = Math.ceil(lim / PAR_GRID);
        for (var ax = -R; ax <= R; ax++) for (var az = -R; az <= R; az++) {
            var a = L.grid.get((gx + ax) * 1000003 + gz + az); if (!a) continue;
            for (var q2 = 0; q2 < a.length; q2++) {
                var i = a[q2], x0 = L.X[i], z0 = L.Z[i], ex = L.X[i + 1] - x0, ez = L.Z[i + 1] - z0;
                var t = ((x - x0) * ex + (z - z0) * ez) / Math.max(1e-6, ex * ex + ez * ez); t = Math.max(0, Math.min(1, t));
                var dx = x - (x0 + ex * t), dz = z - (z0 + ez * t), d = Math.sqrt(dx * dx + dz * dz);
                if (d < best.d) { best.d = d; best.i = t < 0.5 ? i : i + 1; }
            }
        }
        return best;
    }
    function parDistFar(L, x, z) {                                       // 遠い判定用（カメラからの距離など）: 粗い全走査
        var best = 1e18;
        for (var i = 0; i < L.n; i += 10) { var dx = L.X[i] - x, dz = L.Z[i] - z, d = dx * dx + dz * dz; if (d < best) best = d; }
        return Math.sqrt(best);
    }
    function parHitsRiver(L) {
        for (var j = 0; j < L.n; j += 2) if (riverDist(L.X[j], L.Z[j]) < 10 + PAR_HALF_W) return true;
        return false;
    }
    function parHitsRamp(L) {
        for (var i = 0; i < icList.length; i++) {
            var ic = icList[i]; if (!ic.ramps) continue;
            for (var k = 0; k < 4; k++) {
                var R = ic.ramps[k];
                if (R.maxX < L.minX - 50 || R.minX > L.maxX + 50 || R.maxZ < L.minZ - 50 || R.minZ > L.maxZ + 50) continue;
                for (var j = 0; j < R.n; j++) if (parNearest(L, R.X[j], R.Z[j], 30).d < RAIL_CLEAR + 5 + PAR_HALF_W) return true;
            }
        }
        return false;
    }
    function parHitsPar(L) {                                              // ほかの並走線の中心線から 25 m 以内を通るか
        for (var kk in railCache) {
            var M = railCache[kk]; if (!M.par) continue;
            if (L.maxX < M.minX - 40 || L.minX > M.maxX + 40 || L.maxZ < M.minZ - 40 || L.minZ > M.maxZ + 40) continue;
            for (var i = 0; i < L.n; i += 3) if (parNearest(M, L.X[i], L.Z[i], 25).d < 25) return true;
        }
        return false;
    }
    // === v8: インターチェンジ（IC）の出入口と予告標識 =====================================================
    // IC は絶対の道のりで決定的に決める（最初は 3〜4 km 先、以後 6〜10 km ごと）。並走線・くぐる線・補修区間・開口部より先に決め、それらが IC を避ける。
    // 1 か所: 予告 2 km・1 km・500 m → 出口（すりつけ 60 m + 平行 100 m → ノーズ）→ 400〜700 m 先に入口（ノーズ → 平行 180 m + すりつけ 60 m）。
    // 反対車線（右）にも鏡写しに出口・入口（自車から見ると右は入口が手前・出口が奥）
    // IC 名・行き先は佐渡の地名から
    var IC_NAMES = [['両津', 'Ryotsu'], ['相川', 'Aikawa'], ['佐和田', 'Sawata'], ['金井', 'Kanai'], ['新穂', 'Niibo'],
        ['畑野', 'Hatano'], ['真野', 'Mano'], ['小木', 'Ogi'], ['羽茂', 'Hamochi'], ['赤泊', 'Akadomari'],
        ['河原田', 'Kawarada'], ['八幡', 'Yawata'], ['沢根', 'Sawane'], ['二見', 'Futami'], ['加茂', 'Kamo'],
        ['吉井', 'Yoshii'], ['秋津', 'Akitsu'], ['梅津', 'Umetsu'], ['潟上', 'Katagami'], ['長木', 'Nagaki']];
    var IC_DEST = [['夷', 'Ebisu'], ['湊', 'Minato'], ['住吉', 'Sumiyoshi'], ['宿根木', 'Shukunegi'], ['鷲崎', 'Washizaki'],
        ['達者', 'Tassha'], ['姫津', 'Himezu'], ['稲鯨', 'Inakujira'], ['真更川', 'Masarakawa'], ['岩谷口', 'Iwayaguchi'],
        ['松ヶ崎', 'Matsugasaki'], ['多田', 'Tada'], ['徳和', 'Tokuwa'], ['野浦', 'Noura'], ['片野尾', 'Katanoo'],
        ['椿', 'Tsubaki'], ['豊岡', 'Toyooka'], ['国仲', 'Kuninaka'], ['外海府', 'Sotokaifu'], ['内海府', 'Uchikaifu']];
    var EX_TAPER = 60, EX_PAR = 100, EN_PAR = 180, EN_TAPER = 60, RAMP_STEP = 5, LANE_C = 9.85, MAIN_EDGE = P.roadHalf;
    var icList = [], icBuilt = 0, icWhy = {};
    function icCurveOk(T, a, b, rMin) {                                  // [a, b] の曲率半径が rMin 以上
        var MK = T.a.length - 1, lim = 1 / ((rMin || P.icMinR) * curveGain) + 1e-6;   // 密着区間（減速車線・加速車線）の曲率
        for (var s = Math.floor(a); s <= b; s += 5) if (Math.abs(T.a[s & MK]) > lim) return false;
        return true;
    }
    function icZone(ic) { return [ic.s2k - 200, ic.sEnd + 300]; }       // 標識から入口の端まで（他の物が避ける範囲）
    function icNear(s, margin) {                                         // s が IC の区間（± margin）にあるか
        for (var i = 0; i < icList.length; i++) { var z = icList[i]; if (s > z.zA - margin && s < z.zB + margin) return z; }
        return null;
    }
    function ensureICs(upTo) {
        var T = parTrack;
        while (!icList.length || icList[icList.length - 1].sEx0 < upTo) {
            var n = icList.length, prev = n ? icList[n - 1] : null;
            var sEx0 = n === 0 ? 3000 + 1000 * gapHash(n, 81) : prev.sEx0 + 6000 + 4000 * gapHash(n, 81);
            sEx0 = Math.round(sEx0 / 4) * 4 + 1;
            var gapEnt = 1050 + 250 * gapHash(n, 82), ok = false;   // 出口のノーズから入口のノーズまで（設計は 400〜700 m。高さ 23 m を 6% 以内で下りて上るランプが重ならない長さ）
            var half = null, nHalf = icList.filter(function (q2) { return q2.half; }).length;
            for (var tr = 0; tr < 60 && !ok; tr++) {
                // v9 の後: 18 回（約 5 km）置けなければ、出口だけ・入口だけのハーフ IC も試す（全体の 2 割まで）
                half = (tr >= 18 && (nHalf + 1) <= 0.2 * (n + 1)) ? (tr % 3 === 1 ? 'exit' : tr % 3 === 2 ? 'entry' : null) : null;
                var sN1 = sEx0 + EX_TAPER + EX_PAR, sN2 = sN1 + gapEnt, sEnd0 = sN2 + EN_PAR + EN_TAPER;
                T.ensure(sEnd0 + 7000); recordRoad();
                var rMinT = tr < 10 ? P.icMinR : tr < 24 ? 160 : 120;              // 置けない区間が続いたら、曲率半径の下限を 220 → 160 → 120 m と段階的に下げる
                ok = icCurveOk(T, sEx0 - 50, sN1 + 50, rMinT) && icCurveOk(T, sN2 - 50, sEnd0 + 50, rMinT); var why = ok ? '' : 'curve';
                if (ok) {                                                    // ランプの勾配 6% 以内・曲率半径 80 m 以上を確かめる
                    var icT = { n: n, sEx0: sEx0, sN1: sN1, sN2: sN1 + Math.round(gapEnt / 4) * 4, half: half };
                    icT.sEnd = icT.sN2 + EN_PAR + EN_TAPER;
                    buildICRamps(icT);
                    for (var rk = 0; rk < 4; rk++) if (icT.ramps[rk].gmax > 0.06 || icT.ramps[rk].rmin < 80) { ok = false; why = 'geom'; }
                    if (ok && (rampsClash(icT.ramps[0], icT.ramps[1]) || rampsClash(icT.ramps[2], icT.ramps[3]))) { ok = false; why = 'clash'; }
                    if (ok && icT.ramps.some(rampHitsRoad)) { ok = false; why = 'road'; }
                    if (ok && icT.ramps.some(function (R) { for (var q = 0; q < R.n; q += 3) for (var kk in railCache) { var LQ = railCache[kk]; if (lineDist(LQ, R.X[q], R.Z[q]) < RAIL_CLEAR + 3.5 && (LQ.par || R.Y[q] - 2.2 < P.groundY + RAIL_Y + 6.5)) return true; } return false; })) { ok = false; why = 'rail'; }   // 先に決めた線路（道路が戻ってくる所）と寄らない
                    // （ランプは道のりで近づいた時に作るので、いまのカメラの近くを通っても突然は現れない。この条件は外した）
                }
                if (!ok) icWhy[why] = (icWhy[why] || 0) + 1;
                if (!ok && !(half && tr % 3 === 1)) sEx0 += 300;              // ハーフ IC の 2 通りは同じ位置で試す
            }
            var ic = { n: n, sEx0: sEx0, sN1: sEx0 + EX_TAPER + EX_PAR, ok: ok, no: 3 + n, half: ok ? half : null,
                       name: IC_NAMES[Math.floor(gapHash(n, 83) * IC_NAMES.length) % IC_NAMES.length],
                       d1: IC_DEST[Math.floor(gapHash(n, 84) * IC_DEST.length) % IC_DEST.length],
                       d2: IC_DEST[Math.floor(gapHash(n, 85) * IC_DEST.length) % IC_DEST.length] };
            if (ic.d2 === ic.d1) ic.d2 = IC_DEST[(IC_DEST.indexOf(ic.d1) + 7) % IC_DEST.length];
            ic.sN2 = ic.sN1 + Math.round(gapEnt / 4) * 4;
            ic.sEnd = ic.sN2 + EN_PAR + EN_TAPER;
            ic.s2k = ic.sEx0 - 2000;
            if (ok) { buildICRamps(ic); purgeForRamps(ic); }
            var zz = icZone(ic); ic.zA = Math.min(zz[0], ic.rampSA !== undefined ? ic.rampSA - 300 : zz[0]); ic.zB = Math.max(zz[1], ic.rampSB !== undefined ? ic.rampSB + 300 : zz[1]);
            icList.push(ic);
        }
    }
    // ランプの中心線を作る（世界座標）。side = −1 左 / +1 右、div = +1 ノーズから道のりの増える向きへ離れる / −1 減る向きへ離れる。
    // attach = ノーズから本線に沿って密着している長さ（すりつけ区間は本線から遠い端）。
    var rsS = { x: 0, y: 0, z: 0, th: 0, bank: 0, slope: 0 };
    function buildRamp(ic, side, div, sNose, attach, taper, k) {
        var T = parTrack, rows = [];
        var latEnd = 60 + 50 * gapHash(ic.n * 4 + k, 86), Llat = 350 + 150 * gapHash(ic.n * 4 + k, 87);
        var Rarc = 100 + 50 * gapHash(ic.n * 4 + k, 88);
        T.sample(sNose, rsS); var H0 = rsS.y - P.groundY;
        var Ldesc = H0 / 0.057 + 80, fB = 80 / Ldesc;                      // 勾配 5.7% ＋ 前後 40 m の縦曲線（最大 5.7%）
        function drop(u) {                                               // ノーズからの弧長 u での下がり量
            var x = Math.max(0, Math.min(1, u / Ldesc)), f = fB / 2, m = 1 / (1 - f), v;
            if (x < f) v = m * x * x / (2 * f); else if (x > 1 - f) { var y = 1 - x; v = 1 - m * y * y / (2 * f); } else v = m * (x - f / 2);
            return H0 * v;
        }
        // 密着部分（本線の道のり順に、ノーズから遠い端 → ノーズ）
        for (var a = attach; a >= 0; a -= RAMP_STEP) {
            var s = sNose - div * a; T.sample(s, rsS);
            var tp = Math.min(1, a <= attach - taper ? 1 : (attach - a) / taper);   // すりつけ（遠い端で 0）
            rows.push({ s: s, lat: LANE_C, cx: rsS.x, cz: rsS.z, cy: rsS.y, th: rsS.th, bank: rsS.bank, att: true, tp: tp, u: -a });
        }
        // 離れていく部分は世界座標の曲線: ノーズで本線と同じ向きから、最初の 80 m で曲率を 0 → 1/Rd（緩和曲線）、
        // 420 m まで半径 Rd（500〜700 m。導流帯の三角は約 140 m、420 m で横 100〜140 m 離れる）、その先は半径 Rarc（100〜150 m）で道路から離れる向きに曲がって地上へ。
        // 道路が曲がっていても、ランプは道路から離れる向きにしか曲がらないので折り返さない（曲率半径は 100 m 以上）
        var pts = rows.map(function (r) {
            var rx = Math.cos(r.th), rz = Math.sin(r.th);
            return { x: r.cx + rx * side * r.lat, z: r.cz + rz * side * r.lat, roadY: r.cy, r: r };
        });
        var Rd = 500 + 200 * gapHash(ic.n * 4 + k, 89), Lturn = 420, Ltot = Math.max(Ldesc + 260, Lturn + 150);   // 下りはノーズの先端（約 200 m 先）から
        // 420 m までは本線の道のりに沿った横ずれ（直線の道路なら上の曲線と同じ形）で作る。本線がランプの側へ曲がっていても、ランプは必ず本線から離れていく
        // （世界座標の曲線のままだと、本線がランプ側へ曲がる所で本線が追いつき、ランプが本線の上に食い込んでいた）
        function offL(u) { return u < 80 ? u * u * u / (480 * Rd) : 80 * 80 / (6 * Rd) + 80 * (u - 80) / (2 * Rd) + (u - 80) * (u - 80) / (2 * Rd); }
        var px = pts[pts.length - 1].x, pz = pts[pts.length - 1].z, arcLen = Ltot, hd = 0, dirSgn = 1;
        for (var u = RAMP_STEP; u <= Ltot; u += RAMP_STEP) {
            var s2 = sNose + div * Math.min(u, Lturn); T.sample(s2, rsS);
            if (u <= Lturn) {
                var L2 = LANE_C + offL(u), nx2 = rsS.x + Math.cos(rsS.th) * side * L2, nz2 = rsS.z + Math.sin(rsS.th) * side * L2;
                hd = Math.atan2(nx2 - px, nz2 - pz); px = nx2; pz = nz2;
                if (u + RAMP_STEP > Lturn) { var awX = Math.cos(rsS.th) * side, awZ = Math.sin(rsS.th) * side; dirSgn = (Math.cos(hd) * awX - Math.sin(hd) * awZ) > 0 ? 1 : -1; }
            } else {
                hd += dirSgn * RAMP_STEP / Rarc; px += Math.sin(hd) * RAMP_STEP; pz += Math.cos(hd) * RAMP_STEP;
            }
            var latW = (px - rsS.x) * Math.cos(rsS.th) * side + (pz - rsS.z) * Math.sin(rsS.th) * side;   // 本線の中心から外向きの横距離（導流帯の幅に使う）
            pts.push({ x: px, z: pz, roadY: rsS.y, r: { s: s2, att: false, tp: 1, u: u, arc: u > Lturn, lat: latW, bank: rsS.bank } });
        }
        // 高さ（地上 + 0.2 で止める）と、本線から見た内側の縁（導流帯）の幅
        var gR = P.groundY + 0.2, noseTip = -1, iN = 0, Uc = [0];
        for (var i0 = 0; i0 < pts.length; i0++) { if (pts[i0].r.u <= 0) iN = i0; if (i0) Uc.push(Uc[i0 - 1] + Math.hypot(pts[i0].x - pts[i0 - 1].x, pts[i0].z - pts[i0 - 1].z)); }
        for (var i = 0; i < pts.length; i++) {
            var p = pts[i];
            var gapIn = p.r.att ? 0 : p.r.lat - 2.5 - MAIN_EDGE;            // ランプの内側の路肩の縁と本線の舗装端の間
            p.goreZone = !p.r.att && !p.r.arc && gapIn < 6 && noseTip < 0;   // 本線とランプの間（幅 6 m まで）を導流帯で舗装する
            p.gore = p.goreZone ? Math.max(gapIn, 0) : 0;
            if (noseTip < 0 && !p.r.att && (p.r.arc || gapIn >= 6)) noseTip = i;
        }
        // 高さ: ノーズの先端までは本線と同じ高さ、先端から実際の弧長で 5.7% 以内で地上へ（本線の起伏とは無関係）
        // 本線はカーブで横に傾く（バンク）ので、密着部分とノーズの先端までは本線の傾いた路面の高さに合わせ、ランプの路面・構造も同じ傾きにする（先端から 100 m で水平に戻す）
        var iT = noseTip > 0 ? noseTip : iN;
        for (var ib = 0; ib < pts.length; ib++) { var pb2 = pts[ib]; pb2.sbk = Math.sin(pb2.r.bank || 0) * side; pb2.bf = ib <= iT ? 1 : Math.max(0, 1 - (Uc[ib] - Uc[iT]) / 100); }
        var yT = pts[iT].roadY - pts[iT].sbk * pts[iT].r.lat;
        for (var i2 = 0; i2 < pts.length; i2++) {
            var p2 = pts[i2];
            p2.y = i2 <= iT ? p2.roadY - p2.sbk * p2.r.lat : Math.max(gR, yT - drop(Uc[i2] - Uc[iT]));
            p2.h = p2.y - P.groundY;
        }
        // 弧長の累積と、向き（外向き = 道路から離れる横向き）
        var X = [], Y = [], Z = [], U = [0];
        for (var j = 0; j < pts.length; j++) { X.push(pts[j].x); Y.push(pts[j].y); Z.push(pts[j].z); if (j) U.push(U[j - 1] + Math.hypot(pts[j].x - pts[j - 1].x, pts[j].z - pts[j - 1].z)); }
        var R = { ic: ic, side: side, div: div, k: k, pts: pts, X: X, Y: Y, Z: Z, U: U, n: pts.length, noseTip: noseTip, Rarc: Rarc, H0: H0, Ldesc: Ldesc };
        // 道のりの範囲（他の物が避ける範囲）
        var sMin = 1e18, sMax = -1e18; rows.forEach(function (r) { sMin = Math.min(sMin, r.s); sMax = Math.max(sMax, r.s); });
        R.sMin = sMin - (div < 0 ? arcLen : 0); R.sMax = sMax + (div > 0 ? arcLen : 0);
        // 最寄り点の格子（並走線と同じ）
        R.grid = new Map(); R.minX = 1e18; R.maxX = -1e18; R.minZ = 1e18; R.maxZ = -1e18;
        for (var i3 = 0; i3 < R.n - 1; i3++) {
            var cx0 = Math.floor(Math.min(X[i3], X[i3 + 1]) / PAR_GRID), cx1 = Math.floor(Math.max(X[i3], X[i3 + 1]) / PAR_GRID);
            var cz0 = Math.floor(Math.min(Z[i3], Z[i3 + 1]) / PAR_GRID), cz1 = Math.floor(Math.max(Z[i3], Z[i3 + 1]) / PAR_GRID);
            for (var gx = cx0; gx <= cx1; gx++) for (var gz = cz0; gz <= cz1; gz++) { var key = gx * 1000003 + gz, a2 = R.grid.get(key); if (!a2) { a2 = []; R.grid.set(key, a2); } a2.push(i3); }
            R.minX = Math.min(R.minX, X[i3]); R.maxX = Math.max(R.maxX, X[i3]); R.minZ = Math.min(R.minZ, Z[i3]); R.maxZ = Math.max(R.maxZ, Z[i3]);
        }
        // 勾配の最大と、曲率半径の最小（selftest 用）
        var gmax = 0, rmin = 1e9;
        for (var g = 1; g < R.n; g++) { if (pts[g].r.att || g <= noseTip) continue; var du = Math.max(1e-3, U[g] - U[g - 1]); gmax = Math.max(gmax, Math.abs(Y[g] - Y[g - 1]) / du); }   // 本線に沿う部分（ノーズまで）は本線の勾配なので除く
        for (var c = 2; c < R.n; c++) {
            if (pts[c - 1].r.att) continue;                                   // 本線に沿う部分は本線の曲率
            var h1 = Math.atan2(X[c - 1] - X[c - 2], Z[c - 1] - Z[c - 2]), h2 = Math.atan2(X[c] - X[c - 1], Z[c] - Z[c - 1]);
            var dh = Math.abs(((h2 - h1 + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
            if (dh > 1e-6 && (U[c] - U[c - 2]) / 2 / dh < rmin) { rmin = (U[c] - U[c - 2]) / 2 / dh; R.rminAt = pts[c - 1].r.u + (pts[c - 1].r.arc ? 'a' : '') + '/' + (pts[c - 1].r.lat || 0).toFixed(0); }
        }
        R.gmax = gmax; R.rmin = rmin;
        return R;
    }
    function emptyRamp(k) { return { k: k, n: 0, pts: [], X: [], Y: [], Z: [], U: [0], grid: new Map(), minX: 1e18, maxX: -1e18, minZ: 1e18, maxZ: -1e18, gmax: 0, rmin: 1e9, noseTip: -1, sMin: 1e18, sMax: -1e18, empty: true }; }
    function buildICRamps(ic) {
        // 左（自車側）: 出口（ノーズ sN1、手前に 160 m 密着）、入口（ノーズ sN2、先に 240 m 密着）。右（反対車線）: 同じ道のりに鏡写し
        ic.ramps = [
            buildRamp(ic, -1, +1, ic.sN1, EX_TAPER + EX_PAR, EX_TAPER, 0),
            buildRamp(ic, -1, -1, ic.sN2, EN_PAR + EN_TAPER, EN_TAPER, 1),
            buildRamp(ic, +1, +1, ic.sN1, EN_PAR + EN_TAPER, EN_TAPER, 2),      // 反対車線の入口（向こうの車にとって合流）
            buildRamp(ic, +1, -1, ic.sN2, EX_TAPER + EX_PAR, EX_TAPER, 3)       // 反対車線の出口
        ];
        if (ic.half === 'exit') { ic.ramps[1] = emptyRamp(1); ic.ramps[3] = emptyRamp(3); }        // 出口だけ: 自車側の出口と反対車線側の入口
        if (ic.half === 'entry') { ic.ramps[0] = emptyRamp(0); ic.ramps[2] = emptyRamp(2); }       // 入口だけ: 自車側の入口と反対車線側の出口
        ic.rampSA = Math.min.apply(null, ic.ramps.map(function (R) { return R.sMin; }));
        ic.rampSB = Math.max.apply(null, ic.ramps.map(function (R) { return R.sMax; }));
        // 本線のガードレール・地覆を外す区間（すりつけの始まり 〜 ノーズの先端）
        ic.zoneL = [ic.sEx0, ic.sN1 + noseS(ic.ramps[0]), ic.sN2 - noseS(ic.ramps[1]), ic.sEnd];
        ic.zoneR = [ic.sN1 - EN_PAR - EN_TAPER, ic.sN1 + noseS(ic.ramps[2]), ic.sN2 - noseS(ic.ramps[3]), ic.sN2 + EX_TAPER + EX_PAR];
        if (ic.ramps[0].empty) { ic.zoneL[0] = ic.zoneL[1] = -1e9; } if (ic.ramps[1].empty) { ic.zoneL[2] = ic.zoneL[3] = -1e9; }
        if (ic.ramps[2].empty) { ic.zoneR[0] = ic.zoneR[1] = -1e9; } if (ic.ramps[3].empty) { ic.zoneR[2] = ic.zoneR[3] = -1e9; }
        // 標識（左: 自車用。右: 反対車線用で、自車からは裏面）
        ic.signs = [
            { s: ic.sEx0 - 2000, side: -1, kind: '2km' }, { s: ic.sEx0 - 1000, side: -1, kind: '1km' }, { s: ic.sEx0 - 500, side: -1, kind: '500m' }, { s: ic.sEx0, side: -1, kind: 'exit' },
            { s: ic.zoneR[3] + 2000, side: 1, kind: '2km' }, { s: ic.zoneR[3] + 1000, side: 1, kind: '1km' }, { s: ic.zoneR[3] + 500, side: 1, kind: '500m' }, { s: ic.zoneR[3], side: 1, kind: 'exit' }
        ];
        ic.signs = ic.signs.filter(function (sg) { return sg.side < 0 ? !ic.ramps[0].empty : !ic.ramps[3].empty; });   // 予告標識は出口があるときだけ
        ic.signs.forEach(function (sg) { parTrack.ensure(sg.s + 5); parTrack.sample(sg.s, rsS); sg.x = rsS.x; sg.y = rsS.y; sg.z = rsS.z; sg.th = rsS.th; });
        // 本線の外側のガードレールが途切れる所の袖ビーム（丸みを切れ目の側へ）
        ic.mainEnds = [];
        [[ic.zoneL, -1], [ic.zoneR, 1]].forEach(function (zz) {
            for (var q = 0; q < 4; q++) {
                var s = zz[0][q]; if (s < -1e8) continue; parTrack.sample(s, rsS);
                var rx = Math.cos(rsS.th), rz = Math.sin(rsS.th), lat = zz[1] * (P.railLat + 0.0);
                ic.mainEnds.push({ x: rsS.x + rx * lat, y: rsS.y, z: rsS.z + rz * lat, th: rsS.th, fwd: (q % 2 === 0) ? 1 : -1 });   // 区間の始まりはレールが手前で終わる → 丸みは前へ
            }
        });
    }
    function rampsClash(A, B) {                                          // 同じ側の出口と入口が 14 m 以内に寄るか（密着部分は除く）
        for (var i = 0; i < A.n; i += 2) { if (A.pts[i].r.att) continue; if (parNearest(B, A.X[i], A.Z[i], 14).d < 14 && !B.pts[parNearest(B, A.X[i], A.Z[i], 14).i].r.att) return true; }
        return false;
    }
    function rampHitsRoad(R) {                                           // 自分の区間（ノーズ ± 800 m）以外の道路の中心線から 17 m 以内に入るか
        var sN = R.div > 0 ? R.sMin : R.sMax;
        for (var i = 0; i < R.n; i += 2) {
            if (R.pts[i].r.att) continue;
            for (var rk = Math.max(0, Math.floor((R.sMin - 6000) / 20)); rk < Math.min(roadRecX.length, (R.sMax + 6000) / 20); rk++) {   // 前後 6 km の道路
                var sr = rk * 20, own = Math.abs(sr - (R.div > 0 ? R.sMin + 160 : R.sMax - 240)) < 900;
                if (own && !(R.noseTip > 0 && i > R.noseTip)) continue;            // 自分の区間はノーズの先端より先だけ（本線へ戻ってこないこと）
                var dx = roadRecX[rk] - R.X[i], dz = roadRecZ[rk] - R.Z[i];
                if (dx * dx + dz * dz < (own ? 15 * 15 : 17 * 17)) return true;
            }
        }
        return false;
    }
    // 道路は曲がりくねるので、ずっと先の IC のランプが、もう作った沿道・街区の近くを通ることがある。その物を取り除く（線路の purgeForLine と同じ）
    function purgeForRamps(ic) {
        function dR(x, z, lim) { var b = 1e9; for (var k = 0; k < 4; k++) { var d = parNearest(ic.ramps[k], x, z, lim).d; if (d < b) b = d; } return b; }
        function ok(o, r) { return dR(o.x, o.z, RAIL_CLEAR + r + 1) >= RAIL_CLEAR + r; }
        function diag(o) { return 0.5 * Math.sqrt(o.w * o.w + o.d * o.d); }
        for (var ck in chunkCache) {
            var ch = chunkCache[ck];
            ch.houses = ch.houses.filter(function (o) { return ok(o, diag(o)); });
            ch.bldgs = ch.bldgs.filter(function (o) { return ok(o, o.rad || diag(o)); });
            ch.trees = ch.trees.filter(function (o) { return ok(o, 0.45 * Math.max(o.sx, o.sz)); });
            ch.lights = ch.lights.filter(function (o) { return ok(o, o.pool ? POOL_R : 0); });
        }
        for (var bk in blockCache) {
            var b = blockCache[bk];
            b.bldgs = b.bldgs.filter(function (o) { return ok(o, diag(o)); });
            b.pts = b.pts.filter(function (o) { return ok(o, 0); });
        }
    }
    function noseS(R) {
        if (R.empty) return 0; var t = R.pts[Math.max(0, R.noseTip)]; return t ? Math.max(0, t.r.u) : 0; }
    function rampNear(x, z, lim) {                                         // ランプの中心線への最短距離（lim より遠ければ 1e9）
        var best = 1e9;
        for (var i = 0; i < icList.length; i++) {
            var ic = icList[i]; if (!ic.ramps) continue;
            for (var k = 0; k < 4; k++) { var d = parNearest(ic.ramps[k], x, z, lim).d; if (d < best) best = d; }
        }
        return best;
    }
    // === v9: 高架の側面の区間（A 壁高欄 45%・B 遮音壁 35%・C 鋼製高欄の橋 15%・D ガードレール 5%）。左右で独立に、絶対の道のりで決定的に ===
    var SEC_W = [[0, 0.45, 300, 2000], [1, 0.35, 300, 1500], [2, 0.15, 80, 400], [3, 0.05, 100, 300]];
    var secTrack = new global.TwTrack({ segLen: P.segLen, curveGain: curveGain, hillGain: hillGain, bankGain: bankGain, seed: seed });
    var secs = { '-1': [], '1': [] }, rivers = [], RIV_HALF = 600, groads = [], GR_HALF = 400;   // 川は橋の前後 600 m だけ描く（先は暗い地面に溶かす）
    function ensureSecs(upTo) {
        [-1, 1].forEach(function (side) {
            var L = secs[side];
            while (!L.length || L[L.length - 1].s1 < upTo) {
                var n = L.length, s0 = n ? L[n - 1].s1 : 0, h = gapHash(n * 2 + (side > 0 ? 1 : 0), 91), acc = 0, ty = 0;
                for (var i = 0; i < 4; i++) { acc += SEC_W[i][1]; if (h < acc) { ty = SEC_W[i][0]; break; } }
                if (n && L[n - 1].ty === ty) ty = ty === 0 ? 1 : 0;                       // 同じ種類が続かないように
                var W = SEC_W[ty], len = W[2] + (W[3] - W[2]) * gapHash(n * 2 + (side > 0 ? 1 : 0), 92);
                var o = { s0: s0, s1: Math.round(s0 + len), ty: ty, side: side, H: [2.0, 2.5, 3.0][Math.floor(gapHash(n * 7 + side, 93) * 3) % 3],
                          vr: gapHash(n * 7 + side, 94), rv: gapHash(n * 7 + side, 95) };
                L.push(o);
                // 橋（C）の 6 割の下に川。両側の区間で共有したいので、左の C で決め、右も同じ道のりを C にする
                if (ty === 2 && side < 0 && gapHash(n, 96) < 0.6) {
                    var sc = (o.s0 + o.s1) / 2; secTrack.ensure(sc + 5); secTrack.sample(sc, rsS);   // 区間は道のりの順に決めるので、専用の軌道で（並走線の先行軌道はずっと先にある）
                    var ang = rsS.th + (Math.PI / 2) + (gapHash(n, 97) - 0.5) * (Math.PI / 3) * 0.66;   // 道路とほぼ直交（60〜90°）
                    var rw = Math.min(120, Math.max(40, (o.s1 - o.s0) - 30));
                    var Rv = { s: sc, x: rsS.x, z: rsS.z, y: P.groundY, dx: Math.sin(ang), dz: -Math.cos(ang), w: rw, n: rivers.length, s0: o.s0, s1: o.s1 };
                    if (!riverConflicts(Rv)) { rivers.push(Rv); o.river = Rv; purgeForRiver(Rv); }   // 先に決めた線路・ランプと交わる川は置かない。置いたら近くの物を取り除く
                }
                // 残りの橋の下には交差する地上の道路（片側 2 車線＋歩道、幅 24 m）。橋の近くに細い道との交差点と信号
                if (ty === 2 && side < 0 && !o.river) {
                    var sg = (o.s0 + o.s1) / 2; secTrack.ensure(sg + 5); secTrack.sample(sg, rsS);
                    var angG = rsS.th + (Math.PI / 2) + (gapHash(n, 101) - 0.5) * (Math.PI / 3) * 0.66;
                    var xi = (gapHash(n, 102) < 0.5 ? -1 : 1) * (70 + 110 * gapHash(n, 103));
                    var Rg = { s: sg, x: rsS.x, z: rsS.z, y: P.groundY, dx: Math.sin(angG), dz: -Math.cos(angG), w: 24, xi: xi, n: groads.length, s0: o.s0, s1: o.s1,
                               led: gapHash(n, 104) < 0.6, ph: gapHash(n, 105) * 70 };
                    if (!roadConflicts(Rg)) { groads.push(Rg); o.groad = Rg; purgeForRoad(Rg); }
                }
            }
        });
    }
    // 地上の道路（本線: 沿う方向 ±GR_HALF・幅 w、交差する細い道: 交差点 xi で幅 10 m・両側 90 m）からの距離（負なら道路の上）
    function groadDistOne(R, x, z) {
        var ex = x - R.x, ez = z - R.z, a = ex * R.dx + ez * R.dz, c = Math.abs(ex * R.dz - ez * R.dx);
        return Math.min(Math.max(Math.abs(a) - GR_HALF, c - R.w / 2), Math.max(Math.abs(a - R.xi) - 5, c - 90));
    }
    function groadDist(x, z) { var best = 1e9; for (var i = 0; i < groads.length; i++) { var R = groads[i]; if (Math.abs(x - R.x) > GR_HALF + 100 || Math.abs(z - R.z) > GR_HALF + 100) continue; var d = groadDistOne(R, x, z); if (d < best) best = d; } return best; }
    function roadConflicts(R) {
        if (railInit && Math.hypot(R.x - O.x, R.z - O.z) < GR_HALF + BLOCK_FADE + 500) return true;   // 見える範囲の建物を取り除かないように
        for (var i = 0; i < icList.length; i++) { var ic = icList[i]; if (!ic.ramps) continue; for (var k = 0; k < 4; k++) { var Rm = ic.ramps[k]; for (var q2 = 0; q2 < Rm.n; q2 += 3) if (groadDistOne(R, Rm.X[q2], Rm.Z[q2]) < 14) return true; } }
        for (var j = 0; j < rivers.length; j++) if (Math.hypot(rivers[j].x - R.x, rivers[j].z - R.z) < RIV_HALF + GR_HALF + 200) return true;
        return false;
    }
    function purgeForRoad(R) {
        function ok(o, r) { return groadDistOne(R, o.x, o.z) >= 3 + r; }
        function diag(o) { return 0.5 * Math.sqrt(o.w * o.w + o.d * o.d); }
        for (var ck in chunkCache) {
            var ch = chunkCache[ck];
            ch.houses = ch.houses.filter(function (o) { return ok(o, diag(o)); });
            ch.bldgs = ch.bldgs.filter(function (o) { return ok(o, o.rad || diag(o)); });
            ch.trees = ch.trees.filter(function (o) { return ok(o, 0.45 * Math.max(o.sx, o.sz)); });
            ch.lights = ch.lights.filter(function (o) { return ok(o, o.pool ? POOL_R : 0); });
        }
        for (var bk in blockCache) { var b = blockCache[bk]; b.bldgs = b.bldgs.filter(function (o) { return ok(o, diag(o)); }); b.pts = b.pts.filter(function (o) { return ok(o, 0); }); }
    }
    function riverConflicts(R) {
        if (railInit && Math.hypot(R.x - O.x, R.z - O.z) < RIV_HALF + BLOCK_FADE + 500) return true;   // 見える範囲の建物を取り除かないように（かたまりごと消える）、カメラから街区の見える距離より遠い川だけ
        function inR(x, z, m) { var ex = x - R.x, ez = z - R.z; return Math.abs(ex * R.dx + ez * R.dz) < RIV_HALF + m && Math.abs(ex * R.dz - ez * R.dx) < R.w / 2 + 10 + m; }
        for (var i = 0; i < icList.length; i++) { var ic = icList[i]; if (!ic.ramps) continue; for (var k = 0; k < 4; k++) { var Rm = ic.ramps[k]; for (var q = 0; q < Rm.n; q += 3) if (inR(Rm.X[q], Rm.Z[q], 4)) return true; } }
        return false;
    }
    function purgeForRiver(R) {
        function ok(o, r) { var ex = o.x - R.x, ez = o.z - R.z; return !(Math.abs(ex * R.dx + ez * R.dz) < RIV_HALF && Math.abs(ex * R.dz - ez * R.dx) < R.w / 2 + 10 + r); }
        function diag(o) { return 0.5 * Math.sqrt(o.w * o.w + o.d * o.d); }
        for (var ck in chunkCache) {
            var ch = chunkCache[ck];
            ch.houses = ch.houses.filter(function (o) { return ok(o, diag(o)); });
            ch.bldgs = ch.bldgs.filter(function (o) { return ok(o, o.rad || diag(o)); });
            ch.trees = ch.trees.filter(function (o) { return ok(o, 0.45 * Math.max(o.sx, o.sz)); });
            ch.lights = ch.lights.filter(function (o) { return ok(o, o.pool ? POOL_R : 0); });
        }
        for (var bk in blockCache) { var b = blockCache[bk]; b.bldgs = b.bldgs.filter(function (o) { return ok(o, diag(o)); }); b.pts = b.pts.filter(function (o) { return ok(o, 0); }); }
    }
    function secAtS(side, s) { var L = secs[side]; for (var i = L.length - 1; i >= 0; i--) if (L[i].s0 <= s && s < L[i].s1) return L[i]; return null; }
    function riverDist(x, z) {                                           // 川の中心線（幅の中心）からの距離 − 半幅（負なら川の中）
        var best = 1e9;
        for (var i = 0; i < rivers.length; i++) {
            var R = rivers[i], ex = x - R.x, ez = z - R.z, along = ex * R.dx + ez * R.dz;
            if (Math.abs(along) > RIV_HALF) continue;
            var across = Math.abs(ex * R.dz - ez * R.dx) - R.w / 2;
            if (across < best) best = across;
        }
        return best;
    }
    function ensurePars() {
        ensureICs(sCam + RAIL_AHEAD + 16000);
        ensureSecs(sCam + RAIL_AHEAD + 16000);                               // v8: IC を先に決める（並走線がずれて置かれる範囲より先まで）
        var j = parJ0;
        while (parStation(j) <= sCam + RAIL_AHEAD + 2000) {
            var key = 'p' + j;
            if (!railCache[key] && !parSkip[j]) {
                var L = genPar(j);
                var bad = function (M) { return !M || M.roadHit > 0 || M.gmax > 0.035; };
                // v7: 左に置けない時は、左のまま 1.2・2.4 km 先へずらして試してから右へ回す（左 75% を保つ）。右で置けない時は左で試す
                if (bad(L) && gapHash(j, 62) < 0.75) { for (var shf = 1200; shf <= 2400 && bad(L); shf += 1200) { var Ls = genPar(j, false, shf); if (!bad(Ls)) L = Ls; } }
                if (bad(L)) { var L2f = genPar(j, true); if (!bad(L2f)) L = L2f; }
                if (!L) parSkip[j] = 'nofit';                               // 条件に合う区間が見つからない
                else if (L.roadHit > 0) parSkip[j] = 'roadHit ' + L.roadHit + ' sA=' + L.sA;   // 道路の構造物と重なる並走線は使わない
                else if (L.gmax > 0.035) parSkip[j] = 'grade ' + L.gmax.toFixed(3);         // 勾配 3.5% を超える並走線は使わない
                else if (railInit && parDistFar(L, O.x, O.z) < RAIL_FADE + 600) parSkip[j] = 'near';   // いきなり現れるので使わない
                else if (parHitsPar(L)) parSkip[j] = 'parHit';
                else if (parHitsRamp(L)) parSkip[j] = 'rampHit';                               // v8: ランプと交わる・寄る
                // v9 の後: 並走線も川を渡ってよい                                   // 反対側の並走線と交わる（道路が大きく曲がる所）
                else { L.genAt = sCam; if (railInit) purgeForLine(L); railCache[key] = L; parSideEnd[L.side] = Math.max(parSideEnd[L.side], L.s1); parSideN[L.side < 0 ? 0 : 1]++; parAnyEnd = Math.max(parAnyEnd, L.sL); }
            }
            j++;
        }
        for (var kk in railCache) {
            var L2 = railCache[kk];
            // 区間を過ぎて 3 km 先でカメラから遠ければ捨てる。道路が戻ってきて近いままでも、PAR_KEEP 先では必ず捨てる（道路との照合はそこまで）
            if (L2.par && ((L2.s1 < sCam - 3000 && parDistFar(L2, O.x, O.z) > 8000) || L2.s1 < sCam - PAR_KEEP)) { disposeParMesh(L2); delete railCache[kk]; parKept[kk] = { sA: L2.sA, sL: L2.sL, sR: L2.sR, sE: L2.sE, side: L2.side, nc: L2.nc }; parJ0 = Math.max(parJ0, L2.j + 1); }
        }
    }

    // --- 高架の形（断面 12 帯を道のり 10 m ごとに押し出す。地面から低い所は盛土の断面へなめらかに変える） ---
    // [x0, y0, x1, y1, nx, ny]（レール面を原点、x = 進行方向の右）。盛土の断面は buildParMesh の中で作る
    var PAR_BANDS = [
        [-5.2, -0.7, -5.2, 0.9, -1, 0], [-5.2, 0.9, -4.95, 0.9, 0, 1], [-4.95, 0.9, -4.95, -0.2, 1, 0],
        [-4.95, -0.2, 4.95, -0.2, 0, 1],
        [4.95, -0.2, 4.95, 0.9, -1, 0], [4.95, 0.9, 5.2, 0.9, 0, 1], [5.2, 0.9, 5.2, -0.7, 1, 0],
        [-5.2, -0.7, -3.0, -0.7, 0, -1], [-3.0, -0.7, -3.0, -2.7, -1, 0], [-3.0, -2.7, 3.0, -2.7, 0, -1], [3.0, -2.7, 3.0, -0.7, 1, 0], [3.0, -0.7, 5.2, -0.7, 0, -1]
    ];
    var parMat = litMat([0.075, 0.075, 0.072], 0.85, [0.04, 0.04, 0.04], 0.3, true);
    parMat.defines.RVIADUCT = 1; parMat.defines.FADE = 1;
    parMat.uniforms.uFadeFar = { value: RAIL_FADE };
    parMat.uniforms.uUnder.value.set(0.012, 0.009, 0.006);
    var anchorVer = 0;
    function embPoint(b, e, g) {                                        // 盛土の断面での点（g = 地面のレール面からの高さ、負）
        var toeL = [-4.5 + 1.5 * g, g], toeR = [4.5 - 1.5 * g, g], tL = [-4.5, -0.2], tR = [4.5, -0.2];
        var map = [[toeL, tL], [tL, tL], [tL, tL], [tL, tR], [tR, tR], [tR, tR], [tR, toeR], [toeL, toeL], [toeL, toeL], [[toeL[0], g - 0.5], [toeR[0], g - 0.5]], [toeR, toeR], [toeR, toeR]];
        return map[b][e];
    }
    function buildParMesh(L) {
        disposeParMesh(L);
        var NB = PAR_BANDS.length, NV = NB * 2, n = L.n;
        var pos = new Float32Array(n * NV * 3), nrm = new Float32Array(n * NV * 3), sta = new Float32Array(n * NV), lat = new Float32Array(n * NV);
        var ht = new Float32Array(n * NV), band = new Float32Array(n * NV), elev = new Float32Array(n * NV), endf = new Float32Array(n * NV);
        var ax = anchor.x, ay = anchor.y, az = anchor.z, total = L.CUM[n - 1];
        for (var i = 0; i < n; i++) {
            var i0 = Math.max(0, i - 1), i1 = Math.min(n - 1, i + 1);
            var fx = L.X[i1] - L.X[i0], fz = L.Z[i1] - L.Z[i0], fl = Math.sqrt(fx * fx + fz * fz) || 1; fx /= fl; fz /= fl;
            var rx = -fz, rz = fx;
            var g = P.groundY - L.Y[i];
            var e = Math.max(0, Math.min(1, (L.H[i] - 2.0) / 1.5)); e = e * e * (3 - 2 * e);     // 地面から 2〜3.5 m で盛土 → 高架
            var ef = Math.min(1, Math.min(L.CUM[i], total - L.CUM[i]) / 800);                       // 端 800 m で消す
            for (var b = 0; b < NB; b++) {
                var B = PAR_BANDS[b];
                for (var k = 0; k < 2; k++) {
                    var pe = embPoint(b, k, g);
                    var x = pe[0] + (B[k * 2] - pe[0]) * e, y = pe[1] + (B[k * 2 + 1] - pe[1]) * e;
                    var nx = B[4], ny = B[5];
                    if (e < 0.5 && (b === 0 || b === 6)) { nx = b === 0 ? -0.55 : 0.55; ny = 0.83; }   // 盛土の法面
                    var v = (i * NV + b * 2 + k);
                    pos[v * 3] = L.X[i] + rx * x - ax; pos[v * 3 + 1] = L.Y[i] + y - ay; pos[v * 3 + 2] = L.Z[i] + rz * x - az;
                    nrm[v * 3] = rx * nx; nrm[v * 3 + 1] = ny; nrm[v * 3 + 2] = rz * nx;
                    sta[v] = L.CUM[i]; lat[v] = x; ht[v] = y; band[v] = b; elev[v] = e; endf[v] = ef;
                }
            }
        }
        var gg = new THREE.BufferGeometry();
        gg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        gg.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
        gg.setAttribute('aSta', new THREE.BufferAttribute(sta, 1));
        gg.setAttribute('aLat', new THREE.BufferAttribute(lat, 1));
        gg.setAttribute('aHt', new THREE.BufferAttribute(ht, 1));
        gg.setAttribute('aBand', new THREE.BufferAttribute(band, 1));
        gg.setAttribute('aElev', new THREE.BufferAttribute(elev, 1));
        gg.setAttribute('aEndF', new THREE.BufferAttribute(endf, 1));
        var idx = [];
        for (var r = 0; r < n - 1; r++) for (var b2 = 0; b2 < NB; b2++) {
            var a0 = r * NV + b2 * 2, a1 = a0 + 1, c0 = a0 + NV, c1 = a1 + NV;
            idx.push(a0, a1, c0, a1, c1, c0);
        }
        gg.setIndex(idx);
        var mesh = new THREE.Mesh(gg, parMat); mesh.frustumCulled = false;
        sideGroup.add(mesh);
        L.mesh = mesh; L.meshVer = anchorVer;
    }
    function disposeParMesh(L) { if (L.mesh) { sideGroup.remove(L.mesh); L.mesh.geometry.dispose(); L.mesh = null; } }

    // 線路高架の橋脚（30 m ごと、1 本柱＋横梁）と、高欄の外から立つ門型の架線柱（50 m ごと）
    var NPPIER = 900, NPPORT = 700;
    var ppierCols = new THREE.InstancedMesh(pierBox(0.12), pierMat, NPPIER), ppierBeams = new THREE.InstancedMesh(pierBox(0.08), pierMat, NPPIER);
    var pportalGeo = (function () {
        var gs = [];
        [-5.45, 5.45].forEach(function (x) { var c = new THREE.CylinderGeometry(0.1, 0.13, 7.2, 10); c.translate(x, -0.7 + 3.6, 0); gs.push(c); });
        var b = new THREE.CylinderGeometry(0.08, 0.08, 11.2, 8); b.rotateZ(Math.PI / 2); b.translate(0, 6.3, 0); gs.push(b);
        var b2 = new THREE.CylinderGeometry(0.05, 0.05, 11.2, 6); b2.rotateZ(Math.PI / 2); b2.translate(0, 5.8, 0); gs.push(b2);
        gs = gs.map(function (g) { g = g.index ? g.toNonIndexed() : g; for (var k in g.attributes) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k); return g; });
        return A.BufferGeometryUtils.mergeGeometries(gs);
    })();
    var pportalMat = litMat([0.05, 0.05, 0.052], 0.6, [0.2, 0.2, 0.2], 0.0, false);   // 道路の街灯の光を受ける
    pportalMat.defines.FADE = 1; pportalMat.uniforms.uFadeFar = { value: 4500 };
    var pportals = new THREE.InstancedMesh(pportalGeo, pportalMat, NPPORT);
    [ppierCols, ppierBeams, pportals].forEach(function (m) { m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.frustumCulled = false; m.count = 0; sideGroup.add(m); });
    var pA = { x: 0, y: 0, z: 0 }, pB = { x: 0, y: 0, z: 0 }, pEye = new THREE.Vector3(), pTgt = new THREE.Vector3();
    var parQ = new THREE.Quaternion(), parV = new THREE.Vector3(), parS = new THREE.Vector3();
    // 静的な部分（高架の形・橋脚・架線柱）: 沿道と同じタイミングで、近い並走線だけ作る
    function writeParStatic() {
        var np = 0, nq = 0, gy = GROUND_Y - anchor.y;
        for (var kk in railCache) {
            var L = railCache[kk];
            if (!L.par) continue;
            var dFar = parDistFar(L, O.x, O.z);
            if (dFar > RAIL_FADE + 400) { disposeParMesh(L); continue; }
            if (!L.mesh || L.meshVer !== anchorVer) buildParMesh(L);
            var total = L.CUM[L.n - 1];
            for (var u = 15; u < total - 15; u += 30) {                 // 橋脚
                var i = parIndexAt(L, u); if (L.H[i] < 3.6) continue;
                var px = L.X[i], pz = L.Z[i], dx = px - O.x, dz = pz - O.z;
                if (dx * dx + dz * dz > (RAIL_FADE + 100) * (RAIL_FADE + 100) || np >= NPPIER) continue;
                var fx = L.X[Math.min(L.n - 1, i + 1)] - L.X[Math.max(0, i - 1)], fz = L.Z[Math.min(L.n - 1, i + 1)] - L.Z[Math.max(0, i - 1)];
                parQ.setFromAxisAngle(yAxis, Math.atan2(fx, fz) + Math.PI / 2);
                var topY = L.Y[i] - 2.7 - anchor.y;
                parV.set(px - anchor.x, topY, pz - anchor.z);
                tmpM.compose(parV, parQ, parS.set(7.2, 1.2, 1.9)); ppierBeams.setMatrixAt(np, tmpM);
                parV.y = topY - 1.2;
                tmpM.compose(parV, parQ, parS.set(2.2, Math.max(0.5, parV.y - gy + 0.3), 1.8)); ppierCols.setMatrixAt(np, tmpM);
                np++;
            }
            for (var u2 = 25; u2 < total - 25 && nq < NPPORT; u2 += 50) {   // 架線柱
                var i2 = parIndexAt(L, u2);
                var qx = L.X[i2], qz = L.Z[i2], ex = qx - O.x, ez = qz - O.z;
                if (ex * ex + ez * ez > 4600 * 4600) continue;
                var gx2 = L.X[Math.min(L.n - 1, i2 + 1)] - L.X[Math.max(0, i2 - 1)], gz2 = L.Z[Math.min(L.n - 1, i2 + 1)] - L.Z[Math.max(0, i2 - 1)];
                parQ.setFromAxisAngle(yAxis, Math.atan2(gx2, gz2));
                parV.set(qx - anchor.x, L.Y[i2] - anchor.y, qz - anchor.z);
                tmpM.compose(parV, parQ, tmpS); pportals.setMatrixAt(nq++, tmpM);
            }
        }
        ppierCols.count = ppierBeams.count = np; pportals.count = nq;
        ppierCols.instanceMatrix.needsUpdate = true; ppierBeams.instanceMatrix.needsUpdate = true; pportals.instanceMatrix.needsUpdate = true;
    }
    function parIndexAt(L, u) {                                        // 弧長 u に最も近いサンプル番号（二分探索）
        var lo = 0, hi = L.n - 1;
        while (hi - lo > 1) { var m = (lo + hi) >> 1; if (L.CUM[m] < u) lo = m; else hi = m; }
        return (u - L.CUM[lo] < L.CUM[hi] - u) ? lo : hi;
    }
    function parPointAt(L, u, out) {                                   // 弧長 u の位置（線形補間）
        u = Math.max(0, Math.min(L.CUM[L.n - 1], u));
        var lo = 0, hi = L.n - 1;
        while (hi - lo > 1) { var m = (lo + hi) >> 1; if (L.CUM[m] < u) lo = m; else hi = m; }
        var t = (u - L.CUM[lo]) / Math.max(1e-6, L.CUM[hi] - L.CUM[lo]);
        out.x = L.X[lo] + (L.X[hi] - L.X[lo]) * t; out.y = L.Y[lo] + (L.Y[hi] - L.Y[lo]) * t; out.z = L.Z[lo] + (L.Z[hi] - L.Z[lo]) * t;
        return out;
    }
    var trainNear = 1e9, trainNearV = 20;
    function updateTrains(t) {
        var gy = GROUND_Y - anchor.y, ax = anchor.x, az = anchor.z;
        var nC = 0, nG = 0, nP = 0;
        var ci = carGeo.attributes.aCarInfo.array, cb = carGeo.attributes.aBand.array;
        var gk = tglowGeo.attributes.aKind.array, gf = tglowGeo.attributes.aFadeG.array;
        var pp = railPts.geometry.attributes.position.array, pc = railPts.geometry.attributes.aCol.array, ps = railPts.geometry.attributes.aSize.array;
        function pt(x, y, z, r, g, b, s) {
            if (nP >= 3000) return;
            pp[nP * 3] = x - ax; pp[nP * 3 + 1] = gy + y; pp[nP * 3 + 2] = z - az;
            pc[nP * 3] = r; pc[nP * 3 + 1] = g; pc[nP * 3 + 2] = b; ps[nP] = s; nP++;
        }
        trainNear = 1e9;
        for (var kk in railCache) {
            var L = railCache[kk];
            if (L.par || lineDist(L, O.x, O.z) > RAIL_FADE + 300) continue;
            var heads = [[], []];
            for (var dir = 0; dir < 2; dir++) {
                var sg = dir === 0 ? 1 : -1, D = L.D[dir];
                var off = dir === 0 ? -2.0 : 2.0;                     // 左側通行: 進行方向の左の線
                var ox = L.rx * off, oz = L.rz * off;
                var base = ((L.v * t + L.ph[dir]) % D + D) % D;
                var phiT = Math.atan2(sg * L.dx, sg * L.dz);
                tmpQ.setFromAxisAngle(yAxis, phiT);
                var cyc = Math.floor((L.v * t + L.ph[dir]) / D), kIdx = 0;
                for (var hu = -RAIL_HALF + base; hu < RAIL_HALF + tLen(L); hu += D, kIdx++) {
                    var headU = sg * hu;
                    heads[dir].push(headU);
                    var hx = L.cx + L.dx * headU + ox, hz = L.cz + L.dz * headU + oz;
                    var hdx = hx - O.x, hdz = hz - O.z, hd = Math.sqrt(hdx * hdx + hdz * hdz);
                    if (hd > RAIL_FADE + 400) continue;
                    var trainId = cyc - kIdx;                        // 編成ごとの番号（乗客の数などを決める）
                    for (var c = 0; c < L.nc; c++) {
                        var u0 = headU - sg * (c * (CAR_LEN + CAR_GAP) + CAR_LEN);   // 両の後端
                        var uc = u0 + sg * CAR_LEN / 2;
                        if (Math.abs(uc) > RAIL_HALF) continue;
                        var fadeT = Math.min(1, Math.max(0, (RAIL_HALF - Math.abs(uc)) / 1500));
                        var x0 = L.cx + L.dx * u0 + ox, z0 = L.cz + L.dz * u0 + oz;
                        var cdx = x0 + L.dx * sg * 10 - O.x, cdz = z0 + L.dz * sg * 10 - O.z;
                        var cdist = Math.sqrt(cdx * cdx + cdz * cdz);
                        if (cdist < trainNear) { trainNear = cdist; trainNearV = L.v; }
                        if (cdist > RAIL_FADE + 30) continue;                // 遠い両は描かない（容量を近い両に回す）
                        if (nC < NTRAINCAR) {
                            tmpV.set(x0 - ax, gy + RAIL_Y, z0 - az);
                            tmpM.compose(tmpV, tmpQ, tmpS); trainCars.setMatrixAt(nC, tmpM);
                            ci[nC * 4] = c === L.nc - 1 ? 100 + c : c; ci[nC * 4 + 1] = gapHash(trainId * 31 + L.k * 7 + dir, c + 50); ci[nC * 4 + 2] = (c === 2 || c === 5 || c === 8) ? 1 : 0; ci[nC * 4 + 3] = fadeT;
                            cb[nC * 3] = L.col[0]; cb[nC * 3 + 1] = L.col[1]; cb[nC * 3 + 2] = L.col[2];
                            nC++;
                        }
                        if (nG < NTGLOW) {                           // 窓の光が線路脇に落ちる帯（両の長さ × 幅 9 m）
                            tmpV.set(x0 - ax, gy + 0.66, z0 - az);
                            tmpM.compose(tmpV, tmpQ, tmpS2.set(4.5, 1, CAR_LEN)); tglows.setMatrixAt(nG, tmpM);
                            gk[nG] = 0; gf[nG] = fadeT; nG++;
                        }
                    }
                    // 前照灯（先頭）と尾灯（最後尾）、前照灯の前方の光だまり
                    var fT = Math.min(1, Math.max(0, (RAIL_HALF - Math.abs(headU)) / 1500));
                    var tailU = headU - sg * (tLen(L) - CAR_GAP);
                    var fTl = Math.min(1, Math.max(0, (RAIL_HALF - Math.abs(tailU)) / 1500));
                    if (Math.abs(headU) < RAIL_HALF) {
                        for (var s2 = -1; s2 <= 1; s2 += 2) pt(hx + L.rx * 0.75 * s2, RAIL_Y + 1.25, hz + L.rz * 0.75 * s2, 3.0 * fT, 2.9 * fT, 2.6 * fT, 2.2);
                        if (nG < NTGLOW) {
                            tmpV.set(hx - ax, gy + 0.66, hz - az);
                            tmpM.compose(tmpV, tmpQ, tmpS2.set(2.6, 1, 45)); tglows.setMatrixAt(nG, tmpM);
                            gk[nG] = 1; gf[nG] = fT; nG++;
                        }
                    }
                    if (Math.abs(tailU) < RAIL_HALF) {
                        var tx = L.cx + L.dx * tailU + ox, tz = L.cz + L.dz * tailU + oz;
                        for (var s3 = -1; s3 <= 1; s3 += 2) pt(tx + L.rx * 1.05 * s3, RAIL_Y + 1.42, tz + L.rz * 1.05 * s3, 1.8 * fTl, 0.06 * fTl, 0.03 * fTl, 1.4);
                    }
                }
            }
            // 信号（400 m ごと、線路脇の柱の上。電車が通過した直後の区間だけ赤）と保守用の灯（150 m ごと、暗め）
            for (var us = -3600; us <= 3600; us += 400) {
                for (var dir2 = 0; dir2 < 2; dir2++) {
                    var sg2 = dir2 === 0 ? 1 : -1, offS = dir2 === 0 ? -4.2 : 4.2;
                    var sx = L.cx + L.dx * us + L.rx * offS, sz = L.cz + L.dz * us + L.rz * offS;
                    var ddx2 = sx - O.x, ddz2 = sz - O.z;
                    if (ddx2 * ddx2 + ddz2 * ddz2 > RAIL_FADE * RAIL_FADE) continue;
                    var red = false;
                    heads[dir2].forEach(function (h) { var tail = h - sg2 * tLen(L); var past = sg2 * (tail - us); if (past > 0 && past < 700) red = true; });
                    var fS = Math.min(1, (RAIL_HALF - Math.abs(us)) / 1500);
                    if (red) pt(sx, 5.0, sz, 1.6 * fS, 0.08 * fS, 0.05 * fS, 1.3); else pt(sx, 5.0, sz, 0.15 * fS, 1.2 * fS, 0.55 * fS, 1.3);
                }
            }
            for (var um = -3450; um <= 3450; um += 150) {
                var side = (Math.round(um / 150) & 1) ? 5.2 : -5.2;
                var mx = L.cx + L.dx * um + L.rx * side, mz = L.cz + L.dz * um + L.rz * side;
                var ddx3 = mx - O.x, ddz3 = mz - O.z;
                if (ddx3 * ddx3 + ddz3 * ddz3 > RAIL_FADE * RAIL_FADE) continue;
                var fM = Math.min(1, (RAIL_HALF - Math.abs(um)) / 1500);
                pt(mx, 4.0, mz, 0.55 * fM, 0.6 * fM, 0.65 * fM, 1.1);
            }
        }
        // --- 並走線の電車: 折れ線に沿って 1 両ずつ、その位置の向きと勾配に合わせて置く（編成が曲線に沿って曲がる） ---
        for (var pk in railCache) {
            var PL = railCache[pk];
            if (!PL.par || parDistFar(PL, O.x, O.z) > RAIL_FADE + 300) continue;
            var totalP = PL.CUM[PL.n - 1];
            for (var pdir = 0; pdir < 2; pdir++) {
                var psg = pdir === 0 ? 1 : -1, PD = PL.D[pdir], poff = -2.0;   // 左側通行: どちらの向きも進行方向の左の線（v6.1: 逆向きも同じ線を走っていた誤りを修正。orx は進行方向の右なので符号は同じ）
                var pbase = ((PL.v * t + PL.ph[pdir]) % PD + PD) % PD;
                for (var phu = pbase; phu < totalP + tLen(PL); phu += PD) {
                    var pheadU = pdir === 0 ? phu : totalP - phu;
                    for (var pc2 = 0; pc2 < PL.nc; pc2++) {
                        var pu0 = pheadU - psg * (pc2 * (CAR_LEN + CAR_GAP) + CAR_LEN), pu1 = pu0 + psg * CAR_LEN;
                        if (Math.min(pu0, pu1) < 0 || Math.max(pu0, pu1) > totalP) continue;
                        parPointAt(PL, pu0, pA); parPointAt(PL, pu1, pB);
                        var tfx = pB.x - pA.x, tfz = pB.z - pA.z, tfl = Math.sqrt(tfx * tfx + tfz * tfz) || 1;
                        var orx = -tfz / tfl * poff, orz = tfx / tfl * poff;      // 進行方向の右 × オフセット
                        var cdx2 = (pA.x + pB.x) / 2 - O.x, cdz2 = (pA.z + pB.z) / 2 - O.z, cd2 = Math.sqrt(cdx2 * cdx2 + cdz2 * cdz2);
                        if (cd2 < trainNear) { trainNear = cd2; trainNearV = PL.v; }
                        if (cd2 > RAIL_FADE + 30 || nC >= NTRAINCAR) continue;
                        var uc2 = (pu0 + pu1) / 2, fadeP = Math.min(1, Math.min(uc2, totalP - uc2) / 800);
                        // 向き: 後端 → 前端（勾配込み）。lookAt の z 軸が前端を向くようにする
                        pEye.set(pA.x + orx - ax, pA.y - anchor.y, pA.z + orz - az);
                        pTgt.set(pB.x + orx - ax, pB.y - anchor.y, pB.z + orz - az);
                        tmpM.lookAt(pTgt, pEye, yAxis); tmpM.setPosition(pEye);
                        trainCars.setMatrixAt(nC, tmpM);
                        ci[nC * 4] = pc2 === PL.nc - 1 ? 100 + pc2 : pc2; ci[nC * 4 + 1] = gapHash(PL.j * 13 + pdir * 7 + Math.floor((PL.v * t + PL.ph[pdir]) / PD), pc2 + 80); ci[nC * 4 + 2] = (pc2 === 2 || pc2 === 5 || pc2 === 8) ? 1 : 0; ci[nC * 4 + 3] = fadeP;
                        cb[nC * 3] = PL.col[0]; cb[nC * 3 + 1] = PL.col[1]; cb[nC * 3 + 2] = PL.col[2];
                        nC++;
                        if (nG < NTGLOW) {                               // 窓の光が高欄の内側と道床に落ちる（道路側へは高欄で切れる程度の淡さ）
                            pEye.y -= 0.17;
                            tmpM.lookAt(pTgt.set(pTgt.x, pEye.y, pTgt.z), pEye, yAxis); tmpM.setPosition(pEye);
                            tmpM.scale(tmpS2.set(4.5, 1, CAR_LEN)); tglows.setMatrixAt(nG, tmpM);
                            gk[nG] = 0; gf[nG] = fadeP * 0.7; nG++;
                        }
                        if (pc2 === 0) {                                  // 前照灯
                            for (var s4 = -1; s4 <= 1; s4 += 2) pt(pB.x + orx - tfz / tfl * 0.75 * s4, pB.y - (GROUND_Y) + 1.25, pB.z + orz + tfx / tfl * 0.75 * s4, 3.0 * fadeP, 2.9 * fadeP, 2.6 * fadeP, 2.2);
                        }
                        if (pc2 === PL.nc - 1) {                          // 尾灯
                            for (var s5 = -1; s5 <= 1; s5 += 2) pt(pA.x + orx - tfz / tfl * 1.05 * s5, pA.y - (GROUND_Y) + 1.42, pA.z + orz + tfx / tfl * 1.05 * s5, 1.8 * fadeP, 0.06 * fadeP, 0.03 * fadeP, 1.4);
                        }
                    }
                }
            }
        }
        trainCars.count = nC; tglows.count = nG;
        trainCars.instanceMatrix.needsUpdate = true; tglows.instanceMatrix.needsUpdate = true;
        carGeo.attributes.aCarInfo.needsUpdate = true; carGeo.attributes.aBand.needsUpdate = true;
        tglowGeo.attributes.aKind.needsUpdate = true; tglowGeo.attributes.aFadeG.needsUpdate = true;
        railPts.geometry.setDrawRange(0, nP);
        ['position', 'aCol', 'aSize'].forEach(function (a) { railPts.geometry.attributes[a].needsUpdate = true; });
    }

    // v6.1: 時刻 t に運転席から見えている電車の種類（1 = 並走線・同じ向き、2 = 並走線・逆向き、4 = くぐる線）。selftest の出会いの統計に使う
    var encP = { x: 0, y: 0, z: 0 };
    var encIds = [];                                                     // trainsSeen が見つけた編成の番号（線・向き・何本目）
    function trainsSeen(t, E) {
        var m = 0; encIds.length = 0;
        for (var kk in railCache) {
            var L = railCache[kk];
            if (!L.par) {
                if (lineDist(L, E.x, E.z) > 420) continue;
                for (var dir = 0; dir < 2; dir++) {
                    var sg = dir === 0 ? 1 : -1, D = L.D[dir], ox = L.rx * (dir === 0 ? -2.0 : 2.0), oz = L.rz * (dir === 0 ? -2.0 : 2.0);
                    var base = ((L.v * t + L.ph[dir]) % D + D) % D, cyc = Math.floor((L.v * t + L.ph[dir]) / D), kI = 0;
                    for (var hu = -RAIL_HALF + base; hu < RAIL_HALF + tLen(L); hu += D, kI++) {
                        var headU = sg * hu;
                        for (var c = 0; c < L.nc; c++) {
                            var uc = headU - sg * (c * (CAR_LEN + CAR_GAP) + CAR_LEN / 2);
                            if (Math.abs(uc) > RAIL_HALF - 1500) continue;            // 端の 1.5 km はフェード中なので数えない
                            if (seenFrom(E, L.cx + L.dx * uc + ox, P.groundY + RAIL_Y + WIN_H, L.cz + L.dz * uc + oz)) { m |= 4; encIds.push(kk + ':' + dir + ':' + (cyc - kI)); break; }
                        }
                    }
                }
            } else {
                if (parDistFar(L, E.x, E.z) > 520) continue;
                var totalP = L.CUM[L.n - 1];
                for (var pdir = 0; pdir < 2; pdir++) {
                    var PD = L.D[pdir], pbase = ((L.v * t + L.ph[pdir]) % PD + PD) % PD, psg = pdir === 0 ? 1 : -1, pcyc = Math.floor((L.v * t + L.ph[pdir]) / PD), pI = 0;
                    for (var phu = pbase; phu < totalP + tLen(L); phu += PD, pI++) {
                        var pheadU = pdir === 0 ? phu : totalP - phu;
                        for (var c2 = 0; c2 < L.nc; c2 += 2) {
                            var u = pheadU - psg * (c2 * (CAR_LEN + CAR_GAP) + CAR_LEN / 2);
                            if (u < 800 || u > totalP - 800) continue;                  // 端の 800 m はフェード中
                            parPointAt(L, u, encP);
                            var lo = pdir === 0 ? -2.0 : 2.0;                            // 左側通行の線（向きの右へのずれは小さいので省く）
                            if (seenFrom(E, encP.x, encP.y + WIN_H, encP.z)) { m |= pdir === 0 ? 1 : 2; encIds.push(kk + ':' + pdir + ':' + (pcyc - pI)); break; }
                        }
                    }
                }
            }
        }
        return m;
    }

    function icSummary(s0, s1) {                                         // IC の間隔と、IC と並走線・交差点の距離の最小値
        var L = icList.filter(function (ic) { return ic.ramps && ic.sEx0 > s0 && ic.sEx0 < s1; }), gaps = [];
        for (var i = 1; i < L.length; i++) gaps.push(L[i].sEx0 - L[i - 1].sEx0);
        var parsAll = []; for (var k in parKept) parsAll.push(parKept[k]); for (var k2 in railCache) if (railCache[k2].par) parsAll.push(railCache[k2]);
        var dPar = 1e9, dX = 1e9;
        L.forEach(function (ic) {
            parsAll.forEach(function (pp) { var d = Math.max(pp.sA - ic.zB, ic.zA - pp.sL, 0); if (d < dPar) dPar = d; });
            crossAcc.forEach(function (sc) { var d = Math.max(sc - ic.zB, ic.zA - sc, 0); if (d < dX) dX = d; });
        });
        var mean = gaps.length ? gaps.reduce(function (a, b) { return a + b; }, 0) / gaps.length : 0;
        return 'IC n=' + L.length + ' gap(mean/min/max)=' + (mean / 1000).toFixed(1) + '/' + (gaps.length ? (Math.min.apply(null, gaps) / 1000).toFixed(1) : '-') + '/' + (gaps.length ? (Math.max.apply(null, gaps) / 1000).toFixed(1) : '-') + 'km ' +
            'IC-par min=' + (dPar > 1e8 ? 'n/a' : dPar.toFixed(0)) + 'm IC-cross min=' + (dX > 1e8 ? 'n/a' : dX.toFixed(0)) + 'm' + ' firstIC=' + (L.length ? L[0].sEx0 : '-') + ' icFail=' + JSON.stringify(icWhy) + ' half=' + L.filter(function (ic) { return ic.half; }).length;
    }
    function encSummary(st, T, ty) {
        var gaps = [], prev = 0;
        st.forEach(function (x) { gaps.push(x - prev); prev = x; });
        gaps.push(T - prev);
        var mx = Math.max.apply(null, gaps), first = st.length ? st[0] : T, mi = gaps.indexOf(mx);
        var sg2 = gaps.slice().sort(function (a, b) { return a - b; }), p90 = sg2[Math.floor(sg2.length * 0.9)];
        return 'ENC n=' + st.length + ' minPer=' + (st.length ? (T / 60 / st.length).toFixed(2) : 'inf') + ' maxGap=' + (mx / 60).toFixed(2) + 'min(at ' + (mi > 0 ? (st[mi - 1] / 60).toFixed(1) : '0') + 'min) p90=' + (p90 / 60).toFixed(2) + 'min first=' + first.toFixed(0) + 's' +
            ' types(same/opp/cross)=' + ty.same + '/' + ty.opp + '/' + ty.cross + ' T=' + (T / 60).toFixed(1) + 'min';
    }
    // --- 長時間走行の自動検査（selftest=1）: 描画せずに 40 m ずつ進め、いま描かれる世界固定の物と、
    // いま描かれる道路（sCam-36 〜 sCam+viewLen、20 m ごと）の水平距離を調べる ---
    function runSelftest(km) {
        var t0 = performance.now();
        var steps = Math.floor(km * 1000 / CHUNK), viol = 0, violObj = 0, minClr = 1e9, minAt = -1, truncSteps = 0, truncSum = 0, first = [];
        var parSeen = new Set(), parGradeViol = 0, parRoadViol = 0, parRoadMin = 1e9;
        var railFirst = [], railViol = 0, railMin = 1e9, pierViol = 0, piersChecked = 0, linesSeen = new Set();
        var seen = new Set(), truncBy = {}, maxN = { poles: 0, parts: 0, houses: 0, bldgs: 0, trees: 0, lights: 0, pools: 0, blocks: 0, bpts: 0 };
        var farMatMin = 1e9, farMatNear = 0, blkNearMin = 1e9;
        var rivViol = 0, rivRailViol = 0, rivSeen = new Set(), rampViol = 0, rampBy = {}, rampFirst = [], rampMin = 1e9, rampGradeViol = 0, rampRadViol = 0, rampRailViol = 0, rampRailMin = 1e9, rampClash = 0, icSeen = new Set(), railInViol = 0, railInFirst = [];   // 遠景用の材質で描いた棟の最短距離と 700 m 以内の件数、近接用で描いた街区の棟の最短距離
        var CELL = 64, grid = new Map();
        function key(ix, iz) { return ix * 100003 + iz; }
        // v6.1: 電車との出会い。通常の走行（既定の速さ・実時間）で「画面内かつ 400 m 以内」に電車が見えている時間帯を 1 回と数える（新しい編成が見え始めた時を 1 回と数える。同じ編成が 60 秒以内に再び見えても数えない。直前の出会いから 10 秒以内に見え始めた編成は同じ回にまとめる）
        var sStart = sCam, spdT = speed > 0 ? speed : 27.8, encN = 0, encLast = -1e9, encStarts = [], encType = { same: 0, opp: 0, cross: 0 }, encE = {}, encBits = [], encTrace = [], encSeenAt = {};
        for (var stp = 0; stp < steps; stp++) {
            sCam += CHUNK;
            track.ensure(sCam + P.viewLen + 40);
            frameAt(sCam, FC); O.copy(FC.c);
            trainClock = (sCam - sStart) / spdT;
            var D = collectDrawn();
            // v7: encfps=N で、1 秒 N フレームの走行と同じ細かさで調べる（40 m の区切りの中を細かく刻む。時刻は道のり / 速さ）
            var nSub = q.encfps > 0 ? Math.max(1, Math.round(CHUNK / (spdT / q.encfps))) : 1;
            for (var isb = 0; isb < nSub; isb++) {
                var sSub = sCam - CHUNK + (isb + 1) * CHUNK / nSub, tSub = (sSub - sStart) / spdT;
                track.sample(sSub, smp); setEye(encE, smp.x, smp.y, smp.z, smp.th);
                var em = trainsSeen(tSub, encE);
                if (q.encfrom && sSub > q.encfrom * 1000 && sSub < q.encfrom * 1000 + 5000 && isb === nSub - 1) encTrace.push((sSub / 1000).toFixed(2) + ':' + em);
                if (em) {
                    var fresh = encIds.filter(function (id) { return !(encSeenAt[id] > tSub - 60); });
                    encIds.forEach(function (id) { encSeenAt[id] = tSub; });
                    if (fresh.length) {
                        if (tSub - encLast > 10) { encN++; encStarts.push(tSub); encBits.push(0); encLast = tSub; }
                        fresh.forEach(function (id) { var dr = +id.split(':')[1], isPar = id.charAt(0) === 'p'; if (isPar) { if (dr === 0) encType.same++; else encType.opp++; } else encType.cross++; });
                        encBits[encBits.length - 1] |= em;
                    }
                }
            }
            for (var lk in railCache) {
                linesSeen.add(lk);
                var LP = railCache[lk];
                if (!LP.par) continue;
                if (!parSeen.has(lk)) { parSeen.add(lk); if (LP.gmax > 0.035) parGradeViol++; }
                // 道路の構造物（桁の端）と線路高架（幅 10.4 m）の重なり: いま描かれる道路の中心線から 9.75 + 5.2 m 以内に、
                // 自分の地点から 200 m 以上離れた高架部分（レール面が地面から 1 m 超）が入るか
                for (var rs3 = Math.ceil((sCam - 36) / 20) * 20; rs3 <= sCam + P.viewLen; rs3 += 20) {
                    var ri3 = rs3 & TMASK, nr = parNearest(LP, track.px[ri3], track.pz[ri3], 20);
                    if (nr.d < 9.75 + PAR_HALF_W && LP.H[nr.i] > 1.0 && Math.abs(LP.s0 + nr.i * PAR_STEP - rs3) > 200) {
                        parRoadViol++;
                        if (railFirst.length < 6) railFirst.push('parRoad j=' + LP.j + ' cam=' + sCam.toFixed(0) + ' road=' + rs3 + ' own=' + (LP.s0 + nr.i * PAR_STEP) + ' H=' + LP.H[nr.i].toFixed(1) + ' d=' + nr.d.toFixed(1) + ' genAt=' + LP.genAt.toFixed(0) + ' s0..s1=' + LP.s0 + '..' + LP.s1 + ' roadHit=' + LP.roadHit);
                    }
                    if (nr.d < 1e8 && LP.H[nr.i] > 1.0 && Math.abs(LP.s0 + nr.i * PAR_STEP - rs3) > 200) parRoadMin = Math.min(parRoadMin, nr.d - (9.75 + PAR_HALF_W));
                }
            }
            D.blocks.forEach(function (o) { if (o.isPart) return; var dx = o.x - O.x, dz = o.z - O.z, dd = Math.sqrt(dx * dx + dz * dz); if (dd < farMatMin) farMatMin = dd; if (dd < 700) farMatNear++; });
            D.bldgs.forEach(function (o) { if (o.isPart || o.roadMin === undefined) return; var dx = o.x - O.x, dz = o.z - O.z, dd = Math.sqrt(dx * dx + dz * dz); if (dd < blkNearMin) blkNearMin = dd; });
            if (D.trunc > 0) { truncSteps++; truncSum += D.trunc; for (var tk in D.tb) truncBy[tk] = (truncBy[tk] || 0) + D.tb[tk]; }
            for (var mk2 in maxN) maxN[mk2] = Math.max(maxN[mk2], D[mk2].length);
            // 道路の点を格子に入れる
            grid.clear();
            for (var s = Math.ceil((sCam - 36) / 20) * 20; s <= sCam + P.viewLen; s += 20) {
                var idx = s & TMASK, px = track.px[idx], pz = track.pz[idx];
                var kk = key(Math.floor(px / CELL), Math.floor(pz / CELL));
                var arr = grid.get(kk); if (!arr) { arr = []; grid.set(kk, arr); }
                arr.push(px, pz, track.py[idx], s);
            }
            var check = function (o, radius, topY) {
                var ix = Math.floor(o.x / CELL), iz = Math.floor(o.z / CELL), lim = DECK_EDGE + radius;
                var reach = Math.ceil(lim / CELL);
                for (var dx = -reach; dx <= reach; dx++) for (var dz = -reach; dz <= reach; dz++) {
                    var arr = grid.get(key(ix + dx, iz + dz)); if (!arr) continue;
                    for (var i = 0; i < arr.length; i += 4) {
                        var ex = arr[i] - o.x, ez = arr[i + 1] - o.z, d = Math.sqrt(ex * ex + ez * ez);
                        if (topY !== undefined && topY < arr[i + 2] - P.fasciaH) continue;
                        var clr = d - lim;
                        if (clr < minClr) { minClr = clr; minAt = sCam; }
                        if (clr < 0) {
                            viol++;
                            if (!seen.has(o)) { seen.add(o); violObj++; if (first.length < 5) first.push('s=' + sCam.toFixed(0) + ' road s=' + arr[i + 3] + ' d=' + d.toFixed(1) + ' lim=' + lim.toFixed(1)); }
                        }
                    }
                }
            };
            D.houses.forEach(function (o) { check(o, 0.5 * Math.sqrt(o.w * o.w + o.d * o.d)); });
            D.bldgs.forEach(function (o) { if (!o.isPart) check(o, o.rad || 0.5 * Math.sqrt(o.w * o.w + o.d * o.d)); });   // 部品は親の判定半径に含まれる
            D.blocks.forEach(function (o) { if (!o.isPart) check(o, 0.5 * Math.sqrt(o.w * o.w + o.d * o.d)); });
            D.trees.forEach(function (o) { check(o, 0.45 * Math.max(o.sx, o.sz), GROUND_Y + o.sy); });
            D.lights.forEach(function (o) { check(o, 0); });
            D.pools.forEach(function (o) { check(o, POOL_R); });
            D.bpts.forEach(function (o) { check(o, 0); });
            // 線路: 世界固定物が中心線から 9 m（+ 半径）以内、橋脚が 7 m 以内
            var rchk = function (o, radius, kind) {
                for (var kk in railCache) { var LL = railCache[kk], dd = lineDist(LL, o.x, o.z) - (RAIL_CLEAR + radius); if (dd < railMin) railMin = dd;
                    if (dd < 0) { railViol++; if (railFirst.length < 6 && !seen.has(o)) { seen.add(o); railFirst.push(kind + ' s=' + sCam.toFixed(0) + ' line ' + LL.k + ' sc-s=' + (LL.sc - sCam).toFixed(0) + ' genAt=' + (LL.genAt - sCam).toFixed(0) + ' d=' + dd.toFixed(1)); } } }
            };
            D.houses.forEach(function (o) { rchk(o, 0.5 * Math.sqrt(o.w * o.w + o.d * o.d), 'house'); });
            D.bldgs.forEach(function (o) { if (!o.isPart) rchk(o, o.rad || 0.5 * Math.sqrt(o.w * o.w + o.d * o.d), 'bldg'); });
            D.blocks.forEach(function (o) { if (!o.isPart) rchk(o, 0.5 * Math.sqrt(o.w * o.w + o.d * o.d), 'block'); });
            D.trees.forEach(function (o) { rchk(o, 0.45 * Math.max(o.sx, o.sz), 'tree'); });
            D.lights.forEach(function (o) { rchk(o, 0, 'light'); });
            D.pools.forEach(function (o) { rchk(o, POOL_R, 'pool'); });
            D.bpts.forEach(function (o) { rchk(o, 0, 'bpt'); });
            // v8: ランプの中心線から 9 m（＋半径）以内の物、ランプと線路の離隔
            var rmpChk = function (o, radius, kind) { var dR = rampNear(o.x, o.z, RAIL_CLEAR + radius + 1) - (RAIL_CLEAR + radius); if (dR < rampMin) rampMin = dR; if (dR < 0) { rampViol++; rampBy[kind] = (rampBy[kind] || 0) + 1; if (rampFirst.length < 3) rampFirst.push(kind + ' s=' + sCam + ' d=' + dR.toFixed(1) + ' roadMin=' + o.roadMin + ' lat=' + o.lat + ' gen=' + o.genS + ' genRamp=' + o.genRamp + ' genIC=' + o.genIC + ' nowIC=' + icList.length + ' r=' + (0.5 * Math.sqrt(o.w * o.w + o.d * o.d)).toFixed(0)); } };
            D.houses.forEach(function (o) { rmpChk(o, 0.5 * Math.sqrt(o.w * o.w + o.d * o.d), 'house'); });
            D.bldgs.forEach(function (o) { if (!o.isPart) rmpChk(o, o.rad || 0.5 * Math.sqrt(o.w * o.w + o.d * o.d), 'bldg'); });
            D.trees.forEach(function (o) { rmpChk(o, 0.45 * Math.max(o.sx, o.sz), 'tree'); });
            D.lights.forEach(function (o) { rmpChk(o, 0, 'light'); });
            D.pools.forEach(function (o) { rmpChk(o, POOL_R, 'pool'); });
            D.poles.forEach(function (o) { rmpChk(o, 0, 'pole'); });
            // v9: 川と両岸 10 m に物を置かない、線路も寄らない
            var rivChk = function (o, r) { if (riverDist(o.x, o.z) < 10 + r || groadDist(o.x, o.z) < 3 + r) rivViol++; };
            D.houses.forEach(function (o) { rivChk(o, 0.5 * Math.sqrt(o.w * o.w + o.d * o.d)); });
            D.bldgs.forEach(function (o) { if (!o.isPart) rivChk(o, o.rad || 0.5 * Math.sqrt(o.w * o.w + o.d * o.d)); });
            D.trees.forEach(function (o) { rivChk(o, 0.45 * Math.max(o.sx, o.sz)); });
            D.lights.forEach(function (o) { rivChk(o, 0); });
            for (var kr in railCache) { var LR = railCache[kr]; if (!rivSeen.has(kr)) { rivSeen.add(kr); if (LR.par ? parHitsRiver(LR) : lineHitsRiver(LR)) rivRailViol++; } }   // 川を渡る線路の数（鉄橋）
            icList.forEach(function (ic) {
                if (!ic.ramps || ic.zB < sCam - 2000 || ic.zA > sCam + 2000 || icSeen.has(ic.n)) return;
                icSeen.add(ic.n);
                ic.ramps.forEach(function (R) {
                    if (R.gmax > 0.06) rampGradeViol++; if (R.rmin < 80) rampRadViol++;
                    if (!R.empty && R.noseTip >= 0) for (var jg = R.noseTip; jg < R.n; jg++) { var lg = Math.abs(R.pts[jg].r.lat) - 2.6, ry = R.pts[jg].roadY; var drawn = !(lg < P.roadHalf + 0.3 && ry !== undefined && Math.abs(R.Y[jg] - ry) <= 2.0) || Q_OLDRAIL; if (drawn && lg < P.roadHalf && ry !== undefined && Math.abs(R.Y[jg] - ry) <= 2.0) { railInViol++; if (railInFirst.length < 4) railInFirst.push(ic.n + 'k' + R.k + '@' + Math.round(R.pts[jg].r.s) + ':' + lg.toFixed(2)); break; } }   // ノーズから先の内側のガードレールが本線の舗装の上に出ていないか
                    for (var kk3 in railCache) { var LL = railCache[kk3]; for (var j3 = 0; j3 < R.n; j3 += 3) { if (!LL.par && R.Y[j3] - 2.2 >= P.groundY + RAIL_Y + 6.5) continue; var dl = lineDist(LL, R.X[j3], R.Z[j3]) - (RAIL_CLEAR + 3.5); if (dl < rampRailMin) rampRailMin = dl; if (dl < 0) { rampRailViol++; break; } } }   // ランプの下をくぐる所（桁下 6.5 m 以上）は除く
                });
                if (rampsClash(ic.ramps[0], ic.ramps[1]) || rampsClash(ic.ramps[2], ic.ramps[3])) rampClash++;
            });
            for (var qs2 = firstStation(sCam - 60, P.pierPeriod, P.pierPhase); qs2 < sCam + P.viewLen; qs2 += P.pierPeriod) {
                var pi2 = qs2 & TMASK, px2 = track.px[pi2], pz2 = track.pz[pi2];
                if (!clearOfRail(px2, pz2, 0, PIER_RAIL_CLEAR)) continue;        // 描画側と同じ規則で置かれない橋脚
                for (var kk2 in railCache) if (lineDist(railCache[kk2], px2, pz2) < PIER_RAIL_CLEAR) pierViol++;
                piersChecked++;
            }
        }
        var msg = 'SELFTEST seed=' + seed + ' km=' + km + ' steps=' + steps + ' violations=' + viol + ' objects=' + violObj +
            ' minClearance=' + minClr.toFixed(2) + 'm at s=' + minAt.toFixed(0) + ' truncSteps=' + truncSteps + ' truncTotal=' + truncSum +
            ' by=' + JSON.stringify(truncBy) + ' max=' + JSON.stringify(maxN) +
            ' | farMat(min=' + farMatMin.toFixed(0) + 'm within700=' + farMatNear + ') blockAsNear(min=' + (blkNearMin > 1e8 ? 'n/a' : blkNearMin.toFixed(0) + 'm') + ')' +
            ' | ' + icSummary(sStart, sCam) + ' rampViol=' + rampViol + JSON.stringify(rampBy) + rampFirst.join(';') + ' rampMinClear=' + rampMin.toFixed(1) + 'm rampGrade>6%=' + rampGradeViol + ' rampR<80=' + rampRadViol + ' rampRailViol=' + rampRailViol + ' rampRailMin=' + (rampRailMin > 1e8 ? 'n/a' : rampRailMin.toFixed(0) + 'm') + ' rampClash=' + rampClash + ' railIn=' + railInViol + (railInFirst.length ? '[' + railInFirst.join(';') + ']' : '') + ' riverViol=' + rivViol + ' railBridges=' + rivRailViol + ' rivers=' + rivers.filter(function (R) { return R.s0 > sStart && R.s0 < sCam; }).length + ' groads=' + groads.filter(function (R) { return R.s0 > sStart && R.s0 < sCam; }).length + ' wheels=' + wheelMade + '/' + (wheelSlot + 1) + ' halls=' + hallMade +
            ' | rail lines=' + linesSeen.size + ' railViol=' + railViol + ' railMinClear=' + railMin.toFixed(2) + 'm pierViol=' + pierViol + ' (piers checked ' + piersChecked + ')' +
            ' | ' + encSummary(encStarts, (sCam - sStart) / spdT, encType) + ' crossSkip=' + JSON.stringify(Object.keys(railSkip).reduce(function (a, k) { var w = railSkip[k].skipWhy || '?'; a[w] = (a[w] || 0) + 1; return a; }, {})) +
            ' parSkip=' + JSON.stringify(Object.keys(parSkip).reduce(function (a, k) { var w = String(parSkip[k]).split(' ')[0]; a[w] = (a[w] || 0) + 1; return a; }, {})) +
            ' align=' + JSON.stringify(alignStat) + ' parLR=' + parSideN.join('/') +
            ' | par lines=' + parSeen.size + ' parRoadViol=' + parRoadViol + ' parRoadMinClear=' + (parRoadMin > 1e8 ? 'n/a' : parRoadMin.toFixed(1) + 'm') + ' parGradeViol=' + parGradeViol + ' parSkipped=' + Object.keys(parSkip).length + (railFirst.length ? '\n  ' + railFirst.join('\n  ') : '') + (first.length ? '\n  ' + first.join('\n  ') : '');
        if (q.encfrom) msg += '\n  trace: ' + encTrace.join(' ');
        if (q.encdbg) msg += '\n  skips: ' + Object.keys(railSkip).map(function (k) { return (railStation(+k) / 1000).toFixed(1) + railSkip[k].skipWhy; }).join(' ') +
            '\n  pars: ' + Object.keys(parKept).map(function (k) { return (parKept[k].sA / 1000).toFixed(1) + '[' + (parKept[k].sR / 1000).toFixed(1) + '-' + (parKept[k].sE / 1000).toFixed(1) + ']' + (parKept[k].sL / 1000).toFixed(1) + (parKept[k].side < 0 ? 'L' : 'R') + parKept[k].nc + 'c'; }).join(' ') + ' | crosses: ' + crossLog.join(' ') +
            '\n  enc: ' + encStarts.map(function (x, i) { return (x * spdT / 1000 + sStart / 1000).toFixed(1) + ['', 's', 'o', 'so', 'c', 'sc', 'oc', 'soc'][encBits[i]]; }).join(' ');
        logErr(msg);
    }

    // 光の円錐
    var NCONE = 48;
    var coneGeo = new THREE.BufferGeometry();
    (function () {
        var center = new Float32Array(NCONE * 4 * 3), corner = new Float32Array(NCONE * 4 * 2), ai = new Float32Array(NCONE * 4);
        var idx = [];
        for (var i = 0; i < NCONE; i++) {
            var b = i * 4;
            corner[b * 2 + 0] = -1; corner[b * 2 + 1] = 0;
            corner[b * 2 + 2] =  1; corner[b * 2 + 3] = 0;
            corner[b * 2 + 4] = -1; corner[b * 2 + 5] = -1;
            corner[b * 2 + 6] =  1; corner[b * 2 + 7] = -1;
            idx.push(b, b + 2, b + 1, b + 1, b + 2, b + 3);
        }
        coneGeo.setAttribute('aCenter', new THREE.BufferAttribute(center, 3).setUsage(THREE.DynamicDrawUsage));
        coneGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NCONE * 4 * 3), 3));
        coneGeo.setAttribute('aCorner', new THREE.BufferAttribute(corner, 2));
        coneGeo.setAttribute('aI', new THREE.BufferAttribute(ai, 1).setUsage(THREE.DynamicDrawUsage));
        coneGeo.setIndex(idx);
        coneGeo.setDrawRange(0, 0);
    })();
    var coneMat = new THREE.ShaderMaterial({
        vertexShader: S.coneVert, fragmentShader: S.coneFrag, transparent: true,
        blending: THREE.AdditiveBlending, depthWrite: false, depthTest: true,
        uniforms: { uCamPos: U.uCamPos, uConeW: { value: 7.0 }, uConeH: { value: P.lampH - 1.5 }, uLampCol: U.uLampCol }
    });
    var cones = new THREE.Mesh(coneGeo, coneMat); cones.frustumCulled = false; cones.renderOrder = 9; scene.add(cones);

    // 流れ星
    var meteorMat = new THREE.ShaderMaterial({
        vertexShader: S.meteorVert, fragmentShader: S.meteorFrag, transparent: true,
        blending: THREE.AdditiveBlending, depthWrite: false, depthTest: true,   // 低い流れ星は手前の建物・山に隠れる
        uniforms: { uI: { value: 0 } }
    });
    var meteor = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), meteorMat);
    meteor.visible = false; meteor.frustumCulled = false; meteor.renderOrder = -8; skyGroup.add(meteor);
    var meteorState = { next: P.meteorMin + rng() * (P.meteorMax - P.meteorMin), t: -1, p0: new THREE.Vector3(), dir: new THREE.Vector3(), len: 0, dur: 0.9 };

    // --- 飛行機の灯火と観覧車の電飾（世界座標の点。霧で減衰、建物・山に隠れる） ---
    var NSKY = 2000, skyPos = new Float32Array(NSKY * 3), skyCol = new Float32Array(NSKY * 3), skySize = new Float32Array(NSKY);
    var skyGeo = new THREE.BufferGeometry();
    skyGeo.setAttribute('position', new THREE.BufferAttribute(skyPos, 3).setUsage(THREE.DynamicDrawUsage));
    skyGeo.setAttribute('aCol', new THREE.BufferAttribute(skyCol, 3).setUsage(THREE.DynamicDrawUsage));
    skyGeo.setAttribute('aSize', new THREE.BufferAttribute(skySize, 1).setUsage(THREE.DynamicDrawUsage));
    skyGeo.setDrawRange(0, 0);
    var skyPtMat = new THREE.ShaderMaterial({
        vertexShader: S.skyptVert, fragmentShader: S.skyptFrag, transparent: true,
        blending: THREE.AdditiveBlending, depthWrite: false, depthTest: true,
        uniforms: { uCamPos: U.uCamPos, uFogDensity: U.uFogDensity, uFogH: U.uFogH, uOriginY: U.uOriginY,
                    uFogBase: U.uFogBase, uGlowCol: U.uGlowCol, uFogGlow: U.uFogGlow, uCityTex: U.uCityTex,
                    uPxK: { value: 600 }, uPointMax: U.uPointMax }
    });
    var skyPts = new THREE.Points(skyGeo, skyPtMat); skyPts.frustumCulled = false; skyPts.renderOrder = 6; scene.add(skyPts);
    var srng2 = mulberry32(seed * 977 + 31);                                  // 飛行機の抽選（景色の乱数とは別）
    var planes = [], planeNext = 15 + srng2() * 30, wheelLogged = false;
    function hsv(h, s, v) { h = (h - Math.floor(h)) * 6; var i = Math.floor(h), f = h - i, p = v * (1 - s), qq = v * (1 - s * f), t = v * (1 - s * (1 - f)); return [[v, t, p], [qq, v, p], [p, v, t], [p, qq, v], [t, p, v], [v, p, qq]][i % 6]; }
    // 電飾の模様（30 秒ごとに切り替え、3 秒で溶け合わせる）。k = 車輪の上の位置（0〜1、回転と一緒に回る）、rf = 中心からの割合、kind 0 = 外周 1 = スポーク
    function wheelCol(mode, k, rf, kind, t) {
        if (mode === 0) return kind === 0 ? [1.0, 0.9, 0.75] : [0.75, 0.82, 1.0];
        if (mode === 1) return hsv(k + t * 0.03, 0.7, 1.0);
        if (mode === 2) return hsv(t * 0.012, 0.55, 1.0);
        var w = rf - (t * 0.35 - Math.floor(t * 0.35)); w -= Math.round(w);
        var pl = 0.25 + 0.75 * Math.exp(-w * w * 60);
        return kind === 0 ? [0.55, 0.75, 1.0] : [0.7 * pl, 0.85 * pl, 1.0 * pl];
    }
    function updateSkyObjs(dt) {
        var n = 0, t = timeSec;
        skyPtMat.uniforms.uPxK.value = renderer.domElement.height / (2 * Math.tan(camera.fov * Math.PI / 360));
        function put(x, y, z, r, g, b, sz) { if (n >= NSKY) return; skyPos[n * 3] = x - O.x; skyPos[n * 3 + 1] = y - O.y; skyPos[n * 3 + 2] = z - O.z; skyCol[n * 3] = r; skyCol[n * 3 + 1] = g; skyCol[n * 3 + 2] = b; skySize[n] = sz; n++; }
        var cwx = camera.position.x + O.x, cwy = camera.position.y + O.y, cwz = camera.position.z + O.z;
        // 観覧車: 12 分で 1 回転。外周 144・スポーク 24 本 × 6・ゴンドラ 36（室内灯）・ハブ・航空障害灯（ハブの上、赤の常灯）
        for (var wi = 0; wi < wheels.length; wi++) {
            var W = wheels[wi], dH = Math.hypot(W.x - cwx, W.z - cwz);
            var fade = 1 - Math.max(0, Math.min(1, (dH - 3600) / 700));          // 遠景の街リング（半径 4.5 km〜）より手前だけで見せる
            if (fade <= 0) continue;
            var phi = t * 6.2831853 / 720 + W.ph * 6.2831853, R = W.R;
            var tt = t + W.ph * 300, md = Math.floor(tt / 30), fr = Math.min(1, (tt - md * 30) / 3), m0 = (md + 3) % 4, m1 = md % 4;
            var G = 1.8 * fade;                                                    // 3 km 先で外周の線が 0.3 程度（霧・1 画素未満の面積比を含めて）。近くで白飛びさせない
            var lit = function (k, rf, kind) { var a = wheelCol(m0, k, rf, kind, tt), b = wheelCol(m1, k, rf, kind, tt); return [(a[0] + (b[0] - a[0]) * fr) * G, (a[1] + (b[1] - a[1]) * fr) * G, (a[2] + (b[2] - a[2]) * fr) * G]; };
            var at = function (th, rho, dy) { return [W.x + W.ax * rho * Math.cos(th), W.y + rho * Math.sin(th) + (dy || 0), W.z + W.az * rho * Math.cos(th)]; };
            for (var k = 0; k < 144; k++) { var p = at(phi + k * 6.2831853 / 144, R), c = lit(k / 144, 1, 0); put(p[0], p[1], p[2], c[0], c[1], c[2], 6.2831853 * R / 144); }
            for (var sp = 0; sp < 24; sp++) for (var j = 1; j <= 6; j++) { var rf = j / 6.5, p2 = at(phi + sp * 6.2831853 / 24, R * rf), c2 = lit(sp / 24, rf, 1); put(p2[0], p2[1], p2[2], c2[0] * 0.5, c2[1] * 0.5, c2[2] * 0.5, R / 6.5); }
            for (var gq = 0; gq < 36; gq++) { var p3 = at(phi + (gq + 0.5) * 6.2831853 / 36, R + 1.8, -2.2); put(p3[0], p3[1], p3[2], 1.6 * fade, 1.2 * fade, 0.8 * fade, 2.6); }
            put(W.x, W.y, W.z, 1.5 * fade, 1.5 * fade, 1.5 * fade, 3.0);
            var dO = Math.hypot(W.x - cwx, W.y - cwy, W.z - cwz), oG = Math.min(1.5, 2500 / dO) * fade;
            put(W.x, W.y + 4, W.z, 3.0 * oG, 0.25 * oG, 0.10 * oG, -1.2);
        }
        // 遠くのパチンコ店の看板: 1 画素より小さくなると板は描かれずに消えるので、900〜1200 m で看板の面積ぶんの光の点に切り替える（板は 1.2 km まで）
        // （袖看板 = 赤のネオン、屋上の看板 = 赤 + 2 色目。点灯の周期はシェーダーと同じ 8 秒: 灯り始め・点滅の間は暗く）
        if (!/pachi/.test(q.hide)) for (var hi = 0; hi < hallList.length; hi++) {
            var HL = hallList[hi]; if (HL.fail) continue;
            var dh = Math.hypot(HL.x - cwx, HL.z - cwz); if (dh > 3500 || dh < 900) continue;
            var fN = Math.min(1, (dh - 900) / 300);
            var pp = ((t + HL.ph * 37) % 8 + 8) % 8, la = pp < 2.4 ? pp / 2.4 : (pp > 5.4 && pp < 6.6 ? (((pp - 5.4) / 0.4) % 1 < 0.55 ? 1 : 0) : 1);
            var hNx = -HL.side * HL.ct, hNz = -HL.side * HL.sn;
            var plx = HL.x + hNx * (HL.d / 2 + 2) + HL.sn * (HL.w / 2 - 3), plz = HL.z + hNz * (HL.d / 2 + 2) - HL.ct * (HL.w / 2 - 3);
            put(plx, GROUND_Y + HL.hp - 4.5, plz, (2.3 * 0.25 * la + 0.25) * fN, (0.22 * 0.25 * la + 0.17) * fN, (0.40 * 0.25 * la + 0.07) * fN, 7.0);
            put(HL.x + hNx * (HL.d / 2 - 1), GROUND_Y + HL.h + 2.8, HL.z + hNz * (HL.d / 2 - 1),
                (2.3 * 0.2 * la + HL.colB[0] * 0.15 + 0.15) * fN, (0.22 * 0.2 * la + HL.colB[1] * 0.15 + 0.10) * fN, (0.40 * 0.2 * la + HL.colB[2] * 0.15 + 0.04) * fN, 14.0);
        }
        // 大型スーパーの箱型看板: 3 × 2 の点で箱の面を埋める（上の段 = 店の色、下の段 = 白）。1 点が 1 画素前後になる大きさ。0.4 km より近くと 4.5 km より遠くは出さない
        ensureMarts(sCam + 6000);
        if (!/mart/.test(q.hide)) for (var mi = 0; mi < martList.length; mi++) {
            var MT = martList[mi], dm = Math.hypot(MT.x - cwx, MT.z - cwz);
            var fM = Math.min(1, (dm - 400) / 200) * (1 - Math.max(0, Math.min(1, (dm - 3800) / 700)));
            if (fM <= 0) continue;
            for (var my = 0; my < 2; my++) for (var mx = 0; mx < 3; mx++) {
                var ux = (mx - 1) / 3 * MT.w, uy = (0.5 - my) / 2 * MT.hb, top = my === 0, gk = 1.1 * fM;
                put(MT.x + MT.tx * ux, MT.y + uy, MT.z + MT.tz * ux, (top ? MT.col[0] : 1.3) * gk, (top ? MT.col[1] : 1.25) * gk, (top ? MT.col[2] : 1.15) * gk, MT.w / 3);
            }
        }
        // 飛行機: 30〜90 秒に 1 機。前方 ±35°・水平 3〜8 km の点を高度 1.5〜10 km で横切る。灯火 = 左翼端の赤・右翼端の緑・尾灯の白（常灯）、
        // 胴体の赤の衝突防止灯（1 秒に 1 回）、翼端の白の閃光（1.3 秒ごとに 2 連）
        if (!q.shot || q.skytest) planeNext -= dt;
        if (q.skytest === 'p' && !planes.length) planeNext = 0;
        if (planeNext <= 0 && planes.length < 2) {
            camera.getWorldDirection(tmpV3);
            var fa = Math.atan2(tmpV3.x, -tmpV3.z) + (srng2() - 0.5) * 1.2, gd = 3000 + 5000 * srng2(), alt = srng2() < 0.25 ? 1500 + 1500 * srng2() : 4000 + 6000 * srng2();
            var hd = srng2() * 6.2831853, vs = alt < 3000 ? 110 + 40 * srng2() : 190 + 50 * srng2(), T = 160;
            if (q.skytest === 'p') { fa = Math.atan2(tmpV3.x, -tmpV3.z) - 0.3; gd = 3000; alt = 600; hd = fa + 1.4; vs = 120; }
            var px = cwx + Math.sin(fa) * gd, pz = cwz - Math.cos(fa) * gd;
            planes.push({ x0: px - Math.sin(hd) * vs * T / 2, z0: pz + Math.cos(hd) * vs * T / 2, y: GROUND_Y + alt, hx: Math.sin(hd), hz: -Math.cos(hd), v: vs, age: q.skytest === 'p' ? T / 2 : 0, T: T, bp: srng2(), sp: srng2() });
            planeNext = 30 + 60 * srng2();
        }
        for (var pi = planes.length - 1; pi >= 0; pi--) {
            var PL = planes[pi];
            if ((!q.shot || q.skytest) && q.skytest !== 'p') PL.age += dt;
            if (PL.age > PL.T) { planes.splice(pi, 1); continue; }
            var cx = PL.x0 + PL.hx * PL.v * PL.age, cz = PL.z0 + PL.hz * PL.v * PL.age, cy = PL.y;
            var dd = Math.hypot(cx - cwx, cy - cwy, cz - cwz);
            if (dd > 11500) continue;
            var g2 = Math.min(1.6, Math.max(0.45, 5000 / dd)) * (1 - Math.max(0, Math.min(1, (dd - 10000) / 1500)));
            var rxp = -PL.hz, rzp = PL.hx;                                      // 右翼の向き
            put(cx - rxp * 17, cy, cz - rzp * 17, 0.9 * g2, 0.06 * g2, 0.04 * g2, -1.3);
            put(cx + rxp * 17, cy, cz + rzp * 17, 0.05 * g2, 0.85 * g2, 0.35 * g2, -1.3);
            put(cx - PL.hx * 30, cy + 2, cz - PL.hz * 30, 0.6 * g2, 0.6 * g2, 0.6 * g2, -1.2);
            var bph = (t + PL.bp) % 1.0;
            if (bph < 0.12 || q.skytest === 'p') put(cx, cy - 2, cz, 1.6 * g2, 0.12 * g2, 0.06 * g2, -1.6);
            var sph = (t + PL.sp * 1.3) % 1.3;
            if (sph < 0.05 || (sph > 0.14 && sph < 0.19) || q.skytest === 'p') { put(cx - rxp * 17, cy, cz - rzp * 17, 3.0 * g2, 3.0 * g2, 3.2 * g2, -1.8); put(cx + rxp * 17, cy, cz + rzp * 17, 3.0 * g2, 3.0 * g2, 3.2 * g2, -1.8); }
        }
        updateXev(dt, put);
        skyGeo.setDrawRange(0, n);
        if (q.skytest === "w" && !wheelLogged) { wheelLogged = true; logErr("WHEELS " + wheels.map(function (W) { tmpV.set(W.x - O.x, W.y - O.y, W.z - O.z).project(camera); return W.s.toFixed(0) + " d=" + Math.hypot(W.x - cwx, W.z - cwz).toFixed(0) + " ndc=" + tmpV.x.toFixed(2) + "," + tmpV.y.toFixed(2) + " R=" + W.R.toFixed(0); }).join(" / ") + " sCam=" + sCam.toFixed(0) + " n=" + n); }   // 試験用（skytest=w）
        skyGeo.attributes.position.needsUpdate = true; skyGeo.attributes.aCol.needsUpdate = true; skyGeo.attributes.aSize.needsUpdate = true;
    }

    // --- パチンコ店の看板（水平 1.2 km 以内で板を作り、離れたら捨てる。3.5 km までは光の点） ---
    var pachiLive = {}, pylonTex = null, hallLogged = false, hallLogN = 0;
    // 縁の電球の並び: 外周（内側に m だけ入った長方形）を左下から反時計回りに 0〜1。シェーダーと同じ式
    function perimUV(t, asp, m) {
        var W = asp - 2 * m, H = 1 - 2 * m, L = 2 * (W + H), s = t * L;
        if (s < W) return [m + s, m];
        s -= W; if (s < H) return [m + W, m + s];
        s -= H; if (s < W) return [m + W - s, m + H];
        s -= W; return [m, m + H - s];
    }
    // ネオン看板の画像: R = 赤のネオン管（文字の輪郭）、B = 2 色目のネオン、G = 縁の電球。ネオンは輪郭を太い線で描いてぼかしを重ねる
    function neonTex(Wc, Hc, asp, m, nB, drawR, drawB) {
        function layer(fn) {
            var cv = document.createElement('canvas'); cv.width = Wc; cv.height = Hc; var c = cv.getContext('2d');
            c.fillStyle = '#000'; c.fillRect(0, 0, Wc, Hc); c.strokeStyle = '#fff'; c.fillStyle = '#fff'; c.lineJoin = 'round'; c.lineCap = 'round';
            fn(c); return c.getImageData(0, 0, Wc, Hc).data;
        }
        function tube(c, fn, lw) { c.save(); c.shadowColor = '#fff'; c.shadowBlur = lw * 2.2; c.globalAlpha = 0.55; c.lineWidth = lw * 1.8; fn(c); c.restore(); c.lineWidth = lw; fn(c); }
        var R = layer(function (c) { drawR(c, tube); }), B = layer(function (c) { if (drawB) drawB(c, tube); });
        var G = layer(function (c) {
            var rad = Math.max(2.5, Hc * 0.012);
            for (var i = 0; i < nB; i++) { var u = perimUV((i + 0.5) / nB, asp, m); c.beginPath(); c.arc(u[0] / asp * Wc, (1 - u[1]) * Hc, rad, 0, 6.2832); c.fill(); }
        });
        var cv = document.createElement('canvas'); cv.width = Wc; cv.height = Hc; var c2 = cv.getContext('2d'), img = c2.createImageData(Wc, Hc);
        for (var i = 0; i < Wc * Hc * 4; i += 4) { img.data[i] = R[i]; img.data[i + 1] = G[i]; img.data[i + 2] = B[i]; img.data[i + 3] = 255; }
        c2.putImageData(img, 0, 0);
        var t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.NoColorSpace; t.anisotropy = maxAniso; t.minFilter = THREE.LinearMipmapLinearFilter; return t;
    }
    var PYL_W = 3.2, PYL_H = 12.8, PYL_NB = 46;
    function makePylonTex() {                                             // 袖看板: 縦書きの「パチンコ」、上下に 2 色目のネオンの横線
        return neonTex(128, 512, PYL_W / PYL_H, 0.035, PYL_NB, function (c, tube) {
            c.font = '900 92px ' + SIGN_FONT; c.textAlign = 'center'; c.textBaseline = 'middle';
            'パチンコ'.split('').forEach(function (ch, i) { tube(c, function (cc) { cc.strokeText(ch, 64, 70 + i * 106); }, 5); });
        }, function (c, tube) {
            tube(c, function (cc) { cc.beginPath(); cc.moveTo(22, 22); cc.lineTo(106, 22); cc.moveTo(22, 490); cc.lineTo(106, 490); cc.stroke(); }, 4);
        });
    }
    function makeFacadeTex(name, asp) {                                   // 屋上の看板: 左に「パチンコ」（赤）、右に店名（2 色目）
        var Wc = 1024, Hc = Math.round(1024 / asp);
        return neonTex(Wc, Hc, asp, 0.08, Math.round(PYL_NB * asp * 0.55), function (c, tube) {
            c.font = '900 ' + Math.round(Hc * 0.62) + 'px ' + SIGN_FONT; c.textAlign = 'left'; c.textBaseline = 'middle';
            tube(c, function (cc) { cc.strokeText('パチンコ', Wc * 0.05, Hc * 0.53, Wc * 0.42); }, Math.max(4, Hc * 0.035));
        }, function (c, tube) {
            c.font = '900 ' + Math.round(Hc * 0.55) + 'px ' + SIGN_FONT; c.textAlign = 'center'; c.textBaseline = 'middle';
            tube(c, function (cc) { cc.strokeText(name, Wc * 0.74, Hc * 0.53, Wc * 0.44); }, Math.max(4, Hc * 0.032));
        });
    }
    function pachiMat(tex, H, vert, asp, m, nB) {
        return new THREE.ShaderMaterial({
            vertexShader: S.pachiVert, fragmentShader: S.pachiFrag,
            uniforms: { uCamPos: U.uCamPos, uFogDensity: U.uFogDensity, uFogH: U.uFogH, uOriginY: U.uOriginY,
                        uFogBase: U.uFogBase, uGlowCol: U.uGlowCol, uFogGlow: U.uFogGlow, uCityTex: U.uCityTex, uTime: U.uTime,
                        uTex: { value: tex }, uPh: { value: H.ph }, uColA: { value: new THREE.Vector3(2.3, 0.22, 0.40) }, uColB: { value: new THREE.Vector3().fromArray(H.colB) },
                        uBulb: { value: new THREE.Vector3(2.1, 1.45, 0.55) }, uVert: { value: vert ? 1 : 0 }, uAsp: { value: asp }, uM: { value: m }, uNB: { value: nB } }
        });
    }
    function buildHall(H) {
        var g = new THREE.Group(), own = [];
        var Nx = -H.side * H.ct, Nz = -H.side * H.sn, Fx = H.sn, Fz = -H.ct;          // N = 道路の方、F = 進行方向
        // 屋上の看板（道路側の縁に立てる。下端は屋上 + 0.3 m）
        var fw = Math.min(30, H.w * 0.55), fh = 5.0, fasp = fw / fh;
        var ftex = makeFacadeTex(H.name, fasp), fmat = pachiMat(ftex, H, false, fasp, 0.08, Math.round(PYL_NB * fasp * 0.55)), fgeo = new THREE.PlaneGeometry(fw, fh);
        var fm = new THREE.Mesh(fgeo, fmat); fm.position.set(Nx * (H.d / 2 - 1.0), H.h + 0.3 + fh / 2, Nz * (H.d / 2 - 1.0)); fm.rotation.y = Math.atan2(Nx, Nz); g.add(fm);
        var fbGeo = new THREE.BoxGeometry(fw + 0.4, fh + 0.4, 0.4), fb = new THREE.Mesh(fbGeo, signPoleMat);   // 看板の箱と脚
        fb.position.copy(fm.position).addScaledVector(new THREE.Vector3(Nx, 0, Nz), -0.22); fb.rotation.y = fm.rotation.y; g.add(fb);
        // 袖看板（道路側の壁の角から道路の方へ突き出す縦長の箱、両面が進行方向の前後を向く。上端は屋上 + 2 m）
        if (!pylonTex) pylonTex = makePylonTex();
        var px = Nx * (H.d / 2 + PYL_W / 2 + 0.4) + Fx * (H.w / 2 - 3), pz = Nz * (H.d / 2 + PYL_W / 2 + 0.4) + Fz * (H.w / 2 - 3), poleH = H.hp - PYL_H;
        var bgeo = new THREE.BoxGeometry(PYL_W + 0.3, PYL_H + 0.3, 0.6), bm = new THREE.Mesh(bgeo, signPoleMat); bm.position.set(px, poleH + PYL_H / 2, pz); bm.rotation.y = Math.atan2(Fx, Fz); g.add(bm);
        var pmat = pachiMat(pylonTex, H, true, PYL_W / PYL_H, 0.035, PYL_NB), sgeo = new THREE.PlaneGeometry(PYL_W, PYL_H);
        [1, -1].forEach(function (sg) {
            var m = new THREE.Mesh(sgeo, pmat); m.position.set(px + Fx * sg * 0.31, poleH + PYL_H / 2, pz + Fz * sg * 0.31); m.rotation.y = Math.atan2(Fx * sg, Fz * sg); g.add(m);
        });
        own.push(ftex, fmat, fgeo, fbGeo, bgeo, pmat, sgeo);
        scene.add(g);
        return { g: g, own: own };
    }
    function updatePachi() {
        var cwx = camera.position.x + O.x, cwz = camera.position.z + O.z, want = {};
        if (!/pachi/.test(q.hide)) for (var i = 0; i < hallList.length; i++) {
            var H = hallList[i];
            if (H.fail || Math.hypot(H.x - cwx, H.z - cwz) > 1200) continue;   // 板の看板は 1.2 km まで（その先は updateSkyObjs の光の点）
            want[H.id] = 1;
            var L = pachiLive[H.id] || (pachiLive[H.id] = buildHall(H));
            L.g.position.set(H.x - O.x, GROUND_Y - O.y, H.z - O.z);
        }
        if (q.skytest === "h" && !hallLogged && hallList.length && ++hallLogN > 2) { hallLogged = true; logErr("HALLS " + hallList.map(function (H) { var Nx = -H.side * H.ct, Nz = -H.side * H.sn; return H.k * CHUNK + " ok=" + H.ok + " side=" + H.side + " d=" + Math.hypot(H.x - cwx, H.z - cwz).toFixed(0) + " blade=" + (H.x + Nx * (H.d / 2 + 2) + H.sn * (H.w / 2 - 3)).toFixed(1) + "," + (H.z + Nz * (H.d / 2 + 2) - H.ct * (H.w / 2 - 3)).toFixed(1) + " hall=" + H.x.toFixed(1) + "," + H.z.toFixed(1) + " hp=" + H.hp.toFixed(0) + " h=" + H.h.toFixed(0) + " fail=" + !!H.fail + " ndc=" + tmpV.set(H.x - O.x, GROUND_Y + H.hp - O.y, H.z - O.z).project(camera).toArray().map(function (v) { return v.toFixed(2); }); }).join(" / ")); }   // 試験用（skytest=h）
        for (var id in pachiLive) if (!want[id]) { var L2 = pachiLive[id]; scene.remove(L2.g); L2.own.forEach(function (o) { o.dispose(); }); delete pachiLive[id]; }
    }

    var jrng = mulberry32(seed * 7919 + 99);
    var XEV = { gNext: 10800 * (0.6 + 0.8 * jrng()), uNext: 18000 * (0.6 + 0.8 * jrng()), g: null, u: null };
    var tmpF = new THREE.Vector3(), tmpX = new THREE.Vector3(), tmpY = new THREE.Vector3(), tmpB = new THREE.Matrix4();

    var galGeo = carGeo.clone();
    var galMat = new THREE.ShaderMaterial({ vertexShader: S.trainVert, fragmentShader: S.trainFrag,
        uniforms: uni({ uTrainAmb: { value: new THREE.Vector3(0.22, 0.20, 0.18) }, uFadeFar: { value: 40000 } }) });
    var galCars = new THREE.InstancedMesh(galGeo, galMat, 12); galCars.instanceMatrix.setUsage(THREE.DynamicDrawUsage); galCars.frustumCulled = false; galCars.count = 0; scene.add(galCars);
    var GAL_N = 9, GAL_K = 5.0, GAL_S0 = 0, GAL_STEP = 5, GAL_MIN = -1500, GAL_MAX = 12000;
    function galSpawn(r) {
        camera.getWorldDirection(tmpV3);
        var fa = Math.atan2(tmpV3.x, -tmpV3.z), b = fa + (r() - 0.5) * 1.0, dist = 6500 + 1500 * r();
        var cx = camera.position.x + O.x, cz = camera.position.z + O.z;
        b = fa - 0.12 + r() * 0.16; r();
        var h0 = b + 0.6 + r() * 0.25, turn = 0.00006 + 0.00008 * r();
        var n = Math.round((GAL_MAX - GAL_MIN) / GAL_STEP) + 1, T = new Float32Array(n * 6);
        var x = cx + Math.sin(b) * dist, y = GROUND_Y + RAIL_Y, z = cz - Math.cos(b) * dist, psi = h0;
        x -= Math.sin(h0) * (-GAL_MIN); z += Math.cos(h0) * (-GAL_MIN);
        for (var i = 0; i < n; i++) {
            var s = GAL_MIN + i * GAL_STEP;
            var u = Math.max(0, Math.min(1, s / 1000)), th = 0.22 * u * u * (3 - 2 * u);
            if (s > 300) psi += turn * GAL_STEP;
            var fx = Math.cos(th) * Math.sin(psi), fy = Math.sin(th), fz = -Math.cos(th) * Math.cos(psi);
            T[i * 6] = x; T[i * 6 + 1] = y; T[i * 6 + 2] = z; T[i * 6 + 3] = fx; T[i * 6 + 4] = fy; T[i * 6 + 5] = fz;
            x += fx * GAL_STEP; y += fy * GAL_STEP; z += fz * GAL_STEP;
        }
        var ci = galGeo.attributes.aCarInfo.array, cb = galGeo.attributes.aBand.array;
        for (var c = 0; c < GAL_N; c++) {
            ci[c * 4] = c === GAL_N - 1 ? 100 + c : c; ci[c * 4 + 1] = 0.6 + 0.4 * r(); ci[c * 4 + 2] = (c === 2 || c === 5) ? 1 : 0;
            cb[c * 3] = 0.9; cb[c * 3 + 1] = 0.65; cb[c * 3 + 2] = 0.2;
        }
        galGeo.attributes.aBand.needsUpdate = true;
        return { t: 0, T: T, n: n, dust: [] };
    }
    function galAt(G, s, out) {
        var f = (Math.max(GAL_MIN, Math.min(GAL_MAX - GAL_STEP, s)) - GAL_MIN) / GAL_STEP, i = Math.floor(f), w = f - i, T = G.T, a = i * 6, b = a + 6;
        for (var k = 0; k < 6; k++) out[k] = T[a + k] + (T[b + k] - T[a + k]) * w;
        return out;
    }
    var galTmp = new Float32Array(6);
    function galHead(t) { return GAL_S0 + 25 * t + 1.75 * t * t; }
    function updateGalaxy(dt, put) {
        var G = XEV.g;
        if (!G) { galCars.count = 0; return; }
        var sh = galHead(G.t), ci = galGeo.attributes.aCarInfo.array, n = 0;
        var alt = galAt(G, sh, galTmp)[1] - GROUND_Y;
        var fade = 1 - Math.max(0, Math.min(1, (alt - 1800) / 1200));
        if (fade <= 0 || sh > GAL_MAX - 300) { XEV.g = null; galCars.count = 0; return; }
        for (var c = 0; c < GAL_N; c++) {
            var sr = sh - (c * (CAR_LEN + CAR_GAP) + CAR_LEN) * GAL_K, P2 = galAt(G, sr, galTmp);
            tmpF.set(P2[3], P2[4], P2[5]).normalize(); tmpX.crossVectors(yAxis, tmpF).normalize(); tmpY.crossVectors(tmpF, tmpX);
            tmpB.makeBasis(tmpX.multiplyScalar(GAL_K), tmpY.multiplyScalar(GAL_K), tmpF.multiplyScalar(GAL_K)); tmpB.setPosition(P2[0] - O.x, P2[1] - O.y, P2[2] - O.z);
            galCars.setMatrixAt(n, tmpB); ci[n * 4 + 3] = fade * 0.3; n++;
            for (var wq = 0; wq < 2; wq++) {
                var W2 = galAt(G, sr + (5.5 + wq * 9.0) * GAL_K, galTmp), wl = fade * (0.85 + 0.15 * Math.sin(c * 7.1 + wq * 2.3));
                tmpY.normalize();
                put(W2[0] + tmpY.x * 2.4 * GAL_K, W2[1] + tmpY.y * 2.4 * GAL_K, W2[2] + tmpY.z * 2.4 * GAL_K, 6.0 * wl, 4.9 * wl, 2.6 * wl, -2.2);
            }
        }
        galCars.count = n; galCars.instanceMatrix.needsUpdate = true; galGeo.attributes.aCarInfo.needsUpdate = true;
        var H = galAt(G, sh, galTmp);
        put(H[0] + H[3] * 1, H[1] + 2.0 + H[4], H[2] + H[5] * 1, 3.0 * fade, 2.9 * fade, 2.5 * fade, -2.2);
        for (var pk = 0; pk < 64; pk++) {
            var tE = Math.floor(G.t / 0.22) * 0.22 - pk * 0.22, ag = G.t - tE; if (tE < 0 || galHead(tE) < 150) break;
            var PE = galAt(G, galHead(tE) - 3.0 * GAL_K, galTmp), ph2 = Math.sin(pk * 78.233 + Math.floor(tE / 0.22) * 12.9898) * 43758.5453; ph2 -= Math.floor(ph2);
            var gr = 1 - Math.exp(-ag * 1.4), lv2 = fade * Math.exp(-ag / 4.5) * Math.min(1, ag * 6) * (0.7 + 0.6 * ph2);
            put(PE[0] + (ph2 - 0.5) * 38 * gr, PE[1] + 4.6 * GAL_K + 25 * gr + 12 * ag + (ph2 * 3 % 1 - 0.5) * 20 * gr, PE[2] + (ph2 * 7 % 1 - 0.5) * 38 * gr, 0.16 * lv2, 0.17 * lv2, 0.2 * lv2, 14 + 60 * gr);
        }
        var sTail = sh - GAL_N * (CAR_LEN + CAR_GAP) * GAL_K;
        for (var k = 1; k <= 70; k++) {
            var sk = sTail - k * 12; if (sk < 0) break;
            var Q2 = galAt(G, sk, galTmp), hsh = Math.sin(k * 12.9898 + 4.1) * 43758.5453; hsh -= Math.floor(hsh);
            var tw = 0.5 + 0.5 * Math.sin(timeSec * (6 + 9 * hsh) + k), lv = (1 - k / 70) * tw * fade;
            put(Q2[0] + (hsh - 0.5) * 8, Q2[1] + 2 + (hsh * 7 % 1 - 0.5) * 6, Q2[2] + (hsh * 13 % 1 - 0.5) * 8, 1.6 * lv, 1.35 * lv, 0.8 * lv, -1.4);
        }
        if (q.ginga === undefined || q.ginga === null) G.t += dt;
    }

    var ufoGeo = (function () {
        var pr = [[0, -6.5], [8, -7], [20, -6.6], [34, -5.4], [48, -3.6], [58, -1.6], [62, 0], [60, 1.4], [50, 3.4], [38, 5.2], [26, 7.4], [16, 9.6], [8, 11], [0, 11.4]];
        var g = new THREE.LatheGeometry(pr.map(function (p) { return new THREE.Vector2(p[0], p[1]); }), 96); g.computeVertexNormals(); return g;
    })();
    var ufoMat = new THREE.ShaderMaterial({ vertexShader: S.ufoVert, fragmentShader: S.ufoFrag, side: THREE.DoubleSide, uniforms: uni({}) });
    var ufoMesh = new THREE.Mesh(ufoGeo, ufoMat); ufoMesh.visible = false; ufoMesh.frustumCulled = false; scene.add(ufoMesh);
    var haloMat = new THREE.ShaderMaterial({ vertexShader: S.ufoHaloVert, fragmentShader: S.ufoHaloFrag, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false,
        uniforms: { uI: { value: 0 }, uKind: { value: 0 } } });
    var ufoHalo = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), haloMat); ufoHalo.visible = false; ufoHalo.frustumCulled = false; ufoHalo.renderOrder = 20; scene.add(ufoHalo);
    var poolMatU = new THREE.ShaderMaterial({ vertexShader: S.ufoHaloVert, fragmentShader: S.ufoHaloFrag, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: true,
        uniforms: { uI: { value: 0 }, uKind: { value: 1 } }, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8 });
    var ufoPool = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), poolMatU); ufoPool.visible = false; ufoPool.frustumCulled = false; ufoPool.renderOrder = 7; scene.add(ufoPool);
    var UFO_TA = 14, UFO_T0 = 1.6, UFO_T1 = 1.9, UFO_TB = 3.2;
    function ufoRoad(t, U2) { U2.u = -350 + 55 * t; U2.h = 22 + 0.6 * (t - 6.4) * (t - 6.4); U2.lat = U2.lat0 + 3 * Math.sin(t * 0.4); return U2; }
    var ufoFR = new Frame();
    function ufoRoadPos(t, U2, out) {
        ufoRoad(t, U2); frameAt(sCam + U2.u, ufoFR);
        out.copy(ufoFR.c).addScaledVector(ufoFR.r, U2.lat).addScaledVector(ufoFR.n, U2.h);
        return out;
    }
    function updateUfo(dt) {
        var Uo = XEV.u;
        if (!Uo) { ufoMesh.visible = ufoHalo.visible = ufoPool.visible = false; return; }
        var t = Uo.t, pos = new THREE.Vector3(), roll = 0, pitch = 0, yaw = 0, poolI = 0;
        if (t < UFO_TA) {
            ufoRoadPos(t, Uo, pos);
            var p2 = ufoRoadPos(t + 0.05, Uo, new THREE.Vector3());
            ufoRoad(t, Uo);
            yaw = Math.atan2(p2.x - pos.x, p2.z - pos.z); pitch = -0.06;
            var hh = Uo.h; poolI = Math.min(1, Math.pow(30 / hh, 2)) * Math.min(1, t / 2);
            frameAt(sCam + Uo.u, ufoFR);
            ufoPool.position.set(ufoFR.c.x - O.x, ufoFR.c.y + 0.08 - O.y, ufoFR.c.z - O.z); ufoPool.rotation.set(0, -ufoFR.th, 0);
        } else {
            if (!Uo.B) {
                var a0 = ufoRoadPos(UFO_TA - 0.05, Uo, new THREE.Vector3()), a1 = ufoRoadPos(UFO_TA, Uo, new THREE.Vector3());
                Uo.B = { p: a1.clone(), v: a1.clone().sub(a0).multiplyScalar(20) };
            }
            var B = Uo.B, tau = t - UFO_TA, hd0 = Math.atan2(B.v.x, B.v.z);
            if (!B.hT) {
                camera.updateMatrixWorld(); var mF = camera.matrixWorld.elements, fl = Math.hypot(mF[8], mF[10]) || 1, rl = Math.hypot(mF[0], mF[2]) || 1;
                B.f = [-mF[8] / fl, -mF[10] / fl]; B.r = [mF[0] / rl, mF[2] / rl];
                var c15 = Math.cos(0.26), s15 = Math.sin(0.26); B.hT = Math.atan2(B.f[0] * c15 + B.r[0] * s15, B.f[1] * c15 + B.r[1] * s15);
            }
            var dh = ((B.hT - hd0 + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
            var tc = Math.min(tau, UFO_T0), sT = Math.min(1, tau / UFO_T0), sm = sT * sT * (3 - 2 * sT);
            pos.copy(B.p).addScaledVector(B.v, tc - tc * tc / (2 * UFO_T0));
            yaw = hd0 + dh * sm;
            roll = -Math.sign(dh) * 0.1 * Math.sin(Math.PI * sT);
            if (tau >= UFO_T1) {
                var td = tau - UFO_T1, sd = 10 * td + 0.5 * 2600 * td * td, Ls = 600, Rr = 400, f0 = 0.26, fM = 1.35, s1 = Math.min(sd, Ls), sM = (fM - f0) * Rr, sa = Math.min(Math.max(0, sd - Ls), sM), fa = f0 + sa / Rr, s3 = Math.max(0, sd - Ls - sM);
                var ka = Math.cos(f0) * s1 + Rr * (Math.sin(fa) - Math.sin(f0)) + Math.cos(fM) * s3, kb = Math.sin(f0) * s1 + Rr * (Math.cos(f0) - Math.cos(fa)) + Math.sin(fM) * s3;
                pos.x += B.f[0] * ka + B.r[0] * kb; pos.z += B.f[1] * ka + B.r[1] * kb; pos.y += 0.16 * sd;
                yaw = Math.atan2(B.f[0] * Math.cos(fa) + B.r[0] * Math.sin(fa), B.f[1] * Math.cos(fa) + B.r[1] * Math.sin(fa));
                pitch = -0.06 + 0.12 * Math.min(1, td * 8); roll = -0.3 * Math.min(1, td * 6);
            } else pitch = -0.06;
            poolI = Math.max(0, 1 - tau / 1.5) * Math.min(1, Math.pow(30 / Uo.h, 2));
        }
        ufoMesh.position.set(pos.x - O.x, pos.y - O.y, pos.z - O.z);
        ufoMesh.rotation.set(0, 0, 0); ufoMesh.rotation.order = 'YXZ'; ufoMesh.rotation.y = yaw; ufoMesh.rotation.x = pitch; ufoMesh.rotation.z = roll;
        ufoMesh.visible = true;
        ufoHalo.position.copy(ufoMesh.position); ufoHalo.quaternion.copy(camera.quaternion); ufoHalo.scale.setScalar(300); ufoHalo.visible = true;
        var chg = t - UFO_TA - UFO_T0;
        haloMat.uniforms.uI.value = 0.10 * Math.min(1, t / 1.5) * (1 + (chg > 0 ? 0.8 * Math.min(1, chg / (UFO_T1 - UFO_T0)) * Math.exp(-Math.max(0, chg - (UFO_T1 - UFO_T0)) * 1.5) : 0));
        ufoPool.scale.set(P.roadHalf * 2 + 1.5, 1, 150);
        if (t > UFO_TA + UFO_TB) { XEV.u = null; ufoMesh.visible = ufoHalo.visible = ufoPool.visible = false; return; }
        if (q.ufo === undefined || q.ufo === null) Uo.t += dt;
    }
    var kjGeo = (function () {
        var parts = [], Vv = function (x, y, z) { return new THREE.Vector3(x, y, z); };
        function add(g, pl, pn) {
            g = g.index ? g.toNonIndexed() : g;
            for (var k in g.attributes) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
            var nv = g.attributes.position.count, a = new Float32Array(nv), b = new Float32Array(nv * 4); a.fill(pl);
            for (var v = 0; v < nv; v++) if (pn) { b[v * 4] = pn[0]; b[v * 4 + 1] = pn[1]; b[v * 4 + 2] = pn[2]; b[v * 4 + 3] = pn[3]; }
            g.setAttribute('aPlate', new THREE.BufferAttribute(a, 1)); g.setAttribute('aPN', new THREE.BufferAttribute(b, 4)); parts.push(g);
        }
        function limb(p, q, r0, r1) {
            var d = new THREE.Vector3().subVectors(q, p), L = d.length(), g = new THREE.CylinderGeometry(r1, r0, L, 12, 1);
            g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(Vv(0, 1, 0), d.normalize())); g.translate((p.x + q.x) / 2, (p.y + q.y) / 2, (p.z + q.z) / 2); add(g, -1);
        }
        function blob(c, s, rx) { var g = new THREE.SphereGeometry(1, 18, 14); g.scale(s[0], s[1], s[2]); if (rx) g.rotateX(rx); g.translate(c[0], c[1], c[2]); add(g, -1); }
        [-1, 1].forEach(function (sx) {
            blob([sx * 10, 3, 4], [7, 4, 10]);
            limb(Vv(sx * 10, 32, -3), Vv(sx * 11.5, 15, 2), 10, 7.5); limb(Vv(sx * 11.5, 15, 2), Vv(sx * 10, 3, 1), 7.5, 6);
            limb(Vv(sx * 11, 62, 8), Vv(sx * 14, 53, 16), 3.4, 2.5); limb(Vv(sx * 14, 53, 16), Vv(sx * 12, 47, 22), 2.5, 1.8);
        });
        blob([0, 33, -4], [16, 13, 14]); blob([0, 50, 1], [14.5, 22, 12.5], 0.25); blob([0, 61, 6], [12.5, 12, 10.5]);
        limb(Vv(0, 56, 1), Vv(0, 68, 7), 12.5, 9.8); limb(Vv(0, 67, 6.5), Vv(0, 75, 13), 9.8, 7.2);
        blob([0, 77.2, 16.5], [6.4, 5.4, 7.6], 0.1); blob([0, 78.3, 23.5], [4.6, 2.7, 6.4], 0.08); blob([0, 74.7, 22.0], [4.0, 1.7, 6.6], 0.12);
        var tp = [], tr = [];
        for (var i = 0; i <= 16; i++) { var tt = i / 16; tp.push(Vv(16 * Math.sin(tt * 2.0) * tt, 30 * Math.pow(1 - tt, 1.6) + 2.2, -14 - tt * 125)); tr.push(11 * (1 - tt) + 1.0); }
        for (var j = 0; j < 16; j++) limb(tp[j], tp[j + 1], tr[j], tr[j + 1]);
        var sp = [[Vv(0, 76, 9), 5.5], [Vv(0, 69, 4), 8.5], [Vv(0, 60, -1), 10.5], [Vv(0, 49, -7), 11.5], [Vv(0, 38, -12), 12]];
        for (var k2 = 1; k2 <= 16; k2++) sp.push([tp[k2], tr[k2]]);
        var cum = [0]; for (var k3 = 1; k3 < sp.length; k3++) cum.push(cum[k3 - 1] + sp[k3][0].distanceTo(sp[k3 - 1][0]));
        var Ltot = cum[cum.length - 1], xA = Vv(1, 0, 0);
        function at(s) { var i2 = 1; while (i2 < sp.length - 1 && cum[i2] < s) i2++; var w = (s - cum[i2 - 1]) / Math.max(1e-6, cum[i2] - cum[i2 - 1]); return [sp[i2 - 1][0].clone().lerp(sp[i2][0], w), sp[i2 - 1][1] + (sp[i2][1] - sp[i2 - 1][1]) * w, sp[i2][0].clone().sub(sp[i2 - 1][0]).normalize()]; }
        var THORN = [[-0.25, 0], [-0.44, 0.2], [-0.3, 0.27], [-0.54, 0.46], [-0.24, 0.5], [-0.36, 0.7], [-0.1, 0.7], [0, 1], [0.1, 0.64], [0.4, 0.66], [0.2, 0.47], [0.5, 0.38], [0.24, 0.24], [0.4, 0.1], [0.22, 0]];
        var prn = mulberry32(4711);
        function plH(s) { var u = s / Ltot; return 3 + 15 * Math.sin(Math.PI * Math.min(1, u * 1.35 + 0.12)) * (1 - 0.35 * Math.max(0, 0.18 - u) / 0.18); }
        function plate(s, side, hs, sink) {
            var a = at(s), pp = s / Ltot, tg = a[2], nrm = new THREE.Vector3().crossVectors(xA, tg).normalize();
            if (nrm.y - 0.3 * nrm.z < 0) nrm.negate();
            var h = hs * plH(s) * (0.85 + 0.3 * prn()), w = h * 0.58, ln = 0.18 + 0.12 * prn();
            var sh = new THREE.Shape(); THORN.forEach(function (v, i) {
                var j = (i === 0 || i === THORN.length - 1 || i === 7) ? 0 : (prn() - 0.5) * 0.14, x = (v[0] + j) * w + ln * h * v[1], y = Math.min(1, v[1] + (i === 7 ? 0 : (prn() - 0.5) * 0.08)) * h;
                if (i) sh.lineTo(x, y); else sh.moveTo(x, y);
            });
            var th = side ? 1.0 : 1.5, g = new THREE.ExtrudeGeometry(sh, { depth: th, bevelEnabled: false }); g.translate(0, 0, -th / 2);
            var m = new THREE.Matrix4().makeBasis(tg, nrm, xA); g.applyMatrix4(m);
            var base = a[0].clone().addScaledVector(nrm, a[1] * sink); base.x += side * 3.4;
            g.translate(base.x, base.y, base.z); add(g, pp, [nrm.x, nrm.y, nrm.z, h * (side ? 0.3 : 0.42)]);
        }
        for (var s1 = 2; s1 < Ltot - 4;) { var st = 0.8 * plH(s1) + 1.6; plate(s1, 0, 1, 0.78); if (s1 + st / 2 < Ltot - 4) { plate(s1 + st / 2, -1, 0.42, 0.72); plate(s1 + st / 2, 1, 0.42, 0.72); } s1 += st; }
        var gm = A.BufferGeometryUtils.mergeGeometries(parts); gm.computeBoundingSphere(); return gm;
    })();
    var KJ_S = 2.0, KJ_MOUTH = new THREE.Vector3(0, 76.4, 29.5);
    var kjMat = new THREE.ShaderMaterial({ vertexShader: S.kaijuVert, fragmentShader: S.kaijuFrag, side: THREE.DoubleSide,
        uniforms: uni({ uNeck: { value: 0 }, uHeadP: { value: 0 }, uJaw: { value: 0 }, uSwayA: { value: 1 }, uWalk: { value: 0 }, uWalkA: { value: 0 }, uLead: { value: 0 }, uTailA: { value: [0, 0, 0, 0, 0, 0, 0] }, uTailP: { value: [0, 1, 2, 3, 4, 5, 6].map(function (i) { return new THREE.Vector2(0, -10 - i * 125 / 6); }) }, uExt: { value: 0 }, uSweep: { value: 2 }, uGlow: { value: 0 }, uBeam: { value: 0 }, uAppear: { value: 0 }, uMouth: { value: KJ_MOUTH.clone() }, uFirePos: { value: new THREE.Vector3() }, uFireI: { value: 0 } }) });
    var kjMesh = new THREE.Mesh(kjGeo, kjMat); kjMesh.visible = false; kjMesh.frustumCulled = false; kjMesh.scale.setScalar(KJ_S); scene.add(kjMesh);
    var kbGeo = new THREE.BufferGeometry();
    kbGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(12), 3).setUsage(THREE.DynamicDrawUsage));
    kbGeo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([0, -1, 0, 1, 1, -1, 1, 1]), 2)); kbGeo.setIndex([0, 2, 1, 2, 3, 1]);
    var kbMat = new THREE.ShaderMaterial({ vertexShader: S.kbeamVert, fragmentShader: S.kbeamFrag, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: true, side: THREE.DoubleSide,
        uniforms: { uTime: U.uTime, uGrow: { value: 0 }, uI: { value: 0 } } });
    var kbMesh = new THREE.Mesh(kbGeo, kbMat); kbMesh.visible = false; kbMesh.frustumCulled = false; kbMesh.renderOrder = 21; scene.add(kbMesh);
    function kGlow(dTest, col, k) {
        var m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShaderMaterial({ vertexShader: S.ufoHaloVert, fragmentShader: S.kglowFrag, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: dTest,
            uniforms: { uI: { value: 0 }, uCol: { value: new THREE.Vector3().fromArray(col) }, uK: { value: k } } }));
        m.visible = false; m.frustumCulled = false; m.renderOrder = 22; scene.add(m); return m;
    }
    var kgMouth = kGlow(true, [0.5, 0.85, 2.0], 7), kgFlash = kGlow(false, [1.6, 1.25, 0.9], 5), kgFire = kGlow(true, [1.6, 0.55, 0.12], 5); kgFire.renderOrder = 16;
    function kParts(n, add) {
        var g = new THREE.PlaneGeometry(1, 1);
        g.setAttribute('iA', new THREE.InstancedBufferAttribute(new Float32Array(n * 4), 4).setUsage(THREE.DynamicDrawUsage));
        g.setAttribute('iB', new THREE.InstancedBufferAttribute(new Float32Array(n * 4), 4).setUsage(THREE.DynamicDrawUsage));
        var m = new THREE.InstancedMesh(g, new THREE.ShaderMaterial({ vertexShader: S.kpartVert, fragmentShader: S.kpartFrag, transparent: true, depthWrite: false, depthTest: true,
            blending: add ? THREE.AdditiveBlending : THREE.NormalBlending, uniforms: uni({ uAdd: { value: add ? 1 : 0 } }) }), n);
        m.count = 0; m.frustumCulled = false; m.renderOrder = add ? 18 : 17; scene.add(m); return m;
    }
    var NKF = 26, NKS = 34, kpFire = kParts(NKF, true), kpSmoke = kParts(NKS, false);
    var KJ_TF = 7.2, KJ_TE = 7.45;
    function kjFar(x, z, lim) {
        for (var s = Math.max(track.minStation(), sCam - 300); s < sCam + 3600; s += 20) { var ix = Math.floor(s) & TMASK; if (Math.hypot(track.px[ix] - x, track.pz[ix] - z) < lim) return false; }
        return true;
    }
    function kjSpawn(r) {
        camera.getWorldDirection(tmpV3);
        var fa = Math.atan2(tmpV3.x, -tmpV3.z), cx = camera.position.x + O.x, cz = camera.position.z + O.z, M = null, I = null;
        [0.4, 0.48, 0.32, 0.58].forEach(function (b) { [2500, 2800, 3100].forEach(function (d) { if (M) return; var x = cx + Math.sin(fa + b) * d, z = cz - Math.cos(fa + b) * d; if (kjFar(x, z, 220)) M = [x, z]; }); });
        if (!M) M = [cx + Math.sin(fa + 0.49) * 2800, cz - Math.cos(fa + 0.49) * 2800];
        [0.14, 0.07, 0.21, 0.0, 0.28].forEach(function (b) { [1500, 1800, 2100].forEach(function (d) { if (I) return; var x = cx + Math.sin(fa + b) * d, z = cz - Math.cos(fa + b) * d, dm = Math.hypot(x - M[0], z - M[1]); if (dm > 500 && dm < 2000 && kjFar(x, z, 250)) I = [x, z]; }); });
        if (!I) I = [cx + Math.sin(fa + 0.14) * 1800, cz - Math.cos(fa + 0.14) * 1800];
        var fire = [], smoke = [];
        for (var i = 0; i < NKF; i++) { var an = r() * 6.2832, el = r() * 1.1, spd = 30 + 70 * r(); fire.push({ vx: Math.cos(el) * Math.sin(an) * spd, vy: Math.sin(el) * spd * 0.7 + 12, vz: Math.cos(el) * Math.cos(an) * spd, s0: 28 + 34 * r(), life: 2.2 + 2.4 * r(), sd: r() }); }
        for (var j = 0; j < NKS; j++) { var kk = j / NKS, cap = kk > 0.55; smoke.push({ y0: 15 + (cap ? 90 : kk * 120), rise: cap ? 9 + 4 * r() : 3 + 6 * r(), an: r() * 6.2832, rad: cap ? 40 + 90 * r() : 25 * r(), s0: (cap ? 90 : 60) + 50 * r(), dl: 0.4 + kk * 1.8 + 0.6 * r(), sd: r() }); }
        return { t: 0, trn: r() < 0.5 ? -1 : 1, mx: M[0], mz: M[1], ix: I[0], iz: I[1], yaw: Math.atan2(I[0] - M[0], I[1] - M[1]), dist: Math.hypot(I[0] - cx, I[1] - cz), fire: fire, smoke: smoke };
    }
    var kjTmp = new THREE.Vector3(), kjTmp2 = new THREE.Vector3();
    function kjRot(p, cy, cz, a) { var y = p.y - cy, z = p.z - cz, c = Math.cos(a), sn = Math.sin(a); p.y = cy + y * c - z * sn; p.z = cz + y * sn + z * c; }
    var kjTS = { psi: new Float64Array(6), v: new Float64Array(6), out: [0, 0, 0, 0, 0, 0, 0] };
    function kjTailSim(TY, t) {
        var ps = kjTS.psi, v = kjTS.v, o = kjTS.out, h = 1 / 120, T0 = 12.5, te = Math.min(t, 36);
        for (var i = 0; i < 6; i++) { ps[i] = TY(T0); v[i] = 0; }
        for (var tt = T0; tt < te; tt += h) {
            var r0 = TY(tt), rv = (TY(tt + h) - r0) / h;
            for (var j = 0; j < 6; j++) {
                var tg = j ? ps[j - 1] : r0, tv = j ? v[j - 1] : rv;
                v[j] += (3.2 * (tg - ps[j]) + 2.0 * (tv - v[j])) * h;
            }
            for (var k = 0; k < 6; k++) ps[k] += v[k] * h;
        }
        var r = TY(Math.max(t, T0)); o[0] = 0;
        for (var m = 0; m < 6; m++) o[m + 1] = Math.max(-1.6, Math.min(1.6, ps[m] - r));
        return o;
    }
    function updateKaiju(dt) {
        var K = XEV.k;
        if (!K) { kjMesh.visible = kbMesh.visible = kgMouth.visible = kgFlash.visible = kgFire.visible = false; kpFire.count = kpSmoke.count = 0; return; }
        var t = K.t, gy = GROUND_Y - O.y;
        var app = Math.min(1, t / 1.0) * (1 - Math.max(0, Math.min(1, (t - 21) / 4)));
        kjMesh.visible = app > 0.001;
        var S2 = function (a, b) { var x = Math.max(0, Math.min(1, (t - a) / (b - a))); return x * x * (3 - 2 * x); };
        var TY = function (x) { x = Math.max(0, Math.min(1, (x - 13) / 6.5)); return K.trn * Math.PI * x * x * x * (x * (x * 6 - 15) + 10); };
        K.wy = TY(t);
        var ta = kjTailSim(TY, t);
        var tPx = 0, tPz = -10, tL = 125 / 6, tP = kjMat.uniforms.uTailP.value;
        for (var ti = 0; ti < 7; ti++) {
            kjMat.uniforms.uTailA.value[ti] = ti ? 0.5 * (ta[ti] + (ti < 6 ? ta[ti + 1] : ta[ti])) : 0;
            tP[ti].set(tPx, tPz); if (ti < 6) { tPx -= tL * Math.sin(ta[ti + 1]); tPz -= tL * Math.cos(ta[ti + 1]); }
        }
        kjMat.uniforms.uLead.value = TY(t + 0.8) - K.wy;
        var wd = t < 19 ? 0 : t < 21 ? 18 * (t - 19) * (t - 19) / 4 : 18 * (t - 20), wh = K.yaw + K.trn * Math.PI;
        K.wx = Math.sin(wh) * wd; K.wz = Math.cos(wh) * wd;
        kjMesh.position.set(K.mx - O.x + K.wx, gy, K.mz - O.z + K.wz);
        kjMesh.rotation.order = 'YXZ'; kjMesh.rotation.y = K.yaw + K.wy;
        kjMat.uniforms.uWalk.value = Math.max(0, t - 13) * 6.2832 / 4.2; kjMat.uniforms.uWalkA.value = 0.55 * S2(12.5, 14) + 0.45 * S2(18.5, 20.5);
        var bOn = S2(7.1, 7.3) * (1 - S2(9.7, 10.2));
        var kn = -0.42 * S2(4.0, 6.2) + 0.54 * S2(6.45, 7.05) - 0.08 * S2(10.2, 12.8) + 0.025 * Math.sin(t * 31) * bOn;
        var kh = -0.22 * S2(4.4, 6.2) + 0.30 * S2(6.5, 7.0) - 0.06 * S2(10.2, 12.5) + 0.05 * Math.sin(t * 0.5) * (1 - S2(3.5, 4.5) + S2(12, 14));
        var kj = 0.06 * S2(4.6, 5.8) * (1 - S2(6.3, 6.6)) + 0.36 * S2(6.6, 7.1) * (1 - S2(9.9, 10.9));
        kjMat.uniforms.uNeck.value = kn; kjMat.uniforms.uHeadP.value = kh; kjMat.uniforms.uJaw.value = kj; kjMat.uniforms.uSwayA.value = 1 - 0.75 * bOn;
        kjMesh.rotation.x = -0.05 * S2(4.0, 6.2) + 0.10 * S2(6.45, 7.1) - 0.045 * S2(10.2, 12.5) + 0.05 * S2(18, 21) + 0.006 * Math.sin(t * 0.9) - 0.012 * bOn;
        kjMat.uniforms.uAppear.value = app; kjMat.uniforms.uFirePos.value.set(K.ix - O.x, GROUND_Y - O.y + 60, K.iz - O.z); kjMat.uniforms.uFireI.value = t > KJ_TE ? 1.6 * Math.exp(-(t - KJ_TE) * 0.8) + 0.35 * Math.exp(-(t - KJ_TE) / 15) : 0;
        kjMat.uniforms.uSweep.value = 1.05 - 1.1 * Math.max(0, Math.min(1, (t - 3) / 3.5)); kjMat.uniforms.uExt.value = t < KJ_TF ? Math.min(1, Math.max(0, (t - 2.8) * 4)) : Math.max(0, 1 - (t - KJ_TF) / 0.08);
        kjMat.uniforms.uGlow.value = Math.max(0, Math.min(1, (t - 3) * 2)) * (1 - 0.65 * Math.max(0, Math.min(1, (t - 10.5) / 4)));
        var bI = Math.max(0, Math.min(1, (t - KJ_TF) * 10)) * (1 - Math.max(0, Math.min(1, (t - 9.8) / 0.6)));
        kjMat.uniforms.uBeam.value = Math.max(bI, 0.35 * Math.max(0, Math.min(1, (t - 6.2) / 1.0)) * (t < KJ_TF ? 1 : 0));
        kjMesh.updateMatrixWorld(true);
        var mw = kjTmp.copy(KJ_MOUTH);
        kjRot(mw, 74, 12, kh); kjRot(mw, 59, 2, kn); mw.x += 0.97 * 1.4 * Math.sin(U.uTime.value * 0.37) * kjMat.uniforms.uSwayA.value;
        mw.applyMatrix4(kjMesh.matrixWorld);
        var ip = kjTmp2.set(K.ix - O.x, gy + 5, K.iz - O.z);
        kgMouth.visible = kjMat.uniforms.uBeam.value > 0.01; kgMouth.position.copy(mw); kgMouth.quaternion.copy(camera.quaternion); kgMouth.scale.setScalar(140); kgMouth.material.uniforms.uI.value = 1.2 * kjMat.uniforms.uBeam.value;
        kbMesh.visible = bI > 0.001;
        if (kbMesh.visible) {
            var dx = ip.x - mw.x, dy = ip.y - mw.y, dz = ip.z - mw.z, mx = (ip.x + mw.x) / 2 - camera.position.x, my = (ip.y + mw.y) / 2 - camera.position.y, mz = (ip.z + mw.z) / 2 - camera.position.z;
            var sx = dy * mz - dz * my, sy = dz * mx - dx * mz, sz = dx * my - dy * mx, sl = Math.hypot(sx, sy, sz) || 1, W = 22;
            sx *= W / sl; sy *= W / sl; sz *= W / sl;
            var pa = kbGeo.attributes.position.array;
            pa[0] = mw.x - sx; pa[1] = mw.y - sy; pa[2] = mw.z - sz; pa[3] = mw.x + sx; pa[4] = mw.y + sy; pa[5] = mw.z + sz;
            pa[6] = ip.x - sx; pa[7] = ip.y - sy; pa[8] = ip.z - sz; pa[9] = ip.x + sx; pa[10] = ip.y + sy; pa[11] = ip.z + sz;
            kbGeo.attributes.position.needsUpdate = true;
            kbMat.uniforms.uGrow.value = Math.max(0, Math.min(1, (t - KJ_TF) / 0.25)); kbMat.uniforms.uI.value = bI;
        }
        var te = t - KJ_TE;
        kgFlash.visible = te > 0 && te < 20; kgFlash.position.set(ip.x, ip.y + 80, ip.z); kgFlash.quaternion.copy(camera.quaternion); kgFlash.scale.setScalar(1800);
        kgFlash.material.uniforms.uI.value = te > 0 ? 1.3 * Math.exp(-te * 5) + 0.12 * Math.exp(-te * 0.7) : 0;
        kgFire.visible = te > 0 && te < 60; kgFire.position.set(ip.x, ip.y + 40, ip.z); kgFire.quaternion.copy(camera.quaternion); kgFire.scale.setScalar(420);
        kgFire.material.uniforms.uI.value = te > 0 ? (0.55 * Math.exp(-te / 10) + 0.18 * (1 - Math.max(0, Math.min(1, (te - 45) / 10)))) * (0.85 + 0.15 * Math.sin(t * 11.0) * Math.sin(t * 7.3)) : 0;
        var nf = 0, ns = 0;
        if (te > 0) {
            var fa = kpFire.geometry.attributes.iA.array, fb = kpFire.geometry.attributes.iB.array;
            K.fire.forEach(function (f) {
                if (te > f.life) return;
                var e = (1 - Math.exp(-te * 1.3)) / 1.3, u = te / f.life;
                fa[nf * 4] = ip.x + f.vx * e; fa[nf * 4 + 1] = ip.y + 10 + f.vy * e + 9 * te; fa[nf * 4 + 2] = ip.z + f.vz * e; fa[nf * 4 + 3] = f.s0 * (1 + 2.4 * (1 - Math.exp(-te * 1.6)));
                fb[nf * 4] = Math.pow(1 - u, 1.4); fb[nf * 4 + 1] = Math.min(1, te * 12) * (1 - Math.max(0, Math.min(1, (u - 0.7) / 0.3))); fb[nf * 4 + 2] = f.sd; fb[nf * 4 + 3] = 0; nf++;
            });
            var sa = kpSmoke.geometry.attributes.iA.array, sb = kpSmoke.geometry.attributes.iB.array;
            K.smoke.forEach(function (s) {
                var ag = te - s.dl; if (ag <= 0) return;
                var rr = s.rad * (1 - Math.exp(-ag / 5));
                sa[ns * 4] = ip.x + Math.sin(s.an) * rr; sa[ns * 4 + 1] = ip.y + s.y0 + s.rise * ag * (1 - Math.exp(-ag / 25)) * 2.2; sa[ns * 4 + 2] = ip.z + Math.cos(s.an) * rr; sa[ns * 4 + 3] = s.s0 * (1 + ag * 0.1);
                sb[ns * 4] = 0.35 + 0.65 * Math.exp(-ag / 10); sb[ns * 4 + 1] = Math.min(1, ag / 1.5) * (1 - Math.max(0, Math.min(1, (ag - 40) / 12))) * 0.9; sb[ns * 4 + 2] = s.sd; sb[ns * 4 + 3] = 0; ns++;
            });
            kpFire.geometry.attributes.iA.needsUpdate = kpFire.geometry.attributes.iB.needsUpdate = true;
            kpSmoke.geometry.attributes.iA.needsUpdate = kpSmoke.geometry.attributes.iB.needsUpdate = true;
        }
        kpFire.count = nf; kpSmoke.count = ns;
        if (t > 62) { XEV.k = null; updateKaiju(0); return; }
        if (q.kaiju === undefined || q.kaiju === null) K.t += dt;
    }
    function xevShake() {
        if (!XEV || !XEV.k) return; var K = XEV.k;
        var s = K.t - (KJ_TE + K.dist / 343);
        if (s <= 0 || s > 3.5) return;
        var a = 0.4 * Math.exp(-s * 1.8) * Math.min(1, s * 25);
        camera.position.y += a * 0.5 * Math.sin(s * 47); camera.position.x += a * 0.25 * Math.sin(s * 31 + 1); camera.position.z += a * 0.25 * Math.sin(s * 37 + 2);
        camera.rotateX(a * 0.012 * Math.sin(s * 39 + 2)); camera.rotateZ(a * 0.016 * Math.sin(s * 29 + 3)); camera.rotateY(a * 0.008 * Math.sin(s * 23 + 4));
    }
    function updateXev(dt, put) {
        var run = !paused && !q.shot;
        if (q.ginga !== undefined && q.ginga !== null) { if (!XEV.g) { XEV.g = galSpawn(mulberry32(seed * 3 + 1)); } XEV.g.t = q.ginga; }
        else if (run && !/ginga/.test(q.hide) && (XEV.gNext -= dt) <= 0) { XEV.gNext = 10800 * (0.6 + 0.8 * jrng()); if (!XEV.g) XEV.g = galSpawn(jrng); }
        if (q.ufo !== undefined && q.ufo !== null) { if (!XEV.u) XEV.u = { t: 0, lat0: lat, turn: 1 }; XEV.u.t = q.ufo; }
        else if (run && !/ufo/.test(q.hide) && (XEV.uNext -= dt) <= 0) { XEV.uNext = 18000 * (0.6 + 0.8 * jrng()); if (!XEV.u) XEV.u = { t: 0, lat0: lat, turn: jrng() < 0.5 ? -1 : 1 }; }
        if (q.kaiju !== undefined && q.kaiju !== null) { if (!XEV.k) XEV.k = kjSpawn(mulberry32(seed * 5 + 3)); XEV.k.t = q.kaiju; }
        else if (run && !/kaiju/.test(q.hide)) {
            var dN = new Date(), hN = dN.getHours(), kN = dN.toDateString() + hN;
            if (dN.getMinutes() === 0 && [0, 5, 12, 15, 17].indexOf(hN) >= 0 && XEV.kKey !== kN) { XEV.kKey = kN; if (!XEV.k) XEV.k = kjSpawn(jrng); }
        }
        updateGalaxy(dt, put);
        updateUfo(dt);
        updateKaiju(dt);
    }


    // --- ポストプロセス --------------------------------------------------------------------
    // --- 自前のブルーム（13 タップ縮小 × levels 段 → テント拡大で加算 → 元画像に加算） ----------------------
    // UnrealBloomPass の打ち切り分離ガウスは、非常に明るい点光源の周りで裾がカーネルの外形（正方形）として見える。
    // 13 タップ縮小＋テント拡大は丸く広がり、Karis 平均で 1 画素の超高輝度が塊になって暴れるのも防ぐ
    function makeBloomPass(w, h, levels) {
        var pass = Object.create(A.Pass.prototype);
        pass.isPass = true; pass.enabled = true; pass.needsSwap = true; pass.clear = false; pass.renderToScreen = false;
        var rtOpt = { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
                      wrapS: THREE.ClampToEdgeWrapping, wrapT: THREE.ClampToEdgeWrapping, depthBuffer: false };
        var mips = [];
        function mkDown(pre) {
            var m = new THREE.ShaderMaterial({
                vertexShader: S.bloomVert, fragmentShader: S.bloomDown, depthTest: false, depthWrite: false,
                uniforms: { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() },
                            uThreshold: { value: P.bloomThreshold }, uKnee: { value: P.bloomKnee }, uClamp: { value: P.bloomClamp } }
            });
            if (pre) m.defines = { PREFILTER: 1 };
            return m;
        }
        var downPre = mkDown(true), down = mkDown(false);
        var up = new THREE.ShaderMaterial({
            vertexShader: S.bloomVert, fragmentShader: S.bloomUp, depthTest: false, depthWrite: false,
            blending: THREE.AdditiveBlending, transparent: true,
            uniforms: { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() }, uRadius: { value: 1.0 } }
        });
        var comp = new THREE.ShaderMaterial({
            vertexShader: S.bloomVert, fragmentShader: S.bloomComp, depthTest: false, depthWrite: false,
            uniforms: { tDiffuse: { value: null }, tBloom: { value: null }, uTexel: { value: new THREE.Vector2() }, uStrength: { value: P.bloomStrength } }
        });
        var quad = new A.FullScreenQuad(null);
        pass.setSize = function (W, H) {                     // 解像度変更では作り直さず大きさだけ変える
            var mw = W, mh = H;
            for (var i = 0; i < levels; i++) {
                mw = Math.max(1, Math.floor(mw / 2)); mh = Math.max(1, Math.floor(mh / 2));
                if (mips[i]) mips[i].setSize(mw, mh); else mips.push(new THREE.WebGLRenderTarget(mw, mh, rtOpt));
            }
        };
        pass.setSize(w, h);
        pass.render = function (renderer, writeBuffer, readBuffer) {
            var oldAuto = renderer.autoClear; renderer.autoClear = false;
            // 1. 前処理＋1/2 縮小、2. 縮小を繰り返す
            var src = readBuffer.texture, sw = readBuffer.width, sh = readBuffer.height;
            for (var i = 0; i < mips.length; i++) {
                var m = i === 0 ? downPre : down;
                m.uniforms.tSrc.value = src; m.uniforms.uTexel.value.set(1 / sw, 1 / sh);
                quad.material = m; renderer.setRenderTarget(mips[i]); renderer.clear(); quad.render(renderer);
                src = mips[i].texture; sw = mips[i].width; sh = mips[i].height;
            }
            // 3. 小さい段から順にテントで拡大して 1 つ上の段へ加算
            for (var j = mips.length - 1; j > 0; j--) {
                up.uniforms.tSrc.value = mips[j].texture; up.uniforms.uTexel.value.set(1 / mips[j].width, 1 / mips[j].height);
                quad.material = up; renderer.setRenderTarget(mips[j - 1]); quad.render(renderer);
            }
            // 4. 元画像に加算
            comp.uniforms.tDiffuse.value = readBuffer.texture; comp.uniforms.tBloom.value = mips[0].texture;
            comp.uniforms.uTexel.value.set(1 / mips[0].width, 1 / mips[0].height);
            comp.uniforms.uStrength.value = P.bloomStrength;
            quad.material = comp;
            renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
            if (!this.renderToScreen) renderer.clear();
            quad.render(renderer);
            renderer.autoClear = oldAuto;
        };
        pass.dispose = function () {
            mips.forEach(function (rt) { rt.dispose(); });
            [downPre, down, up, comp].forEach(function (m) { m.dispose(); });
            quad.dispose();
        };
        return pass;
    }
    var composer = null, bloomPass = null, finalPass = null, prScale = 1.0;
    function buildComposer() {
        var w = renderer.domElement.clientWidth || global.innerWidth, h = renderer.domElement.clientHeight || global.innerHeight;
        var pr = Math.min(dpr, Q.prMax) * prScale;
        renderer.setPixelRatio(pr);
        renderer.setSize(w, h, false);
        var rt = new THREE.WebGLRenderTarget(Math.floor(w * pr), Math.floor(h * pr), { type: THREE.HalfFloatType, samples: Q.msaa, depthBuffer: true });
        if (composer) composer.dispose();
        composer = new A.EffectComposer(renderer, rt);
        composer.setPixelRatio(pr);
        composer.setSize(w, h);
        composer.addPass(new A.RenderPass(scene, camera));
        if (Q.bloom) {
            if (bloomPass) bloomPass.dispose();
            bloomPass = makeBloomPass(Math.floor(w * pr), Math.floor(h * pr), Q.bloomLevels);
            composer.addPass(bloomPass);
        } else bloomPass = null;
        finalPass = new A.ShaderPass({
            uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uVignette: { value: P.vignette }, uGrain: { value: P.grain } },
            vertexShader: S.finalVert, fragmentShader: S.finalFrag
        });
        composer.addPass(finalPass);
        composer.addPass(new A.OutputPass());
        camera.aspect = w / h; camera.fov = fovFor(w / h); camera.updateProjectionMatrix();
        U.uPR.value = Math.max(0.5, (h * pr) / 1080);
    }
    // 描画解像度・ウィンドウの大きさの変更: composer は作り直さず大きさだけ変える。必ず tick の先頭（描画の前）で呼ぶ
    // （renderer.setSize はキャンバスを消すので、描画の後に呼ぶとその回は消えた画面が表示される = 点滅の原因だった）
    function applySize() {
        var w = renderer.domElement.clientWidth || global.innerWidth, h = renderer.domElement.clientHeight || global.innerHeight;
        var pr = Math.min(dpr, Q.prMax) * prScale;
        renderer.setPixelRatio(pr);
        renderer.setSize(w, h, false);
        composer.setPixelRatio(pr);
        composer.setSize(w, h);
        camera.aspect = w / h; camera.fov = fovFor(w / h); camera.updateProjectionMatrix();
        U.uPR.value = Math.max(0.5, (h * pr) / 1080);
    }
    var pendingQuality = 0, pendingResize = false;
    function applyQuality(newQ) {
        Q = QUALITY[newQ]; qi = newQ;
        [roadMat, deckMat, railMat, postMat, poleMat, pierMat, groundMat, treeMat, rpoleMat, wallMat, panelMat, panelOpMat, trussMat, walkMat, hpMat, rampSurfMat, rampStructMat, rampRailMat, drumMat, signPoleMat].forEach(function (m) {
            m.defines.NL = Q.lamps;
            if (m === roadMat) { if (Q.normalNoise) delete m.defines.NO_NORMAL_NOISE; else m.defines.NO_NORMAL_NOISE = 1; }
            m.needsUpdate = true;
        });
        buildStars(Q.stars);
        prScale = 1.0;
        buildComposer();
        showToast('画質: ' + Q.name);
    }
    buildCityPoints();
    applyQuality(qi);
    global.addEventListener('resize', function () { pendingResize = true; });   // tick の先頭で処理する

    // --- 走行状態 ------------------------------------------------------------------------
    var speed = (q.speed || P.speedKmh) / 3.6;        // m/s
    var sCam = 100 + (q.frame || 0);                  // 道のり [区間]（後方にも軌道があるよう 100 から始める）
    var steer = 0, lat = P.laneX, latTarget = P.laneX;
    // 操舵（±15/フレーム、±285 で止まる）を、左側車道の中（latMin〜latMax）に収まる範囲で使う
    var steerMin = Math.max(-285, (P.latMin - P.laneX) / unitM), steerMax = Math.min(285, (P.latMax - P.laneX) / unitM);
    var keyL = false, keyR = false, paused = !!q.pause;
    var timeSec = 0, trainClock = 0;
    // v7: バイクモード（B で切り替え、保存）。bikeT は 0（車）〜1（バイク）へ 0.6 秒でなめらかに移る
    var bikeOn = q.bikeSet ? q.bike : !!settings.bike, bikeT = bikeOn ? 1 : 0;
    var lcFreeze = false, lean = 0, leanCurve = 0, latV = 0, latPrev = lat, aSlow = 0, aFast = 0, leanLat = 0;   // lean: 右へ倒れる向きが正 [rad]
    function updateLean(dt) {
        var tgt = bikeOn ? 1 : 0;
        bikeT += Math.max(-dt / 0.6, Math.min(dt / 0.6, tgt - bikeT));
        // カーブ: 0.5 秒先の道のりの曲率（右カーブが正）から θ = atan(v²κ/g)、時定数 0.35 秒で追う
        var sL = sCam + speed * 0.5;
        track.sample(sL + 6, smp); var thA = smp.th; track.sample(sL - 6, smp); var thB = smp.th;
        var kap = (thA - thB) / 12;
        var tC = Math.atan(speed * speed * kap / 9.81);
        if (dt <= 0) { if (paused && !lcFreeze) { leanCurve = tC; lean = Math.max(-P.leanMax * Math.PI / 180, Math.min(P.leanMax * Math.PI / 180, leanCurve + leanLat)); } return; }   // 一時停止中（撮影）は釣り合いの傾き
        leanCurve += (tC - leanCurve) * (1 - Math.exp(-dt / 0.35));
        // 車線移動: 横方向の加速度から θ = atan(a/g)。速い成分と遅い成分の差で、倒れ始めに小さな逆振れ（逆操舵）
        var v1 = (lat - latPrev) / dt; latPrev = lat;
        var acc = (v1 - latV) / dt; latV = v1;
        aFast += (acc - aFast) * (1 - Math.exp(-dt / 0.04));
        aSlow += (acc - aSlow) * (1 - Math.exp(-dt / 0.2));
        var counter = Math.max(-0.035, Math.min(0.035, -2.5 * P.bikeLatK * (aFast - aSlow) / 9.81 * 9.0));
        leanLat = Math.atan(aSlow * P.bikeLatK / 9.81) + counter;
        var sway = 0.005 * Math.sin(timeSec * 0.45) * Math.sin(timeSec * 0.17 + 1.0);      // 直線でのわずかな揺れ（±0.3°）
        var lm = P.leanMax * Math.PI / 180;
        lean = Math.max(-lm, Math.min(lm, leanCurve + leanLat + sway));
    }

    // 軌道の局所フレーム（世界座標）
    function Frame() { this.c = new THREE.Vector3(); this.f = new THREE.Vector3(); this.r = new THREE.Vector3(); this.n = new THREE.Vector3(); this.th = 0; this.bank = 0; }
    var smp = { x: 0, y: 0, z: 0, th: 0, bank: 0, slope: 0 };
    function frameAt(s, F) {
        track.sample(s, smp);
        F.c.set(smp.x, smp.y, smp.z);
        F.th = smp.th; F.bank = smp.bank;
        var st = Math.sin(smp.th), ct = Math.cos(smp.th);
        F.f.set(st, smp.slope, -ct).normalize();
        var cb = Math.cos(smp.bank), sb = Math.sin(smp.bank);
        F.r.set(ct * cb, -sb, st * cb);
        F.n.crossVectors(F.r, F.f).normalize();
        F.r.crossVectors(F.f, F.n).normalize();
        return F;
    }
    var O = new THREE.Vector3();                     // 原点 = カメラ足元の軌道点（世界座標）
    var FC = new Frame(), FT = new Frame(), FR = new Frame();
    var tmpV3 = new THREE.Vector3(), tmpS2 = new THREE.Vector3();
    var tmpV = new THREE.Vector3(), tmpV2 = new THREE.Vector3(), tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpS = new THREE.Vector3(1, 1, 1);
    var yAxis = new THREE.Vector3(0, 1, 0);

    // 世界座標 (frame, lateral, height) -> 原点相対の out
    function place(F, x, h, out) {
        out.copy(F.c).addScaledVector(F.r, x).addScaledVector(F.n, h).sub(O);
        return out;
    }
    function firstStation(from, period, phase) {
        var k = Math.ceil((from - phase) / period);
        return k * period + phase;
    }

    function updateWorld(dt) {
        var sBase = Math.floor(sCam / STA_WRAP) * STA_WRAP;    // 区画線 20・街灯 36・支柱 4 m の公倍数で道のりを折り返す（シェーダの周期ノイズと同じ周期）
        track.ensure(sCam + P.viewLen + 40);
        frameAt(sCam, FC);
        O.copy(FC.c);
        ensureLines();

        // --- 路面・桁・ガードレール ---
        var rp = roadGeo.attributes.position.array, rn = roadGeo.attributes.normal.array;
        var rs = roadGeo.attributes.aSta.array, rl = roadGeo.attributes.aLat.array;
        var rt = roadGeo.attributes.aTan.array, rr = roadGeo.attributes.aRight.array;
        var dp = deckGeo.attributes.position.array, dnm = deckGeo.attributes.normal.array;
        var dsA = deckGeo.attributes.aSta.array, dlA = deckGeo.attributes.aLat.array;
        var gp = railGeo.attributes.position.array, gn = railGeo.attributes.normal.array;
        var gs = railGeo.attributes.aSta.array, gl = railGeo.attributes.aLat.array;
        var HW = P.roadHalf, NRV = RAILS.length * NRP;
        var wpA = wallGeo.attributes.position.array, wnA = wallGeo.attributes.normal.array, wsA = wallGeo.attributes.aSta.array, wlA = wallGeo.attributes.aLat.array;
        var ppA = panelGeo.attributes.position.array, pnA = panelGeo.attributes.normal.array, psA = panelGeo.attributes.aSta.array, plA = panelGeo.attributes.aLat.array;
        for (var i = 0; i < NR; i++) {
            var s = sCam + rowD[i];
            frameAt(s, FR);
            var sta = (s - sBase) * P.segLen;
            for (var c = 0; c < 2; c++) {
                var x = c === 0 ? -HW : HW, v = i * 2 + c;
                place(FR, x, 0, tmpV);
                rp[v * 3] = tmpV.x; rp[v * 3 + 1] = tmpV.y; rp[v * 3 + 2] = tmpV.z;
                rn[v * 3] = FR.n.x; rn[v * 3 + 1] = FR.n.y; rn[v * 3 + 2] = FR.n.z;
                rt[v * 3] = FR.f.x; rt[v * 3 + 1] = FR.f.y; rt[v * 3 + 2] = FR.f.z;
                rr[v * 3] = FR.r.x; rr[v * 3 + 1] = FR.r.y; rr[v * 3 + 2] = FR.r.z;
                rs[v] = sta; rl[v] = x;
            }
            for (var b = 0; b < DECK_BANDS.length; b++) {
                var B = DECK_BANDS[b];
                tmpV2.copy(FR.r).multiplyScalar(B[4]).addScaledVector(FR.n, B[5]);
                for (var e2 = 0; e2 < 2; e2++) {
                    var dv = i * NDV + b * 2 + e2, bx = B[e2 * 2], by = B[e2 * 2 + 1];
                    place(FR, bx, by, tmpV);
                    dp[dv * 3] = tmpV.x; dp[dv * 3 + 1] = tmpV.y; dp[dv * 3 + 2] = tmpV.z;
                    dnm[dv * 3] = tmpV2.x; dnm[dv * 3 + 1] = tmpV2.y; dnm[dv * 3 + 2] = tmpV2.z;
                    dsA[dv] = sta; dlA[dv] = bx;
                }
            }
            for (var wb2 = 0; wb2 < WALL_BANDS.length; wb2++) {               // v9: 壁高欄
                var WB = WALL_BANDS[wb2];
                tmpV2.copy(FR.r).multiplyScalar(WB[4]).addScaledVector(FR.n, WB[5]);
                for (var e3 = 0; e3 < 2; e3++) {
                    var wv = i * NWV + wb2 * 2 + e3;
                    if (WB.length > 6) tmpV2.copy(FR.r).multiplyScalar(WB[6 + e3 * 2]).addScaledVector(FR.n, WB[7 + e3 * 2]);   // 手すりの管は頂点ごとの法線
                    place(FR, WB[e3 * 2], WB[e3 * 2 + 1], tmpV);
                    wpA[wv * 3] = tmpV.x; wpA[wv * 3 + 1] = tmpV.y; wpA[wv * 3 + 2] = tmpV.z;
                    wnA[wv * 3] = tmpV2.x; wnA[wv * 3 + 1] = tmpV2.y; wnA[wv * 3 + 2] = tmpV2.z;
                    wsA[wv] = sta; wlA[wv] = WB[e3 * 2];
                }
            }
            for (var pc3 = 0; pc3 < NPV; pc3++) {                             // v9: 遮音壁・鋼製高欄の板（4 頂点）と、遮音壁の先端の折れの帯（12 頂点）
                var pv3 = i * NPV + pc3, px3, py3, sg3, fz = pc3 >= 4;
                if (!fz) { sg3 = pc3 < 2 ? -1 : 1; px3 = sg3 * 9.62; py3 = (pc3 % 2) ? 4.10 : 0.30; }
                else { var f3 = (pc3 - 4) >> 1, top3 = (pc3 - 4) & 1; sg3 = f3 < 3 ? -1 : 1; px3 = sg3 * (9.62 - top3 * PFOLD_DX); py3 = 0.60 + PFOLD_H[f3 % 3] + top3 * PFOLD_DY; }
                place(FR, px3, py3, tmpV);
                ppA[pv3 * 3] = tmpV.x; ppA[pv3 * 3 + 1] = tmpV.y; ppA[pv3 * 3 + 2] = tmpV.z;
                if (!fz) tmpV2.copy(FR.r).multiplyScalar(-sg3);
                else tmpV2.copy(FR.r).multiplyScalar(-sg3 * PFOLD_DY / 0.5).addScaledVector(FR.n, -PFOLD_DX / 0.5);   // 道路側・やや下向きの法線
                pnA[pv3 * 3] = tmpV2.x; pnA[pv3 * 3 + 1] = tmpV2.y; pnA[pv3 * 3 + 2] = tmpV2.z;
                psA[pv3] = sta; plA[pv3] = px3;
            }
            if (i < NRAIL) {
                for (var rk = 0; rk < RAILS.length; rk++) {
                    var RL = RAILS[rk];
                    for (var c3 = 0; c3 < NRP; c3++) {
                        var v3i = i * NRV + rk * NRP + c3;
                        var xr = RL.xb + RL.fs * RAIL_PROF[c3][0];
                        place(FR, xr, RAIL_PROF[c3][1] + P.railY, tmpV);
                        gp[v3i * 3] = tmpV.x; gp[v3i * 3 + 1] = tmpV.y; gp[v3i * 3 + 2] = tmpV.z;
                        tmpV2.copy(FR.r).multiplyScalar(RL.fs * RAIL_NRM[c3][0]).addScaledVector(FR.n, RAIL_NRM[c3][1]).normalize();
                        gn[v3i * 3] = tmpV2.x; gn[v3i * 3 + 1] = tmpV2.y; gn[v3i * 3 + 2] = tmpV2.z;
                        gs[v3i] = sta; gl[v3i] = xr;
                    }
                }
            }
        }
        ['position', 'normal', 'aSta', 'aLat', 'aTan', 'aRight'].forEach(function (k) {
            [roadGeo, deckGeo, railGeo, wallGeo, panelGeo].forEach(function (g) { if (g.attributes[k]) g.attributes[k].needsUpdate = true; });
        });

        // --- ガードレール支柱（外側 2 本は地覆の上、分離帯は縁石の上） ---
        var n = 0;
        var postX = [-(P.railLat + 0.06), P.railLat + 0.06, 0], postY = [P.curbH - 0.05, P.curbH - 0.05, P.medianH - 0.02];
        for (var ps = firstStation(sCam - P.backLen, 4, 1); ps < sCam + 440 && n < NPOST - 3; ps += 4) {
            frameAt(ps, FR);
            tmpQ.setFromAxisAngle(yAxis, -FR.th);
            var gapHere = inGap(ps);
            for (var sd = 0; sd < 3; sd++) {
                if (sd === 2 && gapHere) continue;                   // 補修区間は分離帯の支柱なし
                if (sd < 2 && inRampZone(ps, sd === 0 ? -1 : 1)) continue;   // v8: 出入口の区間は外側の支柱なし
                if (sd < 2 && !q.nov9) { var so9 = secAtS(sd === 0 ? -1 : 1, ps); if (so9 && secTypeEff(so9) !== 3 && !inRiver(ps)) continue; }   // v9: ガードレールの区間（D）以外は支柱なし
                place(FR, postX[sd], postY[sd], tmpV);
                tmpM.compose(tmpV, tmpQ, tmpS);
                posts.setMatrixAt(n++, tmpM);
            }
        }
        posts.count = n; posts.instanceMatrix.needsUpdate = true;

        // --- 補修区間: uGap と ラバーポール ---
        var gn2 = 0, rn = 0, fadeA = rpoleGeo.attributes.aFade.array;
        for (var gb = Math.floor((sCam - 60) / GAP_BLOCK); gb <= Math.floor((sCam + 720) / GAP_BLOCK); gb++) {
            var G = gapOfBlock(gb);
            if (!G) continue;
            if (gn2 < NGAP) { gapArr[gn2].set((G[0] - sBase) * P.segLen, (G[1] - sBase) * P.segLen); gn2++; }
            for (var rs2 = G[0] + 1; rs2 < G[1] && rn < NRPOLE; rs2 += 2) {
                if (rs2 < sCam - 40 || rs2 > sCam + 500) continue;
                var ri = Math.floor(rs2);
                if (gapHash(ri, 11) < 0.04) continue;                   // まれに 1 本抜けている
                frameAt(rs2, FR);
                place(FR, 0, P.medianH, tmpV);
                tmpQ.setFromAxisAngle(yAxis, -FR.th + gapHash(ri, 12) * 6.283);
                if (gapHash(ri, 13) < 0.2) {                            // 数本に 1 本は少し傾いている（±6°）
                    tiltAx.set(Math.cos(gapHash(ri, 14) * 6.283), 0, Math.sin(gapHash(ri, 14) * 6.283));
                    tiltQ.setFromAxisAngle(tiltAx, (gapHash(ri, 15) - 0.5) * 0.21); tmpQ.premultiply(tiltQ);
                }
                tmpM.compose(tmpV, tmpQ, tmpS);
                rpoles.setMatrixAt(rn, tmpM); fadeA[rn] = gapHash(ri, 16); rn++;
            }
        }
        for (var gz = gn2; gz < NGAP; gz++) gapArr[gz].set(-1e6, -1e6);
        // v7.1: 開口部（ラバーポールで塞ぐ）と、補修区間・開口部の両端の袖ビーム
        var on2 = 0, en = 0, ends = [];
        for (var gb2 = Math.floor((sCam - 60) / GAP_BLOCK); gb2 <= Math.floor((sCam + 720) / GAP_BLOCK); gb2++) { var G2 = gapOfBlock(gb2); if (G2) ends.push(G2); }
        for (var on = 0; on < 10000; on++) {
            var OP = openAt(on); if (OP[0] > sCam + 720) break; if (OP[1] < sCam - 60) continue;
            if (on2 < NOPEN) { openArr[on2].set((OP[0] - sBase) * P.segLen, (OP[1] - sBase) * P.segLen); on2++; }
            ends.push(OP);
            for (var rs3 = OP[0] + 1; rs3 < OP[1] && rn < NRPOLE; rs3 += 2) {
                if (rs3 < sCam - 40 || rs3 > sCam + 500) continue;
                frameAt(rs3, FR); place(FR, 0, P.medianH, tmpV);
                tmpQ.setFromAxisAngle(yAxis, -FR.th + gapHash(Math.floor(rs3), 17) * 6.283);
                tmpM.compose(tmpV, tmpQ, tmpS); rpoles.setMatrixAt(rn, tmpM); fadeA[rn] = gapHash(Math.floor(rs3), 18) * 0.5; rn++;
            }
        }
        for (var oz = on2; oz < NOPEN; oz++) openArr[oz].set(-1e6, -1e6);
        // v8: 出入口の区間（本線の外側のガードレール・地覆・支柱を外し、外側線を太い破線に）
        var zl = 0, zr = 0;
        for (var ici = 0; ici < icList.length; ici++) {
            var icz = icList[ici]; if (!icz.ramps || icz.zB < sCam - 400 || icz.zA > sCam + P.viewLen) continue;
            for (var zp = 0; zp < 2; zp++) {
                if (zl < 4) rampLArr[zl++].set((icz.zoneL[zp * 2] - sBase) * P.segLen, (icz.zoneL[zp * 2 + 1] - sBase) * P.segLen);
                if (zr < 4) rampRArr[zr++].set((icz.zoneR[zp * 2] - sBase) * P.segLen, (icz.zoneR[zp * 2 + 1] - sBase) * P.segLen);
            }
        }
        for (; zl < 4; zl++) rampLArr[zl].set(-1e6, -1e6); for (; zr < 4; zr++) rampRArr[zr].set(-1e6, -1e6);
        fillSecs(sBase);
        if (!q.nov9) updateWallParts(sBase);
        updateTruss();
        if (!q.nov9) { updateWalkway(); updateHandPosts(); }
        ends.forEach(function (E2) {
            for (var ee = 0; ee < 2; ee++) {
                var se = E2[ee]; if (se < sCam - 40 || se > sCam + 700 || en >= NEND) continue;
                frameAt(se, FR); place(FR, 0, P.medianH, tmpV);
                tmpQ.setFromAxisAngle(yAxis, -FR.th + (ee === 0 ? Math.PI / 2 : -Math.PI / 2));   // 丸みを区間の内側（ガードレールの無い側）へ向ける
                tmpM.compose(tmpV, tmpQ, tmpS); railEnds.setMatrixAt(en++, tmpM);
            }
        });
        railEnds.count = en; railEnds.instanceMatrix.needsUpdate = true;
        rpoles.count = rn; rpoles.instanceMatrix.needsUpdate = true; rpoleGeo.attributes.aFade.needsUpdate = true;

        // --- 橋脚（道のり ≡ pierPhase mod pierPeriod） ---
        var pn = 0, gyRel = GROUND_Y - O.y;
        for (var qs = firstStation(sCam - 60, P.pierPeriod, P.pierPhase); qs < sCam + P.viewLen && pn < NPIER; qs += P.pierPeriod) {
            frameAt(qs, FR);
            if (!clearOfRail(FR.c.x, FR.c.z, 0, PIER_RAIL_CLEAR)) continue;   // 線路の上に橋脚を立てない
            if (groads.length && groadDist(FR.c.x, FR.c.z) < 2) continue;      // 地上の道路の上にも立てない
            place(FR, 0, -P.fasciaH, tmpV);
            tmpV3.copy(FR.f).negate();
            tmpM.makeBasis(FR.r, FR.n, tmpV3);
            tmpM.scale(tmpS2.set(15, 1.6, 2.2));
            tmpM.setPosition(tmpV);
            pierBeams.setMatrixAt(pn, tmpM);
            // 柱: 梁の下から地面まで（鉛直）
            place(FR, 0, -P.fasciaH - 1.6, tmpV);
            var hcol = Math.max(0.5, tmpV.y - gyRel + 0.5);
            tmpQ.setFromAxisAngle(yAxis, -FR.th);
            tmpM.compose(tmpV, tmpQ, tmpS2.set(2.4, hcol, 2.0));
            pierCols.setMatrixAt(pn, tmpM);
            pn++;
        }
        pierCols.count = pierBeams.count = pn;
        pierCols.instanceMatrix.needsUpdate = true; pierBeams.instanceMatrix.needsUpdate = true;
        ground.position.set(0, gyRel, 0);

        // --- 街灯: ポール・ハロー・円錐・近傍ライト ---
        var hp = halos.geometry.attributes.position.array;
        var cc = coneGeo.attributes.aCenter.array, cI = coneGeo.attributes.aI.array;
        var lampN = 0, haloN = 0, coneN = 0, poleN = 0;
        var expMin = 1e9, expMax = -1e9;
        var lampLimit = Q.lamps, coneLimit = Q.cones;
        for (var ls = firstStation(sCam - 72, P.lampPeriod, P.lampPhase); ls < sCam + P.viewLen && poleN < NPOLE - 1; ls += P.lampPeriod) {
            frameAt(ls, FR);
            for (var sd2 = 0; sd2 < 2; sd2++) {
                var sg = sd2 === 0 ? -1 : 1;
                // 左のポールはアームが +rH 向き（ヨー -th）、右は 180° 回す
                tmpQ.setFromAxisAngle(yAxis, -FR.th + (sg > 0 ? Math.PI : 0));
                place(FR, sg * P.poleLat, P.curbH, tmpV);
                tmpM.compose(tmpV, tmpQ, tmpS);
                if (inRampZone(ls, sg)) {                                 // v8: 出入口の区間はランプの外側に街灯を立てる。本線の路面には、その灯から届く光の代わりを残す（ランプの路面との明るさの段差を出さない）
                    if (lampN < lampLimit) { tmpV.copy(LAMP_LOCAL).applyMatrix4(tmpM); lampArr[lampN].set(tmpV.x, tmpV.y - 0.1, tmpV.z, P.lampI * 0.6); lampN++; }
                    continue;
                }
                poles.setMatrixAt(poleN++, tmpM);
                tmpV.copy(LAMP_LOCAL).applyMatrix4(tmpM);         // 灯の位置 = そのポールの行列 × LAMP_LOCAL
                hp[haloN * 3] = tmpV.x; hp[haloN * 3 + 1] = tmpV.y; hp[haloN * 3 + 2] = tmpV.z; haloN++;
                if (lampN < lampLimit) {
                    lampArr[lampN].set(tmpV.x, tmpV.y - 0.1, tmpV.z, P.lampI); lampN++;
                    expMin = Math.min(expMin, ls); expMax = Math.max(expMax, ls);
                }
                if (coneN < coneLimit && ls > sCam - 40) {
                    for (var cv = 0; cv < 4; cv++) { var ci = (coneN * 4 + cv); cc[ci * 3] = tmpV.x; cc[ci * 3 + 1] = tmpV.y - 0.2; cc[ci * 3 + 2] = tmpV.z; cI[ci] = 0.10; }
                    coneN++;
                }
            }
        }
        for (var le = lampN; le < NLMAX; le++) lampArr[le].w = 0;
        poles.count = poleN; poles.instanceMatrix.needsUpdate = true;
        halos.geometry.setDrawRange(0, haloN); halos.geometry.attributes.position.needsUpdate = true;
        coneGeo.setDrawRange(0, coneN * 6); coneGeo.attributes.aCenter.needsUpdate = true; coneGeo.attributes.aI.needsUpdate = true;
        U.uExpMin.value = (expMin - sBase) * P.segLen; U.uExpMax.value = (expMax - sBase) * P.segLen;

        // --- カメラ ---
        var bob = 0.006 * Math.sin(timeSec * 2.3) + 0.004 * Math.sin(timeSec * 3.9 + 1.0);
        var sway = 0.012 * Math.sin(timeSec * 0.7);
        // v7: バイクは目が低く、ロールの回転中心は路面の接地点（倒れると目は内側へ h·sinθ、下へ h·(1−cosθ)）
        var bT = bikeT * bikeT * (3 - 2 * bikeT), roll = lean * bT;
        var eyeH = P.eyeH + (P.bikeEyeH - P.eyeH) * bT;
        var eyeX = lat + sway + eyeH * Math.sin(roll), eyeY = eyeH * Math.cos(roll) + bob;
        place(FC, eyeX, eyeY, camera.position);
        frameAt(sCam + P.lookAhead, FT);
        place(FT, lat, eyeH, tmpV);
        tmpV2.copy(tmpV).sub(camera.position).normalize();
        tmpV2.lerp(FC.f, 0.4).normalize();
        tmpV.copy(camera.position).add(tmpV2);
        camera.up.copy(FC.n);
        camera.lookAt(tmpV);
        if (q.lookat) { tmpV.set(q.lookat[0] - O.x, GROUND_Y + q.lookat[2] - O.y, q.lookat[1] - O.z); camera.lookAt(tmpV); if (errBox && q.lookd) { errBox.textContent = 'LOOKD ' + Math.hypot(tmpV.x - camera.position.x, tmpV.z - camera.position.z).toFixed(0); errBox.style.display = 'block'; } }   // 確認用: 世界座標の点を見る
        if (roll) camera.rotateZ(-roll);                        // v7: 画面全体を視線の軸のまわりに回す（右へ倒れる = 地平線は右上がり）
        if (P.yaw) camera.rotateY(-P.yaw * Math.PI / 180);     // 確認用の横向き視点
        if (P.pitch) camera.rotateX(P.pitch * Math.PI / 180);
        xevShake();

        U.uCamPos.value.copy(camera.position);
        U.uCarFwd.value.copy(FC.f);
        // v7: ライトは車体と一緒に傾く（配光の左右・上下の軸を、進行方向のまわりにロール角だけ回す）
        var cr = Math.cos(roll), sr = Math.sin(roll);
        U.uCarRight.value.copy(FC.r).multiplyScalar(cr).addScaledVector(FC.n, -sr);
        U.uCarUp.value.copy(FC.n).multiplyScalar(cr).addScaledVector(FC.r, sr);
        // 車の 2 灯（±0.62 m、高さ 0.68 m）→ バイクの 1 灯（車体中央、高さ 0.95 m を接地点のまわりに傾けた位置）。2 つの灯を同じ位置へ寄せる
        var hH = 0.68 + (P.bikeHeadH - 0.68) * bT, hx = lat + hH * Math.sin(roll) * bT, hy = hH * (1 - bT + bT * Math.cos(roll));
        place(FC, hx - 0.62 * (1 - bT), hy, U.uHeadPos0.value).addScaledVector(FC.f, 1.8 - 0.6 * bT);
        place(FC, hx + 0.62 * (1 - bT), hy, U.uHeadPos1.value).addScaledVector(FC.f, 1.8 - 0.6 * bT);
        U.uHeadW.value = 5.0 + 4.0 * bT;
        U.uHeadI.value = P.headI * (1 + (P.bikeHeadK - 1) * bT);

        skyGroup.position.copy(camera.position);
        cityGroup.position.set(0, GROUND_Y - O.y, 0);
        U.uOriginY.value = O.y - GROUND_Y;                    // 霧は地面からの高さで薄くなる

        // 沿道の街（世界座標固定）と電車
        updateSide();
        updateICs();                                           // v8: IC のランプ・標識
        updateTrains(trainClock);
    }

    // --- 流れ星 ---
    function updateMeteor(dt) {
        var M = meteorState;
        if (M.t < 0) {
            M.next -= dt;
            if (q.skytest === 'm') M.next = 0;
            if (M.next > 0) return;
            M.t = 0;
            camera.getWorldDirection(tmpV3);
            var az = Math.atan2(tmpV3.x, -tmpV3.z) + (rng() - 0.5) * 1.6, el = 0.09 + rng() * 0.36;   // 前方 ±46°・高度 5〜26°（視野の中）
            M.p0.set(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)).multiplyScalar(7000);
            var side = new THREE.Vector3().crossVectors(M.p0, yAxis).normalize();
            var upv = new THREE.Vector3().crossVectors(side, M.p0).normalize();
            var ang = -Math.PI / 2 + (rng() - 0.5) * 2.2;                    // 下向き ±63°
            M.dir.copy(side).multiplyScalar(Math.cos(ang)).addScaledVector(upv, Math.sin(ang)).normalize();
            M.len = 500 + rng() * 500;
            M.dur = 0.6 + rng() * 0.6;
            meteor.visible = true;
        }
        M.t += dt;
        if (q.skytest === 'm') M.t = M.dur * 0.6;                             // 試験用: 流れ星を途中で止めて撮る
        var u = M.t / M.dur;
        if (u >= 1) { M.t = -1; meteor.visible = false; M.next = P.meteorMin + rng() * (P.meteorMax - P.meteorMin); return; }
        var head = new THREE.Vector3().copy(M.p0).addScaledVector(M.dir, u * M.len * 1.6);
        var tail = Math.min(420, u * M.len * 1.6);
        var ctr = head.clone().addScaledVector(M.dir, -tail / 2);
        var toCam = ctr.clone().negate().normalize();
        var nrm = new THREE.Vector3().crossVectors(M.dir, toCam).normalize();
        var m = new THREE.Matrix4().makeBasis(M.dir.clone().multiplyScalar(tail), nrm.multiplyScalar(9), toCam);   // 7 km 先で幅 9 m ≒ 1 画素弱
        m.setPosition(ctr);
        meteor.matrixAutoUpdate = false; meteor.matrix.copy(m);
        meteorMat.uniforms.uI.value = 3.0 * Math.sin(u * Math.PI);
    }

    // --- 入力 -------------------------------------------------------------------------------
    var info = document.getElementById('info'), toast = document.getElementById('toast'), toastTimer = 0;
    var showInfo = !!q.fps;
    if (info) info.style.display = showInfo ? 'block' : 'none';
    function showToast(msg) {
        if (!toast) return;
        toast.textContent = msg; toast.style.opacity = '1';
        clearTimeout(toastTimer); toastTimer = setTimeout(function () { toast.style.opacity = '0'; }, 1800);
    }
    global.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowLeft')  { keyL = true; e.preventDefault(); }
        if (e.key === 'ArrowRight') { keyR = true; e.preventDefault(); }
        if (e.key === 'f' || e.key === 'F') toggleFull();
        if (e.key === 'p' || e.key === 'P') { showInfo = !showInfo; if (info) info.style.display = showInfo ? 'block' : 'none'; }
        if (e.key >= '1' && e.key <= '4') pendingQuality = parseInt(e.key, 10);   // tick の先頭で切り替える
        if (e.key === 'm' || e.key === 'M') toggleAudio();
        if ((e.key === 't' || e.key === 'T') && !XEV.g) XEV.g = galSpawn(jrng);
        if ((e.key === 'g' || e.key === 'G') && !XEV.k) XEV.k = kjSpawn(jrng);
        if ((e.key === 'u' || e.key === 'U') && !XEV.u) XEV.u = { t: 0, lat0: lat, turn: jrng() < 0.5 ? -1 : 1 };
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault();
            var li3 = 2, best = 9;
            for (var i3 = 0; i3 < ROAD_LEVELS.length; i3++) if (Math.abs(ROAD_LEVELS[i3] - P.roadGlow) < best) { best = Math.abs(ROAD_LEVELS[i3] - P.roadGlow); li3 = i3; }
            li3 = Math.max(0, Math.min(ROAD_LEVELS.length - 1, li3 + (e.key === 'ArrowUp' ? 1 : -1)));
            P.roadGlow = ROAD_LEVELS[li3];
            roadMat.uniforms.uRoadGlow.value = P.roadGlow; roadMat.uniforms.uSpecGain.value = P.roadGlow * 0.75;   // 鏡面は比例
            settings.roadGlow = P.roadGlow; saveSettings();
            showToast('路面の明るさ: ' + (li3 + 1) + ' / 5');
        }
        if (e.key === 's' || e.key === 'S') {
            var TW = [0, 0.25, 0.5, 0.75, 1.0], ti = 0;
            for (var i2 = 0; i2 < TW.length; i2++) if (Math.abs(TW[i2] - P.twinkle) < 0.01) ti = i2;
            P.twinkle = TW[(ti + 1) % TW.length]; U_TWINKLE.value = P.twinkle;
            settings.twinkle = P.twinkle; saveSettings();
            showToast('星の瞬き: ' + (P.twinkle === 0 ? 'なし' : Math.round(P.twinkle * 100) + '%'));
        }
        if (e.key === 'b' || e.key === 'B') {
            bikeOn = !bikeOn; settings.bike = bikeOn; saveSettings();
            showToast(bikeOn ? 'バイク' : '車');
        }
        if (e.key === ' ') { paused = !paused; e.preventDefault(); }
    });
    global.addEventListener('keyup', function (e) {
        if (e.key === 'ArrowLeft') keyL = false;
        if (e.key === 'ArrowRight') keyR = false;
    });
    global.addEventListener('blur', function () { keyL = keyR = false; });
    global.addEventListener('dblclick', toggleFull);
    function toggleFull() {
        if (document.fullscreenElement) document.exitFullscreen();
        else document.documentElement.requestFullscreen().catch(function () {});
    }
    var idleTimer = 0;
    global.addEventListener('mousemove', function () {
        document.body.classList.remove('idle');
        clearTimeout(idleTimer);
        idleTimer = setTimeout(function () { document.body.classList.add('idle'); }, 2000);
    });
    document.body.classList.add('idle');

    // --- 音（手続き生成の走行音、既定オフ） ---------------------------------------------------
    var audio = null;
    function updateTrainSound() {
        var A2 = audio, t2 = A2.ctx.currentTime;
        var bTs = bikeT * bikeT * (3 - 2 * bikeT);                     // v7: バイクはエンジンの脈動と、強めの風切り音
        A2.eGain.gain.setTargetAtTime(0.10 * bTs, t2, 0.2);
        A2.wind.gain.setTargetAtTime(0.06 * (1 + 1.5 * bTs), t2, 0.2);
        var rpmF = 1 + 0.03 * Math.sin(timeSec * 0.31);                 // ごくわずかな回転のゆらぎ
        A2.eo1.frequency.setTargetAtTime(46 * rpmF, t2, 0.3); A2.eo2.frequency.setTargetAtTime(23 * rpmF, t2, 0.3);
        var k = Math.max(0, 1 - trainNear / 250);                     // 250 m で 0
        A2.tGain.gain.setTargetAtTime(k * k * 0.5, t2, 0.3);           // 既存の走行音（0.9）より小さく
        A2.cGain.gain.setTargetAtTime(k * k * 0.35, t2, 0.1);
        if (k > 0.01 && t2 > A2.nextClick) {                            // 25 m のレールごとに「タタン」
            [0, 0.11].forEach(function (d) { var b = A2.ctx.createBufferSource(); b.buffer = A2.clk; b.connect(A2.cLp); b.start(t2 + d); });
            A2.nextClick = t2 + 25 / Math.max(trainNearV, 5);
        }
    }
    function toggleAudio() {
        if (audio) { audio.ctx.close(); audio = null; showToast('音: オフ'); return; }
        var AC = global.AudioContext || global.webkitAudioContext;
        if (!AC) return;
        var ctx = new AC();
        var len = ctx.sampleRate * 4, buf = ctx.createBuffer(2, len, ctx.sampleRate);
        for (var ch = 0; ch < 2; ch++) {
            var d = buf.getChannelData(ch), last = 0;
            for (var i = 0; i < len; i++) { var w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
        }
        var src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
        var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 320; lp.Q.value = 0.7;
        var bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 0.5;
        var g1 = ctx.createGain(); g1.gain.value = 0.35;
        var g2 = ctx.createGain(); g2.gain.value = 0.06;
        var master = ctx.createGain(); master.gain.value = 0.0;
        src.connect(lp); lp.connect(g1); g1.connect(master);
        src.connect(bp); bp.connect(g2); g2.connect(master);
        master.connect(ctx.destination);
        var lfo = ctx.createOscillator(); lfo.frequency.value = 0.11;
        var lfoG = ctx.createGain(); lfoG.gain.value = 120;
        lfo.connect(lfoG); lfoG.connect(bp.frequency); lfo.start();
        src.start();
        master.gain.linearRampToValueAtTime(0.9, ctx.currentTime + 3);
        // 電車の走行音（低いゴー）とレールの継ぎ目の音（タタン）。電車が 250 m 以内のときだけ、距離に応じた音量で
        var tlp = ctx.createBiquadFilter(); tlp.type = 'lowpass'; tlp.frequency.value = 140; tlp.Q.value = 0.9;
        var tGain = ctx.createGain(); tGain.gain.value = 0;
        src.connect(tlp); tlp.connect(tGain); tGain.connect(ctx.destination);
        var clk = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.06), ctx.sampleRate), cd = clk.getChannelData(0);
        for (var ci2 = 0; ci2 < cd.length; ci2++) cd[ci2] = (Math.random() * 2 - 1) * Math.exp(-ci2 / (ctx.sampleRate * 0.008));
        var cGain = ctx.createGain(); cGain.gain.value = 0;
        var cLp = ctx.createBiquadFilter(); cLp.type = 'lowpass'; cLp.frequency.value = 900;
        cLp.connect(cGain); cGain.connect(ctx.destination);
        // v7: バイクのエンジン音（2 気筒ふうの低い脈動: 46 Hz ののこぎり波と 23 Hz の矩形波を低域通過）。バイクモードの時だけ、控えめに
        var eo1 = ctx.createOscillator(); eo1.type = 'sawtooth'; eo1.frequency.value = 46;
        var eo2 = ctx.createOscillator(); eo2.type = 'square'; eo2.frequency.value = 23;
        var eo2g = ctx.createGain(); eo2g.gain.value = 0.5;
        var eLp = ctx.createBiquadFilter(); eLp.type = 'lowpass'; eLp.frequency.value = 170; eLp.Q.value = 1.2;
        var eGain = ctx.createGain(); eGain.gain.value = 0;
        eo1.connect(eLp); eo2.connect(eo2g); eo2g.connect(eLp); eLp.connect(eGain); eGain.connect(master);
        eo1.start(); eo2.start();
        audio = { ctx: ctx, tGain: tGain, cGain: cGain, cLp: cLp, clk: clk, nextClick: 0, eGain: eGain, wind: g2, eo1: eo1, eo2: eo2 };
        showToast('音: オン');
    }

    // --- メインループ --------------------------------------------------------------------------
    var last = performance.now(), ema = 16, lastChange = last, frames = 0, fpsAcc = 0, fpsShown = 0;
    var autoRes = !!q.auto;                            // 動的解像度は既定で止める（選んだ画質を勝手に変えない）。auto=1 のときだけ使う
    // --- 点滅の検査（flicker=N: N フレーム走らせ、毎フレームの最後に画面の 5 か所を読んで急変・全黒を数える） ---
    // 表示されるのは tick の最後の状態なので、描画後の解像度変更などで画面が消えればここで黒として見える
    var flk = { n: 0, prev: -1, jumps: 0, blacks: 0, list: [], buf: new Uint8Array(8 * 8 * 4), resChanges: 0, lastPr: -1 };
    function flickerProbe() {
        var gl = renderer.getContext(), W = gl.drawingBufferWidth, H = gl.drawingBufferHeight;
        renderer.setRenderTarget(null);
        var pts = [[0.5, 0.5], [0.1, 0.1], [0.9, 0.1], [0.1, 0.9], [0.9, 0.9]], sum = 0, reg = [];
        for (var i = 0; i < pts.length; i++) {
            gl.readPixels(Math.floor(pts[i][0] * W) - 4, Math.floor(pts[i][1] * H) - 4, 8, 8, gl.RGBA, gl.UNSIGNED_BYTE, flk.buf);
            var rs = 0;
            for (var j = 0; j < flk.buf.length; j += 4) rs += 0.3 * flk.buf[j] + 0.59 * flk.buf[j + 1] + 0.11 * flk.buf[j + 2];
            reg.push(rs / 64); sum += rs;
        }
        var regStr = reg.map(function (x) { return x.toFixed(0); }).join('/');
        var lum = sum / (pts.length * 64);
        flk.resChanges = resChanges;
        if (flk.n > 5) {
            if (lum < 0.5 && flk.prev > 2) { flk.blacks++; if (flk.list.length < 12) flk.list.push('f' + flk.n + ' black (prev ' + flk.prev.toFixed(1) + ')'); }
            else if (Math.abs(lum - flk.prev) > 0.3 * Math.max(flk.prev, 4)) { flk.jumps++; if (flk.list.length < 12) flk.list.push('f' + flk.n + ' s=' + sCam.toFixed(1) + ' jump ' + flk.prev.toFixed(1) + '->' + lum.toFixed(1) + ' regions(c,bl,br,tl,tr) ' + flk.prevReg + ' -> ' + regStr); }
        }
        flk.prev = lum; flk.prevReg = regStr; flk.n++;
        document.title = 'FLK ' + flk.n + ' b' + flk.blacks + ' j' + flk.jumps + ' r' + flk.resChanges;
        if (flk.n >= q.flicker) {
            logErr('FLICKER frames=' + flk.n + ' blackFrames=' + flk.blacks + ' jumps=' + flk.jumps + ' resChanges=' + flk.resChanges + ' anchorResets=' + anchorResets + ' s=' + sCam.toFixed(0) + (flk.list.length ? '\n  ' + flk.list.join('\n  ') : ''));
            return true;
        }
        return false;
    }
    var nextForce = 0, clock = 0;
    // --- 動的解像度（判定は鈍く）: 直近 2 秒のフレーム時間から上位 20% を除いた平均で判断。
    // 60 fps（16.7 ms）を守れていれば下げない（120 Hz のモニタで 8.3 ms を超えても下げない）。
    // 下げる = 2 秒続けて 18.5 ms 超、上げる = 10 秒続けて 12.5 ms 未満。上げた直後 20 秒以内にまた下がったら、その解像度は 60 秒試さない
    var ftBuf = [], overSince = -1, underSince = -1, resChanges = 0, lastResChangeAt = -1, lastUpAt = -1e9, banUntil = {};
    function setPrScale(v) {
        if (Math.abs(v - prScale) < 1e-6) return;
        prScale = v; applySize(); resChanges++; lastResChangeAt = clock;
    }
    function autoResolution(dtMs) {
        ftBuf.push([clock, dtMs]);
        while (ftBuf.length && ftBuf[0][0] < clock - 2) ftBuf.shift();
        if (ftBuf.length < 20) return;
        var a = ftBuf.map(function (e) { return e[1]; }).sort(function (x, y) { return x - y; });
        var keep = Math.max(1, Math.floor(a.length * 0.8)), sum = 0;
        for (var i = 0; i < keep; i++) sum += a[i];
        var tm = sum / keep;
        if (tm > 18.5) { if (overSince < 0) overSince = clock; } else overSince = -1;
        if (tm < 12.5) { if (underSince < 0) underSince = clock; } else underSince = -1;
        if (overSince >= 0 && clock - overSince > 2 && prScale > 0.5) {
            var key = prScale.toFixed(2);
            if (clock - lastUpAt < 20) banUntil[key] = clock + 60;          // 上げた直後に下がった = 振動。この解像度はしばらく試さない
            setPrScale(Math.max(0.5, Math.round((prScale - 0.1) * 100) / 100));
            overSince = -1; underSince = -1; ftBuf.length = 0;
        } else if (underSince >= 0 && clock - underSince > 10 && prScale < 1.0) {
            var up = Math.min(1.0, Math.round((prScale + 0.05) * 100) / 100);
            if (!(banUntil[up.toFixed(2)] > clock)) { setPrScale(up); lastUpAt = clock; }
            underSince = -1; ftBuf.length = 0;
        }
    }
    // --- 耐久試験（soak=km）: 1 フレームに soakStep m ずつ実際と同じ道のりで進め、soakEvery km ごとに資源の数・配列の長さ・処理時間の最長を記録する ---
    var soak = null;
    if (q.soak) {
        soak = { s0: sCam, rows: [], nextKm: 0, frame: 0, fMax: 0, fMaxAt: 0, rMax: 0, prof: {}, t0: performance.now() };
        var soakW = function (name, fn) {
            return function () {
                var t0 = performance.now(), r = fn.apply(this, arguments), d = performance.now() - t0;
                var p = soak.prof[name] || (soak.prof[name] = { max: 0, at: 0, sum: 0, n: 0 });
                if (d > p.max) { p.max = d; p.at = sCam; } p.sum += d; p.n++;
                if (soak.frame > 3) { soak.ip = soak.ip || {}; var p2 = soak.ip[name] || (soak.ip[name] = { max: 0, at: 0 }); if (d > p2.max) { p2.max = d; p2.at = sCam; } }
                return r;
            };
        };
        ensureLines = soakW('ensureLines', ensureLines); fillSecs = soakW('fillSecs', fillSecs); updateWallParts = soakW('updateWallParts', updateWallParts);
        updateTruss = soakW('updateTruss', updateTruss); updateWalkway = soakW('updateWalkway', updateWalkway); updateSide = soakW('updateSide', updateSide);
        updateICs = soakW('updateICs', updateICs); updateTrains = soakW('updateTrains', updateTrains); ensureICs = soakW('ensureICs', ensureICs);
        buildICRamps = soakW('buildICRamps', buildICRamps); ensureSecs = soakW('ensureSecs', ensureSecs); ensurePars = soakW('ensurePars', ensurePars);
        genChunk = soakW('genChunk', genChunk); genBlock = soakW('genBlock', genBlock); genLine = soakW('genLine', genLine); writeSide = soakW('writeSide', writeSide);
        purgeForRamps = soakW('purgeForRamps', purgeForRamps); purgeForRiver = soakW('purgeForRiver', purgeForRiver); purgeForLine = soakW('purgeForLine', purgeForLine);
        buildParMesh = soakW('buildParMesh', buildParMesh); genPar = soakW('genPar', genPar);
    }
    function soakPost(txt) { if (!q.soakPort) return; try { fetch('http://127.0.0.1:' + q.soakPort + '/', { method: 'POST', mode: 'no-cors', body: txt }); } catch (e) { } }
    function soakCount(o) { var n = 0; for (var k in o) n++; return n; }
    function soakRow() {
        var km = (sCam - soak.s0) * P.segLen / 1000, mem = renderer.info.memory, nObj = 0;
        scene.traverse(function () { nObj++; });
        var heap = performance.memory ? performance.memory.usedJSHeapSize / 1048576 : -1;
        var r = { km: km.toFixed(0), geo: mem.geometries, tex: mem.textures, prog: renderer.info.programs ? renderer.info.programs.length : -1, heapMB: heap.toFixed(0), obj: nObj,
            chunk: soakCount(chunkCache), block: soakCount(blockCache), rail: soakCount(railCache), railSmp: soakCount(railSmp), railSt: railStations.length, railSkip: soakCount(railSkip),
            parSt: parStations.length, parKept: soakCount(parKept), parSkip: soakCount(parSkip), ic: icList.length, signs: liveSigns.length, icRoot: icRoot.children.length,
            secs: secs['-1'].length + secs['1'].length, rivers: rivers.length, rivM: soakCount(riverMeshes), side: sideGroup.children.length, scene: scene.children.length,
            fMax: soak.fMax.toFixed(0), fMaxAt: (soak.fMaxAt * P.segLen / 1000).toFixed(1), rMax: soak.rMax.toFixed(0) };
        r.top = Object.keys(soak.ip || {}).sort(function (x, y) { return soak.ip[y].max - soak.ip[x].max; }).slice(0, 4).map(function (k) { return k + ':' + soak.ip[k].max.toFixed(0) + '@' + (soak.ip[k].at * P.segLen / 1000).toFixed(1); }).join(' ');
        soak.ip = {};
        soak.rows.push(r); soak.fMax = 0; soak.rMax = 0;
        document.title = 'SOAK ' + r.km + 'km geo' + r.geo + ' tex' + r.tex + ' heap' + r.heapMB;
        soakPost('ROW ' + JSON.stringify(r));
    }
    function soakDump() {
        var ks = Object.keys(soak.rows[0]);
        var out = ['SOAK seed=' + seed + ' step=' + q.soakStep + 'm frames=' + soak.frame + ' wall=' + ((performance.now() - soak.t0) / 1000).toFixed(0) + 's', ks.join('\t')];
        soak.rows.forEach(function (r) { out.push(ks.map(function (k) { return r[k]; }).join('\t')); });
        out.push('PROF name max(ms) at(km) mean(ms) calls');
        Object.keys(soak.prof).sort(function (x, y) { return soak.prof[y].max - soak.prof[x].max; }).forEach(function (k) { var p = soak.prof[k]; out.push('  ' + k + '\t' + p.max.toFixed(1) + '\t' + (p.at * P.segLen / 1000).toFixed(1) + '\t' + (p.sum / p.n).toFixed(2) + '\t' + p.n); });
        logErr(out.join('\n'));
        document.title = 'SOAKDONE';
        soakPost('DONE\n' + out.join('\n'));
    }
    function tick(now) {
        var dtMs = Math.min(100, now - last); last = now;
        var dt = dtMs / 1000;
        timeSec = q.tFixed ? q.t : timeSec + dt;           // t=秒 を指定すると時刻を固定（瞬きの確認用）
        if (!paused) trainClock += dt;                        // 電車は走行と同じ時計（一時停止中は止まる）
        if (q.tFixed) trainClock = q.t;
        ema = ema * 0.9 + dtMs * 0.1;
        clock += dt;

        // --- 画質・大きさ・動的解像度の変更は、ここ（描画の前）でだけ行う ---
        if (pendingQuality) { applyQuality(pendingQuality); pendingQuality = 0; pendingResize = false; }
        if (pendingResize) { applySize(); pendingResize = false; }
        if (P.forceResEvery > 0 && clock > nextForce) { nextForce = clock + P.forceResEvery; setPrScale(prScale > 0.9 ? 0.8 : 1.0); }
        else if (autoRes) autoResolution(dtMs);

        if (!paused) {
            var ds = speed * dt / P.segLen;
            sCam += ds;
            var dir = keyL && !keyR ? -1 : keyR && !keyL ? 1 : 0;
            if (dir) steer = Math.max(steerMin, Math.min(steerMax, steer + dir * 15 * ds));
            latTarget = Math.max(P.latMin, Math.min(P.latMax, P.laneX + steer * unitM));
        }
        lat += (latTarget - lat) * (1 - Math.exp(-dt * 4));
        updateLean(paused ? 0 : dt);

        if (soak) { sCam += q.soakStep / P.segLen; trainClock = (sCam - soak.s0) * P.segLen / 27.8; }
        var tW0 = performance.now();
        updateWorld(dt);
        updateMeteor(dt);
        if (!/sky/.test(q.hide)) updateSkyObjs(dt); else skyGeo.setDrawRange(0, 0);
        updatePachi();
        if (audio) updateTrainSound();
        U.uTime.value = timeSec;
        if (finalPass) finalPass.uniforms.uTime.value = timeSec;
        var tR0 = performance.now();
        if (!soak || soak.frame % q.soakRender === 0) composer.render();
        if (soak) {
            var tEnd = performance.now();
            if (soak.frame > 3 && tR0 - tW0 > soak.fMax) { soak.fMax = tR0 - tW0; soak.fMaxAt = sCam - soak.s0; }
            if (soak.frame > 3) soak.rMax = Math.max(soak.rMax, tEnd - tR0);
            var kmS = (sCam - soak.s0) * P.segLen / 1000;
            if (kmS >= soak.nextKm) { soakRow(); soak.nextKm += q.soakEvery; }
            soak.frame++;
            if (soak.frame === 4) soak.prof = {};                         // 起動時の先行生成は数えない
            if (kmS >= q.soak) { soakDump(); return; }
            setTimeout(function () { tick(performance.now()); }, 0); return;
        }

        frames++; fpsAcc += dtMs;
        if (fpsAcc > 500) { fpsShown = frames * 1000 / fpsAcc; frames = 0; fpsAcc = 0; }
        if (showInfo && info) {
            info.textContent = fpsShown.toFixed(0) + ' fps  ' + ema.toFixed(1) + ' ms  |  ' + Q.name + '  render ' +
                renderer.domElement.width + 'x' + renderer.domElement.height + ' (x' + prScale.toFixed(2) + ', 切替 ' + resChanges + ' 回' +
                (lastResChangeAt >= 0 ? '・最後 ' + (clock - lastResChangeAt).toFixed(0) + ' 秒前' : '') + ')  |  ' +
                (speed * 3.6).toFixed(0) + ' km/h  s=' + sCam.toFixed(0) + '  seed=' + seed +
                '  curve=' + track.curveAt(sCam) + '  hill=' + track.h[Math.floor(sCam) & (track.a.length - 1)] +
                (bikeT > 0 ? '  |  バイク ロール ' + (lean * bikeT * 180 / Math.PI).toFixed(1) + '°' : '');
        }
        if (q.flicker) { if (!flickerProbe()) setTimeout(function () { tick(performance.now()); }, 16); return; }   // ヘッドレスでも確実にフレームを回す
        if (q.tall && ++tallN >= 3) { if (errBox) errBox.textContent = ''; dumpTall(); }   // 毎フレーム書き直す（最後の描画と同じ状態）
        if (q.trdump && ++lampN2 >= 3) {
            if (errBox) errBox.textContent = '';
            setEye(visE, FC.c.x, FC.c.y, FC.c.z, FC.th);
            var lst = []; for (var kq in railCache) { var Lq = railCache[kq]; if (Lq.par) lst.push(kq + '[' + Lq.sR + '-' + Lq.sE + ']' + (Lq.side < 0 ? 'L' : 'R')); }
            logErr('TR sCam=' + sCam.toFixed(0) + ' clock=' + trainClock.toFixed(1) + ' near=' + trainNear.toFixed(0) + ' cars=' + trainCars.count + ' seen=' + trainsSeen(trainClock, visE) + ' ids=' + encIds.join(',') + ' pars=' + lst.join(' '));
        }
        if (q.lampdump && ++lampN2 >= 3) { if (errBox) errBox.textContent = ''; dumpLamps(); }
        requestAnimationFrame(tick);
    }
    // 確認用: tall=1 で、画面に入っている高さ 30 m 以上の棟の距離と画面上の位置を書き出す（dump-dom で読む）
    var tallN = 0, lampN2 = 0;
    // 確認用: lampdump=1 で、高速道路の街灯（ハロー）の距離と画面上の位置を書き出す
    function dumpLamps() {
        var hp = halos.geometry.attributes.position.array, n = halos.geometry.drawRange.count, v = new THREE.Vector3(), out = [];
        var W = renderer.domElement.clientWidth, H = renderer.domElement.clientHeight;
        for (var i = 0; i < n; i++) {
            v.set(hp[i * 3], hp[i * 3 + 1], hp[i * 3 + 2]); var d = v.distanceTo(camera.position); v.project(camera);
            if (v.z > 1 || Math.abs(v.x) > 1 || Math.abs(v.y) > 1) continue;
            out.push(d.toFixed(0) + '@' + ((v.x + 1) * 0.5 * W).toFixed(1) + ',' + ((1 - v.y) * 0.5 * H).toFixed(1));
        }
        logErr('VIEW ' + W + 'x' + H + ' inner ' + global.innerWidth + 'x' + global.innerHeight + ' dpr ' + global.devicePixelRatio + ' buf ' + renderer.domElement.width + 'x' + renderer.domElement.height + ' uPR ' + U.uPR.value.toFixed(3) + ' LAMPS ' + out.join(' ; '));
    }
    function dumpTall() {
        var v = new THREE.Vector3(), out = [];
        drawn.bldgs.map(function (o) { return [o, o.roadMin !== undefined ? 'blkNear' : 'side']; }).concat(drawn.blocks.map(function (o) { return [o, 'blkFar']; })).forEach(function (e0) {
            var o = e0[0];
            if (o.isPart || !(o.h >= 30)) return;
            v.set(o.x - anchor.x, GROUND_Y - anchor.y, o.z - anchor.z); sideGroup.localToWorld(v);
            var d = Math.hypot(v.x - camera.position.x, v.z - camera.position.z);
            var top = v.clone(); top.y += o.h; top.project(camera); var bot = v.clone().project(camera);
            if (top.z > 1 || Math.abs(top.x) > 1) return;
            out.push([d, o.h, top.x, top.y, bot.y, e0[1] + (o.roadMin !== undefined ? ' rmin=' + o.roadMin.toFixed(0) : '') + ' at=' + o.x.toFixed(0) + ',' + o.z.toFixed(0)]);
        });
        out.sort(function (a, b) { return a[0] - b[0]; });
        var W = renderer.domElement.clientWidth, H = renderer.domElement.clientHeight;
        logErr('TALL ' + out.slice(0, 25).map(function (e) {
            return 'd=' + e[0].toFixed(0) + ' h=' + e[1].toFixed(0) + ' x=' + ((e[2] + 1) * 0.5 * W).toFixed(0) + ' ytop=' + ((1 - e[3]) * 0.5 * H).toFixed(0) + ' ybot=' + ((1 - e[4]) * 0.5 * H).toFixed(0) + ' ' + e[5];
        }).join(' ; '));
    }

    if (q.dbg === 8) { roadMat.side = THREE.DoubleSide; roadMat.needsUpdate = true; }
    else if (q.dbg) { roadMat.defines.DBG = q.dbg; roadMat.needsUpdate = true; }
    if (q.debug) {
        updateWorld(0);
        var rpA = roadGeo.attributes.position.array, s2 = '';
        for (var ri2 = 10; ri2 < 20; ri2++) {
            s2 += 'road row ' + ri2 + ' d=' + rowD[ri2].toFixed(2) + ': ' + [rpA[ri2 * 6], rpA[ri2 * 6 + 1], rpA[ri2 * 6 + 2], rpA[ri2 * 6 + 3], rpA[ri2 * 6 + 4], rpA[ri2 * 6 + 5]].map(function (x) { return x.toFixed(2); }).join(',') + '\n';
        }
        s2 += 'cam ' + camera.position.toArray().map(function (x) { return x.toFixed(2); }).join(',') + ' index=' + (roadGeo.index ? roadGeo.index.count : 'none') + ' drawRange=' + JSON.stringify(roadGeo.drawRange) + '\n';
        for (var la = 0; la < 6; la++) s2 += 'lamp' + la + ' ' + lampArr[la].toArray().map(function (x) { return x.toFixed(2); }).join(',') + '\n';
        s2 += 'lampI=' + P.lampI + ' headI=' + P.headI + ' eClamp=' + P.eClamp + ' uEClamp=' + U.uEClamp.value + ' NL=' + roadMat.defines.NL + ' expMin=' + U.uExpMin.value + ' expMax=' + U.uExpMax.value + '\n';
        s2 += 'head0 ' + U.uHeadPos0.value.toArray().map(function (x) { return x.toFixed(2); }).join(',') + ' fwd ' + U.uCarFwd.value.toArray().map(function (x) { return x.toFixed(2); }).join(',') + '\n';
        updateTrains(q.t || 0);
        s2 += 'rail: lines ' + Object.keys(railCache).length + ' beds ' + railbeds.count + ' portals ' + portals.count + ' cars ' + trainCars.count + ' glows ' + tglows.count + ' pts ' + railPts.geometry.drawRange.count + ' nearestCar ' + trainNear.toFixed(0) + 'm\n';
        if (trainCars.count) { trainCars.getMatrixAt(0, tmpM); s2 += 'car0 ' + tmpV.setFromMatrixPosition(tmpM).toArray().map(function (x) { return x.toFixed(1); }).join(',') + ' group ' + sideGroup.position.toArray().map(function (x) { return x.toFixed(1); }).join(',') + '\n'; }
        s2 += 'side: houses ' + houseMesh.count + ' bldgs ' + bldgMesh.count + ' trees ' + treeMesh.count + ' lights ' + sidePts.geometry.drawRange.count + ' pools ' + poolMesh.count + '\n';
        var spA = sidePts.geometry.attributes.position.array, scA = sidePts.geometry.attributes.aCol.array;
        s2 += 'light0 ' + [spA[0], spA[1], spA[2], scA[0], scA[1], scA[2]].map(function (x) { return x.toFixed(2); }).join(',') + ' group ' + sideGroup.position.toArray().map(function (x) { return x.toFixed(1); }).join(',') + '\n';
        logErr(s2);
    }
    if (q.hide) {
        // 切り分け用: hide=posts,rails,poles,halos,cones,road,deck,piers,ground,city,near
        var H = { posts: [posts], rails: [rails], poles: [poles], halos: [halos], cones: [cones], road: [road], deck: [deck],
                  piers: [pierCols, pierBeams], ground: [ground], city: [cityGroup], near: [blockMesh, blockPts],
                  side: [sideGroup], rpoles: [rpoles, railEnds], rail: [railbeds, portals, trainCars, tglows, railPts, ppierCols, ppierBeams, pportals], houses: [houseMesh, bldgMesh, partMesh], trees: [treeMesh], streetlights: [sidePts, poolMesh, upoles], wall: [wallMesh], panel: [panelMesh, panelOpMesh] };
        q.hide.split(',').forEach(function (k) { if (H[k]) H[k].forEach(function (o) { o.visible = false; }); });
    }
    if (q.debug) {
        // カーブ区間と丘の極値を書き出す（撮影地点を選ぶため）
        track.ensure(8000);
        var line = '', cur = track.a[0 & (track.a.length - 1)], from = 0;
        for (var si = 1; si < 8000; si++) {
            var av = track.a[si & (track.a.length - 1)];
            if (av !== cur) { if (cur !== 0) line += 'curve ' + cur + ' s=' + from + '..' + si + '\n'; cur = av; from = si; }
        }
        var hmax = 0, hs = 0;
        for (var hi = 0; hi < 8000; hi++) { var hv = track.h[hi & (track.a.length - 1)]; if (hv > hmax) { hmax = hv; hs = hi; } if (hi % 500 === 499) { line += 'hill max ' + hmax + ' at s=' + hs + ' (block ' + (hi - 499) + ')\n'; hmax = 0; } }
        line += 'hill peaks: ' + hillPeaks.map(function (p) { return (Math.atan2(p.x, -p.z) * 180 / Math.PI).toFixed(0) + 'deg h' + p.h.toFixed(0) + (p.tower ? ' tower' : '') + (p.steady ? ' steady' : ''); }).join(', ') + '\n';
        for (var pj = 0; pj < 4; pj++) { var PP = railCache['p' + pj] || null; line += 'par ' + pj + (parSkip[pj] ? ' skip(' + parSkip[pj] + ')' : '') + (PP ? ' sA=' + PP.sA + ' run ' + PP.sR + '..' + PP.sE + ' sL=' + PP.sL + ' side=' + PP.side + ' roadHit=' + PP.roadHit + ' gmax=' + PP.gmax.toFixed(3) : ' none') + '\n'; }
        var gl2 = 'gaps:';
        for (var gb2 = 0; gb2 < 8000 / GAP_BLOCK; gb2++) { var G2 = gapOfBlock(gb2); if (G2) gl2 += ' ' + G2[0] + '-' + G2[1]; }
        line += gl2 + '\n';
        // 線路: 交差点の道のり・交差角、電車の先頭が交差点を通る時刻（t= で撮影用）
        sCam = 100; for (var rk2 = 0; railStation(rk2) < 12000; rk2++) {
            var LL = railCache[rk2] || genLine(rk2);
            var tCross = [0, 1].map(function (d) { var D = LL.D[d]; return (((RAIL_HALF % D) - LL.ph[d] + 2 * D) % D) / LL.v; });
            line += 'rail ' + rk2 + ' cross s=' + LL.sc.toFixed(0) + ' angle=' + LL.angDeg.toFixed(1) + ' v=' + (LL.v * 3.6).toFixed(0) + 'km/h headAtCross t=' + tCross.map(function (x) { return x.toFixed(1); }).join('/') + '\n';
        }
        sCam = 100 + (q.frame || 0);
        logErr(line);
    }
    // trainview=k（撮影用）: 線路 k が道路から 50〜200 m 横にある地点へカメラを置き、tvahead m 先に電車（tvdir の方向）が来る時刻にする
    if (q.trainview >= 0) {
        var LV = genLine(q.trainview), best = -1, bestErr = 1e9;
        for (var sv = Math.max(200, LV.sc - 3000); sv < LV.sc + 3000; sv += 10) {
            track.ensure(sv + 5); var iv = Math.floor(sv) & TMASK;
            var dv = lineDist(LV, track.px[iv], track.pz[iv]);
            // 線路が道路の左側（ガードレールの下の隙間から見える側）にある地点を選ぶ
            var thv = track.th[iv], rxv = Math.cos(thv), rzv = Math.sin(thv);
            var tpv = (track.px[iv] - LV.cx) * LV.dx + (track.pz[iv] - LV.cz) * LV.dz;
            var qx = LV.cx + LV.dx * tpv - track.px[iv], qz = LV.cz + LV.dz * tpv - track.pz[iv];
            var leftSide = (qx * rxv + qz * rzv) < 0;
            var err = Math.abs(dv - 110) + (dv < 50 || dv > 200 ? 1e6 : 0) + (leftSide ? 0 : 1e5);
            if (err < bestErr) { bestErr = err; best = sv; }
        }
        if (best > 0) {
            sCam = best;
            var ia = Math.floor(best + q.tvAhead) & TMASK;
            var ua = (track.px[ia] - LV.cx) * LV.dx + (track.pz[ia] - LV.cz) * LV.dz;
            var dirV = q.tvDir, sgV = dirV === 0 ? 1 : -1, Dv = LV.D[dirV];
            var hu = sgV * (ua + sgV * 110);                         // 電車の中ほどがその地点に来るよう、先頭を 110 m 先に
            q.t = (((hu + RAIL_HALF - LV.ph[dirV]) % Dv) + Dv) % Dv / LV.v; q.tFixed = true; timeSec = q.t;
            document.title = ('trainview line ' + q.trainview + ' s=' + best.toFixed(0) + ' dist=' + (bestErr + 110).toFixed(0) + 'm t=' + q.t.toFixed(1));
        }
    }
    // ptv=j（撮影用）: 並走線 j の並走区間の ptvat（0〜1、既定 0.5 = 中央）の地点にカメラを置く。
    // 並走線の電車の位相は、通常の走行（起動から既定の速さ）で到着する時刻に合わせて決めるので、ここで置いたカメラの時刻とは合わない（実際の出会いは drive= で確かめる）
    if (q.ptv >= 0) {
        var PV = genPar(q.ptv);
        if (PV) {
            sCam = PV.sR + (PV.sE - PV.sR) * q.ptvAt;
            if (!q.tFixed) { q.t = 0; q.tFixed = true; }
            document.title = 'ptv ' + q.ptv + ' sA=' + PV.sA + ' sR=' + PV.sR + ' sE=' + PV.sE + ' side=' + PV.side + ' roadHit=' + PV.roadHit + ' gmax=' + PV.gmax.toFixed(3);
        }
    }
    // selftest=1: 描画せずに 300 km 走らせて、世界固定の物と道路の重なりを数える（selftest=N なら N km）
    // drive=秒（確認用）: 起動から既定の速さでその秒数だけ走った状態を、selftest と同じ 40 m 刻みの早送りで作ってから描く
    // （線路・並走線の決まり方と電車の時刻が、通常の走行と同じになる）
    if (q.drive > 0 && !q.selftest) {
        var sDr0 = sCam, spdD = speed > 0 ? speed : 27.8, sDr1 = sDr0 + q.drive * spdD;
        while (sCam + CHUNK < sDr1) { sCam += CHUNK; track.ensure(sCam + P.viewLen + 40); frameAt(sCam, FC); O.copy(FC.c); trainClock = (sCam - sDr0) / spdD; collectDrawn(); }
        sCam = sDr1; trainClock = q.drive; q.t = q.drive; q.tFixed = true; timeSec = q.t;
    }
    // lc=秒（確認用、バイク）: 止めたまま、右キーを 0.5 秒押す車線移動を 1/60 秒刻みで再現し、その秒数の時点の傾きで描く。全体の最大・逆振れも書き出す
    if (q.curvescan) {
        ensureICs(sCam + RAIL_AHEAD + 8000);                                                  // 確認用: 左右のカーブの地点を探す（curve 値の一覧）
        var csv = []; for (var cs = 100; cs < 20000; cs += 50) { track.ensure(cs + 10); var cvv = track.curveAt(cs); if (Math.abs(cvv) >= 2) csv.push(cs + ':' + cvv); }
        logErr('CURVES ' + csv.join(' '));
        logErr('ICS ' + icList.slice(0, 6).map(function (ic) { return '#' + ic.no + ' ' + ic.name[0] + ' ok=' + ic.ok + ' ex0=' + ic.sEx0 + ' n1=' + ic.sN1 + ' n2=' + ic.sN2 + ' end=' + ic.sEnd + (ic.ramps ? ' noseTipL=' + (ic.sN1 + noseS(ic.ramps[0])).toFixed(0) + ' mergeTipL=' + (ic.sN2 - noseS(ic.ramps[1])).toFixed(0) : '') + (ic.ramps ? ' g=' + ic.ramps.map(function (R) { return R.gmax.toFixed(3) + '/' + R.rmin.toFixed(0) + '@' + R.rminAt; }).join(',') : ''); }).join(' | '));
        ensureSecs(60000); logErr('RIVERS ' + rivers.slice(0, 6).map(function (R) { return R.s0 + '-' + R.s1 + ' w=' + R.w.toFixed(0); }).join(' ')); logErr('GROADS ' + groads.slice(0, 8).map(function (R) { return R.s0 + '-' + R.s1 + ' xi=' + Math.round(R.xi); }).join(' ')); logErr('SECS L ' + secs[-1].slice(0, 14).map(function (o) { return o.s0 + '-' + o.s1 + 'ABCD'.charAt(o.ty) + (o.river ? 'R' : ''); }).join(' ') + ' | R ' + secs[1].slice(0, 14).map(function (o) { return o.s0 + '-' + o.s1 + 'ABCD'.charAt(o.ty); }).join(' '));
        logErr('OPENINGS ' + [0, 1, 2, 3].map(function (n) { return openAt(n).join('-'); }).join(' ') + ' GAPS ' + [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(function (b) { var g = gapOfBlock(b); return g ? g.join('-') : ''; }).filter(String).join(' '));
    }
    if (q.lc > 0) {
        var lcMax = 0, lcMin = 0, lcAt = 0, lcState = null, lcEarly = 0, lcTrace = [];
        for (var lci = 0; lci < 240; lci++) {
            var tl = lci / 60, ds2 = speed / 60 / P.segLen;
            if (tl < 0.5) steer = Math.max(steerMin, Math.min(steerMax, steer + 15 * ds2));
            latTarget = Math.max(P.latMin, Math.min(P.latMax, P.laneX + steer * unitM));
            lat += (latTarget - lat) * (1 - Math.exp(-4 / 60));
            var pz = paused; paused = false; updateLean(1 / 60); paused = pz;
            var dl = (lean - leanCurve) * 180 / Math.PI;
            if (dl > lcMax) { lcMax = dl; lcAt = tl; } if (dl < lcMin) lcMin = dl; if (tl < 0.2 && dl < lcEarly) lcEarly = dl; lcTrace.push(dl.toFixed(1));
            if (Math.abs(tl - q.lc) < 1 / 120) lcState = { lat: lat, lean: lean, leanCurve: leanCurve, leanLat: leanLat, latV: latV, aSlow: aSlow, aFast: aFast, latPrev: latPrev, latTarget: latTarget, steer: steer };
        }
        if (lcState) { lat = lcState.lat; lean = lcState.lean; leanCurve = lcState.leanCurve; leanLat = lcState.leanLat; latTarget = lcState.lat; steer = lcState.steer; }   // 撮影中は横位置を止める
        logErr('LANECHANGE max=' + lcMax.toFixed(1) + 'deg at ' + lcAt.toFixed(2) + 's early(<0.2s)=' + lcEarly.toFixed(1) + ' min=' + lcMin.toFixed(1) + ' trace(1/60s)=' + lcTrace.filter(function (x, i) { return i % 6 === 0; }).join(',') + 'deg leanAtShot=' + (lean * 180 / Math.PI).toFixed(1) + ' lat=' + lat.toFixed(2));
        lcFreeze = true;
    }
    if (q.selftest) {
        var stKm = q.selftest === 1 ? 300 : q.selftest;
        setTimeout(function () { runSelftest(stKm); }, 0);
        return;
    }
    // shot=1 は pause=1 と同じ（ヘッドレス撮影用。描画を止めると黒が撮れるので描き続ける）
    if (q.shot) paused = true;
    requestAnimationFrame(tick);
    var hint = document.getElementById('hint');
    if (hint) { if (q.pause || q.shot) hint.style.display = 'none'; else setTimeout(function () { hint.style.opacity = '0'; }, 5000); }

    function parFloat0(v) { var x = parseFloat(v); return isFinite(x) ? x : 0; }
    function parseParams() {
        var o = {}, sp = new URLSearchParams(global.location.search);
        o.tall = sp.has('tall'); o.encdbg = sp.has('encdbg'); o.encfrom = parFloat0(sp.get('encfrom'));
        o.lampdump = sp.has('lampdump'); o.trdump = sp.has('trdump'); o.lookd = sp.has('lookd'); o.lookat = sp.has('lookat') ? sp.get('lookat').split(',').map(parseFloat) : null; o.icdump = sp.has('icdump');
        o.seed = sp.has('seed') ? (parseInt(sp.get('seed'), 10) & 0xFFFF) : Math.floor(Math.random() * 17417);
        o.frame = parseFloat(sp.get('frame')) || 0;
        o.speed = parseFloat(sp.get('speed')) || 0;
        o.q = parseInt(sp.get('q'), 10) || 0;
        o.pause = sp.get('pause') === '1';
        o.shot = sp.get('shot') === '1';
        o.auto = sp.get('auto') === '1';
        o.fps = sp.get('fps') === '1';
        o.debug = sp.get('debug') === '1';
        o.t = parseFloat(sp.get('t')) || 0;
        o.tFixed = sp.has('t');
        o.hide = sp.get('hide') || '';
        o.dbg = parseInt(sp.get('dbg'), 10) || 0;
        o.selftest = parseFloat(sp.get('selftest')) || 0;
        o.drive = parseFloat(sp.get('drive')) || 0;
        o.lc = parseFloat(sp.get('lc')) || 0; o.nov9 = sp.has('nov9'); o.pdbg = parseInt(sp.get('pdbg') || '0', 10); o.encfps = parseFloat(sp.get('encfps')) || 0; o.curvescan = sp.has('curvescan');
        o.bikeSet = sp.has('bike'); o.bike = sp.get('bike') === '1';
        o.flicker = parseInt(sp.get('flicker'), 10) || 0;
        o.ginga = sp.has('ginga') ? parseFloat(sp.get('ginga')) : null; o.ufo = sp.has('ufo') ? parseFloat(sp.get('ufo')) : null; o.kaiju = sp.has('kaiju') ? parseFloat(sp.get('kaiju')) : null;
        o.skytest = sp.get('skytest') || ''; o.pachiAt = parseFloat(sp.get('pachiAt')) || 0; o.wheelAt = parseFloat(sp.get('wheelAt')) || 0; o.martAt = sp.get('martAt') ? sp.get('martAt').split(',').map(parseFloat) : null;
        o.soak = parseFloat(sp.get('soak')) || 0; o.adbg = sp.has('adbg'); o.oldrail = sp.has('oldrail'); o.soakStep = parseFloat(sp.get('soakStep')) || 8; o.soakEvery = parseFloat(sp.get('soakEvery')) || 10; o.soakPort = parseInt(sp.get('soakPort'), 10) || 0; o.soakRender = parseInt(sp.get('soakRender'), 10) || 1;
        o.trainview = sp.has('trainview') ? parseInt(sp.get('trainview'), 10) : -1;
        o.ptv = sp.has('ptv') ? parseInt(sp.get('ptv'), 10) : -1;
        o.ptvAt = sp.has('ptvat') ? parseFloat(sp.get('ptvat')) : 0.5;
        o.tvDir = parseInt(sp.get('tvdir'), 10) || 0;
        o.tvAhead = sp.has('tvahead') ? parseFloat(sp.get('tvahead')) : 150;
        // 調整用: 任意の P パラメータを上書き（例: &p.lampI=3000&p.headI=0）
        o.pSet = {};
        sp.forEach(function (v, k) { if (k.indexOf('p.') === 0 && P.hasOwnProperty(k.slice(2))) { var f = parseFloat(v); if (!isNaN(f)) { P[k.slice(2)] = f; o.pSet[k.slice(2)] = true; } } });
        return o;
    }
}

global.ThreeWayApp = { start: start, P: P, QUALITY: QUALITY };
})(typeof window !== 'undefined' ? window : this);
