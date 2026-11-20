// ---------------------------------------------------------------------------
// tw_track.js -- 道路コア (tw_core.js) が 1 区間ずつ出す曲がりと起伏から、
// 世界座標の道路の軌道（位置・方位・バンク角）を積み上げる。
//
// クラシックスクリプト。グローバル TwTrack を公開する。
// ---------------------------------------------------------------------------
(function (global) {
'use strict';

var LEAD = 237;          // 走り始めの直線・平坦な区間
var RING = 1 << 15;      // 保持する区間数（線路を前方 ~20 km で決めるため、前方 ~20 km ＋後方 ~12 km）
var MASK = RING - 1;
var BANK_WIN = 20;       // バンク角の移動平均の半幅（区間）

function TwTrack(opts) {
    opts = opts || {};
    this.segLen    = opts.segLen    || 1.0;       // m / 区間
    this.curveGain = opts.curveGain || 0.0015;    // rad / 区間 / 曲がりの単位
    this.hillGain  = opts.hillGain  || 0.0025;    // m / 起伏の単位
    this.bankGain  = opts.bankGain  || 0.02;      // rad / 曲がりの単位（平滑後）
    this.hillLevel = opts.hillLevel === undefined ? 1 : opts.hillLevel;

    this.core = new global.TwCore(opts.seed === undefined ? 1 : opts.seed, this.hillLevel);

    this.a    = new Float32Array(RING);   // 曲がり（-4..4）
    this.h    = new Float32Array(RING);   // 起伏（正 = 低い）
    this.th   = new Float64Array(RING);   // 方位（rad、累積、右回り正）
    this.px   = new Float64Array(RING);
    this.py   = new Float64Array(RING);
    this.pz   = new Float64Array(RING);
    this.bank = new Float32Array(RING);   // バンク角（rad、正 = 右が下がる＝右カーブ用）

    this.last = -1;        // 定義済みの最後の道のり（区間）

    for (var s = 0; s < LEAD; s++) this._push(0, 0);
}

TwTrack.prototype._push = function (a, h) {
    var n = this.last + 1;
    var i = n & MASK;
    this.a[i] = a;
    this.h[i] = h;
    if (n === 0) {
        this.th[i] = 0; this.px[i] = 0; this.py[i] = 0; this.pz[i] = 0;
    } else {
        var p = (n - 1) & MASK;
        var th = this.th[p] + a * this.curveGain;
        this.th[i] = th;
        this.px[i] = this.px[p] + Math.sin(th) * this.segLen;
        this.pz[i] = this.pz[p] - Math.cos(th) * this.segLen;
        this.py[i] = -h * this.hillGain;
    }
    this.last = n;
    // バンクは BANK_WIN だけ遅れて、[n-2W, n] の平均の曲がりから決める
    var b = n - BANK_WIN;
    if (b >= 0) {
        var sum = 0, cnt = 0;
        for (var k = Math.max(0, n - 2 * BANK_WIN); k <= n; k++) { sum += this.a[k & MASK]; cnt++; }
        this.bank[b & MASK] = (sum / cnt) * this.bankGain;
    }
};

// 道のり need まで定義されるようにコアを進める
TwTrack.prototype.ensure = function (need) {
    need = Math.ceil(need) + BANK_WIN + 2;
    while (this.last < need) {
        this.core.step();
        this._push(this.core.curve, this.core.hill);
    }
};

TwTrack.prototype.minStation = function () { return Math.max(0, this.last - RING + 4); };

// 連続した道のり s の地点を out に書く。
// out: {x,y,z, th, bank, slope}
TwTrack.prototype.sample = function (s, out) {
    if (s > this.last - 2) this.ensure(s + 2);
    if (s < 0) s = 0;
    var n = Math.floor(s), f = s - n;
    var i = n & MASK, j = (n + 1) & MASK;
    out.x  = this.px[i] + (this.px[j] - this.px[i]) * f;
    out.y  = this.py[i] + (this.py[j] - this.py[i]) * f;
    out.z  = this.pz[i] + (this.pz[j] - this.pz[i]) * f;
    out.th = this.th[i] + (this.th[j] - this.th[i]) * f;
    out.bank = this.bank[i] + (this.bank[j] - this.bank[i]) * f;
    var i0 = Math.max(0, n - 3) & MASK, i1 = (n + 3) & MASK;
    out.slope = (this.py[i1] - this.py[i0]) / (6 * this.segLen);
    return out;
};

TwTrack.prototype.curveAt = function (s) { return this.a[Math.floor(s) & MASK]; };

// コアが作ったインターチェンジの区間を道のりで返す: [{s: 始まりの道のり, exit, mid, entry: 出口の直線・間・入口の直線の長さ}]
TwTrack.prototype.icSites = function () {
    return this.core.sites.map(function (t) { return { s: LEAD - 1 + t.d, exit: t.exit, mid: t.mid, entry: t.entry }; });
};

global.TwTrack = TwTrack;
})(typeof window !== 'undefined' ? window : this);
