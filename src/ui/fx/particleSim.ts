// Pure particle simulation with no DOM or Pixi imports. Slots [0, count) are alive; a dead slot is refilled by the last live one, so a renderer can mirror the arrays index for index.
export const SHAPES = ['star', 'sparkle', 'dot', 'strip', 'sweet'] as const;
export type ParticleShape = typeof SHAPES[number];

export interface ParticleSpec {
  x: number; y: number; vx: number; vy: number;
  life: number; size: number; endSize?: number;
  rotation?: number; spin?: number; gravity?: number; drag?: number;
  alpha?: number; fadeFrom?: number; flutter?: number;
  tint: number; shape: ParticleShape;
}
export interface EmitterSpec { duration: number; rate: number; make(): ParticleSpec }

const POP = 0.06;
const rgbToBgr = (tint: number): number => ((tint & 0xff) << 16) | (tint & 0xff00) | ((tint >> 16) & 0xff);

export class ParticleSim {
  cap: number;
  count = 0;
  spawned = 0;
  readonly x: Float32Array; readonly y: Float32Array; readonly vx: Float32Array; readonly vy: Float32Array;
  readonly age: Float32Array; readonly life: Float32Array; readonly size: Float32Array; readonly endSize: Float32Array;
  readonly rotation: Float32Array; readonly spin: Float32Array; readonly gravity: Float32Array; readonly drag: Float32Array;
  readonly alpha: Float32Array; readonly fadeFrom: Float32Array; readonly flutter: Float32Array;
  readonly bgr: Uint32Array; readonly shape: Uint8Array;
  private emitters: { spec: EmitterSpec; left: number; carry: number }[] = [];

  constructor(readonly capacity: number) {
    this.cap = capacity;
    const floats = (): Float32Array => new Float32Array(capacity);
    this.x = floats(); this.y = floats(); this.vx = floats(); this.vy = floats(); this.age = floats(); this.life = floats();
    this.size = floats(); this.endSize = floats(); this.rotation = floats(); this.spin = floats(); this.gravity = floats(); this.drag = floats();
    this.alpha = floats(); this.fadeFrom = floats(); this.flutter = floats();
    this.bgr = new Uint32Array(capacity); this.shape = new Uint8Array(capacity);
  }

  get emitting(): boolean { return this.emitters.length > 0; }
  get active(): boolean { return this.count > 0 || this.emitters.length > 0; }

  spawn(spec: ParticleSpec): boolean {
    const i = this.count;
    if (i >= this.cap || i >= this.capacity) return false;
    this.count++;
    this.spawned++;
    this.x[i] = spec.x; this.y[i] = spec.y; this.vx[i] = spec.vx; this.vy[i] = spec.vy;
    this.age[i] = 0; this.life[i] = Math.max(0.05, spec.life);
    this.size[i] = spec.size; this.endSize[i] = spec.endSize ?? spec.size;
    this.rotation[i] = spec.rotation ?? 0; this.spin[i] = spec.spin ?? 0;
    this.gravity[i] = spec.gravity ?? 0; this.drag[i] = spec.drag ?? 0;
    this.alpha[i] = spec.alpha ?? 1; this.fadeFrom[i] = spec.fadeFrom ?? 0.55; this.flutter[i] = spec.flutter ?? 0;
    this.bgr[i] = rgbToBgr(spec.tint) >>> 0; this.shape[i] = SHAPES.indexOf(spec.shape);
    return true;
  }

  emit(spec: EmitterSpec): void { this.emitters.push({ spec, left: spec.duration, carry: 0 }); }

  step(dt: number): void {
    for (let e = this.emitters.length - 1; e >= 0; e--) {
      const emitter = this.emitters[e];
      const span = Math.min(dt, emitter.left);
      emitter.carry += emitter.spec.rate * span;
      while (emitter.carry >= 1) { emitter.carry -= 1; if (!this.spawn(emitter.spec.make())) { emitter.carry = 0; break; } }
      emitter.left -= dt;
      if (emitter.left <= 1e-6) this.emitters.splice(e, 1);
    }
    for (let i = 0; i < this.count;) {
      const age = this.age[i] + dt;
      if (age >= this.life[i]) { this.kill(i); continue; }
      this.age[i] = age;
      this.vx[i] -= this.vx[i] * this.drag[i] * dt;
      this.vy[i] += this.gravity[i] * dt - this.vy[i] * this.drag[i] * dt;
      this.x[i] += this.vx[i] * dt;
      this.y[i] += this.vy[i] * dt;
      this.rotation[i] += this.spin[i] * dt;
      i++;
    }
  }

  // Uniform scale (with a quick pop-in) and opacity (linear fade from fadeFrom to the end of life) for slot i.
  scaleAt(i: number): number {
    const t = this.age[i] / this.life[i];
    const base = this.size[i] + (this.endSize[i] - this.size[i]) * t;
    return base * Math.min(1, this.age[i] / POP);
  }
  alphaAt(i: number): number {
    const t = this.age[i] / this.life[i], from = this.fadeFrom[i];
    return this.alpha[i] * (t <= from ? 1 : Math.max(0, 1 - (t - from) / (1 - from)));
  }
  // Width factor that makes confetti tumble; 1 for particles that do not flutter.
  flipAt(i: number): number { return this.flutter[i] ? Math.abs(Math.cos(this.age[i] * this.flutter[i])) * 0.85 + 0.15 : 1; }

  clear(): void { this.count = 0; this.emitters.length = 0; }

  private kill(i: number): void {
    const last = --this.count;
    if (i === last) return;
    for (const array of [this.x, this.y, this.vx, this.vy, this.age, this.life, this.size, this.endSize, this.rotation, this.spin, this.gravity, this.drag, this.alpha, this.fadeFrom, this.flutter, this.bgr, this.shape] as { [k: number]: number }[]) array[i] = array[last];
  }
}

export type Range = readonly [number, number]
export const between = (random: () => number, [low, high]: Range): number => low + (high - low) * random();
