// oxlint-disable unicorn/no-array-fill-with-reference-type -- Pixi's Graphics.fill(), not Array.prototype.fill().
import { type Application, Container, Graphics } from 'pixi.js';
import {
  BOLT_LENGTH,
  drawBallistaBase,
  drawBolt,
  drawCloud,
  drawDragon,
  drawStock,
  drawWinch,
  type Dragon,
} from './art';
import type { SceneFrame } from './frame';
import {
  clamp01,
  easeInCubic,
  easeInOutCubic,
  easeOutBack,
  easeOutCubic,
  lerp,
  mixColor,
  wrap,
} from './math';
import type { LongshotPalette } from './palette';

const AIM = -0.5; // radians; the ballista points up and to the right
const CRUISE_ANGLE = -0.2;
const LAUNCH_MS = 1_400;
const CAMERA_RISE_MS = 2_500;
const NUT_REST = 72; // where the string sits when slack, along the stock
const NUT_DRAWN = -70; // where the string is cranked back to

interface Cloud {
  g: Graphics;
  x: number;
  y: number;
  depth: number;
}

interface Ember {
  g: Graphics;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
}

/**
 * Longshot (ported from Skyforge): a ballista on a castle wall is cranked during betting, fires a
 * giant bolt at launch, and the camera follows the bolt up through the clouds. At the crash a
 * dragon swoops in and burns it. All motion is a function of the frame (phase + times), except
 * ambient drift and embers. World colours come from the theme (`LongshotPalette`).
 */
export class LongshotScene {
  private width = 0;
  private height = 0;
  private unit = 1;
  private ambientMs = 0;

  private readonly root = new Container();
  private readonly sky = new Graphics();
  private readonly mountains = new Graphics();
  private readonly cloudLayer = new Container();
  private readonly ground = new Container();
  private readonly wall = new Graphics();
  private readonly ballista = new Container();
  private readonly aim = new Container();
  private readonly bow = new Graphics();
  private readonly winch = drawWinch();
  private readonly trail = new Graphics();
  private readonly bolt: Container;
  private readonly fire = new Graphics();
  private readonly emberLayer = new Container();
  private readonly dragon: Dragon = drawDragon();
  private clouds: Cloud[] = [];
  private embers: Ember[] = [];

  constructor(private readonly palette: LongshotPalette) {
    this.bolt = drawBolt(palette.accent, palette.accentDark);
  }

  init(app: Application): void {
    this.winch.position.set(-78, 0);
    this.aim.rotation = AIM;
    this.aim.addChild(drawStock(), this.winch, this.bow);
    this.ballista.addChild(drawBallistaBase(), this.aim);
    this.ground.addChild(this.wall, this.ballista);

    this.clouds = Array.from({ length: 9 }, (_, i) => ({
      g: drawCloud(i + 1, this.palette.cloud),
      x: (i * 0.37) % 1,
      y: 0.08 + ((i * 0.23) % 0.6),
      depth: 0.35 + ((i * 0.29) % 0.65),
    }));
    this.clouds.sort((a, b) => a.depth - b.depth);
    for (const c of this.clouds) {
      c.g.alpha = 0.25 + c.depth * 0.55;
      this.cloudLayer.addChild(c.g);
    }

    this.fire.blendMode = 'add';
    this.emberLayer.blendMode = 'add';
    this.root.addChild(
      this.sky,
      this.mountains,
      this.cloudLayer,
      this.ground,
      this.trail,
      this.bolt,
      this.fire,
      this.dragon.root,
      this.emberLayer,
    );
    app.stage.addChild(this.root);
  }

  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.unit = Math.min(width / 900, height / 520);
    this.drawSky();
    this.drawMountains();
    this.drawWall();
    for (const c of this.clouds) c.g.scale.set(this.unit * (0.5 + c.depth * 0.7));
    this.ballista.scale.set(this.unit);
    this.bolt.scale.set(this.unit);
    this.dragon.root.scale.set(this.unit);
  }

  render(frame: SceneFrame, deltaMs: number): void {
    if (!this.width) return;
    this.ambientMs += deltaMs;

    const flying = frame.phase !== 'betting';
    const cameraRise = flying ? easeInOutCubic(clamp01(frame.flightMs / CAMERA_RISE_MS)) : 0;
    const drop = cameraRise * this.height * 0.85;
    const distance = flying ? frame.flightMs * 0.12 * (1 + 0.6 * Math.log(frame.multiplier)) : 0;

    this.renderBackground(drop, distance);
    this.ground.y = drop;
    const draw = this.renderBallista(frame);
    this.renderBolt(frame, draw);
    this.renderCrash(frame);
    this.updateEmbers(deltaMs);
  }

  destroy(): void {
    this.root.destroy({ children: true });
  }

  // ── layout pieces ────────────────────────────────────────────────────────

  private get pivot() {
    return { x: this.width * 0.16, y: this.height - 118 * this.unit };
  }

  /** Point along the stock (aim space) in screen space, before the camera drop. */
  private alongStock(d: number) {
    const { x, y } = this.pivot;
    return { x: x + Math.cos(AIM) * d * this.unit, y: y + Math.sin(AIM) * d * this.unit };
  }

  private drawSky(): void {
    const { width: w, height: h } = this;
    const stops = this.palette.skyStops;
    const bands = 48;
    this.sky.clear();
    for (let i = 0; i < bands; i++) {
      const t = i / (bands - 1);
      const seg = Math.min(stops.length - 2, Math.floor(t * (stops.length - 1)));
      const local = t * (stops.length - 1) - seg;
      this.sky
        .rect(0, (i * h) / bands, w, h / bands + 1)
        .fill(mixColor(stops[seg]!, stops[seg + 1]!, local));
    }
    for (let i = 0; i < 40; i++) {
      const x = (i * 7919) % w;
      const y = ((i * 104729) % (h * 0.45)) | 0;
      this.sky
        .circle(x, y, (i % 3) * 0.5 + 0.6)
        .fill({ color: this.palette.stars, alpha: 0.35 + (i % 4) * 0.12 });
    }
  }

  private drawMountains(): void {
    const { width: w, height: h } = this;
    this.mountains.clear();
    for (const [color, base, amp, period] of [
      [this.palette.hills[0], 0.72, 0.16, 0.37],
      [this.palette.hills[1], 0.8, 0.12, 0.23],
    ] as const) {
      const points: number[] = [0, h];
      for (let x = 0; x <= w * 2; x += 24) {
        const y =
          h * (base - amp * Math.abs(Math.sin((x / w) * Math.PI * (1 / period) * 0.5)) * 0.9);
        points.push(x, y + Math.sin(x * 0.05) * 6);
      }
      points.push(w * 2, h);
      this.mountains.poly(points).fill(color);
    }
  }

  private drawWall(): void {
    const { width: w, height: h, unit } = this;
    const top = h - 44 * unit;
    this.wall.clear();
    this.wall.rect(0, top, w, h - top + h).fill(this.palette.wall);
    const merlon = 34 * unit;
    for (let x = 0; x < w; x += merlon * 2)
      this.wall.rect(x, top - 18 * unit, merlon, 18 * unit).fill(this.palette.wall);
    this.wall.rect(0, top, w, 3 * unit).fill({ color: this.palette.rim, alpha: 0.35 });
    this.ballista.position.set(this.pivot.x, this.pivot.y);
  }

  // ── per-frame pieces ─────────────────────────────────────────────────────

  private renderBackground(drop: number, distance: number): void {
    const { width: w, height: h, unit } = this;
    this.mountains.x = -wrap(distance * 0.05 * unit, w);
    this.mountains.y = drop * 0.35;

    for (const c of this.clouds) {
      const span = w + 400 * unit;
      const x =
        wrap(c.x * span - (distance + this.ambientMs * 0.01) * c.depth * unit, span) - 200 * unit;
      const y =
        wrap(c.y * h + drop * c.depth * 0.9 + distance * 0.35 * c.depth * unit, h + 200 * unit) -
        100 * unit;
      c.g.position.set(x, y);
    }
  }

  /** Returns how far the string is drawn (0 slack, 1 fully cranked). */
  private renderBallista(frame: SceneFrame): number {
    let draw = 0;
    let recoil = 0;
    if (frame.phase === 'betting') {
      draw = easeInOutCubic(clamp01(frame.bettingProgress / 0.9));
    } else if (frame.flightMs < 120) {
      draw = 1 - frame.flightMs / 120;
    }
    if (frame.phase !== 'betting')
      recoil = Math.max(0, 1 - frame.flightMs / 400) * Math.sin(frame.flightMs * 0.08);

    this.aim.x = -recoil * 6;
    this.winch.rotation = draw * Math.PI * 6;

    // Bow arms flex as the string is drawn; the string runs tip → nut → tip.
    const nut = lerp(NUT_REST, NUT_DRAWN, draw);
    const tipX = 88 - draw * 22;
    const tipY = 92 - draw * 10;
    const g = this.bow.clear();
    for (const s of [-1, 1]) {
      g.moveTo(108, s * 10)
        .quadraticCurveTo(124 - draw * 6, s * 56, tipX, s * tipY)
        .stroke({ width: 9, color: 0x4a2f1c, cap: 'round' });
      g.circle(tipX, s * tipY, 5).fill(0x3d4148);
    }
    g.moveTo(tipX, -tipY).lineTo(nut, 0).lineTo(tipX, tipY).stroke({ width: 2, color: 0xd9c9a3 });
    return draw;
  }

  private renderBolt(frame: SceneFrame, draw: number): void {
    const { unit } = this;
    const restTail = this.alongStock(lerp(NUT_REST, NUT_DRAWN, draw));
    this.trail.clear();
    this.bolt.tint = 0xffffff;
    this.bolt.alpha = 1;

    if (frame.phase === 'betting') {
      this.bolt.position.set(restTail.x, restTail.y);
      this.bolt.rotation = AIM;
      return;
    }

    const pos = this.flightPosition(frame.flightMs);
    if (frame.phase === 'crashed') this.applyBurn(pos, frame.sinceCrashMs);
    this.bolt.position.set(pos.x, pos.y);
    this.bolt.rotation =
      pos.angle + (frame.phase === 'crashed' ? this.fallSpin(frame.sinceCrashMs) : 0);

    if (frame.phase === 'running') {
      const speed = 70 + 45 * Math.log(frame.multiplier);
      const dx = Math.cos(pos.angle);
      const dy = Math.sin(pos.angle);
      for (let i = 0; i < 6; i++) {
        const offset = (i - 2.5) * 5 * unit;
        const len = speed * (0.6 + ((i * 37) % 10) / 20) * unit;
        const sx = pos.x - dy * offset;
        const sy = pos.y + dx * offset;
        this.trail
          .moveTo(sx, sy)
          .lineTo(sx - dx * len, sy - dy * len)
          .stroke({ width: 1.5 * unit, color: this.palette.accent, alpha: 0.14 + (i % 3) * 0.07 });
      }
    }
  }

  /** Bolt tail position and angle `t` ms after launch. */
  private flightPosition(t: number) {
    const start = this.alongStock(NUT_REST);
    const launch = easeOutCubic(clamp01(t / LAUNCH_MS));
    // Upper right, clear of the multiplier the client draws in the centre.
    const cruiseX = this.width * 0.64 - (BOLT_LENGTH / 2) * this.unit;
    const cruiseY = this.height * 0.24;
    const bob = Math.sin(t * 0.003) * 10 * this.unit * launch;
    return {
      x: lerp(start.x, cruiseX, launch),
      y: lerp(start.y, cruiseY, launch) + bob,
      angle: lerp(AIM, CRUISE_ANGLE, launch) + Math.sin(t * 0.004) * 0.03 * launch,
    };
  }

  private fallSpin(since: number): number {
    return since > 800 ? (since - 800) * 0.004 : 0;
  }

  private applyBurn(pos: { x: number; y: number }, since: number): void {
    const burnt = clamp01((since - 350) / 450);
    this.bolt.tint = mixColor(0xffffff, 0x2b1d18, burnt);
    if (since > 800) pos.y += 0.0011 * (since - 800) ** 2 * this.unit;
    this.bolt.alpha = 1 - clamp01((since - 1800) / 600);
    if (burnt > 0 && burnt < 1 && Math.random() < 0.6) {
      this.spawnEmber(pos.x + Math.cos(this.bolt.rotation) * BOLT_LENGTH * 0.5 * this.unit, pos.y);
    }
  }

  private renderCrash(frame: SceneFrame): void {
    const { root, wingFront, wingBack, mouth } = this.dragon;
    this.fire.clear();
    if (frame.phase !== 'crashed') {
      root.visible = false;
      return;
    }
    const t = frame.sinceCrashMs;
    const { unit, width: w } = this;
    // The dragon hovers relative to where the bolt was hit; the fire tracks the (falling) bolt.
    const hit = this.flightPosition(frame.flightMs);
    const hover = { x: hit.x + (BOLT_LENGTH * 0.6 + 200) * unit, y: hit.y - 30 * unit };
    const boltMid = {
      x: this.bolt.x + Math.cos(this.bolt.rotation) * BOLT_LENGTH * 0.6 * unit,
      y: this.bolt.y + Math.sin(this.bolt.rotation) * BOLT_LENGTH * 0.6 * unit,
    };

    const start = { x: w + 260 * unit, y: -160 * unit };
    const exit = { x: -320 * unit, y: -260 * unit };
    let x: number;
    let y: number;
    if (t < 500) {
      const k = easeOutBack(t / 500);
      x = lerp(start.x, hover.x, k);
      y = lerp(start.y, hover.y, k);
    } else if (t < 1300) {
      x = hover.x;
      y = hover.y + Math.sin((t - 500) * 0.006) * 8 * unit;
    } else {
      const k = easeInCubic(clamp01((t - 1300) / 1100));
      x = lerp(hover.x, exit.x, k);
      y = lerp(hover.y, exit.y, k);
    }
    root.visible = t < 2500;
    root.position.set(x, y);
    root.rotation = t < 1300 ? Math.sin(t * 0.004) * 0.05 : -0.25;
    const flap = Math.cos(this.ambientMs * (t < 500 || t > 1300 ? 0.025 : 0.012));
    wingFront.scale.y = flap;
    wingBack.scale.y = flap * 0.9;

    if (t > 300 && t < 1300)
      this.drawFire({ x: x + mouth.x * unit, y: y + mouth.y * unit }, boltMid, t);
  }

  private drawFire(from: { x: number; y: number }, to: { x: number; y: number }, t: number): void {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const len = Math.hypot(dx, dy);
    const nx = -dy / len;
    const ny = dx / len;
    const intensity = Math.min(1, (t - 300) / 150) * Math.min(1, (1300 - t) / 200);
    for (const [color, spread, alpha] of [
      [0xff3d12, 1, 0.55],
      [0xff8a1f, 0.65, 0.7],
      [0xffe27a, 0.3, 0.9],
    ] as const) {
      const width = (34 + Math.random() * 10) * spread * this.unit;
      this.fire
        .poly([
          from.x,
          from.y,
          to.x + nx * width,
          to.y + ny * width,
          to.x + dx * 0.08 + (Math.random() - 0.5) * 8,
          to.y + dy * 0.08 + (Math.random() - 0.5) * 8,
          to.x - nx * width,
          to.y - ny * width,
        ])
        .fill({ color, alpha: alpha * intensity });
    }
    if (Math.random() < 0.8) this.spawnEmber(to.x, to.y);
  }

  private spawnEmber(x: number, y: number): void {
    if (this.embers.length > 80) return;
    const g = new Graphics()
      .circle(0, 0, 1.5 + Math.random() * 2.5)
      .fill(Math.random() < 0.5 ? 0xffb347 : 0xff5a1f);
    this.emberLayer.addChild(g);
    this.embers.push({
      g,
      x,
      y,
      vx: (Math.random() - 0.5) * 0.25,
      vy: -0.05 - Math.random() * 0.15,
      life: 600 + Math.random() * 600,
    });
  }

  private updateEmbers(deltaMs: number): void {
    this.embers = this.embers.filter((e) => {
      e.life -= deltaMs;
      if (e.life <= 0) {
        e.g.destroy();
        return false;
      }
      e.x += e.vx * deltaMs;
      e.y += e.vy * deltaMs;
      e.vy += 0.0002 * deltaMs;
      e.g.position.set(e.x, e.y);
      e.g.alpha = Math.min(1, e.life / 400);
      return true;
    });
  }
}
