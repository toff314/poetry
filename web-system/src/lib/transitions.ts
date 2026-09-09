/**
 * 放映厅转场库。
 * GLSL 过渡源自 gl-transitions 开源合集（MIT License, github.com/gl-transitions/gl-transitions），
 * 每个 shader 以 transition(vec2 uv) 为入口，运行时注入 progress / getFromColor / getToColor。
 * 「水墨」为诗境定制 shader。
 */

export interface TransitionDef {
  key: string;
  label: string;
  /** CSS 直切等非 WebGL 方案无 shader */
  glsl?: string;
  /** 过渡时长（ms） */
  duration: number;
  /** 额外 uniform 初值（GLSL 中声明同名 uniform） */
  uniforms?: Record<string, number | number[]>;
}

const FADE = `// Author: gre
// License: MIT
vec4 transition (vec2 uv) {
  return mix(
    getFromColor(uv),
    getToColor(uv),
    progress
  );
}`;

const CROSSWARP = `// Author: Eke Péter <peterekepeter@gmail.com>
// License: MIT
vec4 transition(vec2 p) {
  float x = progress;
  x=smoothstep(.0,1.0,(x*2.0+p.x-1.0));
  return mix(getFromColor((p-.5)*(1.-x)+.5), getToColor((p-.5)*x+.5), x);
}`;

const CROSSZOOM = `// License: MIT
// Author: rectalogic
// ported by gre from https://gist.github.com/rectalogic/b86b90161503a0023231

uniform float strength; // = 0.4

const float PI = 3.141592653589793;

float Linear_ease(in float begin, in float change, in float duration, in float time) {
    return change * time / duration + begin;
}

float Exponential_easeInOut(in float begin, in float change, in float duration, in float time) {
    if (time == 0.0)
        return begin;
    else if (time == duration)
        return begin + change;
    time = time / (duration / 2.0);
    if (time < 1.0)
        return change / 2.0 * pow(2.0, 10.0 * time - 10.0) + begin;
    return change / 2.0 * (-pow(2.0, -10.0 * time) + 2.0) + begin;
}

float Sinusoidal_easeInOut(in float begin, in float change, in float duration, in float time) {
    return -change / 2.0 * (cos(PI * time / duration) - 1.0) + begin;
}

vec3 crossFade(in vec2 uv, in float dissolved) {
    return mix(getFromColor(uv).rgb, getToColor(uv).rgb, dissolved);
}

vec4 transition(vec2 uv) {
    vec2 center = vec2(0.5, 0.5);
    vec2 diff = uv - center;
    float dist = length(diff);
    vec2 dir = normalize(diff);
    vec2 result = center + dir * mix(0.0, dist * 2.0, Exponential_easeInOut(0.0, 0.5, 1.0, progress));
    vec4 resultColor = vec4(crossFade(result, Linear_ease(0.0, 1.0, 1.0, progress)), 1.0);
    float s = pow(2.0 * abs(progress - 0.5), 3.0);
    resultColor = mix(resultColor, vec4(crossFade(uv, progress), 1.0), s * strength);
    return resultColor;
}`;

const SWIRL = `// License: MIT
// Author: Sergey Kosarevsky
// ( http://www.linderdaum.com )
// ported by gre from https://gist.github.com/corporateshark/cacfedb8cca0f5ce3f7c

vec4 transition(vec2 UV)
{
	float Radius = 1.0;

	float T = progress;

	UV -= vec2( 0.5, 0.5 );

	float Dist = length(UV);

	if ( Dist < Radius )
	{
		float Percent = (Radius - Dist) / Radius;
		float A = ( T <= 0.5 ) ? mix( 0.0, 1.0, T/0.5 ) : mix( 1.0, 0.0, (T-0.5)/0.5 );
		float Theta = Percent * Percent * A * 8.0 * 3.14159;
		float S = sin( Theta );
		float C = cos( Theta );
		UV = vec2( dot(UV, vec2(C, -S)), dot(UV, vec2(S, C)) );
	}
	UV += vec2( 0.5, 0.5 );

	vec4 C0 = getFromColor(UV);
	vec4 C1 = getToColor(UV);

	return mix( C0, C1, T );
}`;

const WATERDROP = `// Author: Paweł Płóciennik
// License: MIT
uniform float amplitude; // = 30
uniform float speed; // = 30

vec4 transition(vec2 p) {
  vec2 dir = p - vec2(.5);
  float dist = length(dir);

  if (dist > progress) {
    return mix(getFromColor( p), getToColor( p), progress);
  } else {
    vec2 offset = dir * sin(dist * amplitude - progress * speed);
    return mix(getFromColor( p + offset), getToColor( p), progress);
  }
}`;

const WIND = `// Author: gre
// License: MIT
uniform float size; // = 0.2
uniform bool reversed; // = false

float rand (vec2 co) {
  return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);
}

vec4 transition (vec2 uv) {
  float x = reversed ? 1. - uv.x : uv.x;
  float r = rand(vec2(0, uv.y));
  float m = smoothstep(0.0, -size, x*(1.0-size) + size*r - (progress * (1.0 + size)));
  return mix(
    getFromColor(uv),
    getToColor(uv),
    m
  );
}`;

const BURNOUT = `// License: MIT
// Author: pthrasher
// adapted by gre from https://gist.github.com/pthrasher/8e6226b215548ba12734

uniform float smoothness; // = 0.03
uniform vec2 center; // = vec2(0.5)
uniform vec3 color; // = vec3(0.0)

const float M_PI = 3.14159265358979323846;

float quadraticInOut(float t) {
    float p = 2.0 * t * t;
    return t < 0.5 ? p : -p + (4.0 * t) - 1.0;
}

float getGradient(float r, float dist) {
    float d = r - dist;
    return mix(
        smoothstep(-smoothness, 0.0, r - dist * (1.0 + smoothness)),
        -1.0 - step(0.005, d),
        step(-0.005, d) * step(d, 0.01)
    );
}

float getWave(vec2 p){
    vec2 _p = p - center; // offset from center
    float rads = atan(_p.y, _p.x);
    float degs = degrees(rads) + 180.0;
    vec2 range = vec2(0.0, M_PI * 30.0);
    vec2 domain = vec2(0.0, 360.0);
    float ratio = (M_PI * 30.0) / 360.0;
    degs = degs * ratio;
    float x = progress;
    float magnitude = mix(0.02, 0.09, smoothstep(0.0, 1.0, x));
    float offset = mix(40.0, 30.0, smoothstep(0.0, 1.0, x));
    float ease_degs = quadraticInOut(sin(degs));
    float deg_wave_pos = (ease_degs * magnitude) * sin(x * offset);
    return x + deg_wave_pos;
}

vec4 transition(vec2 p) {
    float dist = distance(center, p);
    float m = getGradient(getWave(p), dist);
    vec4 cfrom = getFromColor(p);
    vec4 cto = getToColor(p);
    return mix(mix(cfrom, cto, m), mix(cfrom, vec4(color, 1.0), 0.75), step(m, -2.0));
}`;

const BOOKFLIP = `// Author: hong
// License: MIT
vec2 skewRight(vec2 p) {
  float skewX = (p.x - progress)/(0.5 - progress) * 0.5;
  float skewY =  (p.y - 0.5)/(0.5 + progress * (p.x - 0.5) / 0.5)* 0.5  + 0.5;
  return vec2(skewX, skewY);
}

vec2 skewLeft(vec2 p) {
  float skewX = (p.x - 0.5)/(progress - 0.5) * 0.5 + 0.5;
  float skewY = (p.y - 0.5) / (0.5 + (1.0 - progress ) * (0.5 - p.x) / 0.5) * 0.5  + 0.5;
  return vec2(skewX, skewY);
}

vec4 addShade() {
  float shadeVal  =  max(0.7, abs(progress - 0.5) * 2.0);
  return vec4(vec3(shadeVal ), 1.0);
}

vec4 transition (vec2 p) {
  float pr = step(1.0 - progress, p.x);

  if (p.x < 0.5) {
    return mix(getFromColor(p), getToColor(skewLeft(p)) * addShade(), pr);
  } else {
    return mix(getFromColor(skewRight(p)) * addShade(), getToColor(p),   pr);
  }
}`;

/** 诗境定制：水墨晕染溶解（value-noise fbm 阈值 + 墨色过渡带） */
const INK = `// License: MIT (诗境定制)
float inkHash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
float inkNoise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(inkHash(i), inkHash(i + vec2(1.0, 0.0)), f.x),
             mix(inkHash(i + vec2(0.0, 1.0)), inkHash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float inkFbm(vec2 p){
  float v = 0.0, a = 0.5;
  for(int i = 0; i < 4; i++){ v += a * inkNoise(p); p *= 2.03; a *= 0.5; }
  return v;
}
vec4 transition(vec2 uv){
  float n = inkFbm(uv * 3.0);
  float p = progress * 1.3 - 0.15;
  float edge = 0.12;
  float m = smoothstep(p - edge, p, n);
  float band = smoothstep(p - edge, p - edge * 0.25, n) * (1.0 - smoothstep(p - edge * 0.25, p, n));
  vec4 c = mix(getFromColor(uv), getToColor(uv), m);
  c = mix(c, vec4(0.05, 0.05, 0.06, 1.0), band * 0.85);
  return c;
}`;

export const TRANSITIONS: TransitionDef[] = [
  { key: 'cut', label: '直切', duration: 0 },
  { key: 'fade', label: '淡入淡出', glsl: FADE, duration: 900 },
  { key: 'ink', label: '水墨', glsl: INK, duration: 1400 },
  { key: 'crosszoom', label: '推镜', glsl: CROSSZOOM, duration: 1100, uniforms: { strength: 0.4 } },
  { key: 'crosswarp', label: '卷动', glsl: CROSSWARP, duration: 900 },
  { key: 'swirl', label: '旋涡', glsl: SWIRL, duration: 1000 },
  { key: 'waterdrop', label: '雨滴', glsl: WATERDROP, duration: 1100, uniforms: { amplitude: 30, speed: 30 } },
  { key: 'wind', label: '风拂', glsl: WIND, duration: 1000, uniforms: { size: 0.2 } },
  { key: 'burnout', label: '燃烬', glsl: BURNOUT, duration: 1200, uniforms: { smoothness: 0.03, center: [0.5, 0.5], color: [0, 0, 0] } },
  { key: 'bookflip', label: '翻页', glsl: BOOKFLIP, duration: 1000 },
];

export function getTransition(key: string): TransitionDef {
  return TRANSITIONS.find((t) => t.key === key) || TRANSITIONS[1];
}
