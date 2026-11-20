// ---------------------------------------------------------------------------
// tw_shaders.js -- ThreeWay respected FreeWay の GLSL 群（クラシックスクリプト、グローバル TW_SHADERS）
// three.js r170 の ShaderMaterial 向け（GLSL ES 1.00 記法。WebGL2 へは three が変換する）
// ---------------------------------------------------------------------------
(function (global) {
'use strict';

// --- 共通: ノイズ ----------------------------------------------------------
var NOISE = [
'float hash12(vec2 p) {',
'    vec3 p3 = fract(vec3(p.xyx) * 0.1031);',
'    p3 += dot(p3, p3.yzx + 33.33);',
'    return fract((p3.x + p3.y) * p3.z);',
'}',
// 値ノイズ: x = 値, yz = 勾配
'vec3 noised(vec2 p) {',
'    vec2 i = floor(p), f = fract(p);',
'    vec2 u = f*f*(3.0-2.0*f);',
'    vec2 du = 6.0*f*(1.0-f);',
'    float a = hash12(i), b = hash12(i+vec2(1,0)), c = hash12(i+vec2(0,1)), d = hash12(i+vec2(1,1));',
'    float k0 = a, k1 = b-a, k2 = c-a, k3 = a-b-c+d;',
'    float v = k0 + k1*u.x + k2*u.y + k3*u.x*u.y;',
'    vec2 g = vec2(k1 + k3*u.y, k2 + k3*u.x) * du;',
'    return vec3(v, g);',
'}',
'float vnoise(vec2 p) { return noised(p).x; }',
'float fbm(vec2 p) {',
'    float v = 0.0, a = 0.5;',
'    for (int i = 0; i < 4; i++) { v += a * vnoise(p); p = p * 2.03 + vec2(17.1, 9.3); a *= 0.5; }',
'    return v;',
'}',
// 道のり方向（p.y）に周期 per 格子で繰り返す版。道のりは STA_WRAP = 1440 m で折り返すので、
// 呼び出し側は p.y = vSta * (cells / 1440.0)、per = cells（整数）で呼ぶ。こうすると折り返しで模様が飛ばない
'float hashP(vec2 i, float per) { return hash12(vec2(i.x, mod(i.y, per))); }',
'vec3 noisedP(vec2 p, float per) {',
'    vec2 i = floor(p), f = fract(p);',
'    vec2 u = f*f*(3.0-2.0*f);',
'    vec2 du = 6.0*f*(1.0-f);',
'    float a = hashP(i, per), b = hashP(i+vec2(1,0), per), c = hashP(i+vec2(0,1), per), d = hashP(i+vec2(1,1), per);',
'    float k0 = a, k1 = b-a, k2 = c-a, k3 = a-b-c+d;',
'    float v = k0 + k1*u.x + k2*u.y + k3*u.x*u.y;',
'    vec2 g = vec2(k1 + k3*u.y, k2 + k3*u.x) * du;',
'    return vec3(v, g);',
'}',
'float vnoiseP(vec2 p, float per) { return noisedP(p, per).x; }',
'float fbmP(vec2 p, float per) {',              // オクターブ倍率はちょうど 2.0、オフセットは x のみ（周期を保つ）
'    float v = 0.0, a = 0.5;',
'    for (int i = 0; i < 4; i++) { v += a * vnoiseP(p, per); p = p * 2.0 + vec2(17.0, 0.0); per *= 2.0; a *= 0.5; }',
'    return v;',
'}'
].join('\n');

// --- 共通: 高さ依存の大気霧（地表で濃く、上空で薄い。遠いほど彩度が落ちて光害色に溶ける） ---
var FOG = [
'uniform vec3 uCamPos;',
'uniform float uFogDensity;',
'uniform float uFogH;',
'uniform float uOriginY;',
'uniform vec3 uFogBase;',
'uniform vec3 uGlowCol;',
'uniform float uFogGlow;',
'uniform sampler2D uCityTex;',
'float cityDens(vec3 dir) {',
'    float az = atan(dir.x, -dir.z);',
'    return texture2D(uCityTex, vec2(az / 6.2831853 + 0.5, 0.5)).r;',
'}',
'vec3 fogColor(vec3 dir) {',
'    float e = max(dir.y, 0.0);',
'    return uFogBase + uGlowCol * (cityDens(dir) * uFogGlow) * (0.4 + 0.6 * exp(-e * 12.0));',
'}',
// カメラから P までの光学的厚さ（密度 ∝ exp(-高さ/uFogH) を線積分した解析解）
'float fogAmount(vec3 P) {',
'    float L = length(P - uCamPos);',
'    float h0 = max(uCamPos.y + uOriginY, 0.0), h1 = max(P.y + uOriginY, 0.0);',
'    float dh = h1 - h0;',
'    float t = (abs(dh) < 0.5) ? exp(-h0 / uFogH) : uFogH * (exp(-h0 / uFogH) - exp(-h1 / uFogH)) / dh;',
'    return 1.0 - exp(-uFogDensity * L * t);',
'}',
'vec3 applyFogP(vec3 col, vec3 P) {',
'    float f = fogAmount(P);',
'    vec3 dir = normalize(P - uCamPos);',
'    float lum = dot(col, vec3(0.30, 0.59, 0.11));',
'    col = mix(col, vec3(lum), f * 0.5);',                 // 大気遠近法: 遠いほど彩度とコントラストが落ちる
'    return mix(col, fogColor(dir), f);',
'}'
].join('\n');

// --- 共通: 街灯・ヘッドライト ---------------------------------------------
var LIGHTS = [
'#define PI 3.14159265',
'#ifndef HEAD_GAIN',
'#define HEAD_GAIN 1.0',
'#endif',
FOG,
'uniform vec3 uHeadPos0;',
'uniform vec3 uHeadPos1;',
'uniform vec3 uCarFwd;',
'uniform vec3 uCarRight;',
'uniform vec3 uCarUp;',
'uniform float uHeadI;',
'uniform float uHeadW;',            // 配光の横の絞り（車 5、バイク 9: 一灯は左右への広がりが狭い）
'uniform vec3 uHeadCol;',
'uniform vec4 uLamps[NL];',
'uniform vec3 uLampCol;',
'uniform vec3 uAmbient;',
'uniform float uTime;',
'uniform float uEClamp;',
'uniform float uHeadClamp;',
'vec3 applyFog(vec3 col, vec3 dir, float dist) { return applyFogP(col, uCamPos + dir * dist); }',
// ロービーム。p へ向かう光度 (cd) を返す。L は p から光源へ、dist は距離。
'float headI(vec3 p, vec3 hp, out vec3 L, out float dist) {',
'    vec3 d = p - hp; dist = length(d); vec3 dir = d / dist; L = -dir;',
'    float f = dot(dir, uCarFwd);',
'    if (f < 0.12) return 0.0;',
'    float ax = dot(dir, uCarRight) / f;',
'    float ay = dot(dir, uCarUp) / f;',
'    float horiz = exp(-ax * ax * uHeadW);',
'    float cut = 1.0 - smoothstep(-0.022, 0.0, ay);',
'    float beam = 0.15 + 0.85 * smoothstep(-0.14, -0.03, ay);',   // 配光: 手前は弱く、カットオフ直下が最も強い
'    return uHeadI * horiz * cut * beam * smoothstep(0.12, 0.45, f);',   // v7: 真下に近い所の縁をぼかす（縦長で画角が広いと手前の縁が見える）
'}',
'float D_GGX(float NdotH, float a) {',
'    float a2 = a * a; float d = NdotH * NdotH * (a2 - 1.0) + 1.0;',
'    return a2 / (PI * d * d + 1e-6);',
'}',
'float V_Smith(float NdotV, float NdotL, float a) {',
'    float a2 = a * a;',
'    float gv = NdotL * sqrt(NdotV * NdotV * (1.0 - a2) + a2);',
'    float gl = NdotV * sqrt(NdotL * NdotL * (1.0 - a2) + a2);',
'    return 0.5 / max(gv + gl, 1e-4);',
'}',
'vec3 F_Schlick(vec3 F0, float VdotH) { float f = pow(max(1.0 - VdotH, 0.0), 5.0); return F0 + (1.0 - F0) * f; }',
'vec3 brdf(vec3 N, vec3 V, vec3 L, float NdotL, float NdotV, vec3 albedo, float a, vec3 F0) {',
'    vec3 H = normalize(L + V);',
'    float NdotH = max(dot(N, H), 0.0); float VdotH = max(dot(V, H), 0.0);',
'    vec3 F = F_Schlick(F0, VdotH);',
'    vec3 spec = D_GGX(NdotH, a) * V_Smith(NdotV, NdotL, a) * F;',
'    return albedo * (1.0 - F) / PI + spec;',
'}',
// 街灯 + ヘッドライトによる出射輝度
'vec3 shadeLights(vec3 P, vec3 N, vec3 V, vec3 albedo, float rough, vec3 F0) {',
'    vec3 col = vec3(0.0);',
'    float a = max(rough * rough, 0.002);',
'    float NdotV = max(dot(N, V), 1e-3);',
'    for (int i = 0; i < NL; i++) {',
'        vec4 L4 = uLamps[i];',
'        if (L4.w <= 0.0) continue;',
'        vec3 d = L4.xyz - P; float d2 = dot(d, d); float dist = sqrt(d2); vec3 L = d / dist;',
'        float NdotL = dot(N, L);',
'        if (NdotL <= 0.0) continue;',
'        float down = clamp(L.y, 0.0, 1.0);',
'        float E = min(L4.w * (0.2 + 0.8 * down) * NdotL / d2, uEClamp);',
'        col += brdf(N, V, L, NdotL, NdotV, albedo, a, F0) * E * uLampCol;',
'    }',
'    for (int k = 0; k < 2; k++) {',
'        vec3 L; float dist;',
'        float I = headI(P, k == 0 ? uHeadPos0 : uHeadPos1, L, dist);',
'        if (I <= 0.0) continue;',
'        float NdotL = dot(N, L);',
'        if (NdotL <= 0.0) continue;',
'        float E = uHeadClamp * (1.0 - exp(-I * NdotL / (dist * dist) / uHeadClamp)) * HEAD_GAIN;',
'        col += brdf(N, V, L, NdotL, NdotV, albedo, a, F0) * E * uHeadCol;',
'    }',
'    return col;',
'}',
// 環境光: 空の半球 + 地平線（都市グロー）の映り込み
'vec3 shadeAmbient(vec3 N, vec3 V, vec3 albedo, float rough, vec3 F0) {',
'    float NdotV = max(dot(N, V), 1e-3);',
'    vec3 R = reflect(-V, N);',
'    vec3 F = F_Schlick(F0, NdotV);',
'    float gloss = (1.0 - rough) * (1.0 - rough);',
'    vec3 env = fogColor(R) * (0.6 + 1.2 * gloss);',
'    return albedo * uAmbient * (0.6 + 0.4 * N.y) + F * env * (0.3 + 0.7 * gloss);',
'}',
// 周期配置された遠方の街灯（道のり ≡ uLampPhase mod uLampPeriod、横 ±uLampLat、高さ uLampH）の
// 拡散照度を、路面ローカル座標で近い 3 本ぶん解析的に合算する
'uniform float uLampPeriod;',
'uniform float uLampPhase;',
'uniform float uLampLat;',
'uniform float uLampH;',
'uniform float uLampI;',
'uniform float uExpMin;',
'uniform float uExpMax;',
'float farPool(float s, float x) {',
'    float base = floor((s - uLampPhase) / uLampPeriod) * uLampPeriod + uLampPhase;',
'    float sum = 0.0;',
'    for (int k = -1; k <= 1; k++) {',
'        float ds = base + float(k) * uLampPeriod - s;',
'        for (int side = 0; side < 2; side++) {',
'            float dx = (side == 0 ? -uLampLat : uLampLat) - x;',
'            float d2 = ds * ds + dx * dx + uLampH * uLampH;',
'            float d = sqrt(d2);',
'            float down = uLampH / d;',
'            sum += (0.2 + 0.8 * down) * uLampH / (d2 * d);',
'        }',
'    }',
'    float wExp = smoothstep(uExpMin - 10.0, uExpMin + 30.0, s) * (1.0 - smoothstep(uExpMax - 30.0, uExpMax + 10.0, s));',
'    return sum * uLampI * (1.0 - wExp);',
'}'
].join('\n');

// --- 路面 --------------------------------------------------------------------
var ROAD_VERT = [
'attribute float aSta;',
'attribute float aLat;',
'attribute vec3 aTan;',
'attribute vec3 aRight;',
'varying vec3 vWorld;',
'varying vec3 vN;',
'varying vec3 vT;',
'varying vec3 vB;',
'varying float vSta;',
'varying float vLat;',
'void main() {',
'    vec4 wp = modelMatrix * vec4(position, 1.0);',
'    vWorld = wp.xyz;',
'    vN = normalize(normal); vT = aTan; vB = aRight;',
'    vSta = aSta; vLat = aLat;',
'    gl_Position = projectionMatrix * viewMatrix * wp;',
'}'
].join('\n');

var ROAD_FRAG = [
'varying vec3 vWorld;',
'varying vec3 vN;',
'varying vec3 vT;',
'varying vec3 vB;',
'varying float vSta;',
'varying float vLat;',
'uniform float uMedianHalf;',
'uniform float uInnerLine;',
'uniform float uLaneDiv;',
'uniform float uOuterLine;',
'uniform float uRetro;',
'uniform vec2 uRampL[4];',          // v8: IC の区間（左: 自車側、右: 反対車線側）。本線の外側のガードレール・地覆を外し、外側線を太い破線に
'uniform vec2 uRampR[4];',
'float rampZone(float sta, float lat) {',
'    float z = 0.0;',
'    for (int i = 0; i < 4; i++) {',
'        vec2 a = uRampL[i], b = uRampR[i];',
'        if (lat < 0.0 && sta > a.x && sta < a.y) z = 1.0;',
'        if (lat > 0.0 && sta > b.x && sta < b.y) z = 1.0;',
'    }',
'    return z;',
'}',
'uniform float uWet;',
'uniform float uRoadHalf;',
NOISE,
LIGHTS,
'vec2 sq(float kx, float cells) { return vec2(vLat * kx, vSta * (cells / 1440.0)); }',
// 路面用: 街灯の拡散（× uRoadGlow）、街灯の鏡面（× uSpecGain、x/(1+kx) で芯だけ圧縮して裾を残す）、ヘッドライト（倍率なし）
'uniform float uRoadGlow;',
'uniform float uSpecGain;',
'uniform float uSpecK;',
'vec3 shadeRoadLights(vec3 P, vec3 N, vec3 V, vec3 albedo, float rough, vec3 F0) {',
'    vec3 dif = vec3(0.0), spc = vec3(0.0), head = vec3(0.0);',
'    float a = max(rough * rough, 0.002);',
'    float NdotV = max(dot(N, V), 1e-3);',
'    for (int i = 0; i < NL; i++) {',
'        vec4 L4 = uLamps[i];',
'        if (L4.w <= 0.0) continue;',
'        vec3 d = L4.xyz - P; float d2 = dot(d, d); vec3 L = d / sqrt(d2);',
'        float NdotL = dot(N, L);',
'        if (NdotL <= 0.0) continue;',
'        float down = clamp(L.y, 0.0, 1.0);',
'        float E = min(L4.w * (0.2 + 0.8 * down) * NdotL / d2, uEClamp);',
'        vec3 H = normalize(L + V);',
'        float NdotH = max(dot(N, H), 0.0); float VdotH = max(dot(V, H), 0.0);',
'        vec3 F = F_Schlick(F0, VdotH);',
'        dif += albedo * (1.0 - F) / PI * E;',
'        spc += D_GGX(NdotH, a) * V_Smith(NdotV, NdotL, a) * F * E;',
'    }',
'    for (int k = 0; k < 2; k++) {',
'        vec3 L; float dist;',
'        float I = headI(P, k == 0 ? uHeadPos0 : uHeadPos1, L, dist);',
'        if (I <= 0.0) continue;',
'        float NdotL = dot(N, L);',
'        if (NdotL <= 0.0) continue;',
'        float E = uHeadClamp * (1.0 - exp(-I * NdotL / (dist * dist) / uHeadClamp));',
'        head += brdf(N, V, L, NdotL, NdotV, albedo, a, F0) * E * uHeadCol;',
'    }',
'    spc *= uSpecGain;',
'    float sl = dot(spc, vec3(0.30, 0.59, 0.11));',
'    spc *= 1.0 / (1.0 + uSpecK * sl);',
'    return (dif * uRoadGlow + spc) * uLampCol + head;',
'}',
'float lineBand(float x, float c, float hw, float aa) {',
'    return smoothstep(c - hw - aa, c - hw, x) * (1.0 - smoothstep(c + hw, c + hw + aa, x));',
'}',
'void main() {',
'    vec3 P = vWorld;',
'    vec3 toCam = uCamPos - P; float dist = length(toCam); vec3 V = toCam / dist;',
'    float e = abs(vLat);',
// 道のりに依存するノイズはすべて周期版（STA_WRAP = 1440 m で折り返しても模様が飛ばない）。
// sq(kx, cells): 横 vLat*kx、道のり方向は 1440 m あたり cells 格子
'    float sd = sign(vLat);',
// アルベドと濡れ
'    float coarse = vnoiseP(sq(0.45, 648.0), 648.0);',
'    float grain  = vnoiseP(sq(7.0, 10080.0), 10080.0);',
'    float wetMap = fbmP(sq(0.09, 50.0) + vec2(3.7, 0.0), 50.0);',
// 全面がしっとり濡れていて、濃淡がなだらかに変わる（二値化すると遠くで黒い塊になる）
'    float wet = clamp(0.45 + 1.1 * (wetMap - 0.5), 0.15, 0.9) * uWet;',
// 轍: 片側 2 車線の各車線中央 ±0.8 m
'    float c1 = (uInnerLine + uLaneDiv) * 0.5, c2 = (uLaneDiv + uOuterLine) * 0.5;',
'    float laneX = min(abs(e - c1), abs(e - c2));',
'    float inLane = step(uInnerLine, e) * step(e, uOuterLine);',
'    float dw = (laneX - 0.80) / 0.28;',
'    float wheel = exp(-dw * dw) * inLane;',
'    wet = clamp(wet + wheel * 0.3 * uWet, 0.0, 1.0);',                           // 轍に水が溜まる
'    vec3 albedo = vec3(0.048, 0.047, 0.046) * (0.75 + 0.5 * coarse) * (0.85 + 0.3 * grain);',
'    albedo = mix(albedo, albedo * 1.25, wheel * 0.5);',
// タイヤが通らない帯（車線中央）の黒ずみ・オイル跡
'    float cx = laneX / 0.35;',
'    float centre = exp(-cx * cx) * inLane;',
'    float soot = fbmP(sq(0.6, 173.0) + vec2(5.0, 0.0), 173.0);',
'    albedo *= 1.0 - 0.18 * centre * smoothstep(0.35, 0.7, soot);',
// ひび割れ（細く・まばら）
'    float cr = abs(vnoiseP(sq(2.6, 1872.0) + vec2(17.0, 0.0), 1872.0) - 0.5) + abs(vnoiseP(sq(5.0, 4320.0) + vec2(29.0, 0.0), 4320.0) - 0.5) * 0.3;',
'    float crack = (1.0 - smoothstep(0.0, 0.012, cr)) * smoothstep(0.55, 0.72, fbmP(sq(0.07, 101.0) + vec2(9.0, 0.0), 101.0));',
'    albedo *= 1.0 - 0.4 * crack;',
'    float rough = mix(0.62, 0.16, wet);',
'    rough = mix(rough, rough * 0.7, wheel * 0.6);',
// 縁の汚れ（高架なので土や草ではなく、地覆沿いに溜まった砂・細かい砕石・黒ずみ）。外側と分離帯側
'    float edgeN = (fbmP(vec2(3.0 + sd * 5.0, vSta * (173.0 / 1440.0)), 173.0) - 0.5) * 0.6 + (vnoiseP(vec2(1.0 + sd * 7.0, vSta * (2160.0 / 1440.0)), 2160.0) - 0.5) * 0.2;',
'    float asphaltEdge = uRoadHalf - 0.35 + edgeN;',
'    float rzE = rampZone(vSta, vLat);',                                              // 出入口の区間はランプの路面が続くので、外側の縁の砂・欠けを描かない
'    float sandO = smoothstep(asphaltEdge - 0.05, asphaltEdge + 0.05, e) * (1.0 - rzE);',
'    float dustO = smoothstep(asphaltEdge - 1.2, asphaltEdge, e) * (1.0 - rzE);',
'    float medEdge = uMedianHalf + 0.25 + edgeN * 0.5;',
'    float sandM = 1.0 - smoothstep(medEdge - 0.04, medEdge + 0.04, e);',
'    float dustM = 1.0 - smoothstep(medEdge, medEdge + 0.6, e);',
'    float sand = max(sandO, sandM);',
'    float dust = max(dustO, dustM) * (0.5 + 0.5 * fbmP(sq(1.2, 432.0) + vec2(23.0, 0.0), 432.0));',
'    float grit = fbmP(sq(2.5, 3600.0) + vec2(31.0, 0.0), 3600.0);',
'    float pebble = step(0.78, vnoiseP(sq(14.0, 20160.0) + vec2(41.0, 0.0), 20160.0));',
'    vec3 sandCol = vec3(0.060, 0.056, 0.050) * (0.6 + 0.8 * grit) * (1.0 + 0.5 * pebble);',
'    float curbDist = min(rzE > 0.5 ? 1.0 : uRoadHalf - e, e - uMedianHalf);',                       // 縁石・地覆からの距離
'    sandCol *= 1.0 - 0.6 * (1.0 - smoothstep(0.0, 0.18, curbDist));',                // 根元の黒ずみ
'    albedo = mix(albedo, vec3(0.062, 0.058, 0.052), dust * 0.3 * (1.0 - wet) * (1.0 - sand));',
'    albedo = mix(albedo, sandCol, sand);',
'    rough = mix(rough, 0.95, sand);',
'    wet *= 1.0 - 0.8 * sand;',
// 区画線: 外側線・内側線（実線）と車線境界線（破線 8m/12m）。線ごと・20 m ごと・左右ごとに劣化度が違う
'    float aa = max(fwidth(vLat), 1e-4);',
'    float eN = e + (vnoiseP(sq(9.0, 3600.0) + vec2(3.0, 0.0), 3600.0) - 0.5) * 0.012;',
'    float rzR = rampZone(vSta, vLat);',
'    float outerL = rzR > 0.5 ? lineBand(eN, uOuterLine, 0.15, aa) * step(mod(vSta, 12.0), 6.0) : lineBand(eN, uOuterLine, 0.10, aa);',   // v8: 出入口の区間は太い破線（線 6 m・間 6 m）
'    float edge = max(outerL, lineBand(eN, uInnerLine, 0.075, aa));',
'    float dashS = mod(vSta, 20.0);',
'    float aaS = max(fwidth(vSta), 1e-3);',
'    float dash = smoothstep(-aaS, 0.0, dashS) * (1.0 - smoothstep(8.0, 8.0 + aaS, dashS));',
'    float lane = lineBand(eN, uLaneDiv, 0.075, aa) * dash;',
// 伸縮継手（高架の目印。橋脚と同じ位置）: 暗い鋼の帯。両脇は黒ずみ
'    float jd = abs(mod(vSta - 21.0 + 18.0, 36.0) - 18.0);',
'    float joint = 1.0 - smoothstep(0.175 - aaS, 0.175 + aaS, jd);',                  // v7.1: 鋼製の伸縮装置 幅 0.35 m
'    float jointSoot = (1.0 - smoothstep(0.175, 0.45, jd)) * (1.0 - joint);',
'    float mark = max(edge, lane) * (1.0 - joint);',
'    float lineId = e < c1 ? 0.0 : (e < c2 ? 1.0 : 2.0);',                           // 0 内側線 / 1 車線境界線 / 2 外側線
'    float piece = hash12(vec2(mod(floor(vSta / 20.0), 72.0), lineId * 3.0 + sd));',
'    float wearT = (lineId == 1.0 ? 0.32 : 0.16) + 0.35 * piece;',                    // 車線変更で踏まれる境界線ほど摩耗
'    float wearN = fbmP(sq(1.8, 504.0) + vec2(piece * 10.0, 0.0), 504.0);',
'    float tx = (e - uOuterLine + 0.3) / 0.25;',
'    float tyre = exp(-tx * tx);',
'    float cover = max(smoothstep(wearT - 0.12, wearT + 0.12, wearN - 0.15 * tyre), 0.1);',
'    float paint = mark * cover;',
'    float paintN = 0.8 + 0.4 * vnoiseP(sq(3.0, 4320.0), 4320.0);',
'    albedo = mix(albedo, vec3(0.42, 0.42, 0.40) * paintN, paint);',
'    rough = mix(rough, mix(0.5, 0.25, wet), paint);',
'    albedo *= 1.0 - 0.45 * jointSoot;',
'    float jds = mod(vSta - 21.0 + 18.0, 36.0) - 18.0;',
'    float tooth = (abs(fract(vLat * 6.0) - 0.5) * 4.0 - 1.0) * 0.05;',                // 歯形（櫛の歯が噛み合う継ぎ目、ピッチ 17 cm）
'    float jointGap = (1.0 - smoothstep(0.0, 0.018 + aaS * 0.5, abs(jds - tooth))) * (1.0 - smoothstep(0.02, 0.06, aaS));',
'    float plates = 0.85 + 0.3 * step(0.0, jds - tooth);',                             // 左右の鋼板の明るさの差
'    albedo = mix(albedo, vec3(0.03) * plates * (1.0 - 0.8 * jointGap), joint);',
'    rough = mix(rough, 0.35, joint);',
'    wet *= 1.0 - joint;',
// 法線: 骨材の凹凸（濡れると水で埋まって平らになる）
'    vec3 N = normalize(vN);',
'#ifndef NO_NORMAL_NOISE',
'    vec3 n1 = noisedP(sq(9.0, 12960.0), 12960.0);',
'    vec3 n2 = noisedP(sq(31.0, 44640.0) + vec2(7.0, 0.0), 44640.0);',
'    vec2 g = (n1.yz * 9.0 * 0.006 + n2.yz * 31.0 * 0.0015) * (1.0 - 0.85 * wet) * (1.0 - 0.7 * paint) * (1.0 + 0.6 * sand);',
'    float lod = clamp(dist / 70.0, 0.0, 1.0);',
'    g *= (1.0 - lod);',
'    N = normalize(N - vB * g.x - vT * g.y);',
'#endif',
'    vec3 F0 = vec3(0.04);',
'    vec3 col = shadeRoadLights(P, N, V, albedo, rough, F0);',
'    col += albedo * farPool(vSta, vLat) * uLampCol / PI * uRoadGlow;',
'    col += shadeAmbient(N, V, albedo, rough, F0);',
// 白線の再帰反射（ガラスビーズ）
'    if (paint > 0.001) {',
'        float retro = 0.0;',
'        for (int k = 0; k < 2; k++) { vec3 L; float d; float I = headI(P, k == 0 ? uHeadPos0 : uHeadPos1, L, d); retro += I / (d * d); }',
'        col += uHeadCol * retro * uRetro * paint * paintN * smoothstep(0.1, 0.7, cover);',
'    }',
'    col = applyFogP(col, P);',
'#ifdef DBG',
'    if (DBG == 1) col = vec3(0.3, 0.0, 0.0) + vec3(mark);',
'    if (DBG == 2) col = albedo * 5.0;',
'    if (DBG == 3) col = shadeLights(P, normalize(vN), V, albedo, rough, F0);',
'    if (DBG == 4) col = vec3(farPool(vSta, vLat)) * 0.1 + vec3(fract(vSta / 20.0), fract(vLat), 0.0) * 0.3;',
'    if (DBG == 5) col = shadeAmbient(N, V, albedo, rough, F0);',
'    if (DBG == 6) col = albedo * farPool(vSta, vLat) * uLampCol / PI;',
'    if (DBG == 10) { vec3 c10 = vec3(0.0); float eSum = 0.0; for (int i = 0; i < NL; i++) { vec4 L4 = uLamps[i]; if (L4.w <= 0.0) continue; vec3 d = L4.xyz - P; float d2 = dot(d, d); vec3 L = d / sqrt(d2); float NdotL = max(dot(N, L), 0.0); eSum += min(L4.w * NdotL / d2, uEClamp); } col = vec3(eSum * 0.1, 0.0, 0.0); }',
'    if (DBG == 11) { vec3 c11 = vec3(0.0); for (int i = 0; i < NL; i++) { vec4 L4 = uLamps[i]; if (L4.w <= 0.0) continue; vec3 d = L4.xyz - P; float d2 = dot(d, d); vec3 L = d / sqrt(d2); float NdotL = max(dot(N, L), 0.0); if (NdotL <= 0.0) continue; float NdotV = max(dot(N, V), 1e-3); c11 += brdf(N, V, L, NdotL, NdotV, albedo, max(rough * rough, 0.002), F0) * min(L4.w * NdotL / d2, uEClamp); } col = c11; }',
'    if (DBG == 13) { col = vec3(length(uLamps[4].xyz - P) * 0.01, length(uCamPos - P) * 0.01, uEClamp * 0.1); }',
'    if (DBG == 14) { vec3 d = uLamps[4].xyz - P; float d2 = dot(d, d); vec3 L = d / sqrt(d2); col = vec3(max(dot(N, L), 0.0), min(uLamps[4].w * max(dot(N, L), 0.0) / d2, uEClamp) * 0.1, 0.0); }',
'    if (DBG == 15) { col = vec3(fract(vWorld.z * 0.02), fract(vWorld.x * 0.1), fract(-vWorld.z * 0.002)); }',
'    if (DBG == 16) { col = vec3(fract(uCamPos.z * 0.02 + 0.5), fract(uCamPos.x * 0.1 + 0.5), uCamPos.y * 0.5); }',
'    if (DBG == 18) { col = vec3(vWorld.x, vWorld.y, -vWorld.z) * 0.05 + 0.1; }',
'    if (DBG == 19) { col = vec3(fract(vSta * 0.02), fract(vLat * 0.1), fract(vT.z)); }',
'    if (DBG == 20) { col = vec3(fract(vWorld.z * 0.02), fract(vWorld.x * 0.1), 0.0); }',
'    if (DBG >= 21 && DBG <= 24) { float sD = 0.0, sV = 0.0, sF = 0.0; float a_ = max(rough * rough, 0.002); float NdotV = max(dot(N, V), 1e-3);',
'        for (int i = 0; i < NL; i++) { vec4 L4 = uLamps[i]; if (L4.w <= 0.0) continue; vec3 d = L4.xyz - P; float d2 = dot(d, d); vec3 L = d / sqrt(d2); float NdotL = dot(N, L); if (NdotL <= 0.0) continue;',
'            float E = min(L4.w * NdotL / d2, uEClamp); vec3 H = normalize(L + V); float NdotH = max(dot(N, H), 0.0); float VdotH = max(dot(V, H), 0.0);',
'            sD += D_GGX(NdotH, a_) * E; sV += V_Smith(NdotV, NdotL, a_) * E; sF += F_Schlick(F0, VdotH).x * E; }',
'        if (DBG == 21) col = vec3(sD * 0.1); if (DBG == 22) col = vec3(sV * 0.01); if (DBG == 23) col = vec3(sF); if (DBG == 24) col = vec3(rough, a_, wet); }',
'    if (DBG == 12) { col = vec3(uLamps[0].w * 0.001, length(uLamps[0].xyz) * 0.01, float(NL) * 0.02); }',
'    if (DBG == 7) { vec3 c7 = vec3(0.0); for (int k = 0; k < 2; k++) { vec3 L; float d; float I = headI(P, k == 0 ? uHeadPos0 : uHeadPos1, L, d); float NdotL = max(dot(N, L), 0.0); c7 += albedo / PI * min(I * NdotL / (d * d), uEClamp) * uHeadCol; } col = c7; }',
'#endif',
'    gl_FragColor = vec4(col, 1.0);',
'}'
].join('\n');

// v9: 高架の側面の区間（左 = 自車側の外側、右 = 反対車線の外側）。a = (始まり, 終わり, 種類 0 壁高欄 / 1 遮音壁 / 2 鋼製高欄 / 3 ガードレール, 遮音壁の高さ)、
// b = (前の区間の種類, 次の区間の種類, 変種 0〜1, 区間ごとの乱数)。道のりは折り返し後
var SECS = [
'uniform vec4 uSecAL[16];', 'uniform vec4 uSecBL[16];', 'uniform vec4 uSecAR[16];', 'uniform vec4 uSecBR[16];',
'bool secOf(float sta, float lat, out vec4 a, out vec4 b) {',
'    a = vec4(-1e6, -1e6, 3.0, 0.0); b = vec4(3.0, 3.0, 0.0, 0.0);',
'    for (int i = 0; i < 16; i++) {',
'        vec4 qa = lat < 0.0 ? uSecAL[i] : uSecAR[i];',
'        if (sta >= qa.x && sta < qa.y) { a = qa; b = lat < 0.0 ? uSecBL[i] : uSecBR[i]; return true; }',
'    }',
'    return false;',
'}',
].join('\n');

// --- 汎用ライト付きマテリアル（支柱・ガードレール・地面） ------------------------
var LIT_VERT = [
'varying vec3 vWorld;',
'varying vec3 vN;',
'#ifdef HAS_STATION',
'attribute float aSta;',
'attribute float aLat;',
'varying float vSta;',
'varying float vLat;',
'#endif',
'#ifdef RAMP',
'attribute vec3 aRamp;',
'varying vec3 vRamp;',
'#endif',
'#if defined(POST) || defined(PIER) || defined(RPOLE) || defined(DRUM)',
'varying float vLocalY;',
'#endif',
'#if defined(DECK) || defined(RAIL) || defined(WALL)',
'attribute float aHt;',
'varying float vHt;',
'#endif',
'#ifdef TREE',
'varying vec3 vObjN;',
'varying float vTreeSeed;',
'#endif',
'#ifdef RPOLE',
'attribute float aFade;',
'varying float vFade;',
'#endif',
'#ifdef RVIADUCT',
'attribute float aHt;',
'attribute float aBand;',
'attribute float aElev;',
'attribute float aEndF;',
'varying float vRHt;',
'varying float vRBand;',
'varying float vRElev;',
'varying float vREnd;',
'#endif',
'void main() {',
'    vec3 p = position; vec3 n = normal;',
'#if defined(POST) || defined(PIER) || defined(RPOLE) || defined(DRUM)',
'    vLocalY = position.y;',
'#endif',
'#if defined(DECK) || defined(RAIL) || defined(WALL)',
'    vHt = aHt;',
'#endif',
'#ifdef RPOLE',
'    vFade = aFade;',
'#endif',
'#ifdef RVIADUCT',
'    vRHt = aHt; vRBand = aBand; vRElev = aElev; vREnd = aEndF;',
'#endif',
'#ifdef TREE',
'    vObjN = normal + position * 1.7;',                                   // 葉むらのノイズの入力（インスタンス内で固定）
'#ifdef USE_INSTANCING',
'    vTreeSeed = fract(length(instanceMatrix[0].xyz) * 7.13 + length(instanceMatrix[2].xyz) * 3.71);',
'#else',
'    vTreeSeed = 0.0;',
'#endif',
'#endif',
'#ifdef USE_INSTANCING',
'    p = (instanceMatrix * vec4(p, 1.0)).xyz;',
'    n = mat3(instanceMatrix) * n;',
'#endif',
'    vec4 wp = modelMatrix * vec4(p, 1.0);',
'    vWorld = wp.xyz;',
'    vN = normalize(mat3(modelMatrix) * n);',
'#ifdef HAS_STATION',
'    vSta = aSta; vLat = aLat;',
'#endif',
'#ifdef RAMP',
'    vRamp = aRamp;',
'#endif',
'    gl_Position = projectionMatrix * viewMatrix * wp;',
'}'
].join('\n');

var LIT_FRAG = [
'varying vec3 vWorld;',
'varying vec3 vN;',
'#ifdef HAS_STATION',
'varying float vSta;',
'varying float vLat;',
'#endif',
'#if defined(POST) || defined(PIER) || defined(RPOLE) || defined(DRUM)',
'varying float vLocalY;',
'#endif',
'#if defined(DECK) || defined(RAIL) || defined(WALL)',
'varying float vHt;',
'#endif',
'#ifdef TREE',
'varying vec3 vObjN;',
'varying float vTreeSeed;',
'#endif',
'#ifdef RPOLE',
'varying float vFade;',
'uniform float uRetroPole;',
'#endif',
'#ifdef RVIADUCT',
'varying float vRHt;',
'varying float vRBand;',
'varying float vRElev;',
'varying float vREnd;',
'#endif',
'#ifdef NGAP',
'uniform vec2 uGap[NGAP];',       // 中央分離帯の補修区間（折り返し後の道のり）
'#endif',
'#if defined(DECK) || defined(RAIL) || defined(WALL)',
'uniform vec2 uRampL[4];',          // v8: IC の区間（左: 自車側、右: 反対車線側）。本線の外側のガードレール・地覆を外し、外側線を太い破線に
'uniform vec2 uRampR[4];',
'float rampZone(float sta, float lat) {',
'    float z = 0.0;',
'    for (int i = 0; i < 4; i++) {',
'        vec2 a = uRampL[i], b = uRampR[i];',
'        if (lat < 0.0 && sta > a.x && sta < a.y) z = 1.0;',
'        if (lat > 0.0 && sta > b.x && sta < b.y) z = 1.0;',
'    }',
'    return z;',
'}',
'#endif',
'#ifdef RAMP',
'varying vec3 vRamp;',
'uniform sampler2D uRoadTxt;',
'#endif',
'#if defined(WALL) || defined(RAIL) || defined(DECK)',
SECS,
'#endif',
'#ifdef NOPEN',
'uniform vec2 uOpen[NOPEN];',     // v7.1: 中央分離帯の開口部（同じく折り返し後の道のり）
'#endif',
'uniform vec3 uAlbedo;',
'uniform vec3 uUnder;',
'uniform float uRough;',
'uniform vec3 uF0;',
'uniform float uNoiseAmt;',
'uniform vec3 uEmissive;',
NOISE,
LIGHTS,
'#ifdef FADE',
'uniform float uFadeFar;',        // 世界固定の物の表示限界（カメラからの水平距離）。0.8 倍から先でフェード
'float fadeOf(vec3 p) { return 1.0 - smoothstep(0.8 * uFadeFar, uFadeFar, length((p - uCamPos).xz)); }',
'#endif',
'void main() {',
'    vec3 P = vWorld;',
'    vec3 toCam = uCamPos - P; float dist = length(toCam); vec3 V = toCam / dist;',
'    vec3 N = normalize(vN);',
'    if (dot(N, V) < 0.0) N = -N;',
'    vec3 albedo = uAlbedo;',
'    float rough = uRough;',
'#ifdef HAS_STATION',
// 汚れのむら。道のりに固定した周期ノイズ（原点相対の座標を使うと模様が泳ぐ）
'    if (uNoiseAmt > 0.0) albedo *= 1.0 + uNoiseAmt * (fbmP(vec2(vLat * 0.8, vSta * (1152.0 / 1440.0)), 1152.0) - 0.5) * 2.0;',
'#endif',
'#ifdef POST',
// 支柱: 下ほど泥はね・錆で暗く、レールの裏に入る帯（0.6〜0.9 m）は陰で暗い。光沢は鈍い
'    float mud = smoothstep(0.0, 0.6, vLocalY);',
'    float rustN = fbm(vec2(vLocalY * 6.0, 3.7));',
'    albedo *= mix(0.3, 1.0, mud) * mix(vec3(1.0), vec3(1.35, 0.85, 0.6), (1.0 - mud) * rustN);',
'    albedo *= 1.0 - 0.55 * smoothstep(0.56, 0.62, vLocalY) * (1.0 - smoothstep(0.88, 0.94, vLocalY));',
'    rough = clamp(rough + (1.0 - mud) * 0.15, 0.0, 0.98);',
'#endif',
'#ifdef RAIL',
// v7.1: ガードレールは長さ 4 m のビームを、端を 0.3 m 重ねてボルトで留めて連ねる（継ぎ目は支柱 ≡ 1 mod 4 の位置）。
// 重ねの部分は板が一段手前に出る: 継ぎ目の縁の細い影とハイライト、ボルト頭 6 個（上下 2 段 × 3 列）。
// 線の太さは画素の大きさ（fwidth）より細くならないよう、1 画素が 6 cm を超えたら薄めて消す（遠くでちらつかない）
'    float aaS = max(fwidth(vSta), 1e-4);',
'    float sl = vSta - 1.0, segI = floor(sl / 4.0), segU = sl - segI * 4.0;',
'    float far0 = 1.0 - smoothstep(0.02, 0.06, aaS);',                               // 継ぎ目の線を見せる距離
'    float lw = 0.008 + aaS;',
'    float edgeA = 1.0 - smoothstep(lw - aaS, lw, abs(segU - 0.30));',              // 下になった板の端（重ねの奥の縁）: 影
'    float edgeB = 1.0 - smoothstep(lw - aaS, lw, min(segU, 4.0 - segU));',        // 上に重なる板の端: 明るい縁と細い影
'    float sideK = vLat < -0.5 ? 0.0 : (vLat > 0.5 ? 2.0 : (vLat < 0.0 ? 1.0 : 3.0));',
'    float hb = hash12(vec2(mod(segI, 360.0), sideK * 7.0 + 1.0));',
'    albedo *= 0.94 + 0.12 * hb;',                                                  // ビームごとの色あせ（±6%）
'    rough = clamp(rough + (hash12(vec2(mod(segI, 360.0), sideK + 11.0)) - 0.5) * 0.12, 0.08, 0.95);',
'    float hNew = hash12(vec2(mod(segI, 360.0), sideK + 23.0));',
'    if (hNew < 0.03) { albedo *= 1.15; rough = max(rough - 0.1, 0.06); }',          // ごくまれに新しい 1 枚
'    if (hNew > 0.985) {',                                                           // ごくまれに凹みのある 1 枚（反射の帯が波打つ）
'        float dent = sin(segU * 2.2 + hb * 6.0) * sin(clamp(segU, 0.3, 3.7) * 0.8);',
'        N = normalize(N + vec3(0.0, 0.18 * dent, 0.0));',
'    }',
'    albedo *= 1.0 - 0.55 * edgeA * far0;',
'    albedo *= 1.0 - 0.35 * edgeB * far0 * step(0.5, fract(vHt * 7.0));',
'    float lap = step(0.0, segU) * (1.0 - step(0.30, segU));',                     // 重なった部分は少し明るい（板が手前）
'    albedo *= 1.0 + 0.10 * lap * far0;',
// ボルト頭（φ 2.4 cm、上下 2 段 × 3 列）。1 画素が 2 cm を超えたら消す
'    float bolt = 0.0;',
'    for (int bi = 0; bi < 3; bi++) {',
'        float bu = 0.06 + float(bi) * 0.09;',
'        for (int bj = 0; bj < 2; bj++) {',
'            float bh = bj == 0 ? 0.70 : 0.80;',
'            float rr = length(vec2(segU - bu, (vHt - bh) * 1.0));',
'            bolt = max(bolt, 1.0 - smoothstep(0.012, 0.012 + aaS, rr));',
'        }',
'    }',
'    bolt *= 1.0 - smoothstep(0.008, 0.02, aaS);',
'    albedo = mix(albedo, albedo * 1.6, bolt); rough = mix(rough, 0.2, bolt);',
'    float spangle = vnoiseP(vec2(vLat * 40.0, vSta * (3600.0 / 1440.0)), 3600.0);',
'    rough = clamp(rough + (spangle - 0.5) * 0.18, 0.08, 0.95);',
// 橋の伸縮継手（橋脚と同じ道のり ≡ 21 mod 36）: ビームが 4 cm 途切れ、裏の暗さが見える
'    if (abs(vLat) > 0.5 && rampZone(vSta, vLat) > 0.5) discard;',
'    if (abs(vLat) > 0.5) {',                                                       // v9: 外側のガードレールはガードレールの区間（D）だけ
'        vec4 sa, sb; vec4 sa2, sb2; vec4 sa3, sb3;',
'        bool hit = secOf(vSta, vLat, sa, sb);',
'        bool dHere = !hit || sa.z > 2.5;',
'        bool dNear = (secOf(vSta + 0.5, vLat, sa2, sb2) && sa2.z > 2.5) || (secOf(vSta - 0.5, vLat, sa3, sb3) && sa3.z > 2.5);',   // 壁の端に少し重ねて終わる
'        if (!dHere && !dNear) discard;',
'    }',                 // v8: 出入口の区間は本線の外側のガードレールを外す
'    float jdR = abs(mod(vSta - 21.0 + 18.0, 36.0) - 18.0);',
'    if (jdR < 0.02 && aaS < 0.03) discard;',
// 補修区間・開口部: 分離帯の 2 本（|x| < 0.5）は区間内を消す（端は袖ビームの部材が丸く巻き込む）。端 0.4 m は奥へ絞れて暗く見せる
'    float endFade = 1.0;',
'    if (abs(vLat) < 0.5) {',
'        for (int gi = 0; gi < NGAP; gi++) {',
'            vec2 g = uGap[gi];',
'            if (vSta > g.x && vSta < g.y) discard;',
'            float de = min(abs(vSta - g.x), abs(vSta - g.y));',
'            endFade = min(endFade, smoothstep(0.0, 0.4, de));',
'        }',
'        for (int oi = 0; oi < NOPEN; oi++) {',
'            vec2 g = uOpen[oi];',
'            if (vSta > g.x && vSta < g.y) discard;',
'            float de = min(abs(vSta - g.x), abs(vSta - g.y));',
'            endFade = min(endFade, smoothstep(0.0, 0.4, de));',
'        }',
'    }',
'    albedo *= mix(0.6, 1.0, endFade);',
'#endif',
'#ifdef WALL',
// v9: 壁高欄（A・B の区間）。路面から天端まで 1.10 m。天端の手すり（vHt > 1.15）は A だけ。区間の端は斜めに下げる（隣が C・D のとき 2 m かけて）
'    vec4 wa, wb;',
'    if (!secOf(vSta, vLat, wa, wb) || wa.z > 1.5 || rampZone(vSta, vLat) > 0.5) discard;',
'    float isRail = step(1.15, vHt);',
'    if (isRail > 0.5 && wa.z > 0.5) discard;',                                        // 手すりは A だけ（B は遮音壁が載る）
'    float dS = vSta - wa.x, dE = wa.y - vSta;',
'    float topH = 1.10;',
'    if (wb.x > 1.5) topH = min(topH, mix(0.30, 1.10, clamp(dS / 2.0, 0.0, 1.0)));',   // 前が C・D: 端を斜めに
'    if (wb.y > 1.5) topH = min(topH, mix(0.30, 1.10, clamp(dE / 2.0, 0.0, 1.0)));',
'    if (vHt > topH + 0.02 + isRail * 0.3) discard;',
'    if (isRail > 0.5 && topH < 1.09) discard;',
'    float aaW = max(fwidth(vSta), 1e-3);',
'    float secV = wb.w;',                                                              // 区間ごとの色の違い（新しい区間は明るい）
'    albedo = vec3(0.17, 0.17, 0.165) * (0.88 + 0.28 * secV) * (0.9 + 0.2 * vnoiseP(vec2(vHt * 2.0, vSta * (720.0 / 1440.0)), 720.0));',
'    float jW = abs(mod(vSta + 5.0, 10.0) - 5.0);',                                    // 10 m ごとの縦目地
'    albedo *= 1.0 - 0.55 * (1.0 - smoothstep(0.008, 0.008 + aaW, jW)) * (1.0 - smoothstep(0.03, 0.1, aaW));',
'    albedo *= 1.0 - 0.06 * (1.0 - smoothstep(0.0, 0.015, abs(fract(vHt / 0.6) - 0.5) - 0.48)) * (1.0 - smoothstep(0.02, 0.06, aaW));',   // 型枠の横筋（ごく淡く）
'    float tyre = 1.0 - smoothstep(0.05, 0.32, vHt);',
'    albedo *= 0.45 + 0.75 * smoothstep(0.25, 0.75, vnoiseP(vec2(vHt * 0.9 + 3.0, vSta * (1080.0 / 1440.0)), 1080.0) * 0.7 + vnoiseP(vec2(vHt * 5.0, vSta * (4320.0 / 1440.0)), 4320.0) * 0.3);',   // 面全体の雨に洗われたむら（1〜2 m 単位、縦にやや長い）
'    albedo *= 1.0 - 0.3 * (1.0 - smoothstep(0.2, 0.7, vHt));',   // 下半分は水はねで暗い                                 // 下の黒いタイヤ痕と泥はね
'    float tyreN = vnoiseP(vec2(vHt * 30.0, vSta * (720.0 / 1440.0)), 720.0) * 0.6 + vnoiseP(vec2(vHt * 6.0, vSta * (2880.0 / 1440.0)), 2880.0) * 0.4;',   // 横に長いむら
'    albedo = mix(albedo, vec3(0.20, 0.18, 0.15), 0.6 * (1.0 - smoothstep(0.2, 0.5, vHt)));',   // 足元は砂ぼこりで茶色っぽく明るい（その上にタイヤ痕が黒く乗る）
'    float tyreM = smoothstep(0.5, 0.62, vnoiseP(vec2(vHt * 11.0, vSta * (360.0 / 1440.0)), 360.0)) * (1.0 - smoothstep(0.04, 0.3, vHt));',   // 横に長い（2〜5 m）黒いタイヤ痕
'    albedo *= (1.0 - 0.88 * tyreM) * (1.0 - 0.35 * (1.0 - smoothstep(0.0, 0.3, vHt)) * tyreN);',
'    float drip = smoothstep(0.35, 0.75, vnoiseP(vec2(3.0, vSta * (2160.0 / 1440.0)), 2160.0)) * smoothstep(0.1, 1.1, vHt) * (0.6 + 0.4 * vnoiseP(vec2(vHt * 3.0, vSta * (5760.0 / 1440.0)), 5760.0));',   // 天端からの雨だれ
'    albedo *= 1.0 - 0.45 * drip;',
'    float dCol = floor(vSta / 0.35), dH = hash12(vec2(mod(dCol, 4114.0), 7.0));',      // 雨だれの縦筋（1〜3 m ごとに不規則、天端から 10〜60 cm）
'    float dLen = 0.1 + 0.5 * hash12(vec2(mod(dCol, 4114.0), 13.0));',
'    float dStreak = step(0.82, dH) * step(1.10 - vHt, dLen) * (1.0 - smoothstep(0.08, 0.17, abs(fract(vSta / 0.35) - 0.5))) * (1.0 - (1.10 - vHt) / max(dLen, 0.01) * 0.6);',
'    albedo *= 1.0 - 0.7 * dStreak * (1.0 - smoothstep(0.02, 0.06, aaW));',
'    albedo *= 1.0 - (0.35 + 0.3 * vnoiseP(vec2(vHt * 4.0, vSta * (2880.0 / 1440.0)), 2880.0)) * (1.0 - smoothstep(0.05, 0.6, jW)) * (0.6 + 0.4 * (1.0 - vHt / 1.1));',   // 目地の両側のしみ（下ほど濃い、むらあり）                                 // 目地まわりのしみ
'    float pC = floor(vSta / 4.0), pH = hash12(vec2(mod(pC, 4114.0), 21.0)), pX = fract(vSta / 4.0) * 4.0;',   // 補修のモルタル: 輪郭のはっきりした四角い当て跡（4 m のうち 1 割強）。明るい丸いしみにしない
'    float p0 = 0.4 + 1.6 * hash12(vec2(mod(pC, 4114.0), 22.0)), pW = 0.6 + 1.2 * hash12(vec2(mod(pC, 4114.0), 23.0)), pT = 0.45 + 0.5 * hash12(vec2(mod(pC, 4114.0), 24.0));',
'    float patchM = step(0.87, pH) * step(p0, pX) * step(pX, p0 + pW) * step(0.12, vHt) * step(vHt, pT);',
'    albedo = mix(albedo, albedo * vec3(0.82, 0.83, 0.84) + vec3(0.012), patchM);',
'    float dq = abs(mod(vSta + 2.5, 10.0) - 5.0);',                                    // 排水口（足元の小さな格子、10 m ごと）
'    float drain = (1.0 - step(0.15, dq)) * (1.0 - step(0.14, vHt)) * step(abs(vLat), 9.33);',
'    albedo *= 1.0 - 0.8 * drain * (0.7 + 0.3 * step(0.5, fract(vSta * 25.0)));',
'    rough = 0.9;',
'    if (isRail > 0.5) { albedo = vec3(0.045, 0.046, 0.048) * (0.85 + 0.3 * vnoiseP(vec2(3.0, vSta * (720.0 / 1440.0)), 720.0)); rough = 0.55; }',   // 鋼管の手すり（くすんだ塗装の丸い管。街灯の細く鈍いハイライト）            // 鋼管の手すり（街灯の細いハイライト）
'#endif',
'#ifdef DECK',
// 桁・地覆のコンクリート: 側面に雨だれの縦筋（上端から垂れる）、根元と上面の汚れ
'    float vert = 1.0 - smoothstep(0.5, 0.8, abs(N.y));',
'    float streak = vnoiseP(vec2(vHt * 0.35 + 5.0, vSta * (4320.0 / 1440.0)), 4320.0) * 0.7 + vnoiseP(vec2(vHt * 0.9 + 2.0, vSta * (1440.0 / 1440.0)), 1440.0) * 0.3;',
'    float fascia = step(FASCIA_LAT, abs(vLat));',                                   // 外側の桁側面（地覆の内面・分離帯の縁石は除く）
'    float drip = smoothstep(0.45, 0.8, streak) * vert * fascia * (0.4 + 0.6 * smoothstep(-2.2, 0.25, vHt));',
'    albedo *= 1.0 - 0.5 * drip;',
'    albedo *= 1.0 - 0.6 * (1.0 - vert) * smoothstep(0.1, 0.25, vHt);',          // 上面は砂埃で暗い
// 縁石・地覆の内面: 路面からの泥はねで下ほど暗く、道のり方向にゆるいむら
'    float splash = vert * (1.0 - fascia) * (1.0 - smoothstep(0.0, 0.2, vHt));',
'    albedo *= (1.0 - 0.55 * splash) * (0.8 + 0.4 * vnoiseP(vec2(vLat * 0.3, vSta * (720.0 / 1440.0)), 720.0) * (1.0 - fascia));',
// v7.1: 伸縮継手の位置（道のり ≡ 21 mod 36）で、地覆・縁石・桁側面に縦の目地（幅 3 cm の暗い線）
'    if (abs(vLat) > FASCIA_LAT - 0.3 && vHt > -0.02 && rampZone(vSta, vLat) > 0.5) discard;',   // v8: 出入口の区間は地覆を外す（ランプの路面が続く）
'    float aaD = max(fwidth(vSta), 1e-4);',
'    float jdD = abs(mod(vSta - 21.0 + 18.0, 36.0) - 18.0);',
'    albedo *= 1.0 - 0.75 * (1.0 - smoothstep(0.015, 0.015 + aaD, jdD)) * (1.0 - smoothstep(0.03, 0.1, aaD));',
// v9: 橋（C）の区間の桁の外側面は鋼桁: 床版の縁（上 0.3 m）はコンクリートのまま、その下は塗装した I 形の主桁の腹板。
// 垂直補剛材 1.6 m ごと（陰の縦線と、光の当たる縁）、床版の下の影、下フランジの出っ張り（明るい縁と下の影）、塗装の色あせと錆のしみ
'    vec4 ga, gb;',
'    if (fascia * vert > 0.5 && vHt < -0.30 && secOf(vSta, vLat, ga, gb) && ga.z > 1.5 && ga.z < 2.5) {',
'        vec3 paint = vec3(0.060, 0.068, 0.064) * (0.9 + 0.2 * gb.w);',
'        float aaH2 = max(fwidth(vHt), 1e-4);',
'        float sx = mod(vSta + 0.8, 1.6), stiff = 1.0 - smoothstep(0.03, 0.03 + aaD, abs(sx - 0.8));',
'        float stiffE = (1.0 - smoothstep(0.012, 0.012 + aaD, abs(sx - 0.84))) * (1.0 - smoothstep(0.03, 0.1, aaD));',
'        float under = 1.0 - smoothstep(0.0, 0.25, -0.30 - vHt);',                     // 床版の下の影
'        float flg = 1.0 - smoothstep(0.0, 0.03 + aaH2, abs(vHt + 2.08));',              // 下フランジの上面の明るい縁
'        float flgS = smoothstep(-2.06, -2.02, vHt) * (1.0 - smoothstep(-1.98, -1.85, vHt));',   // フランジの上の細い影
'        float rustS = smoothstep(0.62, 0.85, vnoiseP(vec2(vHt * 0.6 + 9.0, vSta * (2880.0 / 1440.0)), 2880.0)) * smoothstep(-0.6, -2.0, vHt);',
'        albedo = paint * (0.85 + 0.3 * vnoiseP(vec2(vHt * 1.5, vSta * (720.0 / 1440.0)), 720.0));',
'        albedo *= (1.0 - 0.55 * stiff * (1.0 - smoothstep(0.03, 0.1, aaD))) * (1.0 + 0.8 * stiffE) * (1.0 - 0.6 * under) * (1.0 - 0.45 * flgS) * (1.0 + 1.2 * flg);',
'        albedo = mix(albedo, albedo * vec3(1.3, 0.85, 0.6), 0.6 * rustS);',
'        float jG = min(vSta - ga.x, ga.y - vSta);',                                      // 区間の端（コンクリート桁との境）の目地
'        albedo *= 1.0 - 0.7 * (1.0 - smoothstep(0.02, 0.02 + aaD, jG));',
'        rough = 0.55;',
'    }',
'#endif',
'#ifdef TREE',
// 葉むら: 物体座標の 3D ノイズで塊ごとの濃淡と、細かい葉の明暗。色味も木ごとに少し変える
'    vec3 tq = vObjN * 2.3 + vTreeSeed * 17.0;',
'    float clump = vnoise(tq.xy + tq.z * 1.7) * 0.6 + vnoise(tq.yz * 2.1 + 3.0) * 0.4;',
'    float leaf = vnoise(tq.xz * 9.0 + tq.y * 5.0);',
'    albedo *= (0.45 + 1.1 * clump) * (0.75 + 0.5 * leaf);',
'    albedo *= mix(vec3(1.0), vec3(1.25, 1.05, 0.8), vTreeSeed);',
'#endif',
'#if defined(DECK) && defined(NGAP)',
// 補修区間の分離帯の上面に、ガードレール支柱を切った小さな暗い丸い跡（4 m ごと）。色の違う当て板は付けない
'    if (vHt > 0.2 && abs(vLat) < 0.5) {',
'        for (int gi = 0; gi < NGAP; gi++) {',
'            vec2 g = uGap[gi];',
'            if (vSta > g.x - 0.5 && vSta < g.y + 0.5) {',
'                float ds = abs(mod(vSta - 1.0 + 2.0, 4.0) - 2.0);',
'                float rr = length(vec2(ds, vLat));',
'                albedo *= mix(0.35, 1.0, smoothstep(0.05, 0.08, rr));',
'            }',
'        }',
'    }',
'#endif',
'#ifdef RVIADUCT',
// 並走する線路の高架: コンクリートの壁高欄・床版・箱桁。30 m ごとの継ぎ目、壁の上端から垂れる雨だれの縦筋、
// 道床（高架はコンクリート、盛土は砕石）にレール 4 本。盛土の法面は土
'    float bnd = floor(vRBand + 0.5);',
'    float aaS2 = max(fwidth(vSta), 1e-3);',
'    float vertF = 1.0 - smoothstep(0.5, 0.8, abs(N.y));',
'    float strk = vnoise(vec2(vSta * 3.0, vRHt * 0.35 + 3.0)) * 0.7 + vnoise(vec2(vSta * 0.9, vRHt * 0.8)) * 0.3;',
'    albedo *= 1.0 - 0.45 * smoothstep(0.45, 0.8, strk) * vertF * smoothstep(-2.7, 0.9, vRHt);',
'    float dj = abs(mod(vSta + 15.0, 30.0) - 15.0);',
'    albedo *= 1.0 - 0.6 * (1.0 - smoothstep(0.02, 0.05 + aaS2, dj));',
'    if (bnd == 1.0 || bnd == 5.0) albedo *= 1.25;',
'    if (bnd >= 7.0) albedo *= 0.8;',
'    if (bnd == 3.0) {',
'        float grit = vnoise(vec2(vLat * 5.0, vSta * 5.0));',
'        vec3 bed = mix(vec3(0.045, 0.044, 0.042) * (0.85 + 0.3 * grit), vec3(0.035, 0.032, 0.028) * (0.6 + 0.8 * grit), step(vRElev, 0.5));',
'        albedo = bed;',
'        float aaE = max(fwidth(vLat), 1e-3);',
'        for (int k = 0; k < 2; k++) {',
'            float c = k == 0 ? -2.0 : 2.0, de = abs(vLat - c);',
'            float rl = (1.0 - smoothstep(0.035, 0.035 + aaE, abs(de - 0.5335))) * (1.0 - smoothstep(0.04, 0.2, aaE));',
'            albedo = mix(albedo, vec3(0.05, 0.05, 0.055), rl); rough = mix(rough, 0.25, rl);',
'            float slp = (1.0 - smoothstep(1.1, 1.1 + aaE, de)) * (1.0 - smoothstep(0.08, 0.3, aaS2));',
'            albedo *= 1.0 - 0.25 * slp * step(0.5, fract(vSta / 0.6));',
'        }',
'    }',
'    if (vRElev < 0.5 && (bnd == 0.0 || bnd == 6.0)) { albedo = vec3(0.020, 0.018, 0.012) * (0.7 + 0.6 * vnoise(vec2(vSta * 0.5, vRHt * 2.0))); rough = 0.95; }',
'#endif',
'#ifdef RAMP',
// v8: ランプの路面（vSta = ランプの弧長、vLat = ランプの中心からの横位置、正 = 道路から遠い側）。
// 濡れたアスファルト、車線の両側の白の実線、本線との間の導流帯（白の外枠と斜めの縞）。ランプの街灯（36 m ごと、外側 1.2 m・高さ 10 m）の光を足す
'    float aaR = max(fwidth(vLat), 1e-3), aaU = max(fwidth(vSta), 1e-3);',
'    albedo = vec3(0.040, 0.040, 0.042) * (0.85 + 0.3 * vnoise(vec2(vLat * 0.7, vSta * 0.5))) * (0.9 + 0.2 * vnoise(vec2(vLat * 6.0, vSta * 6.0)));',
'    rough = 0.32 + 0.2 * vnoise(vec2(vLat * 0.5, vSta * 0.2));',
'    float lineR = (1.0 - smoothstep(0.075, 0.075 + aaR, abs(vLat - 1.75))) + (1.0 - smoothstep(0.075, 0.075 + aaR, abs(vLat + 1.75)));',
'    float goreO = (1.0 - smoothstep(0.075, 0.075 + aaR, abs(vLat + 2.6))) * step(-2.7, vLat) * 0.0;',
'    float gore = step(vLat, -2.6);',
// 導流帯の縞: 進行方向に対して 45°、ノーズへ流れる向き（出口はランプ側へ開く、入口は鏡写し）。幅 0.45 m・間隔 2 m（進行方向に測って）。遠くは縞の平均の明るさ
'    float zt = (vSta + (vRamp.y < 0.5 ? 1.0 : -1.0) * vLat) / 2.0;',
'    float zw = max(fwidth(zt), 1e-4);',
'    float zebra = gore * mix(1.0 - smoothstep(0.1125 - zw, 0.1125 + zw, abs(fract(zt) - 0.5)), 0.23, smoothstep(0.15, 0.6, zw));',
'    float goreEdge = (1.0 - smoothstep(0.1, 0.1 + aaR, abs(vLat + 2.6)));',
'    float tpr = vRamp.x;',                                                              // すりつけの割合（1 = 車線の幅いっぱい）
'    float laneOut = 8.1 + 3.5 * tpr - 9.85;',                                           // すりつけ区間の車線の外側の端（ランプの横位置）
'    float tz = (vSta - vLat) / 2.0, tzw = max(fwidth(tz), 1e-4);',
'    float taperZ = step(tpr, 0.999) * step(laneOut + 0.1, vLat) * step(vLat, 8.1 + 4.5 * tpr - 9.85) * mix(1.0 - smoothstep(0.1125 - tzw, 0.1125 + tzw, abs(fract(tz) - 0.5)), 0.23, smoothstep(0.15, 0.6, tzw));',
'    float taperE = step(tpr, 0.999) * (1.0 - smoothstep(0.075, 0.075 + aaR, abs(vLat - laneOut)));',
// 減速車線の路面の文字「速度落とせ」（縦長のゴシック、1 文字 幅 1.5 m・長さ 6 m、7.5 m ごと、全長 37 m）。車線の中央に縦に並べ、奥から手前へ読む（奥が「速」）。
// 文字は 128×640 の画像（上が奥）から取る。手前の端はノーズの 95 m 手前、奥の端は 58 m 手前（平行区間の中ほど）
'    float arrow = 0.0;',
'    if (vRamp.y < 0.5) {',
'        float du = vSta - (vRamp.z - 95.0), dv = vLat;',
'        vec2 tuv = vec2(0.5 - dv / 1.5, (du - 0.5) / 37.5);',
'        float cell = fract(tuv.y * 5.0);',
'        float inT = step(0.0, tuv.x) * step(tuv.x, 1.0) * step(0.0, tuv.y) * step(tuv.y, 1.0) * step(cell, 0.8);',   // 文字の長さ 6 m、次の文字までの 1.5 m は空ける
'        float tv = (floor(tuv.y * 5.0) + cell / 0.8) / 5.0;',
'        vec2 g = vec2(1.0 / 1.5, 1.0 / 30.0) * vec2(fwidth(dv), fwidth(du));',
'        arrow = inT * textureGrad(uRoadTxt, vec2(tuv.x, tv), vec2(g.x, 0.0), vec2(0.0, g.y)).r;',
'        arrow *= mix(1.0, 0.6, smoothstep(0.1, 0.4, aaU));',
'    }',
'    float paintR = clamp(lineR + zebra + goreEdge + goreO + taperZ + taperE + arrow, 0.0, 1.0);',
'    albedo = mix(albedo, vec3(0.42, 0.42, 0.40) * (0.8 + 0.3 * vnoise(vec2(vSta * 2.0, vLat * 3.0))), paintR);',
'    rough = mix(rough, 0.45, paintR);',
'    float u0 = floor(vSta / 36.0) * 36.0 + 18.0;',
'    float Er = 0.0;',
'    for (int li = -1; li <= 1; li++) {',
'        float du = vSta - (u0 + float(li) * 36.0), dl = vLat - 1.2;',
'        float d2 = du * du + dl * dl + 100.0;',
'        Er += 10.0 / pow(d2, 1.5);',                                                // 光度 × cos / d² （高さ 10 m）
'    }',
'#endif',
'#ifdef DRUM',
// v8: クッションドラム（黄と黒の縞、上部に再帰反射の白い帯）
'    float bandD = step(0.5, fract(vLocalY * 2.5));',
'    albedo = mix(vec3(0.02), vec3(0.45, 0.33, 0.02), bandD);',
'    float reflD = step(0.82, vLocalY) * step(vLocalY, 0.92);',
'    albedo = mix(albedo, vec3(0.6), reflD); rough = 0.5;',
'#endif',
'#ifdef RPOLE',
// ラバーポール: 色あせの度合いが 1 本ずつ違う橙、上部に白の反射帯 2 本（各 5 cm）、根元は黒ずみ
'    float bandA = step(0.60, vLocalY) * step(vLocalY, 0.65), bandB = step(0.69, vLocalY) * step(vLocalY, 0.74);',
'    float band = max(bandA, bandB);',
'    albedo = mix(albedo, vec3(0.30, 0.20, 0.14), vFade * 0.45);',             // 色あせ
'    albedo = mix(albedo, vec3(0.55, 0.55, 0.52), band);',
'    albedo *= mix(0.35, 1.0, smoothstep(0.0, 0.18, vLocalY));',
'    rough = mix(rough, 0.35, band);',
'#endif',
'#ifdef PIER',
'    albedo *= mix(0.55, 1.0, smoothstep(-1.0, -0.9, vLocalY));',                    // 根元の汚れ
'#endif',
'#ifdef NO_LIGHTS',
'    vec3 col = vec3(0.0);',                                                         // 桁の下・地面には街灯の光が届かない
'#else',
'    vec3 col = shadeLights(P, N, V, albedo, rough, uF0);',
'#if defined(HAS_STATION) && !defined(RVIADUCT) && !defined(RAMP)',                              // 線路高架は道路の遠方街灯の解析式を使わない
'#if defined(DECK) || defined(WALL)',
'    col += albedo * farPool(vSta, vLat) * uLampCol / PI * smoothstep(0.4, 0.9, N.y);',   // 解析式は上向きの面だけ
'#else',
'    col += albedo * farPool(vSta, vLat) * uLampCol / PI;',
'#endif',
'#endif',
'#endif',
'    col += shadeAmbient(N, V, albedo, rough, uF0) + uEmissive;',
'#ifdef RAMP',
'    col += albedo / PI * Er * uLampI * 2.6 * uLampCol;',                            // ランプの街灯（本線の路面と明るさをそろえる）
'#endif',
'#ifdef DRUM',
'    { float retroD = 0.0; for (int k = 0; k < 2; k++) { vec3 L; float d; float I = headI(P, k == 0 ? uHeadPos0 : uHeadPos1, L, d); retroD += I / (d * d); } col += uHeadCol * retroD * 0.0006 * (reflD + 0.4 * bandD); }',
'#endif',
'    col += albedo * uUnder * (0.6 - 0.4 * N.y);',                                   // 下の街明かりの仰ぎ光
'#ifdef RPOLE',
// 反射帯はヘッドライトの再帰反射で淡く白く見える（光る玉にはしない）
'    if (band > 0.5) { float retro = 0.0; for (int k = 0; k < 2; k++) { vec3 L; float d; float I = headI(P, k == 0 ? uHeadPos0 : uHeadPos1, L, d); retro += I / (d * d); } col += uHeadCol * retro * uRetroPole; }',
'#endif',
'    col = applyFogP(col, P);',
'#ifdef FADE',
'    col = mix(fogColor(normalize(P - uCamPos)), col, fadeOf(P));',
'#endif',
'#ifdef RVIADUCT',
'    col = mix(fogColor(normalize(P - uCamPos)), col, vREnd);',
'#endif',
'    gl_FragColor = vec4(col, 1.0);',
'}'
].join('\n');


// --- v9: 遮音壁（透明板）と鋼製高欄（縦格子）。不透明物の後に、前乗算アルファで描く ---------------------
var PANEL_VERT = [
'attribute float aSta;', 'attribute float aLat;', 'attribute float aHt;', 'attribute float aFold;',
'varying vec3 vWorld; varying vec3 vN; varying float vSta; varying float vLat; varying float vHt; varying float vFold;',
'void main() {',
'    vec4 wp = modelMatrix * vec4(position, 1.0); vWorld = wp.xyz; vN = normalize(mat3(modelMatrix) * normal);',
'    vSta = aSta; vLat = aLat; vHt = aHt; vFold = aFold;',
'    gl_Position = projectionMatrix * viewMatrix * wp;',
'}'
].join('\n');
var PANEL_FRAG = [
'varying vec3 vWorld; varying vec3 vN; varying float vSta; varying float vLat; varying float vHt; varying float vFold;',
NOISE,
LIGHTS,
SECS,
'uniform vec2 uRampL[4];', 'uniform vec2 uRampR[4];',
'float rampZoneP(float sta, float lat) { for (int i = 0; i < 4; i++) { vec2 a = uRampL[i], b = uRampR[i]; if (lat < 0.0 && sta > a.x && sta < a.y) return 1.0; if (lat > 0.0 && sta > b.x && sta < b.y) return 1.0; } return 0.0; }',
// 1 次元の縞（周期 p、幅 w の明るい部分）の、画素の幅 fw にわたる平均（被覆率）。遠くでちらつかない
'float stripeCov(float x, float p, float w, float fw) {',
'    float t = x / p, ww = w / p, f = max(fw / p, 1e-4);',
'    float a = t - f * 0.5, b = t + f * 0.5;',
'    float Fa = floor(a) * ww + clamp(fract(a), 0.0, ww), Fb = floor(b) * ww + clamp(fract(b), 0.0, ww);',
'    return clamp((Fb - Fa) / f, 0.0, 1.0);',
'}',
'void main() {',
'    vec4 sa, sb;',
'    if (!secOf(vSta, vLat, sa, sb) || rampZoneP(vSta, vLat) > 0.5) discard;',
'    vec3 P = vWorld; vec3 toCam = uCamPos - P; float dist = length(toCam); vec3 V = toCam / dist;',
'    vec3 N = normalize(vN); if (dot(N, V) < 0.0) N = -N;',
'    float aaS = max(fwidth(vSta), 1e-4), aaH = max(fwidth(vHt), 1e-4);',
'    vec3 col = vec3(0.0); float alpha = 0.0;',
'    if (sa.z > 0.5 && sa.z < 1.5) {',
// B: 遮音壁。壁高欄の天端（1.10 m）から高さ H。支柱 2 m ごと、段の境の押縁 1 m ごと。区間の端の板は上端を斜めに落とす
'        float H = sa.w, y = vHt - 1.10;',
'        float dS = vSta - sa.x, dE = sa.y - vSta;',
'        float topY = H;',
'        if (sb.x != 1.0) topY = min(topY, mix(H * 0.4, H, clamp(dS / 2.0, 0.0, 1.0)));',
'        if (sb.y != 1.0) topY = min(topY, mix(H * 0.4, H, clamp(dE / 2.0, 0.0, 1.0)));',
'        float folded = step(fract(sb.w * 7.31 + 0.17), 0.2);',                          // 2 割の区間は先端改良型（上 0.5 m が道路側へ 20° 折れる）。折れの帯は高さ H ごとに 1 本ずつある
'        if (vFold > 0.5) { if (folded < 0.5 || abs(vFold - H) > 0.1) discard; }',
'        else if (folded > 0.5) topY = min(topY, H - 0.5);',
'        if (y < 0.0 || y > topY) discard;',
'        float post = stripeCov(vSta + 0.075, 2.0, 0.15, aaS);',
'        if (sb.x != 1.0) post = max(post, 1.0 - smoothstep(0.15, 0.15 + aaS, dS));',   // 区間の端は支柱 1 本で終わる
'        if (sb.y != 1.0) post = max(post, 1.0 - smoothstep(0.15, 0.15 + aaS, dE));',
'        float frameH = stripeCov(y + 0.0175, 1.0, 0.035, aaH) + (1.0 - smoothstep(0.0, 0.035 + aaH, topY - y));',
'        float lowMetal = step(sb.z, 0.3) * step(y, 1.0);',                         // 3 割の区間は下 1 段が金属の吸音板
'        float opaque = clamp(post + frameH + lowMetal, 0.0, 1.0);',
'        vec3 albO = mix(vec3(0.028, 0.029, 0.031), vec3(0.06, 0.062, 0.064), clamp(frameH, 0.0, 1.0));',   // 支柱は暗い灰色の塗装、押縁は鈍いアルミ
'        if (lowMetal > 0.5) albO = vec3(0.16, 0.165, 0.17) * (0.85 + 0.3 * step(0.5, fract(vSta * 12.0)));',
'        vec3 colO = vec3(0.0);',
'        if (opaque > 0.002) colO = shadeLights(P, N, V, albO, 0.65, vec3(0.04)) + shadeAmbient(N, V, albO, 0.7, vec3(0.04));',   // 枠・支柱の画素だけ照明を計算する（AMD の GPU で描画が長引いて固まるのを防ぐ）
// 透明板: フレネル（n = 1.5）。正面から見るとほぼ透明、前方をかすめて見ると反射が勝つ
'        float cosT = clamp(abs(dot(N, V)), 0.0, 1.0);',
'        float omc = 1.0 - cosT, omc2 = omc * omc;',
'        float F = 0.04 + 0.96 * omc2 * omc2 * omc;',
'        vec3 R = reflect(-V, N);',
'        vec3 refl = R.y >= 0.0 ? fogColor(R) * 0.22 : uFogBase * 0.25 + uLampCol * 0.002;',   // 鏡映方向の夜空・街の光害（上向き）、暗い景色とわずかな路面の光（下向き）。一様な明るい色は足さない                                               // 空と街の光害
'#ifdef PDBG',
'        if (PDBG == 4) refl = vec3(0.0);',
'#endif',
// 街灯の映り込み: 灯の方向と反射の向きのずれで、縦に長い光の筋。反射が効く画素（F が大きい）だけ、ループの外へ出せる計算は外に出して行う
// （AMD の GPU では、この透明板の全画素で街灯の数だけのループを 2 回回すと描画が長引き、ドライバにリセットされていた）
'        if (F > 0.06 && opaque < 0.998) {',
'            vec3 hz = vec3(R.z, 0.0, -R.x); float hzl = length(hz); hz = hzl > 1e-4 ? hz / hzl : vec3(1.0, 0.0, 0.0);',   // 反射の向きに直交する水平軸 = normalize(cross(up, R))
'            float wav = (vnoise(vec2(vSta * 0.7, 3.0)) - 0.5) * 0.004;',                     // 板の微小なうねり
'            for (int i = 0; i < NL; i++) {',
'                vec4 L4 = uLamps[i];',
'                vec3 Ld = L4.xyz - P; float dl = max(length(Ld), 0.01); Ld /= dl;',
'                float dx = dot(Ld, hz) + wav, dy = Ld.y - R.y;',
'                refl += uLampCol * exp(-dx * dx * 12000.0 - dy * dy * 400.0) * max(L4.w, 0.0) * 0.006 / (1.0 + dl * 0.02);',   // 灯の鏡映点への方向の鋭いハイライト（縦に少し伸びる）
'            }',
'        }',
'#ifdef PDBG',
'        if (PDBG == 3) refl = R.y >= 0.0 ? fogColor(R) * 0.22 : uFogBase * 0.25;',
'#endif',
'        float rd = fract(sin(dot(floor(vec2(vSta / 2.0, y / 1.0)), vec2(12.9, 78.2)) + sb.w * 31.0) * 43758.5);',   // 板ごとの汚れの度合い（交換した板は澄む）
'        float dirt = 0.0;',
'        if (dist < 300.0) {',
'            dirt = (0.2 + 0.2 * rd) * (1.0 - smoothstep(0.0, 0.6, y)) * (0.7 + 0.3 * vnoise(vec2(vSta * 3.0, y * 9.0)));',   // 下ほど濃い水はねの霧
'            dirt += 0.08 * rd * smoothstep(0.6, 0.9, vnoise(vec2(vSta * 14.0, y * 14.0)));',                                  // 乾いた水滴のむら
'            dirt += 0.12 * smoothstep(0.75, 0.95, vnoise(vec2(vSta * 2.5, 3.0))) * smoothstep(H * 0.4, H, y);',               // 上端からの雨だれ
'            dirt *= step(0.08, rd);',
'        }',
'        float bird = step(0.8, sb.z) * stripeCov(y, 0.1, 0.006, aaH) * step(0.5, fract(vSta * 8.0));',   // 鳥の衝突防止の白い点線（2 割の区間）
'        float tA = 0.17;',                                                             // 透過率 0.83（灰〜薄い青緑: 板自体のわずかな色を足す）
'        vec3 rf = refl * F * 0.45; rf = rf / (1.0 + rf / 1.5);',                        // 映り込みは控えめ（2026-11-20 の指摘で 0.45 倍）。頭打ちは遠くで重なっても光る板にしないため
'        vec3 glassC = rf + vec3(0.006, 0.011, 0.011) * (0.5 + 0.5 * rd);',
'        float aG = clamp(tA + F + dirt, 0.0, 0.95);',
'        vec3 dirtC = (uAmbient * 1.0 + uLampCol * 0.0015) * dirt * (1.0 - smoothstep(0.0, 0.6, y));',   // 板の拡散（くもり）は下 0.6 m の汚れだけ
'        glassC += dirtC + vec3(0.25) * bird * 0.05;',
'#ifdef PDBG',
'        if (PDBG == 1) opaque = 0.0;',
'        if (PDBG == 2) { glassC = vec3(0.0); aG = 0.0; }',
'        if (PDBG == 5) { gl_FragColor = vec4(mix(vec3(1.0, 0.0, 1.0), vec3(0.0, 1.0, 0.0), step(0.5, opaque)), 1.0); return; }',
'#endif',
'        col = mix(glassC, colO, opaque);',
'        alpha = mix(aG, 1.0, opaque);',
'    } else if (sa.z > 1.5 && sa.z < 2.5) {',
// C: 鋼製高欄（地覆 0.30 m の上、笠木まで 1.10 m）。縦の平鋼 2 cm を 0.12 m ごと、笠木・下の横材・支柱 2 m ごと。被覆率で描く
'        if (vFold > 0.5 || vHt < 0.30 || vHt > 1.10) discard;',
'        float bars = stripeCov(vSta, 0.12, 0.02, aaS);',
'        float rails = (1.0 - smoothstep(0.0, 0.01 + aaH, 1.10 - vHt - 0.10)) + (1.0 - smoothstep(0.0, 0.01 + aaH, vHt - 0.30 - 0.06));',
'        float post = stripeCov(vSta + 0.05, 2.0, 0.10, aaS);',
'        if (sb.x < 1.5) post = max(post, 1.0 - smoothstep(0.22, 0.22 + aaS, vSta - sa.x));',   // 壁高欄・遮音壁につながる端の支柱は太め
'        if (sb.y < 1.5) post = max(post, 1.0 - smoothstep(0.22, 0.22 + aaS, sa.y - vSta));',
'        float cov = clamp(bars + rails + post, 0.0, 1.0);',
'        if (cov < 0.004) discard;',
'        vec3 alb = vec3(0.045, 0.055, 0.05);',
'        col = (shadeLights(P, N, V, alb, 0.45, vec3(0.05)) + shadeAmbient(N, V, alb, 0.5, vec3(0.05))) * cov;',
'        alpha = cov;',
'    } else discard;',
'    if (alpha > 0.001) col = applyFogP(col / alpha, P) * alpha;',                   // 前乗算のまま霧をかける
'#ifdef OPAQUE_PASS',
'    if (alpha < 0.5) discard;',                                                       // 不透明な部分（支柱・枠・金属板・格子の密な所）は奥行きを書く普通の物体として先に描く
'    gl_FragColor = vec4(col / alpha, 1.0);',
'#else',
'    if (alpha >= 0.5) discard;',                                                      // 透明な板と、まばらな格子だけを後から重ねる
'    gl_FragColor = vec4(col, alpha);',
'#endif',
'}'
].join('\n');


// --- v9: 川の水面。暗い水に、両岸の街灯（30 m ごと）の鏡映が縦に長く揺れる筋として映る（環境マップなし） ---
var WATER_VERT = [
'varying vec3 vWorld; varying vec2 vRiv;',
'attribute vec2 aRiv;',
'void main() { vec4 w = modelMatrix * vec4(position, 1.0); vWorld = w.xyz; vRiv = aRiv; gl_Position = projectionMatrix * viewMatrix * w; }'
].join('\n');
var WATER_FRAG = [
'varying vec3 vWorld; varying vec2 vRiv;',      // vRiv = (川に沿った距離, 川を横切る位置)
'uniform vec3 uCamPos; uniform vec3 uLampCol; uniform float uTime; uniform float uFogDensity; uniform vec3 uFogBase;',
'uniform vec3 uRivO; uniform vec3 uRivA; uniform vec3 uRivC; uniform float uRivW;',   // 原点・川に沿った向き・横切る向き・幅
NOISE,
'void main() {',
'    vec3 P = vWorld; vec3 V = normalize(uCamPos - P); float dist = length(uCamPos - P);',
'    vec2 q = vRiv;',
'    float w1 = vnoise(vec2(q.x * 0.35 + uTime * 0.4, q.y * 0.9)) - 0.5, w2 = vnoise(vec2(q.x * 1.3 - uTime * 0.7, q.y * 3.1)) - 0.5;',
'    vec3 n = normalize(vec3(0.0, 1.0, 0.0) + uRivA * (w1 * 0.10 + w2 * 0.05) + uRivC * (w2 * 0.04));',
'    vec3 R = reflect(-V, n);',
'    vec3 col = uFogBase * 0.5 * (0.6 + 0.4 * max(R.y, 0.0));',
'    for (int b = 0; b < 2; b++) {',
'        float side = b == 0 ? -1.0 : 1.0;',
'        float k0 = floor(q.x / 30.0);',
'        for (int k = -2; k <= 3; k++) {',
'            float al = (k0 + float(k)) * 30.0;',
'            vec3 Lp = uRivO + uRivA * al + uRivC * side * (uRivW * 0.5 + 6.0) + vec3(0.0, 8.0, 0.0);',
'            vec3 Ld = Lp - P; float dl = length(Ld); Ld /= dl;',
'            vec3 hz = normalize(cross(vec3(0.0, 1.0, 0.0), V));',
'            float dx = dot(R - Ld, hz), dy = dot(R - Ld, vec3(0.0, 1.0, 0.0));',
'            col += uLampCol * exp(-dx * dx * 1800.0 - dy * dy * 6.0) * 0.5 / (1.0 + dl * 0.01);',
'        }',
'    }',
'    col *= 1.0 - smoothstep(450.0, 600.0, abs(q.x));',                         // 端は暗い地面に溶かす
'    float f = exp(-dist * uFogDensity * 0.8);',
'    col = mix(uFogBase * 1.2, col, f);',
'    gl_FragColor = vec4(col, 1.0);',
'}'
].join('\n');

// --- v9: 橋の下の地上の道路（片側 2 車線、歩道、交差点の横断歩道と停止線）。両側の街路灯で照らす（解析的、6 灯）。座標は世界座標から求める ---
var GROAD_VERT = [
'varying vec3 vWorld;',
'void main() { vec4 w = modelMatrix * vec4(position, 1.0); vWorld = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }'
].join('\n');
var GROAD_FRAG = [
'varying vec3 vWorld;',
FOG,
NOISE,
'uniform vec3 uRivO; uniform vec3 uRivA; uniform vec3 uRivC; uniform float uW; uniform float uXi; uniform float uHalf; uniform vec3 uGrCol;',
'float band(float x, float w, float fw) { return clamp((w * 0.5 - abs(x)) / fw + 0.5, 0.0, 1.0); }',   // 幅 w の線の、画素の幅 fw での被覆率
'void main() {',
'    vec3 P = vWorld; vec3 d = P - uRivO; float a = dot(d, uRivA), c = dot(d, uRivC);',
'    float hw = uW * 0.5, ac = abs(c), ax = abs(a - uXi);',
'    bool onMain = ac < hw && abs(a) < uHalf;',
'    bool onX = ax < 5.0 && ac < 90.0;',                                               // 交差する細い道（幅 10 m、両側 90 m まで）
'    if (!onMain && !onX) discard;',
'    float fa = max(fwidth(a), 1e-3), fc = max(fwidth(c), 1e-3), fw = max(fa, fc);',
'    float far = 1.0 - smoothstep(0.08, 0.3, fw);',                                     // 遠くでは細かい線を薄める（ちらつき防止）
'    float n1 = vnoise(vec2(a * 0.35, c * 0.35)), n2 = vnoise(vec2(a * 2.3, c * 2.3));',
'    vec3 alb = vec3(0.045, 0.045, 0.047) * (0.8 + 0.3 * n1 + 0.15 * n2);',            // アスファルト
'    float carW = hw - 3.5;',                                                           // 車道の半幅（歩道 3.5 m）
'    bool inX = ax < 5.0;',
'    if (onMain && ac > carW && !inX) {',
'        alb = vec3(0.085, 0.083, 0.08) * (0.85 + 0.25 * n1);',                         // 歩道（平板の目地）
'        alb *= 1.0 - 0.35 * (1.0 - smoothstep(0.02, 0.02 + fw, abs(fract(a / 0.6) - 0.5) * 0.6)) * far;',
'        alb = mix(alb, vec3(0.13, 0.13, 0.125), band(ac - carW - 0.09, 0.18, fc));',  // 縁石
'    }',
'    if (onX && !onMain && ax > 3.5) alb = vec3(0.085, 0.083, 0.08) * (0.85 + 0.25 * n1);',   // 細い道の歩道
'    float paint = 0.0; vec3 pc = vec3(0.32, 0.32, 0.31);',
'    if (onMain && ac < carW) {',
'        if (ax > 13.0) {',
'            paint = max(paint, band(ac - 0.2, 0.15, fc));',                                     // 中央線（黄の 2 本）
'            float isY = paint;',
'            float dash = step(fract(a / 10.0), 0.5);',
'            paint = max(paint, band(ac - carW * 0.5, 0.15, fc) * dash);',                      // 車線境界線（白の破線）
'            paint = max(paint, band(ac - (carW - 0.4), 0.15, fc));',                           // 外側線
'            if (isY > 0.5) pc = vec3(0.30, 0.20, 0.03);',
'        }',
'        float sl = band(a - uXi - sign(c) * 12.0, 0.45, fa) * step(0.3, ac);',               // 停止線（左側通行: 交差点の手前の車線だけ）
'        paint = max(paint, sl * step(0.0, (a - uXi) * sign(c)));',
'        float cw = band(ax - 8.0, 4.0, fa) * step(0.5, fract(c / 0.9));',                     // 横断歩道（縞 45 cm）
'        paint = max(paint, cw);',
'    }',
'    if (onX && ac > hw - 3.5 && ac < hw + 1.0) paint = max(paint, step(0.5, fract(a / 0.9)) * step(ax, 3.5));',   // 細い道を渡る横断歩道
'    if (onX && ac > hw + 1.0) paint = max(paint, band(a - uXi, 0.12, fa) * step(fract(c / 6.0), 0.5));',          // 細い道の中央の破線
'    float wear = 0.55 + 0.45 * smoothstep(0.3, 0.7, vnoise(vec2(a * 0.8, c * 1.7)));',
'    alb = mix(alb, pc, paint * wear * mix(0.5, 1.0, far));',
// 街路灯: 両側の歩道、32 m ごと（片側は 16 m ずらす）、高さ 9 m、灯具は車道へ 2 m 張り出す
'    float E = 0.0; float h = 9.0;',
'    for (int sd = 0; sd < 2; sd++) {',
'        float sgn = sd == 0 ? -1.0 : 1.0, off = sd == 0 ? 0.0 : 16.0;',
'        float k0 = floor((a - off) / 32.0 + 0.5);',
'        for (int k = -1; k <= 1; k++) {',
'            float la = (k0 + float(k)) * 32.0 + off; if (abs(la) > uHalf - 40.0) continue;',
'            float dx = a - la, dy = c - sgn * (hw - 5.0); float r2 = dx * dx + dy * dy + h * h;',
'            float g = h * h / r2; E += g * g * sqrt(g);',
'        }',
'    }',
'    vec3 col = alb * (uGrCol * min(E, 1.5) + vec3(0.010, 0.010, 0.012));',
'    col *= 1.0 - smoothstep(uHalf - 150.0, uHalf, abs(a));',                          // 端は暗い地面に溶かす
'    if (!onMain) col *= 1.0 - smoothstep(55.0, 90.0, ac);',
'    gl_FragColor = vec4(applyFogP(col, P), 1.0);',
'}'
].join('\n');

// --- 空 ----------------------------------------------------------------------
var SKY_VERT = [
'varying vec3 vDir;',
'void main() {',
'    vDir = position;',
'    vec4 mv = modelViewMatrix * vec4(position, 1.0);',
'    gl_Position = projectionMatrix * mv;',
'}'
].join('\n');

var SKY_FRAG = [
'varying vec3 vDir;',
'uniform vec3 uZenith;',
'uniform vec3 uHorizon;',
'uniform vec3 uGround;',
'uniform vec3 uGlowCol;',
'uniform float uGlowStrength;',
'uniform sampler2D uCityTex;',
'uniform mat3 uMilkyRot;',
'uniform vec3 uMilkyCol;',
'uniform float uMilkyStrength;',
NOISE,
'void main() {',
'    vec3 d = normalize(vDir);',
'    float e = d.y;',
'    float az = atan(d.x, -d.z);',
'    float dens = texture2D(uCityTex, vec2(az / 6.2831853 + 0.5, 0.5)).r;',
'    float ep = max(e, 0.0);',
'    vec3 col = mix(uHorizon, uZenith, pow(ep, 0.45));',
'    col += uGlowCol * dens * uGlowStrength * (0.6 * exp(-ep * 40.0) + 0.3 * exp(-ep * 12.0) + 0.1 * exp(-ep * 3.5));',
// 天の川
'    vec3 m = uMilkyRot * d;',
'    float v = m.y;',
'    float u = atan(m.x, m.z);',
'    float band = exp(-v * v / (2.0 * 0.11 * 0.11)) * 0.7 + exp(-v * v / (2.0 * 0.28 * 0.28)) * 0.3;',
'    vec2 mq = vec2(u * 2.2, v * 7.0);',
'    float n = fbm(mq * 1.5 + 11.0);',
'    float lanes = smoothstep(0.35, 0.75, fbm(mq * 3.1 + vec2(5.0, 2.0)));',
'    float mw = band * (0.35 + 0.9 * n) * (1.0 - 0.6 * lanes * exp(-v * v / (2.0 * 0.07 * 0.07)));',
'    col += uMilkyCol * uMilkyStrength * mw * smoothstep(0.0, 0.18, e);',
// 地平線下
'    if (e < 0.0) {',
'        float t = exp(e * 90.0);',
'        vec3 g = uGround + uGlowCol * dens * uGlowStrength * 0.12;',
'        col = mix(g, col, t);',
'    }',
'    gl_FragColor = vec4(col, 1.0);',
'}'
].join('\n');

// --- 星 ----------------------------------------------------------------------
var STAR_VERT = [
'attribute float aSize;',
'attribute vec3 aCol;',
'attribute float aPhase;',
'attribute float aTw;',
'varying vec3 vCol;',
'varying float vSoft;',
'uniform float uPR;',
'uniform float uTime;',
'uniform float uTwinkle;',
'void main() {',
'    vec4 mv = modelViewMatrix * vec4(position, 1.0);',
'    float e = normalize(position).y;',
'    float ext = smoothstep(0.14, 0.42, e) * (0.7 + 0.3 * smoothstep(0.1, 0.5, e));',   // 光害: 高度 8° 以下はほぼ見えず、8〜25° で徐々に現れる
// 瞬き（シンチレーション）: 互いに割り切れない周波数の和で不規則に速く揺れる。地平線に近いほど強く、天頂はほとんど瞬かない。
// aTw = 星ごとの強さ（0.6〜1.0、コアの明るい星 120 個は 1.2）
'    float t = uTime;',
// v4: 速い成分を弱め、周波数を全体に 0.7 倍（基本 1.5 / 3.7 / 8.2 rad/s）にして静かに
'    float s1 = sin(t * (1.5 + aPhase * 1.2) + aPhase * 37.0);',
'    float s2 = sin(t * (3.7 + aPhase * 2.2) + aPhase * 91.0);',
'    float s3 = sin(t * (8.2 + aPhase * 3.5) + aPhase * 17.0);',
'    float scint = s1 * 0.62 + s2 * 0.28 + s3 * 0.10;',
'    float air = 1.0 - smoothstep(0.08, 0.75, e);',
'    float amp = mix(0.06, 0.75, air) * uTwinkle * aTw;',
'    float tw = max(1.0 + amp * scint, 0.08);',
'    float sz = aSize * min(uPR, 1.25);',                               // 高解像度で膨らませすぎない。瞬きでは大きさを変えない
'    gl_PointSize = max(sz, 1.0);',
'    vSoft = sz < 1.5 ? 0.0 : clamp((sz - 1.5) * 2.0, 0.0, 1.0);',      // 1.5 画素未満は柔らかい円盤にせず 1 画素の点のまま
'    vCol = aCol * ext * tw;',
'    if (aSize > 1.6) { float cj = 0.15 * air * s2 * uTwinkle; vCol.r *= 1.0 + cj; vCol.b *= 1.0 - cj; }',   // 明るい星は地平線近くで色も揺れる
'    gl_Position = projectionMatrix * mv;',
'}'
].join('\n');

var STAR_FRAG = [
'varying vec3 vCol;',
'varying float vSoft;',
'void main() {',
'    vec2 c = gl_PointCoord - 0.5;',
'    float r = length(c) * 2.0;',
'    float a = mix(1.0, exp(-r * r * 3.0) * (1.0 - smoothstep(0.7, 1.0, r)), vSoft);',
'    gl_FragColor = vec4(vCol * a, 1.0);',
'}'
].join('\n');

// --- 点光（デリニエータ / 街灯ハロー / 窓明かり / 障害灯）-------------------------
// aMode: 0 = 固定輝度（窓）, 1 = 点滅（障害灯）, 2 = 街灯ハロー, 4 = ゆらぐ窓, 5 = 沿道の街路の灯（3 は欠番: 旧デリニエータ）
var GLOW_VERT = [
'attribute float aSize;',
'attribute vec3 aCol;',
'attribute float aMode;',
'attribute float aPhase;',
'varying vec3 vCol;',
'varying float vSoft;',
'varying float vCore;',
'uniform float uPR;',
'uniform float uTime;',
'uniform vec3 uCamPos;',
'uniform vec3 uHeadPos0;',
'uniform vec3 uCarFwd;',
'uniform float uHeadI;',
'uniform float uRetroGain;',
'uniform float uHaloGain;',
'uniform float uFogDensity;',
'uniform float uPointMax;',     // GPU の点の大きさの上限（ALIASED_POINT_SIZE_RANGE）
'#ifdef FADE',
'uniform float uFadeFar;',
'#endif',
'void main() {',
'    vec3 wp = (modelMatrix * vec4(position, 1.0)).xyz;',
'    vec4 mv = viewMatrix * vec4(wp, 1.0);',
'    float dist = length(wp - uCamPos);',
'    float sz = aSize * uPR;',
'    vec3 col = aCol;',
'    vCore = 0.0;',
'    if (aMode < 0.5) {',
'        col *= 1.0;',
'    } else if (aMode < 1.5) {',
'        float kk = floor(aPhase);',                                    // 整数部 1〜7 = 周期 1.2〜1.8 秒（山の障害灯）、0 = 従来の 1.43 秒
'        float ph = fract(uTime * (kk > 0.5 ? 1.0 / (1.1 + 0.1 * kk) : 0.7) + fract(aPhase));',
'        col *= step(ph, 0.22) * (0.6 + 0.4 * smoothstep(0.22, 0.0, ph));',
'    } else if (aMode < 2.5) {',
// 街灯ハロー: 見かけの大きさは距離に反比例。霧で遠い灯ほど大きく滲む
// v6.1: 最小の大きさで止めたときは、本来の面積との比で暗くする（光の総量を保つ。遠い灯が「同じ明るさの玉」で残らない）。
// 霧は滲みを少し広げるが、遠いほど光は減る（霧の減衰）。300 m より先は芯の明るさをブルームの閾値（1.0）以下に抑える
'        float fog = 1.0 - exp(-dist * uFogDensity);',
'        float szN = aSize * 600.0 / max(dist, 1.0) * (1.0 + 0.5 * fog) * uPR;',
'        sz = clamp(szN, 1.5 * uPR, 180.0 * uPR);',
'        float keep = szN / sz;',
'        col *= uHaloGain * keep * keep * exp(-dist * uFogDensity * 0.7) * min(dist / 12.0, 1.0);',
'        float cMax = max(col.r, max(col.g, col.b)) * 1.85;',                     // 1.85 = 芯の形の山の高さ
'        float lim = mix(1e4, 1.0, smoothstep(200.0, 600.0, dist));',
'        col *= min(1.0, lim / max(cMax, 1e-4));',
'        vCore = 1.0;',
'    } else if (aMode < 4.5) {',
'        col *= 0.85 + 0.25 * sin(uTime * (0.9 + aPhase * 2.0) + aPhase * 50.0);',
'    } else {',
// 沿道の街路の灯: 見かけの大きさは距離に反比例（遠いほど小さい点）、霧で減衰
'        float szN = aSize * 220.0 / max(dist, 1.0) * uPR;',
'        sz = clamp(szN, 1.2 * uPR, 14.0 * uPR);',
'        float keep = szN / sz;',
'        col *= exp(-dist * uFogDensity * 0.8) * mix(1.0, keep * keep, 0.75);',     // v6.1: 最小の大きさで止めたら面積比で暗く（窓の明かり程度は残す）
'        col *= min(1.0, mix(1e4, 0.8, smoothstep(250.0, 600.0, dist)) / max(max(col.r, max(col.g, col.b)), 1e-4));',
'    }',
'#ifdef FADE',
'    col *= 1.0 - smoothstep(0.8 * uFadeFar, uFadeFar, length((wp - uCamPos).xz));',   // 世界固定の点は距離でフェード
'#endif',
'    sz = min(sz, uPointMax);',      // GPU が切る前に自分で切る（形は gl_PointCoord で決まるので円のまま、輝度も変わらない）
'    gl_PointSize = max(sz, 1.0);',
'    vSoft = clamp((sz - 1.0) * 0.5, 0.0, 1.0);',
'    vCol = col * min(sz * sz, 1.0);',
'    gl_Position = projectionMatrix * mv;',
'}'
].join('\n');

var GLOW_FRAG = [
'varying vec3 vCol;',
'varying float vSoft;',
'varying float vCore;',
'void main() {',
'    vec2 c = gl_PointCoord - 0.5;',
'    float r = length(c) * 2.0;',
'    float disc = exp(-r * r * 3.5) * (1.0 - smoothstep(0.75, 1.0, r));',
'    float halo = (exp(-r * r * 14.0) * 1.6 + exp(-r * r * 2.2) * 0.25) * (1.0 - smoothstep(0.7, 1.0, r));',   // r >= 1（スプライトの角）は必ず 0
'    float a = mix(1.0, mix(disc, halo, vCore), vSoft);',
'    gl_FragColor = vec4(vCol * a, 1.0);',
'}'
].join('\n');

// --- 霧の中の光の円錐（ビルボード四角形） ---------------------------------------
var CONE_VERT = [
'attribute vec3 aCenter;',
'attribute vec2 aCorner;',
'attribute float aI;',
'varying vec2 vUv;',
'varying float vI;',
'uniform vec3 uCamPos;',
'uniform float uConeW;',
'uniform float uConeH;',
'void main() {',
'    vec3 c = (modelMatrix * vec4(aCenter, 1.0)).xyz;',
'    vec3 toCam = uCamPos - c;',
'    vec3 cr = cross(vec3(0.0, 1.0, 0.0), toCam);',
'    vec3 right = cr / max(length(cr), 1e-4);',                        // 真上・真下から見たときのゼロ除算（NaN）を防ぐ
'    float dist = length(toCam);',
'    vec3 p = c + right * (aCorner.x * uConeW) + vec3(0.0, aCorner.y * uConeH, 0.0);',
'    vUv = aCorner;',
'    vI = aI * smoothstep(6.0, 30.0, dist) * (1.0 - smoothstep(150.0, 400.0, dist));',   // v6.1: 遠い円錐は消す
'    gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);',
'}'
].join('\n');

var CONE_FRAG = [
'varying vec2 vUv;',
'varying float vI;',
'uniform vec3 uLampCol;',
'void main() {',
'    float y = -vUv.y;',                      // 0 = 灯具, 1 = 下端
'    float w = 0.10 + 0.95 * y;',
'    float x = abs(vUv.x) / w;',
'    float shape = exp(-x * x * 3.0) * (1.0 - smoothstep(0.6, 1.0, x));',
'    float fall = exp(-y * 3.2) * smoothstep(0.0, 0.08, y) * (1.0 - smoothstep(0.75, 1.0, y));',
'    float edge = 1.0 - smoothstep(0.9, 1.0, abs(vUv.x));',       // 四角形の左右の縁で必ず 0（上下は fall が 0）
'    gl_FragColor = vec4(uLampCol * (vI * shape * fall * edge), 1.0);',
'}'
].join('\n');

// --- ビル（窓格子つきシルエット。丘陵にも流用） ------------------------------------
// インスタンス属性: aSeed, aType (0 オフィス / 1 住宅), aLit (点灯率)
var CITY_VERT = [
'attribute float aSeed;',
'attribute float aType;',
'attribute float aLit;',
'varying vec3 vWorld;',
'varying vec3 vN;',
'varying vec2 vCell;',
'varying float vFace;',
'varying float vSeed;',
'varying float vType;',
'varying float vLit;',
'varying float vZs;',          // 物体座標の法線 z（マンションの廊下側 / ベランダ側の見分け）
'#ifdef NEAR',
'varying float vGH;',          // 地面からの高さ [m]
'#endif',
'#ifdef LITBLD',
'attribute vec4 aWall;',            // xyz = 外壁の反射率、w = 部材の底の地面からの高さ (v6.1)
'attribute vec4 aRoad;',
'attribute vec4 aL0;',
'attribute vec4 aL1;',
'attribute vec4 aL2;',
'varying vec3 vWall;',
'varying vec4 vRoad;',
'varying vec4 vL0;',
'varying vec4 vL1;',
'varying vec4 vL2;',
'varying vec3 vLoc;',          // 建物の原点（地面）からの位置（世界の軸）
'varying vec3 vObj;',          // 単位ジオメトリ上の位置（0〜1）
'varying vec3 vScl;',          // 建物の寸法
'#endif',
'void main() {',
'    vec3 p = position; vec3 n = normal; vec3 sc = vec3(1.0);',
'    vZs = normal.z;',
'#ifdef USE_INSTANCING',
'    sc = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));',
'    p = (instanceMatrix * vec4(p, 1.0)).xyz; n = mat3(instanceMatrix) * n;',
'#endif',
'    vec4 wp = modelMatrix * vec4(p, 1.0);',
'    vWorld = wp.xyz; vN = n;',
'    float faceW = abs(normal.x) > 0.5 ? sc.z : sc.x;',
'    vFace = abs(normal.y) > 0.5 ? 2.0 : (abs(normal.x) > 0.5 ? 0.0 : 1.0);',
'    vCell = vec2(uv.x * faceW / 3.6, uv.y * sc.y / 3.3);',          // 窓ピッチ 3.6 m、階高 3.3 m
'    vSeed = aSeed; vType = aType; vLit = aLit;',
'#ifdef NEAR',
'    vGH = position.y * sc.y;',
'#endif',
'#ifdef LITBLD',
'    vWall = aWall.xyz; vRoad = aRoad; vL0 = aL0; vL1 = aL1; vL2 = aL2; vObj = position; vScl = sc;',
'#ifdef USE_INSTANCING',
'    vLoc = p - instanceMatrix[3].xyz + vec3(0.0, aWall.w, 0.0);',   // v6.1: 高さは地面基準（屋上・セットバックの部材も）
'#else',
'    vLoc = p;',
'#endif',
'#endif',
'    gl_Position = projectionMatrix * viewMatrix * wp;',
'}'
].join('\n');

var CITY_FRAG = [
'varying vec3 vWorld;',
'varying vec3 vN;',
'varying vec2 vCell;',
'varying float vFace;',
'varying float vSeed;',
'varying float vType;',
'varying float vLit;',
'varying float vZs;',
'#ifdef NEAR',
'varying float vGH;',
'#endif',
'#ifdef LITBLD',
'varying vec3 vWall;',
'varying vec4 vRoad;',
'varying vec4 vL0;',
'varying vec4 vL1;',
'varying vec4 vL2;',
'varying vec3 vLoc;',
'varying vec3 vObj;',
'varying vec3 vScl;',
'uniform vec3 uAmbient;',
'uniform vec3 uLampCol;',
'uniform float uRoadLK;',
'uniform float uStreetLK;',
'uniform float uBldDebug;',
// 足元の街路灯 1 個の照度（距離の 2 乗で減衰、面の向き）
'vec3 streetLamp(vec4 l, vec3 loc, vec3 N) {',
'    if (abs(l.w) < 0.5) return vec3(0.0);',
'    vec3 dl = l.xyz - loc; float d2 = dot(dl, dl);',
'    float c = max(dot(N, dl * inversesqrt(max(d2, 1e-4))), 0.0);',
'    vec3 lc = l.w > 0.0 ? vec3(0.85, 0.92, 1.0) : vec3(1.0, 0.62, 0.25);',
'    return lc * c / (d2 + 6.0);',
'}',
'#endif',
'uniform vec3 uBuilding;',
'uniform float uWinGain;',
NOISE,
FOG,
'#ifdef FADE',
'uniform float uFadeFar;',        // 世界固定の物の表示限界（カメラからの水平距離）。0.8 倍から先でフェード
'float fadeOf(vec3 p) { return 1.0 - smoothstep(0.8 * uFadeFar, uFadeFar, length((p - uCamPos).xz)); }',
'#endif',
// 窓 1 枚ぶん（セル 1 つ）の発光の平均（近くで見た時の窓の明るさ × 窓の面積の割合）。遠くの窓はこの値の平均で描く（v8 前: 窓のかたまりの修正）
'vec3 cellEm(vec2 c) {',
'    float hw = hash12(c * 1.7 + vec2(vSeed * 13.1, vFace * 7.0));',
'    float hf = hash12(vec2(c.y * 0.37, vSeed * 3.3 + vFace));',
'    float r = mix(hw, hf, vType < 0.5 ? 0.72 : 0.22);',
'    float on = step(1.0 - vLit, r);',
'    vec3 cOffice = mix(vec3(0.80, 0.88, 1.0), vec3(1.0, 0.92, 0.74), step(0.65, hash12(c + vSeed * 5.0)));',
'#ifdef NEAR',
'    float isHouse = step(0.5, vType) * (1.0 - step(1.5, vType));',
'    vec3 tint = mix(vec3(1.0, 0.60, 0.30), vec3(1.0, 0.84, 0.62), hash12(c * 4.1 + vSeed));',
'    vec3 wcN = vType < 0.5 ? cOffice : tint;',
'    float brN = 0.16 + 0.34 * hash12(c * 3.1 + vSeed);',
'    float cov = mix(0.56 * 0.42, 0.45 * 0.40, isHouse) * 0.62;',          // 窓の面積 × 窓の中の明るさの平均（上下の明暗・カーテン・窓枠）
'    return wcN * brN * on * cov;',
'#else',
'    vec3 cHome = mix(vec3(1.0, 0.70, 0.40), vec3(1.0, 0.86, 0.62), hash12(c * 2.3 + vSeed));',
'    float bright = 0.35 + 0.9 * hash12(c * 3.1 + vSeed);',
'    return (vType < 0.5 ? cOffice : cHome) * bright * on * (0.56 * 0.42);',
'#endif',
'}',
'void main() {',
'    vec3 N = normalize(vN);',
'    vec3 P = vWorld;',
'    vec2 cell = floor(vCell); vec2 f = fract(vCell);',
'    float leakW = 0.0; vec3 leakC = vec3(0.0); float railHide = 0.0; float offMull = 0.0;',
'    float fp = max(fwidth(vCell.x), fwidth(vCell.y));',           // 1 画素あたりの窓セル数
'    float lod = smoothstep(0.18, 1.1, fp);',                       // 遠いほど平均光に溶かす
'    float hw = hash12(cell * 1.7 + vec2(vSeed * 13.1, vFace * 7.0));',
'    float hf = hash12(vec2(cell.y * 0.37, vSeed * 3.3 + vFace));',  // 階ごとの値（フロア単位でまとまって点く）
'    float floorBias = vType < 0.5 ? 0.72 : 0.22;',
'    float isMansion = step(1.5, vType);',
'    float corridor = isMansion * step(0.5, vZs);',                 // マンションの +z 面 = 開放廊下
'    float r = mix(hw, hf, floorBias);',
'    float on = step(1.0 - vLit, r) * (1.0 - corridor);',
'    float bright = 0.35 + 0.9 * hash12(cell * 3.1 + vSeed);',
'    vec3 cOffice = mix(vec3(0.80, 0.88, 1.0), vec3(1.0, 0.92, 0.74), step(0.65, hash12(cell + vSeed * 5.0)));',
'    vec3 cHome = mix(vec3(1.0, 0.70, 0.40), vec3(1.0, 0.86, 0.62), hash12(cell * 2.3 + vSeed));',
'    vec3 wc = vType < 0.5 ? cOffice : cHome;',
'    float aa = clamp(fp, 0.01, 0.3);',
'    float ax = smoothstep(0.22 - aa, 0.22 + aa, f.x) * (1.0 - smoothstep(0.78 - aa, 0.78 + aa, f.x));',
'    float ay = smoothstep(0.30 - aa, 0.30 + aa, f.y) * (1.0 - smoothstep(0.72 - aa, 0.72 + aa, f.y));',
'    vec3 winEm = wc * (bright * on * ax * ay);',
'#ifdef NEAR',
// 近景の窓: 住宅は壁に対して小さめ（幅 0.45 × 高さ 0.4 セル）。窓枠・中桟の暗い線、カーテン越しの暖色のむら
// （上が明るく下が暗い、窓ごとに色温度と明るさが違う）、消灯窓はガラスにわずかな反射。白飛びしない輝度に抑える
'    float isHouse = step(0.5, vType) * (1.0 - step(1.5, vType));',
'    float wx0 = mix(0.22, 0.275, isHouse), wx1 = mix(0.78, 0.725, isHouse);',
'    float wy0 = mix(0.30, 0.32, isHouse),  wy1 = 0.72;',
'    float axN = smoothstep(wx0 - aa, wx0 + aa, f.x) * (1.0 - smoothstep(wx1 - aa, wx1 + aa, f.x));',
'    float ayN = smoothstep(wy0 - aa, wy0 + aa, f.y) * (1.0 - smoothstep(wy1 - aa, wy1 + aa, f.y));',
'    vec2 wq = vec2((f.x - wx0) / (wx1 - wx0), (f.y - wy0) / (wy1 - wy0));',
'    float detail = 1.0 - smoothstep(0.035, 0.09, fp);',             // 窓 1 枚が十数画素以上のときだけ細部を描く
'    float lw = 0.07;',
'    float frameIn = smoothstep(0.0, lw, wq.x) * smoothstep(0.0, lw, 1.0 - wq.x) * smoothstep(0.0, lw * 1.2, wq.y) * smoothstep(0.0, lw * 1.2, 1.0 - wq.y);',
'    float hWin = hash12(cell * 5.3 + vSeed * 2.1);',
'    float mull = 1.0 - smoothstep(0.018, 0.04, abs(wq.x - 0.5));',
'    float tran = step(0.55, hWin) * (1.0 - smoothstep(0.018, 0.04, abs(wq.y - 0.62)));',   // 十字の中桟の窓もある
'    float glass = mix(1.0, frameIn * (1.0 - max(mull, tran)), detail);',
'    float folds = 0.82 + 0.36 * vnoise(vec2(wq.x * 7.0 + hWin * 31.0, 0.5 + hWin * 9.0));',
'    float grad = mix(0.45, 1.0, smoothstep(0.0, 1.0, wq.y));',
'    vec3 tint = mix(vec3(1.0, 0.60, 0.30), vec3(1.0, 0.84, 0.62), hash12(cell * 4.1 + vSeed));',
'    vec3 wcN = vType < 0.5 ? cOffice : tint;',
'    float brN = 0.16 + 0.34 * hash12(cell * 3.1 + vSeed);',
'    vec3 litWin = wcN * brN * mix(1.0, grad * folds, detail);',
'    vec3 offWin = vec3(0.006, 0.008, 0.012) * (0.4 + wq.y) * detail;',          // 消灯窓: ガラスに空のわずかな反射
'    winEm = mix(offWin, litWin, on) * glass * axN * ayN;',
'#ifdef LITBLD',
// 点灯窓の周り（窓枠の外 0.5〜1 m、特に下の窓台）がほのかに明るい
'    vec2 dOut = vec2(max(max(wx0 - f.x, f.x - wx1), 0.0), max(max(wy0 - f.y, f.y - wy1), 0.0) * (f.y < wy0 ? 0.6 : 1.4));',
'    leakW = on * (1.0 - axN * ayN) * exp(-length(dOut * vec2(3.6, 3.3)) * 2.2) * detail;',
'    leakC = wcN;',
'#endif',
'#endif',
// 遠景（v8 前に修正）: 以前は 2x2 セルのかたまりごとに点灯を決め、かたまり全体を光らせていたため、遠くで「大きな明るい板」が貼り付いて見えた。
// いまは窓 1 枚ずつの点灯のまま、画素の範囲（fwidth）に入る窓の平均の明るさで描く:
//   画素が窓 1 枚より小さい → 窓の形のまま（winEm）、窓 0.5〜3 枚 → 画素の範囲の 4 点の窓の平均、3 枚以上 → 棟の面の 16 枚の窓の平均（一定でちらつかない）
'    vec2 fpv = vec2(max(fwidth(vCell.x), 1e-4), max(fwidth(vCell.y), 1e-4));',
'    vec3 em = winEm;',
'    if (fp > 0.35) {',
'        vec3 farEm;',
'        if (fp < 4.0) farEm = (cellEm(floor(vCell + vec2(-0.25, -0.25) * fpv)) + cellEm(floor(vCell + vec2(0.25, -0.25) * fpv)) +',
'                               cellEm(floor(vCell + vec2(-0.25, 0.25) * fpv)) + cellEm(floor(vCell + vec2(0.25, 0.25) * fpv))) * 0.25;',
'        if (fp > 2.0) {',
'            vec3 meanEm = vec3(0.0);',
'            for (int mi = 0; mi < 4; mi++) for (int mj = 0; mj < 4; mj++) meanEm += cellEm(vec2(float(mi) * 3.0 + 1.0, float(mj) * 2.0 + 1.0));',
'            meanEm *= 1.0 / 16.0;',
'            farEm = fp < 4.0 ? mix(farEm, meanEm, smoothstep(2.0, 4.0, fp)) : meanEm;',
'        }',
'        em = mix(winEm, farEm, smoothstep(0.35, 0.9, fp));',
'    }',
'    em *= uWinGain;',
// マンションの開放廊下: 各階に淡い帯状の明かり＋ 2 セルごとに小さな明るい灯（全階そろって並ぶ）
'    if (corridor > 0.5) {',
'#ifdef NEAR',
// 近景の開放廊下: 各階 = スラブの縁（暗い線）＋手すり壁（腰の高さまで暗い帯）＋開口（奥の廊下の壁が天井灯で淡く照らされる）。
// 灯は天井の小さな点で、灯を中心に横方向へなだらかに減衰。玄関ドアは暗い縦長の矩形。階段室・エレベーター棟は縦の暗い帯
'        float slab = 1.0 - smoothstep(0.06, 0.09, f.y);',
'        float open = smoothstep(0.40, 0.43, f.y) * (1.0 - smoothstep(0.95, 0.98, f.y));',
'        float lxC = mod(vCell.x, 2.0) - 1.0;',                      // 灯（2 セルごと）からの横距離 [セル]
'        float pool = exp(-lxC * lxC * 2.2);',
'        float vert = mix(0.55, 1.0, smoothstep(0.42, 0.95, f.y));',   // 天井近くほど明るい
'        float dmod = mod(vCell.x, 2.0);',
'        float door = step(0.25, dmod) * (1.0 - step(0.50, dmod)) * step(0.45, f.y);',
'        float hFl = hash12(vec2(cell.y * 1.3, vSeed * 0.7));',
'        float lampOn = step(0.06, hash12(vec2(floor(vCell.x * 0.5), cell.y) + vSeed));',   // まれに切れた灯
'        float dimF = 0.75 + 0.5 * hFl;',
'        vec3 cw = vec3(1.0, 0.93, 0.80);',
'        vec3 back = cw * 0.045 * dimF * (0.15 + 0.85 * pool * lampOn) * vert * (1.0 - 0.75 * door);',
'        vec2 ld = vec2(lxC * 14.0, (f.y - 0.93) * 30.0);',
'        float lampPt = exp(-dot(ld, ld)) * lampOn;',
'        vec3 nearC = back * open + cw * lampPt * 0.5;',
'        vec3 parapet = uBuilding * 0.9 + cw * 0.004 * pool * lampOn;',   // 手すり壁: 暗い。上端だけ灯がわずかにかかる
'        nearC += parapet * (1.0 - open) * (1.0 - slab) * smoothstep(0.30, 0.40, f.y);',
'        float shaftA = 1.0 + floor(hash12(vec2(vSeed, 3.0)) * 3.0), shaftB = shaftA + 5.0 + floor(hash12(vec2(vSeed, 7.0)) * 4.0);',
'        float shaft = max(step(abs(cell.x - shaftA), 0.1), step(abs(cell.x - shaftB), 0.1) * step(0.5, hash12(vec2(vSeed, 11.0))));',
'        vec3 shaftC = cw * 0.02 * (1.0 - smoothstep(0.05, 0.12, abs(f.x - 0.5))) * step(0.5, f.y) * (1.0 - step(0.8, f.y));',   // 階段室の細い縦長の窓
'        nearC = mix(nearC, shaftC, shaft);',
'        nearC *= 1.0 - slab;',
'        vec3 farC0 = vec3(0.85, 0.92, 1.0) * (0.012 + 0.05 * step(mod(cell.x, 2.0), 0.5));',
'        em = mix(nearC, farC0, lod) * uWinGain;',
'#else',
'        float band = smoothstep(0.30 - aa, 0.36 + aa, f.y) * (1.0 - smoothstep(0.84 - aa, 0.90 + aa, f.y));',
'        float lx = mod(cell.x, 2.0) < 1.0 ? 1.0 : 0.0;',
'        vec2 dl = vec2((f.x - 0.5) * 9.0, (f.y - 0.84) * 16.0);',
'        float lampDot = lx * exp(-dot(dl, dl) * 1.5);',
'        float dim = 0.7 + 0.6 * hash12(vec2(cell.y, vSeed));',               // 階ごとに少し明るさが違う
'        vec3 cc = vec3(0.85, 0.92, 1.0);',
'        vec3 nearC = cc * (band * 0.022 * dim + lampDot * 0.9);',
'        vec3 farC = cc * (0.012 + 0.05 * lx);',
'        em = mix(nearC, farC, lod) * uWinGain;',
'#endif',
'    }',
'    if (isMansion > 0.5 && abs(vZs) < 0.5) em *= 0.15;',                  // 妻側の壁はほぼ窓なし
'    if (vFace > 1.5) em = vec3(0.0);',
'    vec3 wall = uBuilding * (0.7 + 0.3 * max(N.y, 0.0));',
'#ifdef NEAR',
// 近景: 壁は少し明るく、地面に近いほど街路灯で暖色に照らされる
'    wall = wall * 1.5 + vec3(1.0, 0.62, 0.32) * 0.006 * exp(-vGH / 6.0) * (1.0 - step(1.5, vFace));',
'    if (corridor > 0.5) wall *= lod;',                                 // 近い廊下側は em が構造（スラブ・手すり壁）を描く
'#endif',
'#ifdef LITBLD',
// v6: 近い建物（〜1300 m）は外壁の色に 5 つの光を当てる。遠くは今の暗いシルエットへなだらかに戻す
'    float dCamB = length(P - uCamPos) / clamp(vScl.y / 45.0, 1.0, 2.6);',   // v8 前: 高い棟は見かけが大きいので、近接用の作りを遠くまで（高さ 45 m 超は高さに比例、最大 2.6 倍）
'    float kNear = 1.0 - smoothstep(500.0, 700.0, dCamB);',             // v6.1: 500〜700 m で従来のシルエットへ（遠くの高い棟が白い板に見えないように）
'    if (kNear > 0.001) {',
'        vec3 alb = vWall;',
// 部品の種類: 3 基壇（1 階の店舗・エントランス）、4 パラペット、5 塔屋・室外機、6 架台・アンテナ、7 屋上看板の骨組み
'        if (vType > 3.5 && vType < 4.5) alb = vWall * 0.85;',
'        else if (vType > 4.5 && vType < 5.5) alb = vec3(0.34, 0.35, 0.35) * (0.85 + 0.3 * fract(vSeed * 3.7));',
'        else if (vType > 5.5 && vType < 6.5) alb = vec3(0.13, 0.13, 0.14);',
'        else if (vType > 6.5) alb = vec3(0.08, 0.08, 0.085);',
'        bool roofTop = vFace > 1.5 && N.y > 0.5;',
'        bool houseRoof = vType > 0.5 && vType < 1.5 && vObj.y > 0.73;',
'        if (houseRoof) {',                                                    // 住宅の屋根材: 暗い瓦の灰・えんじ・濃緑・濃紺の金属
'            float hr = fract(vSeed * 7.31);',
'            alb = hr < 0.45 ? vec3(0.24, 0.24, 0.26) : (hr < 0.65 ? vec3(0.40, 0.14, 0.11) : (hr < 0.82 ? vec3(0.14, 0.27, 0.17) : vec3(0.14, 0.19, 0.32)));',
'        } else if (roofTop) {',                                               // 屋上の防水面: 暗い灰緑〜灰色、汚れのむら
'            alb = vec3(0.36, 0.38, 0.35) * (0.75 + 0.5 * vnoise(vLoc.xz * 0.35 + vSeed));',
'        }',
// 2.3 壁の凹凸（近いときだけ。窓 1 枚が十数画素以上の距離）: 棟ごとの外壁の素材、角の柱型、窓の下の雨だれ、基礎まわりの汚れ
'        float dWall = (1.0 - smoothstep(0.04, 0.12, fp)) * step(vFace, 1.5) * (houseRoof ? 0.0 : 1.0);',
'        if (dWall > 0.001 && vType < 3.5) {',
'            float uM = vCell.x * 3.6, vM = vLoc.y;',                              // 面の横方向と高さ [m]
'            float aaM = max(fwidth(uM), 1e-3);',
'            float mat = floor(fract(vSeed * 3.17) * 5.0);',
'            float g = 1.0;',
'            if (mat < 0.5) {',                                                  // タイル: 細かい目地の格子
'                vec2 tq = abs(fract(vec2(uM / 0.45, vM / 0.30)) - 0.5);',
'                g = 1.0 - 0.18 * (1.0 - smoothstep(0.42, 0.48, max(tq.x, tq.y)));',
'            } else if (mat < 1.5) {',                                           // 打放しコンクリート: 型枠の継ぎ目と P コン跡の点列
'                vec2 tq = abs(fract(vec2(uM / 1.8, vM / 0.9)) - 0.5);',
'                g = 1.0 - 0.15 * (1.0 - smoothstep(0.47, 0.495, max(tq.x, tq.y)));',
'                vec2 pq = fract(vec2(uM / 0.6, vM / 0.45)) - 0.5;',
'                g *= 1.0 - 0.25 * (1.0 - smoothstep(0.06, 0.1, length(pq * vec2(0.6, 0.45))));',
'                g *= 0.95 + 0.1 * vnoise(vec2(uM * 0.25, vM * 0.25) + vSeed);',
'            } else if (mat < 2.5) {',                                           // 吹付け: むら
'                g = 0.94 + 0.12 * vnoise(vec2(uM * 0.35, vM * 0.35) + vSeed * 3.0);',
'            } else if (mat < 3.5) {',                                           // 金属パネル: 縦の継ぎ目
'                g = 1.0 - 0.3 * (1.0 - smoothstep(0.0, 0.03 + aaM, abs(fract(uM / 1.2) - 0.5) * 1.2 - 0.57));',
'            } else {',                                                          // ALC: 横目地
'                g = 1.0 - 0.2 * (1.0 - smoothstep(0.0, 0.02 + aaM, abs(fract(vM / 0.6) - 0.5) * 0.6 - 0.28));',
'            }',
// 角の柱型（角から 0.4 m は少し明るい・出っ張り）
'            float edgeU = (0.5 - abs(vObj.x)) * vScl.x, edgeV = (0.5 - abs(vObj.z)) * vScl.z;',            // 単位の箱は -0.5〜0.5
'            float corner = 1.0 - smoothstep(0.35, 0.45, abs(N.x) > 0.5 ? edgeV : edgeU);',
'            g *= 1.0 + 0.12 * corner;',
// 窓の下の雨だれ（窓セルの真ん中から下へ、輪郭はぼかす）と、屋上の縁から垂れる黒ずみ、基礎まわりの汚れ
'            float streakC = 1.0 - smoothstep(0.05, 0.25, abs(f.x - 0.5));',
'            float under = smoothstep(0.32, 0.05, f.y) * streakC * vnoise(vec2(cell.x * 3.1 + vSeed, vM * 0.8));',
'            float topDirt = smoothstep(vScl.y - 3.0, vScl.y, vM) * (0.5 + 0.5 * vnoise(vec2(uM * 0.5, 0.3) + vSeed));',
'            float baseDirt = 1.0 - smoothstep(0.0, 1.6, vM);',
'            g *= 1.0 - 0.25 * under - 0.3 * topDirt - 0.35 * baseDirt;',
// 100 m で読める大きさの階層: 階ごとの打継ぎ（スラブの線）と、2 スパンごとのパネル割り
'            float flY = f.y;',
'            g *= 1.0 - 0.28 * (1.0 - smoothstep(0.0, 0.045 + aa, min(flY, 1.0 - flY)));',
'            g *= 1.0 - 0.15 * (1.0 - smoothstep(0.0, 0.03 + aa, abs(fract(vCell.x * 0.5) - 0.5) * 2.0 - 0.94));',
'#ifdef NEAR',
// 窓台（窓の下の明るい縁）と窓枠の外の影
'            float inWx = step(wx0, f.x) * step(f.x, wx1);',
'            g *= 1.0 + 0.35 * inWx * step(wy0 - 0.07, flY) * step(flY, wy0);',
'            g *= 1.0 - 0.25 * inWx * step(wy1, flY) * step(flY, wy1 + 0.05);',
'            if (vType > 1.5 && vType < 2.5 && vZs < -0.5) {',
// マンションのベランダ側: 各階の手すり壁の明るい帯、スラブ下の影、隣戸との隔て板の縦線
'                float railB = smoothstep(0.02, 0.05, flY) * (1.0 - smoothstep(0.31, 0.35, flY));',
'                g *= 1.0 + 0.30 * railB;',
'                g *= 1.0 - 0.55 * (1.0 - smoothstep(0.0, 0.08, 1.0 - flY));',
'                float divL = 1.0 - smoothstep(0.015, 0.04 + aa, abs(fract(vCell.x * 0.5) - 0.5) * 2.0 - 0.95);',
'                g *= 1.0 - 0.45 * divL * step(0.33, flY);',
'                railHide = railB;',
'            } else if (vType < 0.5) {',
// オフィス: 柱と梁の格子（窓より手前で明るい）、腰壁（スパンドレル）、方立の細い縦線
'                float colm = 1.0 - smoothstep(0.06, 0.1 + aa, min(f.x, 1.0 - f.x));',
'                float beam = 1.0 - smoothstep(0.08, 0.14 + aa, flY);',
'                g *= 1.0 + 0.25 * max(colm, beam);',
'                g *= 1.0 - 0.12 * step(flY, 0.3) * (1.0 - colm);',
'                offMull = 1.0 - smoothstep(0.01, 0.025 + aa, abs(fract(f.x * 3.0) - 0.5) / 3.0 - 0.155);',
'            }',
'#endif',
'            alb *= mix(1.0, g, dWall);',
'        }',
'        vec3 Ls = vec3(0.0);',
// 面の向き: 道路側（towardRoad と同じ向き）・側面・裏面（道路と反対）・屋上で、明るさと色味を変える
'        float upF = max(N.y, 0.0);',
'        vec2 nh = N.xz / max(length(N.xz), 1e-3);',
'        float roadNear = vRoad.z < 170.0 ? 1.0 - smoothstep(110.0, 160.0, vRoad.z) : 0.0;',
'        float faceRoad = dot(nh, vRoad.xy) * (1.0 - upF);',                   // 1 = 道路側、-1 = 裏面
'        float backF = smoothstep(0.2, 0.8, -faceRoad) * roadNear;',
// 5. 空（寒色）と街の光害（暖色、都市の方角を向いた面ほど強い）。裏面は暗い
'        float cdn = cityDens(normalize(vec3(N.x, 0.0, N.z) + vec3(0.0, 0.0, 1e-4)));',
// v6.1: 環境光は弱く（壁の環境光だけで表示 8〜16）、下が明るく上が暗い縦の勾配。光の色で白く洗わない（色味の付いた弱い光だけ）
'        float hUp = vLoc.y;',
'        float vGrad = mix(1.0, 0.55, smoothstep(6.0, 40.0, hUp));',            // 足元の照り返しが届く下ほど明るい
'        vec3 amb = vec3(0.038, 0.048, 0.078) * (0.5 + 0.5 * upF) * mix(vGrad, 1.0, upF);',
'        amb += uGlowCol * (0.045 + 0.085 * cdn) * (1.0 - upF) * vGrad + uGlowCol * 0.036 * upF;',
// 地上の街明かり（路地の街灯・店の明かり）の照り返し: 足元だけ暖かく明るい
'        amb += uLampCol * 0.022 * exp(-max(hUp - 2.0, 0.0) / 14.0) * (1.0 - upF);',
'        Ls += amb * (1.0 - 0.6 * backF);',
// 道路側の面は、照らされた路面と高架からの照り返し（ナトリウム色）を、道路の高さ付近の帯だけ受ける
'        float roadBand = exp(-pow(max(abs(hUp - (vRoad.w + 2.0)) - 4.0, 0.0) / 5.0, 2.0));',
'        Ls += uLampCol * 0.035 * max(faceRoad, 0.0) * roadNear * roadBand;',
// 1. 高速道路の街灯: 道路を高さ (道路 + 11 m) の線光源とみなす。桁の縁で遮られる所は暗い
'        if (vRoad.z < 170.0) {',
'            vec2 tr = vRoad.xy;',
'            float dp = max(2.0, vRoad.z - dot(vLoc.xz, tr));',
'            float hl = vRoad.w + 11.0;',
'            vec3 toL = vec3(tr.x * dp, hl - vLoc.y, tr.y * dp); float rl = length(toL); toL /= rl;',
'            float cl = max(dot(N, toL), 0.0);',
'            float edgeY = hl - (hl - vLoc.y) * (2.35 / dp);',                 // 灯具から点への線が桁の縁（中心から 9.75 m）を通る高さ
'            float occ = smoothstep(vRoad.w + 0.6, vRoad.w + 1.4, edgeY);',
// 灯具は下向き（カットオフ型）なので、壁を照らすのは路面〜灯具の少し下の帯だけ。灯具より上の階はほとんど届かない
'            float hRel = hUp - vRoad.w;',
'            float lampBand = exp(-pow(max(hRel - 7.0, 0.0) / 4.0, 2.0)) * exp(-pow(max(-hRel - 1.0, 0.0) / 6.0, 2.0));',
'            Ls += uLampCol * (0.8 * uRoadLK * cl / rl) * occ * roadNear * lampBand;',
'        }',
// 2. 足元の街路灯・エントランス灯（近い 3 個）: 壁の下部に丸い明かりの溜まり
'        Ls += (streetLamp(vL0, vLoc, N) + streetLamp(vL1, vLoc, N) + streetLamp(vL2, vLoc, N)) * uStreetLK * exp(-max(hUp - 3.0, 0.0) / 5.0);',   // 足元から上へ急に減衰（地上 10〜15 m でほぼ消える）
// 隣の棟の陰（近似）: 棟ごとに片側を決め、面の横方向にその側ほど暗く。下の階ほど強い（実際の隣棟の形は見ていない）
'        float hx = vFace < 0.5 ? vObj.z : vObj.x;',
'        float shSide = fract(vSeed * 3.71) < 0.5 ? hx : -hx;',
'        Ls *= mix(1.0, 0.6 + 0.4 * smoothstep(-0.5, 0.3, shSide), (1.0 - upF) * (0.5 + 0.5 * (1.0 - smoothstep(5.0, 30.0, hUp))) * step(0.5, fract(vSeed * 7.13) + 0.2));',
'        Ls *= 1.0 - 0.2 * upF;',                                                // 屋上は少し抑える（表示 8〜14）
'        vec3 litW = alb * Ls;',
// 明るさの上限: 漸近値 線形 0.16（表示で 105 前後 = 路面の光だまり）。芯で表示 95 前後まで許す
'        litW = litW / (1.0 + litW / 0.16);',
// 250〜700 m は 6 割、700〜1300 m で従来の暗いシルエットへ
'        litW *= mix(1.0, 0.35, smoothstep(250.0, 500.0, dCamB));',          // 250 m を超えたら落とす
'#ifndef NEAR',
'        litW *= 0.3;',                                                         // 街区（500 m 以遠の棟）の壁は v5 とほぼ同じ暗さ（色と屋上の部品だけ残す）
'#endif',
'        if (uBldDebug > 0.0) litW = vec3(uBldDebug);',
'        wall = mix(wall, litW, kNear);',
// 3. 窓の周りの漏れ光
'        em += leakC * leakW * 0.035 * kNear;',
'        em *= 1.0 - 0.85 * railHide;',                                        // ベランダの手すり壁が窓の下部を隠す
'        em *= 1.0 - 0.7 * offMull;',                                             // オフィスの方立
'        if (vType < 0.5) em *= mix(1.0, 0.45, step(0.62, fract(sin(dot(floor(vCell), vec2(12.9, 78.2)) + vSeed) * 43758.5)) * step(0.55, f.y));',   // ブラインドが半分下りている窓
'        if (vType > 3.5) em = vec3(0.0);',                                    // 屋上の部品に窓は無い
'        if (vType > 2.5 && vType < 3.5 && vFace < 1.5) {',                    // 基壇: 1 階の大きなガラス面（明るい）と、上の看板の帯（色面だけ、文字なし）
'            float gy = vObj.y;',
'            float pil = 1.0 - smoothstep(0.04, 0.07, abs(fract(vCell.x) - 0.5) * 0.5 - 0.0);',
'            float glassB = step(0.06, gy) * (1.0 - step(0.68, gy)) * (1.0 - step(0.47, abs(fract(vCell.x) - 0.5)));',
'            float lit3 = step(0.35, fract(vSeed * 5.3 + floor(vCell.x) * 0.37));',
'            vec3 shopC = mix(vec3(1.0, 0.86, 0.66), vec3(0.85, 0.93, 1.0), step(0.5, fract(vSeed * 2.9)));',
'            em = shopC * glassB * lit3 * 0.30 * (0.7 + 0.3 * gy);',
'            float sc3 = fract(vSeed * 9.1);',
'            vec3 signC = sc3 < 0.25 ? vec3(0.9, 0.18, 0.12) : (sc3 < 0.5 ? vec3(0.15, 0.35, 0.9) : (sc3 < 0.7 ? vec3(0.15, 0.7, 0.3) : vec3(0.9, 0.9, 0.85)));',
'            float band = step(0.76, gy) * (1.0 - step(0.93, gy));',
'            em += signC * band * 0.16 * step(0.4, fract(vSeed * 4.1));',
'            em *= kNear;',
'        }',
'    }',
'#endif',
'#ifdef FADE',
'    float fd = fadeOf(P);',
'    em *= fd;',
'#endif',
'    vec3 col = wall + em;',
'    col = applyFogP(col, P);',
'#ifdef FADE',
'    col = mix(fogColor(normalize(P - uCamPos)), col, fd);',          // 壁は霧の色へ溶ける（輪郭ごと消える）
'#endif',
'    gl_FragColor = vec4(col, 1.0);',
'}'
].join('\n');

// --- 流れ星（細長いビルボード） ---------------------------------------------------
var METEOR_VERT = [
'varying vec2 vUv;',
'void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }'
].join('\n');
var METEOR_FRAG = [
'varying vec2 vUv;',
'uniform float uI;',
'void main() {',
'    float t = vUv.x;',                          // 1 = 先頭
'    float w = abs(vUv.y - 0.5) * 2.0;',
'    float a = pow(t, 3.0) * exp(-w * w * 6.0) * (1.0 - smoothstep(0.6, 1.0, w));',
'    gl_FragColor = vec4(vec3(0.9, 0.95, 1.0) * a * uI, 1.0);',
'}'
].join('\n');

// --- 最終パス: ビネット + 粒状 --------------------------------------------------
// --- 飛行機の灯火・観覧車の電飾（世界座標の点）。aSize > 0 = 実寸 [m]（1 画素未満は面積比で暗く）、aSize < 0 = 画素の大きさ固定 ---
var SKYPT_VERT = [
FOG,
'attribute vec3 aCol;',
'attribute float aSize;',
'uniform float uPxK;',
'uniform float uPointMax;',
'varying vec3 vCol;',
'varying float vSoft;',
'void main() {',
'    vec4 wp = modelMatrix * vec4(position, 1.0);',
'    float dist = length(wp.xyz - uCamPos);',
'    vec3 col = aCol * (1.0 - fogAmount(wp.xyz));',
'    float sz;',
'    if (aSize < 0.0) sz = -aSize;',
'    else { float szN = aSize * uPxK / max(dist, 1.0); sz = max(szN, 1.0); col *= min(szN * szN, 1.0); }',
'    sz = min(sz, uPointMax);',
'    gl_PointSize = sz;',
'    vSoft = clamp((sz - 1.0) * 0.5, 0.0, 1.0);',
'    vCol = col;',
'    gl_Position = projectionMatrix * viewMatrix * wp;',
'}'
].join('\n');
var SKYPT_FRAG = [
'varying vec3 vCol;',
'varying float vSoft;',
'void main() {',
'    float r = length(gl_PointCoord - 0.5) * 2.0;',
'    float a = mix(1.0, exp(-r * r * 3.0) * (1.0 - smoothstep(0.7, 1.0, r)), vSoft);',
'    gl_FragColor = vec4(vCol * a, 1.0);',
'}'
].join('\n');

// --- パチンコ店のネオン看板（R = 赤のネオン、B = 2 色目のネオン、G = 縁の電球） ---
// 赤のネオンは 8 秒周期: 文字の並び順に 2.4 秒かけて灯り、3 秒点灯、3 回点滅、点灯。袖看板の 1 文字はときどき切れかかってちらつく。
// 電球は 3 個に 1 個が流れる（8 秒ごとに全体の点滅と交互）
var PACHI_VERT = [
'varying vec2 vUv;',
'varying vec3 vWp;',
'void main() { vUv = uv; vec4 wp = modelMatrix * vec4(position, 1.0); vWp = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }'
].join('\n');
var PACHI_FRAG = [
FOG,
'varying vec2 vUv;',
'varying vec3 vWp;',
'uniform sampler2D uTex;',
'uniform float uTime, uPh, uVert, uAsp, uM, uNB;',
'uniform vec3 uColA, uColB, uBulb;',
'float h1(float n) { return fract(sin(n * 12.9898) * 43758.5453); }',
'void main() {',
'    vec4 tx = texture2D(uTex, vUv);',
'    float tt = uTime + uPh * 37.0;',
'    float ax = uVert > 0.5 ? 1.0 - vUv.y : vUv.x / 0.5;',                        // 読む順（袖看板は上から、屋上の看板は左の「パチンコ」）
'    float p = mod(tt, 8.0);',
'    float litA = p < 2.4 ? step(ax * 2.2, p) : (p > 5.4 && p < 6.6 ? step(fract((p - 5.4) / 0.4), 0.55) : 1.0);',
'    if (uVert > 0.5) {',
'        float seg = floor(h1(uPh * 7.0) * 4.0), inSeg = step(abs(floor((ax - 0.08) / 0.207) - seg), 0.1);',
'        float burst = step(0.72, h1(floor(tt / 2.5) + uPh * 13.0));',
'        litA *= 1.0 - 0.92 * inSeg * burst * step(0.45, h1(floor(tt * 14.0) + uPh));',
'    }',
'    vec2 q = vUv * vec2(uAsp, 1.0) - uM; float W = uAsp - 2.0 * uM, H = 1.0 - 2.0 * uM;',
'    float dB = abs(q.y), dR = abs(q.x - W), dT = abs(q.y - H), dL = abs(q.x), mn = min(min(dB, dR), min(dT, dL));',
'    float per = mn == dB ? q.x : (mn == dR ? W + q.y : (mn == dT ? W + H + (W - q.x) : 2.0 * W + H + (H - q.y)));',
'    float idx = floor(clamp(per / (2.0 * (W + H)), 0.0, 0.9999) * uNB);',
'    float bOn = mod(floor(tt / 8.0), 2.0) < 0.5 ? step(fract((idx - floor(tt * 7.0)) / 3.0), 0.34) : step(fract(tt * 1.6), 0.5);',
'    float bulb = tx.g * (0.07 + 0.93 * bOn);',
'    vec3 col = vec3(0.006, 0.005, 0.006) + tx.r * litA * uColA + tx.b * uColB * (0.9 + 0.1 * sin(tt * 1.3)) + bulb * uBulb;',
'    gl_FragColor = vec4(applyFogP(col, vWp), 1.0);',
'}'
].join('\n');

var UFO_VERT = [
'varying vec3 vL;',
'varying vec3 vW;',
'varying vec3 vN;',
'void main() { vL = position; vec4 wp = modelMatrix * vec4(position, 1.0); vW = wp.xyz; vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * viewMatrix * wp; }'
].join('\n');
var UFO_FRAG = [
FOG,
'uniform vec3 uAmbient;',
'uniform float uTime;',
'varying vec3 vL;',
'varying vec3 vW;',
'varying vec3 vN;',
'vec3 hsv(float h, float s, float v) { vec3 k = clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0); return v * mix(vec3(1.0), k, s); }',
'void main() {',
'    float r = length(vL.xz), a = atan(vL.z, vL.x), y = vL.y, T = 6.2831853;',
'    vec3 V = normalize(uCamPos - vW), N = normalize(vN); if (dot(N, V) < 0.0) N = -N;',
'    float fr = max(fwidth(r), 1e-3);',
'    vec3 alb = vec3(0.10, 0.105, 0.115);',
'    float pl = 1.0 - smoothstep(0.0, 0.08 + fr, abs(fract(r / 4.0) - 0.5) * 4.0);',
'    float rl = 1.0 - smoothstep(0.0, 0.05 + fr / max(r, 1.0), abs(fract(a / T * 48.0) - 0.5) / 48.0 * T);',
'    alb *= 1.0 - 0.35 * max(pl, rl * step(6.0, r));',
'    vec3 col = alb * (uAmbient * 2.0 + vec3(0.05, 0.06, 0.08));',
'    col += fogColor(reflect(-V, N)) * 0.35 * (0.2 + 0.8 * pow(1.0 - max(dot(N, V), 0.0), 3.0));',
'    vec3 em = vec3(0.0);',
'    if (y < -0.3) {',
'        em += vec3(1.7, 2.0, 2.6) * 2.6 * (1.0 - smoothstep(5.0, 11.0, r));',
'        for (int k = 0; k < 4; k++) {',
'            float R = 16.0 + 12.0 * float(k), ring = 1.0 - smoothstep(0.7, 1.3, abs(r - R));',
'            float n = floor(R * T / 3.2), sp = (k == 1 || k == 3) ? -0.06 : 0.05;',
'            float f = a / T * n + uTime * sp * n, id = floor(f);',
'            float lamp = 1.0 - smoothstep(0.22, 0.42, abs(fract(f) - 0.5));',
'            vec3 c = hsv(fract(id * 0.137 + float(k) * 0.25 + uTime * 0.07), 0.65, 1.0);',
'            em += c * 2.4 * ring * lamp;',
'        }',
'        em += vec3(0.5, 0.6, 0.9) * 0.15 * smoothstep(60.0, 20.0, r);',
'    }',
'    if (abs(y) < 1.5 && r > 57.0) {',
'        float d = fract(a / T * 60.0 - uTime * 0.5);',
'        em += vec3(2.6, 2.0, 1.3) * 1.8 * (1.0 - smoothstep(0.45, 0.6, d));',
'    }',
'    if (y > 0.5) {',
'        float wr = 1.0 - smoothstep(0.6, 1.0, abs(r - 31.0) / 1.6);',
'        float wa = 1.0 - smoothstep(0.30, 0.40, abs(fract(a / T * 72.0) - 0.5));',
'        em += vec3(1.0, 0.75, 0.45) * 0.9 * wr * wa;',
'        em += vec3(2.5, 0.12, 0.06) * (1.0 - smoothstep(1.0, 2.0, r)) * step(0.5, fract(uTime * 0.8));',
'    }',
'    col += em;',
'    gl_FragColor = vec4(applyFogP(col, vW), 1.0);',
'}'
].join('\n');
var UFO_HALO_VERT = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
var UFO_HALO_FRAG = [
'varying vec2 vUv;',
'uniform float uI;',
'uniform float uKind;',
'void main() {',
'    vec2 q = vUv * 2.0 - 1.0; float r2 = dot(q, q);',
'    float a = uKind < 0.5 ? exp(-r2 * 9.0) + 0.25 * exp(-r2 * 2.5) : exp(-r2 * 3.0) * (1.0 + 0.25 * sin(sqrt(r2) * 40.0));',
'    a *= 1.0 - smoothstep(0.85, 1.0, sqrt(r2));',
'    vec3 c = uKind < 0.5 ? vec3(0.55, 0.70, 1.0) : vec3(0.65, 0.80, 1.0);',
'    gl_FragColor = vec4(c * a * uI, 1.0);',
'}'
].join('\n');

var KAIJU_VERT = [
'attribute float aPlate;',
'attribute vec4 aPN;',
'varying vec3 vW;',
'varying vec3 vN;',
'varying vec3 vL;',
'varying float vP;',
'uniform float uTime, uNeck, uHeadP, uJaw, uSwayA, uWalk, uWalkA, uLead, uExt, uSweep;',
'uniform float uTailA[7];',
'uniform vec2 uTailP[7];',
'vec3 ry(vec3 p, float a) { float cs = cos(a), sn = sin(a); return vec3(p.x * cs + p.z * sn, p.y, -p.x * sn + p.z * cs); }',
'vec3 rx(vec3 p, vec3 c, float a) { p -= c; float cs = cos(a), sn = sin(a); return c + vec3(p.x, p.y * cs - p.z * sn, p.y * sn + p.z * cs); }',
'vec3 rxn(vec3 n, float a) { float cs = cos(a), sn = sin(a); return vec3(n.x, n.y * cs - n.z * sn, n.y * sn + n.z * cs); }',
'void main() {',
'    vL = position; vP = aPlate;',
'    vec3 p = position, n = normal;',
'    if (aPlate >= 0.0) p += aPN.xyz * (aPN.w * (smoothstep(uSweep - 0.02, uSweep + 0.04, aPlate) * uExt - 0.35) * (1.0 + 0.06 * uExt * sin(uTime * 9.0 + aPlate * 31.0)));',
'    float w1 = smoothstep(57.0, 70.0, p.y) * (1.0 - smoothstep(9.0, 12.5, abs(p.x)) * step(5.0, p.z));',
'    float w2 = smoothstep(71.0, 75.5, p.y) * smoothstep(8.0, 13.0, p.z);',
'    float wj = w2 * (1.0 - smoothstep(75.6, 76.6, p.y)) * smoothstep(16.5, 19.5, p.z);',
'    p = rx(p, vec3(0.0, 76.0, 16.0), uJaw * wj); n = rxn(n, uJaw * wj);',
'    p = rx(p, vec3(0.0, 74.0, 12.0), uHeadP * w2); n = rxn(n, uHeadP * w2);',
'    p = rx(p, vec3(0.0, 59.0, 2.0), uNeck * w1); n = rxn(n, uNeck * w1);',
'    float sd = sign(position.x), wl = (1.0 - smoothstep(27.0, 36.0, position.y)) * smoothstep(4.0, 7.0, abs(position.x)) * smoothstep(-13.0, -7.0, position.z);',
'    float ph = uWalk + (sd > 0.0 ? 0.0 : 3.14159), la = 0.32 * sin(ph) * uWalkA * wl;',
'    p = rx(p, vec3(0.0, 33.0, -2.0), la); n = rxn(n, la);',
'    p.y += 3.5 * max(0.0, cos(ph)) * uWalkA * wl * (1.0 - smoothstep(4.0, 30.0, position.y));',
'    p.y += 1.2 * (0.5 - abs(sin(uWalk))) * uWalkA * (1.0 - wl);',
'    p.x += 2.0 * sin(uWalk) * uWalkA * smoothstep(25.0, 85.0, position.y) * step(-14.0, position.z);',
'    float wt = clamp((-position.z - 10.0) / 125.0, 0.0, 1.0);',
'    p.x += pow(wt, 1.5) * 14.0 * sin(uTime * 0.55 - wt * 2.6) * uSwayA;',
'    p.y += pow(wt, 2.0) * 2.5 * sin(uTime * 0.4 - wt * 2.0 + 1.3) * uSwayA;',
'    if (wt > 0.0) {',
'        float tf = wt * 6.0, ta = 0.0; vec2 tc = uTailP[0];',
'        for (int i = 0; i < 6; i++) { if (float(i) <= tf) { float fr = clamp(tf - float(i), 0.0, 1.0); ta = mix(uTailA[i], uTailA[i + 1], fr); tc = mix(uTailP[i], uTailP[i + 1], fr); } }',
'        vec3 dd = ry(vec3(p.x, 0.0, p.z + 10.0 + wt * 125.0), ta); p.x = tc.x + dd.x; p.z = tc.y + dd.z; n = ry(n, ta);',
'    }',
'    float wl2 = smoothstep(38.0, 62.0, position.y) * step(-14.0, position.z);',
'    p = ry(p, uLead * wl2); n = ry(n, uLead * wl2);',
'    float wu = smoothstep(20.0, 85.0, position.y) * step(-14.0, position.z);',
'    p.x += wu * 1.4 * sin(uTime * 0.37) * uSwayA;',
'    float wb = smoothstep(22.0, 40.0, position.y) * (1.0 - smoothstep(58.0, 66.0, position.y)) * step(-14.0, position.z);',
'    p.xz *= 1.0 + wb * 0.018 * sin(uTime * 1.25) * uSwayA;',
'    vec4 wp = modelMatrix * vec4(p, 1.0); vW = wp.xyz; vN = normalize(mat3(modelMatrix) * n); gl_Position = projectionMatrix * viewMatrix * wp;',
'}'
].join('\n');
var KAIJU_FRAG = [
NOISE,
FOG,
'uniform vec3 uAmbient;',
'uniform float uTime, uSweep, uGlow, uBeam, uAppear;',
'uniform vec3 uMouth, uFirePos;',
'uniform float uFireI;',
'varying vec3 vW;',
'varying vec3 vN;',
'varying vec3 vL;',
'varying float vP;',
'void main() {',
'    vec3 V = normalize(uCamPos - vW), N = normalize(vN); if (dot(N, V) < 0.0) N = -N;',
'    float sk = vnoise(vL.xz * 0.35 + vec2(vL.y * 0.3, 0.0)) * 0.6 + vnoise(vL.xy * 1.3 + 7.0) * 0.4;',
'    vec3 alb = vec3(0.030, 0.029, 0.027) * (0.55 + 0.9 * sk) * (vP >= 0.0 ? 1.9 : 1.0);',
'    vec3 col = alb * (uAmbient * 2.0 + vec3(0.05, 0.045, 0.04)) + fogColor(normalize(vec3(N.x, max(N.y, -0.2), N.z))) * alb * 6.0;',
'    col += fogColor(reflect(-V, N)) * 0.08 * pow(1.0 - max(dot(N, V), 0.0), 3.0);',
'    if (vP >= 0.0) {',
'        float lit = smoothstep(uSweep - 0.05, uSweep + 0.01, vP);',
'        float fl = 0.75 + 0.25 * sin(uTime * 23.0 + vP * 40.0) + 0.15 * sin(uTime * 57.0 + vP * 13.0);',
'        col += vec3(0.25, 0.75, 2.6) * 2.4 * lit * uGlow * fl;',
'    }',
'    float dm = length(vL - uMouth);',
'    col += vec3(0.4, 0.8, 2.5) * uBeam * (3.0 * exp(-dm * dm / 60.0) + 0.05);',
'    col += vec3(1.0, 0.45, 0.12) * 0.3 * uFireI * max(dot(N, normalize(uFirePos - vW)), 0.0) * (0.4 + 0.6 * sk);',
'    col = applyFogP(col, vW);',
'    col = mix(fogColor(normalize(vW - uCamPos)), col, uAppear);',
'    gl_FragColor = vec4(col, 1.0);',
'}'
].join('\n');
var KBEAM_VERT = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0); }';
var KBEAM_FRAG = [
'varying vec2 vUv;',
'uniform float uTime, uGrow, uI;',
'void main() {',
'    float a = vUv.x, v = vUv.y;',
'    if (a > uGrow) discard;',
'    float core = exp(-v * v / 0.010), glow = exp(-v * v / 0.16), halo = exp(-v * v / 0.6);',
'    float n = 0.75 + 0.25 * sin(a * 90.0 - uTime * 80.0) + 0.15 * sin(a * 233.0 - uTime * 140.0);',
'    float tip = 1.0 + 1.5 * exp(-(uGrow - a) * (uGrow - a) / 0.0004) * step(uGrow, 0.999);',
'    vec3 c = vec3(4.0, 5.5, 8.0) * core + vec3(0.25, 0.65, 2.3) * glow * n + vec3(0.05, 0.12, 0.45) * halo;',
'    gl_FragColor = vec4(c * uI * tip * smoothstep(0.0, 0.02, a), 1.0);',
'}'
].join('\n');
var KGLOW_FRAG = [
'varying vec2 vUv;',
'uniform float uI, uK;',
'uniform vec3 uCol;',
'void main() {',
'    vec2 q = vUv * 2.0 - 1.0; float r2 = dot(q, q);',
'    float a = (exp(-r2 * uK) + 0.2 * exp(-r2 * 2.0)) * (1.0 - smoothstep(0.85, 1.0, sqrt(r2)));',
'    gl_FragColor = vec4(uCol * a * uI, 1.0);',
'}'
].join('\n');
var KPART_VERT = [
'attribute vec4 iA;',
'attribute vec4 iB;',
'varying vec2 vUv;',
'varying vec4 vB;',
'varying vec3 vW;',
'void main() {',
'    vUv = uv; vB = iB; vW = iA.xyz;',
'    vec4 mv = viewMatrix * vec4(iA.xyz, 1.0);',
'    float an = iB.z * 6.2832;',
'    vec2 p = mat2(cos(an), sin(an), -sin(an), cos(an)) * position.xy;',
'    mv.xy += p * iA.w;',
'    gl_Position = projectionMatrix * mv;',
'}'
].join('\n');
var KPART_FRAG = [
NOISE,
FOG,
'uniform float uAdd, uTime;',
'varying vec2 vUv;',
'varying vec4 vB;',
'varying vec3 vW;',
'void main() {',
'    vec2 q = vUv * 2.0 - 1.0; float r = length(q);',
'    float n = vnoise(vUv * 3.0 + vB.z * 17.0 + uTime * 0.15) * 0.6 + vnoise(vUv * 7.0 - vB.z * 9.0) * 0.4;',
'    float sh = 1.0 - smoothstep(0.35, 1.0, r + (n - 0.5) * 0.55);',
'    float tr = 1.0 - fogAmount(vW);',
'    if (uAdd > 0.5) {',
'        float T = vB.x;',
'        vec3 c = mix(vec3(0.5, 0.07, 0.01), vec3(2.6, 1.15, 0.30), T) + vec3(5.0, 4.0, 3.0) * T * T * T * (1.0 - smoothstep(0.0, 0.7, r));',
'        gl_FragColor = vec4(c * sh * vB.y * tr, 1.0);',
'    } else {',
'        vec3 c = vec3(0.045, 0.04, 0.036) * (0.7 + 0.6 * n) + vec3(1.0, 0.36, 0.08) * 0.5 * vB.x * (0.3 + 0.7 * (1.0 - vUv.y)) * (0.6 + 0.8 * n);',
'        c = mix(fogColor(normalize(vW - uCamPos)), c, tr);',
'        gl_FragColor = vec4(c, sh * vB.y);',
'    }',
'}'
].join('\n');

var FINAL_VERT = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }';
var FINAL_FRAG = [
'varying vec2 vUv;',
'uniform sampler2D tDiffuse;',
'uniform float uTime;',
'uniform float uVignette;',
'uniform float uGrain;',
'void main() {',
'    vec4 c = texture2D(tDiffuse, vUv);',
'    vec2 q = vUv - 0.5;',
'    float v = 1.0 - uVignette * smoothstep(0.25, 0.95, dot(q, q) * 1.9);',
'    float n = fract(sin(dot(vUv * vec2(1231.7, 977.3) + fract(uTime) * 13.0, vec2(12.9898, 78.233))) * 43758.5453);',
'    c.rgb = c.rgb * v + (n - 0.5) * uGrain;',
'    gl_FragColor = c;',
'}'
].join('\n');

// --- 地面の光だまり（街路灯の真下の水平な円盤、加算） ------------------------------
var POOL_VERT = [
'attribute vec3 aPoolCol;',
'varying vec3 vCol;',
'varying vec2 vL;',
'varying vec3 vW;',
'void main() {',
'    vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);',
'    vL = position.xz; vCol = aPoolCol; vW = wp.xyz;',
'    gl_Position = projectionMatrix * viewMatrix * wp;',
'}'
].join('\n');
var POOL_FRAG = [
'varying vec3 vCol;',
'varying vec2 vL;',
'varying vec3 vW;',
'uniform float uPoolGain;',
FOG,
'#ifdef FADE',
'uniform float uFadeFar;',        // 世界固定の物の表示限界（カメラからの水平距離）。0.8 倍から先でフェード
'float fadeOf(vec3 p) { return 1.0 - smoothstep(0.8 * uFadeFar, uFadeFar, length((p - uCamPos).xz)); }',
'#endif',
'void main() {',
'    float r2 = dot(vL, vL);',
'    float f = max(1.0 - r2, 0.0); f *= f;',                        // 中心から外へ 2 乗で減衰
'    vec3 col = vCol * (f * uPoolGain) * (1.0 - fogAmount(vW));',
'#ifdef FADE',
'    col *= fadeOf(vW);',
'#endif',
'    gl_FragColor = vec4(col, 1.0);',
'}'
].join('\n');

// --- ブルーム（13 タップ縮小＋テント拡大。丸く広がり、打ち切りカーネルの四角が出ない） ----------
var BLOOM_VERT = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
// 13 タップの縮小（Jimenez 2014）。PREFILTER のときは各 4 タップ群を Karis 平均（1/(1+輝度) の重み）し、
// 輝度の頭打ちとソフトニー付き閾値で明部だけを取り出す
var BLOOM_DOWN = [
'varying vec2 vUv;',
'uniform sampler2D tSrc;',
'uniform vec2 uTexel;',
'uniform float uThreshold;',
'uniform float uKnee;',
'uniform float uClamp;',
'vec3 tap(vec2 o) {',
'    vec3 c = texture2D(tSrc, vUv + o * uTexel).rgb;',
'#ifdef PREFILTER',
// NaN / Inf を除く（1 画素でも NaN があると縮小・拡大の段を通って画面全体が 1 フレーム化ける）
'    c.r = (c.r >= 0.0 || c.r < 0.0) ? c.r : 0.0;',
'    c.g = (c.g >= 0.0 || c.g < 0.0) ? c.g : 0.0;',
'    c.b = (c.b >= 0.0 || c.b < 0.0) ? c.b : 0.0;',
'    c = clamp(c, vec3(0.0), vec3(60000.0));',
'    float m = max(c.r, max(c.g, c.b));',
'    c *= min(1.0, uClamp / max(m, 1e-4));',                       // 輝度の頭打ち
'#endif',
'    return c;',
'}',
'float lum(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }',
'void main() {',
'    vec3 a = tap(vec2(-2.0, 2.0)), b = tap(vec2(0.0, 2.0)), c = tap(vec2(2.0, 2.0));',
'    vec3 d = tap(vec2(-2.0, 0.0)), e = tap(vec2(0.0, 0.0)), f = tap(vec2(2.0, 0.0));',
'    vec3 g = tap(vec2(-2.0, -2.0)), h = tap(vec2(0.0, -2.0)), i = tap(vec2(2.0, -2.0));',
'    vec3 j = tap(vec2(-1.0, 1.0)), k = tap(vec2(1.0, 1.0)), l = tap(vec2(-1.0, -1.0)), m = tap(vec2(1.0, -1.0));',
'    vec3 g0 = (j + k + l + m) * 0.25;',
'    vec3 g1 = (a + b + d + e) * 0.25, g2 = (b + c + e + f) * 0.25, g3 = (d + e + g + h) * 0.25, g4 = (e + f + h + i) * 0.25;',
'#ifdef PREFILTER',
'    float w0 = 0.5 / (1.0 + lum(g0)), w1 = 0.125 / (1.0 + lum(g1)), w2 = 0.125 / (1.0 + lum(g2)), w3 = 0.125 / (1.0 + lum(g3)), w4 = 0.125 / (1.0 + lum(g4));',
'    vec3 col = (g0 * w0 + g1 * w1 + g2 * w2 + g3 * w3 + g4 * w4) / (w0 + w1 + w2 + w3 + w4);',
// ソフトニー付き閾値
'    float br = max(col.r, max(col.g, col.b));',
'    float rq = clamp(br - uThreshold + uKnee, 0.0, 2.0 * uKnee);',
'    rq = rq * rq / (4.0 * uKnee + 1e-4);',
'    col *= max(rq, br - uThreshold) / max(br, 1e-4);',
'#else',
'    vec3 col = g0 * 0.5 + (g1 + g2 + g3 + g4) * 0.125;',
'#endif',
'    gl_FragColor = vec4(max(col, vec3(0.0)), 1.0);',
'}'
].join('\n');
// 3x3 テント（9 タップ）で小さい段を拡大して、1 つ上の段へ加算（加算合成で描く）
var BLOOM_UP = [
'varying vec2 vUv;',
'uniform sampler2D tSrc;',
'uniform vec2 uTexel;',
'uniform float uRadius;',
'void main() {',
'    vec2 o = uTexel * uRadius;',
'    vec3 s = texture2D(tSrc, vUv).rgb * 4.0;',
'    s += (texture2D(tSrc, vUv + vec2(-o.x, 0.0)).rgb + texture2D(tSrc, vUv + vec2(o.x, 0.0)).rgb + texture2D(tSrc, vUv + vec2(0.0, -o.y)).rgb + texture2D(tSrc, vUv + vec2(0.0, o.y)).rgb) * 2.0;',
'    s += texture2D(tSrc, vUv + vec2(-o.x, -o.y)).rgb + texture2D(tSrc, vUv + vec2(o.x, -o.y)).rgb + texture2D(tSrc, vUv + vec2(-o.x, o.y)).rgb + texture2D(tSrc, vUv + vec2(o.x, o.y)).rgb;',
'    gl_FragColor = vec4(s / 16.0, 1.0);',
'}'
].join('\n');
// 合成: 元画像 + bloomStrength × テント拡大した 1/2 解像度のブルーム
var BLOOM_COMP = [
'varying vec2 vUv;',
'uniform sampler2D tDiffuse;',
'uniform sampler2D tBloom;',
'uniform vec2 uTexel;',
'uniform float uStrength;',
'void main() {',
'    vec2 o = uTexel;',
'    vec3 s = texture2D(tBloom, vUv).rgb * 4.0;',
'    s += (texture2D(tBloom, vUv + vec2(-o.x, 0.0)).rgb + texture2D(tBloom, vUv + vec2(o.x, 0.0)).rgb + texture2D(tBloom, vUv + vec2(0.0, -o.y)).rgb + texture2D(tBloom, vUv + vec2(0.0, o.y)).rgb) * 2.0;',
'    s += texture2D(tBloom, vUv + vec2(-o.x, -o.y)).rgb + texture2D(tBloom, vUv + vec2(o.x, -o.y)).rgb + texture2D(tBloom, vUv + vec2(-o.x, o.y)).rgb + texture2D(tBloom, vUv + vec2(o.x, o.y)).rgb;',
'    vec4 c = texture2D(tDiffuse, vUv);',
'    gl_FragColor = vec4(c.rgb + s / 16.0 * uStrength, c.a);',
'}'
].join('\n');

// --- 線路の路盤（盛土＋砕石＋枕木＋レール 4 本。1 本の線路 = 1 インスタンス、長さ uLen） ------------------
// 単位ジオメトリ: x = 横（-6〜6 m）、y = 高さ、z = 0〜1（インスタンスの z 拡大で線路の長さ）
var RAILBED_VERT = [
'attribute float aFadeL;',
'varying vec3 vWorld;',
'varying vec2 vRB;',             // x = 横 [m]、y = 線路の始点からの距離 [m]
'varying float vLen;',
'void main() {',
'    float len = length(instanceMatrix[2].xyz);',
'    vRB = vec2(position.x, position.z * len); vLen = len;',
'    vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);',
'    vWorld = wp.xyz;',
'    gl_Position = projectionMatrix * viewMatrix * wp;',
'}'
].join('\n');
var RAILBED_FRAG = [
'varying vec3 vWorld;',
'varying vec2 vRB;',
'varying float vLen;',
'uniform vec3 uAmbient;',
'uniform vec3 uUnder;',
NOISE,
FOG,
'uniform float uFadeFar;',
'void main() {',
'    vec3 P = vWorld;',
'    float e = vRB.x, a = vRB.y, ae = abs(e);',
'    float aaE = max(fwidth(e), 1e-3), aaA = max(fwidth(a), 1e-3);',
// 盛土の法面（|e| > 4.5）は土、上面は砕石。砕石は細かい粒の濃淡
'    float grit = vnoise(vec2(e * 6.0, a * 6.0)) * 0.6 + vnoise(vec2(e * 1.3, a * 0.7)) * 0.4;',
'    vec3 alb = mix(vec3(0.030, 0.028, 0.026), vec3(0.045, 0.041, 0.036), grit);',
'    alb = mix(alb, vec3(0.018, 0.017, 0.013), smoothstep(4.4, 4.7, ae));',
'    float lum = 0.0;',
'    for (int k = 0; k < 2; k++) {',
'        float c = k == 0 ? -2.0 : 2.0;',
'        float de = abs(e - c);',
// 枕木（0.6 m ごと、幅 0.24 m、長さ 2.4 m）。細かすぎる距離では平均色に溶かす
'        float sl = smoothstep(0.0, aaA, 0.12 - abs(fract(a / 0.6) * 0.6 - 0.3)) ;',
'        float slMix = mix(sl, 0.4, smoothstep(0.08, 0.3, aaA));',
'        alb = mix(alb, vec3(0.055, 0.054, 0.052), slMix * (1.0 - smoothstep(1.2 - aaE, 1.2 + aaE, de)));',
// レール（軌間 1.067 m、頭幅 6.5 cm）: 磨かれた鋼。暗い所ではほぼ見えない。空の明かりを鈍く映す
'        float rl = 1.0 - smoothstep(0.03, 0.03 + aaE, abs(de - 0.5335));',
'        lum = max(lum, rl * (1.0 - smoothstep(0.03, 0.2, aaE)));',
'    }',
'    vec3 V = normalize(uCamPos - P);',
'    vec3 col = alb * (uAmbient * 0.8 + uUnder * 0.6);',
'    col += lum * (fogColor(reflect(-V, vec3(0.0, 1.0, 0.0))) * 1.6 + vec3(0.006, 0.006, 0.007));',
'    col = applyFogP(col, P);',
// 線路の両端 1.5 km と、カメラからの水平距離でフェード（端がいきなり切れて見えない）
'    float endF = smoothstep(0.0, 1500.0, min(a, vLen - a));',
'    float fd = (1.0 - smoothstep(0.8 * uFadeFar, uFadeFar, length((P - uCamPos).xz))) * endF;',
'    col = mix(fogColor(normalize(P - uCamPos)), col, fd);',
'    gl_FragColor = vec4(col, 1.0);',
'}'
].join('\n');

// --- 電車（1 両 = 1 インスタンス。物体座標: x 横、y 高さ（レール面 0）、z 0〜20 m（+z が進行方向）） ------------
// aPart: 0 車体、1 屋根の冷房装置、2 床下機器・台車、3 パンタグラフ
var TRAIN_VERT = [
'attribute float aPart;',
'attribute vec4 aCarInfo;',        // x = 編成内の番号（0 = 先頭、最後尾は + 100）、y = 両の乱数、z = パンタグラフあり、w = 線路端のフェード
'attribute vec3 aBand;',           // 色帯の色
'varying vec3 vLocal;',
'varying vec3 vNo;',
'varying vec3 vWorld;',
'varying vec3 vNw;',
'varying float vPart;',
'varying vec4 vInfo;',
'varying vec3 vBand;',
'void main() {',
'    vec3 p = position;',
'    if (aPart > 2.5 && aCarInfo.z < 0.5) p = vec3(0.0, 3.6, 10.0);',     // パンタグラフのない両は潰す
'    vLocal = p; vNo = normal; vPart = aPart; vInfo = aCarInfo; vBand = aBand;',
'    vec4 wp = modelMatrix * instanceMatrix * vec4(p, 1.0);',
'    vWorld = wp.xyz;',
'    vNw = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);',
'    gl_Position = projectionMatrix * viewMatrix * wp;',
'}'
].join('\n');
var TRAIN_FRAG = [
'varying vec3 vLocal;',
'varying vec3 vNo;',
'varying vec3 vWorld;',
'varying vec3 vNw;',
'varying float vPart;',
'varying vec4 vInfo;',
'varying vec3 vBand;',
'uniform vec3 uAmbient;',
'uniform vec3 uTrainAmb;',
'uniform float uFadeFar;',
NOISE,
FOG,
// 窓の中: 天井の灯の列（上端が最も明るい）、吊り革・手すりの影、座席の背の暗い帯、まばらな乗客の影
'vec3 interior(float u, float wy, float detail, float seedC) {',
'    vec3 ci = vec3(0.85, 0.95, 0.90);',
// 天井の灯の列（窓の上端の少し上が最も明るい）と、下へ行くほど暗くなる車内
'    float b = 0.26 + 0.20 * wy;',
'    b += 0.55 * smoothstep(0.86, 0.98, wy) * detail;',
// 車内越しに見える反対側の窓（外は夜なので暗い）。窓柱の位置に合わせて 1.7 m ごとに区切る
'    float ou = abs(fract((u + 0.85) / 1.7) - 0.5) * 1.7;',
'    float opp = (1.0 - smoothstep(0.62, 0.70, ou)) * smoothstep(0.30, 0.36, wy) * (1.0 - smoothstep(0.78, 0.84, wy));',
'    b *= 1.0 - 0.55 * opp * detail;',
// 吊り革（0.45 m ごと）と手すりの影
'    float strap = (1.0 - smoothstep(0.012, 0.025, abs(fract(u / 0.45) - 0.5) * 0.45)) * step(0.70, wy) * step(wy, 0.86);',
'    float ring = (1.0 - smoothstep(0.03, 0.05, length(vec2((fract(u / 0.45) - 0.5) * 0.45, (wy - 0.70) * 0.9)))) * smoothstep(0.015, 0.03, length(vec2((fract(u / 0.45) - 0.5) * 0.45, (wy - 0.70) * 0.9)));',
'    float rail = 1.0 - smoothstep(0.006, 0.016, abs(wy - 0.87));',
'    b *= 1.0 - detail * (0.6 * max(strap, ring) + 0.5 * rail);',
'    vec3 col = ci * b;',
// 座席の背（窓の下部に見える青みのある布地、背もたれの上端は少し明るい）
'    float seat = 1.0 - smoothstep(0.20, 0.26, wy);',
'    col = mix(col, vec3(0.16, 0.20, 0.30) * (0.8 + 0.4 * smoothstep(0.1, 0.22, wy)), seat * detail);',
// 乗客（両ごとに 0〜4 人）: 頭と肩の暗い塊
'    float nP = floor(seedC * 5.0);',
'    for (int i = 0; i < 4; i++) {',
'        if (float(i) >= nP) break;',
'        float pu = 1.5 + 17.0 * fract(seedC * (13.7 + float(i) * 7.3));',
'        float ph = 0.45 + 0.2 * fract(seedC * (5.1 + float(i) * 3.7));',      // 立っている人と座っている人で頭の高さが違う
'        vec2 dh = vec2((u - pu) / 0.12, (wy - ph) / 0.14);',
'        float head = 1.0 - smoothstep(0.75, 1.0, length(dh));',
'        float body = (1.0 - smoothstep(0.20, 0.26, abs(u - pu))) * (1.0 - smoothstep(ph - 0.12, ph - 0.06, wy));',
'        col *= 1.0 - detail * 0.85 * max(head, body);',
'    }',
'    return col;',
'}',
'void main() {',
'    vec3 P = vWorld;',
'    vec3 V = normalize(uCamPos - P);',
'    vec3 Nw = normalize(vNw); if (dot(Nw, V) < 0.0) Nw = -Nw;',
'    vec3 n = vNo;',
'    float u = vLocal.z, y = vLocal.y;',
'    float fp = max(fwidth(u), fwidth(y));',                                   // 1 画素あたりの長さ [m]
'    float detail = 1.0 - smoothstep(0.03, 0.10, fp);',
'    float aa = clamp(fp, 0.004, 0.3);',
'    vec3 alb = vec3(0.16, 0.165, 0.17);',                                     // 銀色の車体（ステンレス）
'    vec3 em = vec3(0.0);',
'    float spec = 0.5;',
'    float car = vInfo.x;',
'    if (vPart < 0.5) {',
'        if (abs(n.x) > 0.5) {',
// 側面: ドア 4 か所（両開き、幅 1.3 m）、ドア間に横長の窓、窓の下に色帯 1 本、裾は暗い
'            float dn = 1e3, dc = 0.0;',
'            for (int i = 0; i < 4; i++) { float c = 2.45 + float(i) * 5.03; float d0 = abs(u - c); if (d0 < dn) { dn = d0; dc = c; } }',
'            float inDoor = 1.0 - smoothstep(0.65 - aa, 0.65 + aa, dn);',
'            float doorY = step(1.0, y) * (1.0 - step(3.02, y));',
'            float doorEdge = (1.0 - smoothstep(0.0, 0.035 + aa, abs(dn - 0.65))) + (1.0 - smoothstep(0.0, 0.02 + aa, dn)) ;',
// 窓（ドアから 0.45 m 以上離れた所）。窓柱は 1.7 m ごと
'            float winY = smoothstep(1.95 - aa, 1.95 + aa, y) * (1.0 - smoothstep(2.85 - aa, 2.85 + aa, y));',
'            float winX = smoothstep(1.1 - aa, 1.1 + aa, dn) * smoothstep(0.55 - aa, 0.55 + aa, u) * (1.0 - smoothstep(19.45 - aa, 19.45 + aa, u));',
'            float pill = 1.0 - smoothstep(0.06, 0.06 + aa, abs(fract((u - dc) / 1.7) - 0.5) * 1.7);',
'            float win = winY * winX * (1.0 - pill * detail);',
// ドアの窓（各扉の中央）
'            float leaf = abs(dn - 0.325);',
'            float dWin = inDoor * (1.0 - smoothstep(0.2 - aa, 0.2 + aa, leaf)) * smoothstep(2.05 - aa, 2.05 + aa, y) * (1.0 - smoothstep(2.85 - aa, 2.85 + aa, y));',
'            float wy = clamp((y - 1.95) / 0.9, 0.0, 1.0);',
'            vec3 inside = interior(u, wy, detail, vInfo.y);',
'            float frame = (1.0 - smoothstep(0.0, 0.04 + aa, abs(y - 1.95))) + (1.0 - smoothstep(0.0, 0.04 + aa, abs(y - 2.85)));',
'            em = inside * max(win, dWin) * (0.85 + 0.3 * vInfo.y);',     // 両ごとに少し明るさが違う
'            alb *= 1.0 - 0.6 * clamp(doorEdge * doorY + frame * winX * detail, 0.0, 1.0);',
'            alb = mix(alb, vBand * 0.45, step(1.70, y) * (1.0 - step(1.86, y)) * (1.0 - inDoor));',   // 色帯
'            alb *= mix(0.25, 1.0, smoothstep(0.95, 1.15, y));',                                   // 裾
'            alb *= 1.0 - 0.7 * max(win, dWin);',
// 遠景: 窓は 1 両ごとに途切れる明るい帯に溶ける
'            vec3 farEm = vec3(0.85, 0.95, 0.90) * 0.42 * winY * smoothstep(0.6, 1.2, u) * (1.0 - smoothstep(18.8, 19.4, u));',
'            farEm *= 1.0 - 0.6 * (1.0 - smoothstep(0.55, 0.75, dn));',                     // 中距離でもドアの位置で帯が切れる（1 両に 5 つの窓の帯）
'            em = mix(farEm, em, detail);',
'        } else if (abs(n.z) > 0.5) {',
// 前後の面: 先頭は運転台の窓（暗い）と行先表示の小さな明るい矩形、最後尾は尾灯の赤
'            bool front = n.z > 0.0;',
'            float ax = abs(vLocal.x);',
'            alb *= mix(0.25, 1.0, smoothstep(0.95, 1.15, y));',
'            if (front && car < 0.5) {',
'                float wsh = step(1.95, y) * (1.0 - step(2.95, y)) * (1.0 - step(1.25, ax));',
'                alb = mix(alb, vec3(0.01), wsh);',
'                float dest = step(3.0, y) * (1.0 - step(3.22, y)) * (1.0 - step(0.55, ax));',
'                em += vec3(0.95, 0.90, 0.75) * dest * 0.9;',
'            } else if (!front && vInfo.x > 99.5) {',                              // v7.1: 最後尾は番号 + 100（両数が線ごとに違う）
'                float tl = step(1.35, y) * (1.0 - step(1.5, y)) * step(0.9, ax) * (1.0 - step(1.2, ax));',
'                em += vec3(1.6, 0.05, 0.03) * tl;',
'            } else {',
'                alb *= 0.5;',                                                       // 連結面は暗い
'            }',
'        } else {',
// 屋根: 暗い灰色。0.5 m ごとの細い筋と、雨どいの線（のっぺりした板にしない）
'            alb = vec3(0.075, 0.075, 0.078) * (0.85 + 0.3 * vnoise(vec2(u * 2.0, vLocal.x * 3.0)));',
'            alb *= 1.0 - 0.35 * (1.0 - smoothstep(0.0, 0.03 + aa, abs(fract(u / 0.5) - 0.5) * 0.5)) * detail;',
'            alb *= 1.0 - 0.5 * (1.0 - smoothstep(0.02, 0.05 + aa, abs(abs(vLocal.x) - 1.12)));',
'            spec = 0.2;',
'        }',
'    } else if (vPart < 1.5) {',
'        alb = vec3(0.09, 0.09, 0.095);',                                            // 冷房装置: 格子の筋
'        alb *= 1.0 - 0.4 * step(0.5, fract(vLocal.x * 8.0)) * step(0.5, n.y) * detail;',
'        spec = 0.2;',
'    } else if (vPart < 2.5) {',
'        alb = vec3(0.012, 0.012, 0.013); spec = 0.05;',                             // 床下機器・台車
'    } else {',
'        alb = vec3(0.05, 0.05, 0.055); spec = 0.6;',                                 // パンタグラフ
'    }',
// 照明: 夜の街明かりの環境光（上からわずか、横から街の明かり）＋空の映り込み（ステンレスの鈍い光沢）
'    vec3 col = alb * (uAmbient * (0.6 + 0.4 * Nw.y) + uTrainAmb * (0.7 - 0.3 * Nw.y));',
'    float fr = pow(clamp(1.0 - dot(Nw, V), 0.0, 1.0), 4.0);',
'    col += fogColor(reflect(-V, Nw)) * (0.15 + 0.85 * fr) * spec * 0.6;',
'    col += em;',
'    col = applyFogP(col, P);',
'    float fd = (1.0 - smoothstep(0.8 * uFadeFar, uFadeFar, length((P - uCamPos).xz))) * vInfo.w;',
'    col = mix(fogColor(normalize(P - uCamPos)), col, fd);',
'    gl_FragColor = vec4(col, 1.0);',
'}'
].join('\n');

// --- 電車の光が線路脇に落ちる帯と、前照灯の前方の光だまり（電車と一緒に動く加算の四角形） ----------------
// 単位ジオメトリ: x -1〜1、z 0〜1。aKind 0 = 窓の光（車体の両脇に帯）、1 = 前照灯（前方へ細長く減衰）
var TGLOW_VERT = [
'attribute float aKind;',
'attribute float aFadeG;',
'varying vec2 vL;',
'varying float vKind;',
'varying float vFadeG;',
'varying vec3 vW;',
'void main() {',
'    vL = position.xz; vKind = aKind; vFadeG = aFadeG;',
'    vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);',
'    vW = wp.xyz;',
'    gl_Position = projectionMatrix * viewMatrix * wp;',
'}'
].join('\n');
var TGLOW_FRAG = [
'varying vec2 vL;',
'varying float vKind;',
'varying float vFadeG;',
'varying vec3 vW;',
'uniform float uGain;',
'uniform float uFadeFar;',
FOG,
'void main() {',
'    float x = abs(vL.x), z = vL.y;',
'    float f;',
'    vec3 c;',
'    if (vKind < 0.5) {',
// 車体（|x| < 0.33 = 1.5 m）の外側すぐが最も明るく、外へなだらかに減衰。両の端で弱まる
'        f = smoothstep(0.30, 0.38, x) * exp(-(x - 0.38) * (x - 0.38) * 9.0) * smoothstep(0.0, 0.08, z) * smoothstep(0.0, 0.08, 1.0 - z);',
'        c = vec3(0.85, 0.95, 0.90) * 0.05;',
'    } else {',
'        f = exp(-x * x * 5.0) * exp(-z * 2.5) * smoothstep(0.0, 0.05, z);',
'        c = vec3(1.0, 0.97, 0.9) * 0.22;',
'    }',
'    float fd = (1.0 - smoothstep(0.8 * uFadeFar, uFadeFar, length((vW - uCamPos).xz))) * vFadeG;',
'    gl_FragColor = vec4(c * f * uGain * fd * (1.0 - fogAmount(vW)), 1.0);',
'}'
].join('\n');

global.TW_SHADERS = {
    panelVert: PANEL_VERT, panelFrag: PANEL_FRAG, waterVert: WATER_VERT, waterFrag: WATER_FRAG, groadVert: GROAD_VERT, groadFrag: GROAD_FRAG,
    railbedVert: RAILBED_VERT, railbedFrag: RAILBED_FRAG, trainVert: TRAIN_VERT, trainFrag: TRAIN_FRAG, tglowVert: TGLOW_VERT, tglowFrag: TGLOW_FRAG,
    bloomVert: BLOOM_VERT, bloomDown: BLOOM_DOWN, bloomUp: BLOOM_UP, bloomComp: BLOOM_COMP,
    poolVert: POOL_VERT, poolFrag: POOL_FRAG,
    roadVert: ROAD_VERT, roadFrag: ROAD_FRAG,
    litVert: LIT_VERT, litFrag: LIT_FRAG,
    skyVert: SKY_VERT, skyFrag: SKY_FRAG,
    starVert: STAR_VERT, starFrag: STAR_FRAG,
    glowVert: GLOW_VERT, glowFrag: GLOW_FRAG,
    coneVert: CONE_VERT, coneFrag: CONE_FRAG,
    cityVert: CITY_VERT, cityFrag: CITY_FRAG,
    meteorVert: METEOR_VERT, meteorFrag: METEOR_FRAG, skyptVert: SKYPT_VERT, skyptFrag: SKYPT_FRAG, pachiVert: PACHI_VERT, pachiFrag: PACHI_FRAG, ufoVert: UFO_VERT, ufoFrag: UFO_FRAG, ufoHaloVert: UFO_HALO_VERT, ufoHaloFrag: UFO_HALO_FRAG, kaijuVert: KAIJU_VERT, kaijuFrag: KAIJU_FRAG, kbeamVert: KBEAM_VERT, kbeamFrag: KBEAM_FRAG, kglowFrag: KGLOW_FRAG, kpartVert: KPART_VERT, kpartFrag: KPART_FRAG,
    finalVert: FINAL_VERT, finalFrag: FINAL_FRAG
};
})(typeof window !== 'undefined' ? window : this);
