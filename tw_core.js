// ---------------------------------------------------------------------------
// tw_core.js -- ThreeWay respected FreeWay の道路コア（描画に依存しない）
//
// 1 区間（1 m）ずつ道路の形を生む:
//   curve: 曲がりの強さ（整数 -4..4、正 = 右、0 = 直線）。直線と一定の曲がりが交互に続く
//   hill : 起伏（正 = 低い）。平らな区間の合間に、なだらかに下って上がる窪みが入る
// 空の星 120 個と地平線の灯り 130 個の方位・高さ・色もここで決める。
// 乱数は seed から決まるので、同じ seed なら同じ道になる。
//
// クラシックスクリプト。グローバル TwCore を公開する。
// ---------------------------------------------------------------------------
(function (global) {
'use strict';

// 32 ビットの xorshift。seed は混ぜてから使う（近い seed でも違う道にする）
function makeRng(seed) {
    var s = (seed >>> 0) ^ 0x9E3779B9;
    s = Math.imul(s ^ (s >>> 16), 0x85EBCA6B); s = Math.imul(s ^ (s >>> 13), 0xC2B2AE35); s ^= s >>> 16;
    if (s === 0) s = 0x6D2B79F5;
    return function () {
        s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0;
        return s / 4294967296;
    };
}

// 曲がり: 直線 30〜370 m（中央値 約 200 m）と、強さ 1〜4 の一定の曲がり 60〜230 m が交互。
// 曲がりの 2 割弱は直線をはさまず次の曲がりへ続く（S 字や、きつさの変わるカーブ）。
// 直近（約 700 m）に曲がった向きを覚えておき、同じ向きが続くほど逆向きを選びやすくする
// （同じ向きばかり続くと道が輪になり、自分の脇へ戻ってくる）
var TURN_MEM = 1 - 1 / 700, TURN_SOFT = 900, TURN_HARD = 1300;
var CURVE_W = [0.22, 0.24, 0.24, 0.30];          // 強さ 1, 2, 3, 4 の出やすさ
// インターチェンジの区間: 7〜10 km ごとに、出口の直線 270 m → 間 950〜1200 m（ゆるい曲がり 2 つと短い直線）→ 入口の直線 350 m。
// 直線は減速車線・加速車線（と前後 50 m）がちょうど収まる長さ。位置は sites に残し、インターチェンジはそこに置く
var IC_GAP = 5500, IC_GAP_RND = 3000, IC_EXIT = 270, IC_ENTRY = 350, IC_MID = 950, IC_MID_RND = 250;

// 起伏: 平ら 250〜1500 m → 下り（1 m に 13〜19）→ 底 60〜300 m → 上り（1 m に 12〜20）→ 平ら。
// 窪みの深さは 1200〜4800（hillLevel 倍）。傾きは急に変えず、目標の傾きへ少しずつ寄せる
var HILL_EASE = 0.08;

function TwCore(seed, hillLevel) {
    this.rng = makeRng(seed === undefined ? 1 : seed);
    this.hillLevel = hillLevel === undefined ? 1 : hillLevel;
    this.curve = 0;
    this.hill = 0;
    this._cLeft = 150;            // 走り始めは直線
    this._cVal = 0;
    this._turn = 0;               // 直近に曲がった量（右が正）
    this._dist = 0;               // 進んだ距離
    this._nextIC = 2400;          // 次のインターチェンジの区間を始めてよい距離
    this._plan = [];              // 決まっている次の区間 [{v: 曲がり, n: 長さ}]
    this.sites = [];              // インターチェンジの区間 {d: 始まり（その区間を出した step の通し番号）, exit, mid, entry: 各長さ}
    this._hPhase = 0;             // 0 平ら / 1 下り / 2 底 / 3 上り
    this._hLeft = 400;
    this._hRate = 0;
    this._hTarget = 0;
    this._hDepth = 0;
    this._hBase = 0;
    this._makeSky();
}

TwCore.prototype._tri = function () { return (this.rng() + this.rng()) * 0.5; };

TwCore.prototype._pickSign = function () {
    var pR = 0.5 - 0.42 * Math.tanh(this._turn / TURN_SOFT), sg = this.rng() < pR ? 1 : -1;
    if (Math.abs(this._turn) > TURN_HARD) sg = this._turn > 0 ? -1 : 1;
    return sg;
};

TwCore.prototype._nextCurve = function () {
    var r = this.rng;
    if (this._plan.length) { var pl = this._plan.shift(); this._cVal = pl.v; this._cLeft = pl.n; return; }
    if (this._cVal !== 0 && this._dist >= this._nextIC) {
        // インターチェンジの区間: 出口の直線、間（曲がり・短い直線・曲がり。強さ 1〜2）、入口の直線
        var mid = Math.round(IC_MID + IC_MID_RND * r());
        var a = Math.round(mid * (0.3 + 0.15 * r())), b = Math.round(mid * (0.1 + 0.1 * r())), c = mid - a - b;
        var v1 = (1 + Math.floor(r() * 2)) * this._pickSign(), v2 = (1 + Math.floor(r() * 2)) * (r() < 0.5 ? 1 : -1) * (v1 > 0 ? 1 : -1) * -1;
        this.sites.push({ d: this._dist, exit: IC_EXIT, mid: mid, entry: IC_ENTRY });
        this._plan = [{ v: v1, n: a }, { v: 0, n: b }, { v: v2, n: c }, { v: 0, n: IC_ENTRY }];
        this._nextIC = this._dist + IC_EXIT + mid + IC_ENTRY + IC_GAP + IC_GAP_RND * r();
        this._cVal = 0; this._cLeft = IC_EXIT;
        return;
    }
    if (this._cVal === 0 || r() < 0.18) {
        var u = r(), k = 0, acc = CURVE_W[0];
        while (u > acc && k < 3) { k++; acc += CURVE_W[k]; }
        this._cVal = (k + 1) * this._pickSign();
        this._cLeft = Math.round(60 + 170 * this._tri());
    } else {
        this._cVal = 0;
        this._cLeft = Math.round(30 + 340 * this._tri());
    }
};

TwCore.prototype._nextHill = function () {
    var r = this.rng;
    if (this.hillLevel <= 0) { this._hPhase = 0; this._hLeft = 1e9; this._hTarget = 0; return; }
    switch (this._hPhase) {
    case 0:                                   // 平ら → 下り
        this._hPhase = 1;
        this._hDepth = (1200 + 3600 * r()) * this.hillLevel;
        this._hTarget = 13 + 6 * r();
        this._hLeft = 1e9;                    // 深さに届いたら終わる
        break;
    case 1:                                   // 下り → 底
        this._hPhase = 2;
        this._hTarget = (r() - 0.5) * 6;
        this._hLeft = Math.round(60 + 240 * r());
        break;
    case 2:                                   // 底 → 上り
        this._hPhase = 3;
        this._hTarget = -(12 + 8 * r());
        this._hLeft = 1e9;                    // 平らの高さに戻ったら終わる
        break;
    default:                                  // 上り → 平ら（わずかに残る高さで止まる）
        this._hPhase = 0;
        this._hBase = Math.round(30 * r() * r());
        this._hTarget = 0;
        this._hLeft = Math.round(250 + 1250 * r());
        break;
    }
};

// 1 区間進める
TwCore.prototype.step = function () {
    this._dist++;
    if (--this._cLeft <= 0) this._nextCurve();
    this.curve = this._cVal;
    this._turn = this._turn * TURN_MEM + this._cVal;

    this._hRate += (this._hTarget - this._hRate) * HILL_EASE;
    var h = this.hill + this._hRate;
    if (this._hPhase === 0) { h = this.hill + (this._hBase - this.hill) * 0.05; this._hRate = 0; }
    if (this._hPhase === 1 && h >= this._hDepth) this._hLeft = 0;
    if (this._hPhase === 3 && h <= this._hBase + 40) this._hLeft = 0;
    this.hill = h;
    if (--this._hLeft <= 0) this._nextHill();
};

// 星: 方位 0〜2π、仰角 30〜75°、色は水色がかった白（4 段階の濃さ）
// 地平線の灯り: 方位 0〜2π、高さ 10〜200 m（低いものほど多い）、色は白・電球色・ナトリウム灯・赤
var LIGHT_COL = [[0.55, 0.55, 0.55], [0.75, 0.75, 0.75], [0.9, 0.9, 0.88], [1.0, 1.0, 0.97],
                 [0.62, 0.6, 0.22], [0.75, 0.72, 0.22], [0.88, 0.85, 0.25], [0.68, 0.4, 0.38]];
TwCore.prototype._makeSky = function () {
    var r = makeRng((this.rng() * 4294967296) >>> 0);
    this.stars = [];
    for (var i = 0; i < 120; i++) {
        var lv = 0.6 + 0.4 * Math.floor(r() * 4) / 3;
        this.stars.push({ az: r() * Math.PI * 2, el: (30 + 45 * r()) * Math.PI / 180, rgb: [0, lv, lv] });
    }
    this.lights = [];
    for (var j = 0; j < 130; j++) {
        var u = r();
        this.lights.push({ az: r() * Math.PI * 2, h: 10 + 190 * u * u, rgb: LIGHT_COL[j % LIGHT_COL.length].slice() });
    }
};

global.TwCore = TwCore;
})(typeof window !== 'undefined' ? window : this);
