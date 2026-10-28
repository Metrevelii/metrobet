// oxlint-disable unicorn/no-array-fill-with-reference-type -- Pixi's Graphics.fill(), not Array.prototype.fill().
import { Container, Graphics } from 'pixi.js';

/**
 * Longshot art, ported from Skyforge: vector shapes in local units (the scene scales it). Swap
 * for sprites or Spine later without touching the choreography in scene.ts. The dragon, wood
 * and iron keep their art colours; the fletching and clouds take theme colours.
 */

export const BOLT_LENGTH = 185;

export function drawBolt(fletching: number, fletchingDark: number): Container {
  const bolt = new Container();
  const g = new Graphics();
  // Fletching
  g.poly([0, -3, 34, -3, 18, -16, 2, -16]).fill(fletching);
  g.poly([0, 3, 34, 3, 18, 16, 2, 16]).fill(fletchingDark);
  // Shaft
  g.roundRect(0, -3.5, 152, 7, 3).fill(0x6e4a2c);
  g.rect(40, -4.5, 6, 9).fill(0x3d4148);
  g.rect(120, -4.5, 6, 9).fill(0x3d4148);
  // Iron head
  g.poly([148, -9, 185, 0, 148, 9, 154, 0]).fill(0xb8c0c8);
  g.poly([154, 0, 185, 0, 148, 9]).fill(0x8a929b);
  bolt.addChild(g);
  return bolt;
}

/** Legs and deck of the ballista; does not rotate. */
export function drawBallistaBase(): Graphics {
  const g = new Graphics();
  const wood = 0x4f321d;
  g.moveTo(-30, 0).lineTo(-62, 74).stroke({ width: 10, color: wood, cap: 'round' });
  g.moveTo(30, 0).lineTo(62, 74).stroke({ width: 10, color: wood, cap: 'round' });
  g.moveTo(-46, 40).lineTo(46, 40).stroke({ width: 8, color: wood, cap: 'round' });
  g.circle(0, 0, 12).fill(0x3d4148);
  return g;
}

/** Stock (beam) of the ballista in aim space: +x points where it shoots. */
export function drawStock(): Graphics {
  const g = new Graphics();
  g.roundRect(-95, -8, 225, 16, 4).fill(0x6b4426);
  g.rect(-95, -2, 225, 4).fill({ color: 0x000000, alpha: 0.18 });
  for (const x of [-60, 20, 95]) g.rect(x, -9, 7, 18).fill(0x3d4148);
  return g;
}

export function drawWinch(): Graphics {
  const g = new Graphics();
  g.circle(0, 0, 18).stroke({ width: 5, color: 0x3d4148 });
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 4;
    g.moveTo(Math.cos(a) * -24, Math.sin(a) * -24)
      .lineTo(Math.cos(a) * 24, Math.sin(a) * 24)
      .stroke({ width: 4, color: 0x6b4426, cap: 'round' });
  }
  return g;
}

export interface Dragon {
  root: Container;
  wingFront: Graphics;
  wingBack: Graphics;
  /** Mouth in dragon-local units. */
  mouth: { x: number; y: number };
}

/** Dragon facing left (−x), origin at the body centre. */
export function drawDragon(): Dragon {
  const root = new Container();
  const body = 0x2b1014;
  const edge = 0xff6a2a;

  const wingBack = drawWing(0x1d0a0d);
  wingBack.position.set(10, -14);
  wingBack.scale.x = 0.85;

  const g = new Graphics();
  // Tail
  g.poly([40, -6, 110, 4, 175, -18, 185, -12, 115, 16, 40, 12]).fill(body);
  g.poly([175, -18, 200, -26, 186, -6]).fill(body);
  // Body
  g.ellipse(0, 0, 58, 24).fill(body);
  g.ellipse(-4, 6, 44, 12).fill({ color: 0x5a2420, alpha: 0.8 });
  // Legs
  g.moveTo(-20, 16).lineTo(-30, 38).stroke({ width: 7, color: body, cap: 'round' });
  g.moveTo(25, 16).lineTo(20, 40).stroke({ width: 7, color: body, cap: 'round' });
  // Neck and head
  g.poly([-40, -14, -88, -40, -100, -32, -48, 8]).fill(body);
  g.poly([-86, -46, -128, -34, -132, -26, -98, -18, -84, -24]).fill(body);
  g.poly([-96, -44, -78, -66, -88, -42]).fill(body);
  g.poly([-88, -44, -64, -60, -80, -40]).fill(body);
  g.circle(-104, -36, 3).fill(0xffb347);
  g.moveTo(-58, -20).lineTo(30, -16).stroke({ width: 2, color: edge, alpha: 0.35 });

  const wingFront = drawWing(0x3d1418);
  wingFront.position.set(-6, -16);

  root.addChild(wingBack, g, wingFront);
  return { root, wingFront, wingBack, mouth: { x: -132, y: -29 } };
}

function drawWing(color: number): Graphics {
  const g = new Graphics();
  g.poly([0, 0, 30, -95, 95, -135, 78, -70, 130, -82, 92, -30, 140, -30, 60, 4]).fill(color);
  g.moveTo(0, 0).lineTo(95, -135).stroke({ width: 4, color: 0x14070a, cap: 'round' });
  g.moveTo(30, -60).lineTo(130, -82).stroke({ width: 3, color: 0x14070a, cap: 'round' });
  g.moveTo(40, -20).lineTo(140, -30).stroke({ width: 3, color: 0x14070a, cap: 'round' });
  return g;
}

export function drawCloud(seed: number, color: number): Graphics {
  const g = new Graphics();
  const puffs = 5 + (seed % 3);
  for (let i = 0; i < puffs; i++) {
    const x = (i - puffs / 2) * 34 + ((seed * 13 + i * 7) % 11);
    const r = 26 + ((seed * 7 + i * 17) % 22);
    g.circle(x, -r * 0.4, r).fill({ color, alpha: 0.9 });
  }
  g.ellipse(0, 0, puffs * 22, 18).fill({ color, alpha: 0.9 });
  return g;
}
