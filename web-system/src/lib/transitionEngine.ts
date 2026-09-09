import type { TransitionDef } from './transitions';

const VERTEX = `
attribute vec2 a_pos;
varying vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

const FRAGMENT_PREFIX = `
precision highp float;
varying vec2 v_uv;
uniform float progress;
uniform vec2 u_res;
uniform vec2 u_fromRes;
uniform vec2 u_toRes;
uniform sampler2D u_from;
uniform sampler2D u_to;
`;

const FRAGMENT_HELPERS = `
vec2 coverUV(vec2 uv, vec2 texRes) {
  vec2 s = u_res / texRes;
  float sc = max(s.x, s.y);
  vec2 scaled = texRes * sc;
  vec2 offset = (u_res - scaled) * 0.5;
  return clamp((uv * u_res - offset) / scaled, 0.0, 1.0);
}
vec4 getFromColor(vec2 uv) { return texture2D(u_from, coverUV(uv, u_fromRes)); }
vec4 getToColor(vec2 uv) { return texture2D(u_to, coverUV(uv, u_toRes)); }
`;

const FRAGMENT_MAIN = `
void main() { gl_FragColor = transition(v_uv); }
`;

/**
 * WebGL 转场引擎：单 canvas，纹理按 URL 缓存，shader 按转场 key 缓存。
 * 不可用时 fallback() 返回 false，调用方降级为 CSS 淡入淡出。
 */
export class TransitionEngine {
  private gl: WebGLRenderingContext | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private buffer: WebGLBuffer | null = null;
  private programs = new Map<string, WebGLProgram>();
  private textures = new Map<string, WebGLTexture | null>();
  private texRes = new Map<string, [number, number]>();
  private pendingTex = new Map<string, Promise<WebGLTexture | null>>();

  init(canvas: HTMLCanvasElement | null): boolean {
    if (!canvas || this.canvas === canvas) return !!this.gl;
    const gl = canvas.getContext('webgl', {
      premultipliedAlpha: false,
      antialias: false,
    });
    if (!gl) return false;
    this.canvas = canvas;
    this.gl = gl;
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    this.buffer = buf;
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);
    return true;
  }

  get available(): boolean {
    return !!this.gl;
  }

  /** 同步 canvas 像素尺寸（devicePixelRatio 上限 2），返回是否变化 */
  resize(cssW: number, cssH: number): boolean {
    if (!this.canvas) return false;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(2, Math.round(cssW * dpr));
    const h = Math.max(2, Math.round(cssH * dpr));
    if (this.canvas.width === w && this.canvas.height === h) return false;
    this.canvas.width = w;
    this.canvas.height = h;
    return true;
  }

  private compile(key: string, glsl: string): WebGLProgram | null {
    const cached = this.programs.get(key);
    if (cached) return cached;
    const gl = this.gl;
    if (!gl) return null;
    const frag = FRAGMENT_PREFIX + FRAGMENT_HELPERS + glsl + FRAGMENT_MAIN;
    const compile = (type: number, src: string): WebGLShader | null => {
      const sh = gl.createShader(type);
      if (!sh) return null;
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        console.warn('[transition] shader compile failed:', gl.getShaderInfoLog(sh));
        gl.deleteShader(sh);
        return null;
      }
      return sh;
    };
    const vs = compile(gl.VERTEX_SHADER, VERTEX);
    const fs = compile(gl.FRAGMENT_SHADER, frag);
    if (!vs || !fs) return null;
    const prog = gl.createProgram();
    if (!prog) return null;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.warn('[transition] link failed:', gl.getProgramInfoLog(prog));
      return null;
    }
    this.programs.set(key, prog);
    return prog;
  }

  private async loadTexture(url: string): Promise<WebGLTexture | null> {
    const cached = this.textures.get(url);
    if (cached !== undefined) return cached;
    const pending = this.pendingTex.get(url);
    if (pending) return pending;
    const p = (async () => {
      const gl = this.gl;
      if (!gl) return null;
      try {
        const img = new Image();
        img.decoding = 'async';
        img.src = url;
        await img.decode();
        const tex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        this.textures.set(url, tex);
        this.texRes.set(url, [img.naturalWidth, img.naturalHeight]);
        return tex;
      } catch {
        this.textures.set(url, null);
        return null;
      } finally {
        this.pendingTex.delete(url);
      }
    })();
    this.pendingTex.set(url, p);
    return p;
  }

  /** 预加载（转场开始前调用，避免首帧白屏） */
  preload(urls: string[]): void {
    urls.forEach((u) => {
      void this.loadTexture(u);
    });
  }

  /**
   * 渲染一帧转场。progress ∈ [0,1]。
   * 返回 false 表示不可用或纹理未就绪（调用方应降级）。
   */
  async render(def: TransitionDef, fromUrl: string, toUrl: string, progress: number): Promise<boolean> {
    const gl = this.gl;
    if (!gl || !def.glsl || !this.canvas) return false;
    const [fromTex, toTex] = await Promise.all([this.loadTexture(fromUrl), this.loadTexture(toUrl)]);
    if (!fromTex || !toTex) return false;
    const prog = this.compile(def.key, def.glsl);
    if (!prog) return false;

    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.useProgram(prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    const loc = gl.getAttribLocation(prog, 'a_pos');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, fromTex);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, toTex);

    const set1i = (name: string, v: number) => {
      const l = gl.getUniformLocation(prog, name);
      if (l) gl.uniform1i(l, v);
    };
    const set1f = (name: string, v: number) => {
      const l = gl.getUniformLocation(prog, name);
      if (l) gl.uniform1f(l, v);
    };
    const set2f = (name: string, x: number, y: number) => {
      const l = gl.getUniformLocation(prog, name);
      if (l) gl.uniform2f(l, x, y);
    };

    set1i('u_from', 0);
    set1i('u_to', 1);
    set1f('progress', progress);
    set2f('u_res', this.canvas.width, this.canvas.height);
    const fr = this.texRes.get(fromUrl) || [1, 1];
    const tr = this.texRes.get(toUrl) || [1, 1];
    set2f('u_fromRes', fr[0], fr[1]);
    set2f('u_toRes', tr[0], tr[1]);

    if (def.uniforms) {
      for (const [name, v] of Object.entries(def.uniforms)) {
        if (typeof v === 'number') {
          // 布尔 uniform（如 wind 的 reversed）按 0/1 int 传
          const l = gl.getUniformLocation(prog, name);
          if (l) gl.uniform1f(l, v);
        } else if (v.length === 2) {
          set2f(name, v[0], v[1]);
        } else if (v.length === 3) {
          const l = gl.getUniformLocation(prog, name);
          if (l) gl.uniform3f(l, v[0], v[1], v[2]);
        }
      }
    }

    gl.drawArrays(gl.TRIANGLES, 0, 3);
    return true;
  }

  clear(): void {
    const gl = this.gl;
    if (!gl || !this.canvas) return;
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
  }

  destroy(): void {
    const gl = this.gl;
    if (!gl) return;
    this.programs.forEach((p) => gl.deleteProgram(p));
    this.textures.forEach((t) => t && gl.deleteTexture(t));
    this.programs.clear();
    this.textures.clear();
    this.texRes.clear();
    this.gl = null;
    this.canvas = null;
  }
}

export const transitionEngine = new TransitionEngine();
