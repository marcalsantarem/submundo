import Phaser from 'phaser';
import type { Vector2D } from '../../core/index';
import type { VillageNpcId } from '../../core/progression/VillageHub';
import { DF_FONTS } from '../ui/DarkFantasyUiBuilder';
import {
  GORRAN_HAMMER_IMPACT_FRAME,
  GORRAN_HAMMER_IMPACT_OFFSET,
  VILLAGE_ANIMS,
  VILLAGE_FRAMES,
  VILLAGE_ORIGINS,
  VILLAGE_TEXTURES,
  villageFootprint,
  type VillageTextureKey,
} from './VillageAssets';

/**
 * Vila Natal (T-138): mapa de 32x13 tiles com o layout de
 * `scripts/art/buildMockupVillageHub.py` (mockup aprovado). Tudo em pixels de
 * mundo (1:1 com a folha); a câmera aplica o zoom 1.45 da HubScene.
 */
export const VILLAGE_TILE = 32;
export const VILLAGE_COLS = 32;
export const VILLAGE_ROWS = 13;
export const VILLAGE_MAP_W = VILLAGE_COLS * VILLAGE_TILE;
export const VILLAGE_MAP_H = VILLAGE_ROWS * VILLAGE_TILE;

/** Escala dos atores (herói e NPCs), igual ao mockup. */
export const VILLAGE_ACTOR_SCALE = 0.88;
/** Distância do centro do sprite do herói (80x80, origem 0.5) até os pés. */
export const HERO_FEET_OFFSET = 36 * VILLAGE_ACTOR_SCALE;

const TOP_Y = 144;
const EAST_X = 1008;
const BOT_Y = 380;
export const VILLAGE_GATE_X = 831;
const GATE_Y = TOP_Y + 4;

const HERO_START: Vector2D = { x: 672, y: 244 };
const HERO_GATE: Vector2D = { x: VILLAGE_GATE_X, y: 184 };
const CAMPFIRE: Vector2D = { x: 752, y: 262 };
const FORGE: Vector2D = { x: 945, y: 217 };
const BRAZIER: Vector2D = { x: 614, y: 195 };
const HOUSE: Vector2D = { x: 590, y: 165 };
const TORCHES: readonly Vector2D[] = [
  { x: 500, y: TOP_Y + 6 },
  { x: 686, y: TOP_Y + 6 },
  { x: 744, y: TOP_Y + 8 },
  { x: 918, y: TOP_Y + 8 },
  { x: 520, y: 352 },
  { x: 760, y: 362 },
];

export type VillageInteractableId = VillageNpcId | 'gate';

interface VillageNpcConfig {
  id: VillageNpcId;
  label: string;
  texture: VillageTextureKey;
  anim: string;
  pos: Vector2D;
  /** Altura da cabeça acima dos pés (px de mundo), para o nome e o "!". */
  headHeight: number;
}

export const VILLAGE_NPCS: readonly VillageNpcConfig[] = [
  {
    id: 'master',
    label: 'Mestre de Armas',
    texture: VILLAGE_TEXTURES.npcMaster,
    anim: VILLAGE_ANIMS.masterIdle,
    pos: { x: 524, y: 251 },
    headHeight: 58,
  },
  {
    id: 'lyra',
    label: 'Lyra',
    texture: VILLAGE_TEXTURES.npcLyra,
    anim: VILLAGE_ANIMS.lyraIdle,
    pos: { x: 569, y: 207 },
    headHeight: 56,
  },
  {
    id: 'gorran',
    label: 'Gorran',
    texture: VILLAGE_TEXTURES.npcGorran,
    anim: VILLAGE_ANIMS.gorranHammer,
    pos: { x: 886, y: 231 },
    headHeight: 60,
  },
];

/** Pontos de referência para o minimapa da HUD. */
export const VILLAGE_LANDMARKS = {
  gate: { x: VILLAGE_GATE_X, y: TOP_Y },
  house: HOUSE,
  campfire: CAMPFIRE,
  forge: FORGE,
  topY: TOP_Y,
  bottomY: BOT_Y,
  eastX: EAST_X,
} as const;

const NPC_INTERACT_RADIUS = 46;
const HERO_HALF_W = 8;
const HERO_FOOT_H = 6;
const MIN_X = 14;
const MAX_X = VILLAGE_MAP_W - 14;
const MIN_Y = TOP_Y + 6;
const MAX_Y = VILLAGE_MAP_H - 6;

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Hash determinístico idêntico ao `h01` de `scripts/art/buildVillageHub.py`. */
export function villageHash01(x: number, y: number, s = 0): number {
  let n =
    (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(s, 982451653)) >>> 0;
  n = Math.imul((n ^ (n >>> 13)) >>> 0, 1274126177) >>> 0;
  n = (n ^ (n >>> 16)) >>> 0;
  return (n & 0xffffff) / 0x1000000;
}

/** Nome do tile de chão em cada célula (Wang de cantos, como o mockup). */
export function buildVillageGroundFrames(): string[][] {
  const V: number[][] = [];
  for (let r = 0; r <= VILLAGE_ROWS; r++) {
    const row: number[] = [];
    for (let c = 0; c <= VILLAGE_COLS; c++) {
      let v = 1;
      if (r >= 5 && r <= 11 && c >= 1 && c <= 31) v = 0;
      if (r === 4 && c >= 3 && c <= 30 && villageHash01(c, r, 5) > 0.3) v = 0;
      if (r === 12 && c >= 6 && c <= 28 && villageHash01(c, r, 6) > 0.35) v = 0;
      row.push(v);
    }
    V.push(row);
  }
  for (const [r, c] of [
    [5, 14], [5, 15], [11, 17], [11, 18], [10, 18], [6, 30], [7, 30], [10, 22],
  ]) {
    V[r][c] = 1;
  }
  for (let r = 0; r < 6; r++) {
    for (const c of [25, 26, 27]) V[r][c] = 0;
  }
  const dirt = [
    'dirt_0', 'dirt_1', 'dirt_2', 'dirt_3', 'dirt_0', 'dirt_2', 'dirt_pebbles',
    'dirt_tufts', 'dirt_cracks', 'dirt_damp', 'dirt_tufts', 'dirt_1',
  ];
  const grass = [
    'grass_0', 'grass_1', 'grass_2', 'grass_0', 'grass_flowers', 'grass_tall', 'grass_tall',
  ];
  const out: string[][] = [];
  for (let r = 0; r < VILLAGE_ROWS; r++) {
    const row: string[] = [];
    for (let c = 0; c < VILLAGE_COLS; c++) {
      const b = [V[r][c], V[r][c + 1], V[r + 1][c], V[r + 1][c + 1]];
      const key = b.join('');
      if (key === '0000') {
        row.push(
          (c === 25 || c === 26) && r <= 5
            ? 'path_v'
            : dirt[Math.floor(villageHash01(c, r, 77) * 12)]
        );
      } else if (key === '1111') {
        row.push(grass[Math.floor(villageHash01(c, r, 78) * 7)]);
      } else {
        row.push(`edge_${key}`);
      }
    }
    out.push(row);
  }
  return out;
}

interface VillageObjectSpec {
  texture: VillageTextureKey;
  frame: string;
  x: number;
  y: number;
  anim?: string;
  animOffset?: number;
  /** Força a profundidade como se os pés estivessem nesta altura. */
  sortY?: number;
}

function buildObjectSpecs(): VillageObjectSpec[] {
  const T = VILLAGE_TILE;
  const P = VILLAGE_TEXTURES.palisade;
  const o: VillageObjectSpec[] = [];
  const hFrames = ['h_0', 'h_1', 'h_1', 'h_broken', 'h_0'];
  for (let c = 0; c < VILLAGE_COLS; c++) {
    if ((c >= 24 && c <= 27) || c === 31) continue;
    o.push({ texture: P, frame: hFrames[c % 5], x: c * T + 16, y: TOP_Y });
  }
  o.push({ texture: P, frame: 'corner', x: EAST_X, y: TOP_Y });
  for (let y = TOP_Y + 32; y < BOT_Y; y += 32) {
    o.push({ texture: P, frame: Math.floor(y / 32) % 2 ? 'v_0' : 'v_1', x: EAST_X, y });
  }
  const bFrames = ['h_1', 'h_0', 'h_broken', 'h_0'];
  for (let c = 11; c < 31; c++) {
    o.push({ texture: P, frame: bFrames[c % 4], x: c * T + 16, y: BOT_Y });
  }
  o.push({ texture: P, frame: 'corner', x: EAST_X, y: BOT_Y });
  o.push({ texture: P, frame: 'post', x: 10 * T + 22, y: BOT_Y });
  for (const [x, y] of [[392, 330], [412, 342], [436, 352]]) {
    o.push({ texture: P, frame: 'spikes', x, y });
  }
  o.push({ texture: VILLAGE_TEXTURES.house, frame: 'house', ...HOUSE });
  o.push({
    texture: VILLAGE_TEXTURES.campfire,
    frame: 'campfire_2',
    ...CAMPFIRE,
    anim: VILLAGE_ANIMS.campfire,
    animOffset: 2,
  });
  o.push({
    texture: VILLAGE_TEXTURES.forge,
    frame: 'forge_2',
    ...FORGE,
    anim: VILLAGE_ANIMS.forge,
    animOffset: 2,
  });
  o.push({
    texture: VILLAGE_TEXTURES.brazier,
    frame: 'brazier_1',
    ...BRAZIER,
    anim: VILLAGE_ANIMS.brazier,
    animOffset: 1,
  });
  TORCHES.forEach((t, i) => {
    o.push({
      texture: VILLAGE_TEXTURES.torch,
      frame: `torch_${i % 4}`,
      ...t,
      anim: VILLAGE_ANIMS.torch,
      animOffset: i % 4,
    });
  });
  const PR = VILLAGE_TEXTURES.props;
  o.push({ texture: VILLAGE_TEXTURES.cart, frame: 'cart', x: 714, y: 160 });
  o.push({ texture: PR, frame: 'crate', x: 668, y: 150 });
  o.push({ texture: PR, frame: 'sacks', x: 770, y: 168 });
  o.push({ texture: PR, frame: 'firewood', x: 412, y: 190 });
  o.push({ texture: PR, frame: 'weapon_rack', x: 462, y: 238 });
  o.push({ texture: PR, frame: 'herb_rack', x: 478, y: 186 });
  o.push({ texture: PR, frame: 'pots', x: 655, y: 174 });
  o.push({ texture: PR, frame: 'barrel', x: 978, y: 252 });
  o.push({ texture: PR, frame: 'barrel', x: 990, y: 270 });
  o.push({ texture: PR, frame: 'bucket', x: 912, y: 290 });
  o.push({ texture: PR, frame: 'bench', x: 700, y: 316 });
  // Bigorna sob o impacto do martelo do Gorran (face = 36 px acima dos pés).
  // Pedido do dono: a bigorna não cobre o Gorran -> ordena logo atrás dele.
  const gorran = VILLAGE_NPCS.find((n) => n.id === 'gorran')!.pos;
  const impact = gorranImpactPoint(gorran);
  o.push({
    texture: PR,
    frame: 'anvil',
    x: impact.x + 1,
    y: impact.y + 36,
    sortY: gorran.y - 0.5,
  });
  return o;
}

function gorranImpactPoint(feet: Vector2D): Vector2D {
  return {
    x: feet.x + GORRAN_HAMMER_IMPACT_OFFSET.dx * VILLAGE_ACTOR_SCALE,
    y: feet.y + GORRAN_HAMMER_IMPACT_OFFSET.dy * VILLAGE_ACTOR_SCALE,
  };
}

/** Profundidade pelos pés: 10..40 (abaixo do limiar 50 da câmera de UI). */
export function villageDepthForY(feetY: number): number {
  const t = Phaser.Math.Clamp(feetY / VILLAGE_MAP_H, 0, 1);
  return 10 + t * 30;
}

interface VillageLight {
  image: Phaser.GameObjects.Image;
  baseAlpha: number;
  baseScale: number;
  seed: number;
}

interface VillageNpcView {
  config: VillageNpcConfig;
  sprite: Phaser.GameObjects.Sprite;
  label: Phaser.GameObjects.Text;
}

export interface VillageProximity {
  id: VillageInteractableId;
  label: string;
}

/** Constrói e mantém a cena 2.5D da Vila (chão, objetos, luzes, NPCs, colisão). */
export class VillageWorld {
  private readonly scene: Phaser.Scene;
  private readonly objects: Phaser.GameObjects.GameObject[] = [];
  private readonly staticRects: Rect[] = [];
  private gateRects: Rect[] = [];
  private gateSprite?: Phaser.GameObjects.Sprite;
  private gateOpen = false;
  private readonly lights: VillageLight[] = [];
  private readonly npcs: VillageNpcView[] = [];
  private readonly alertMarker: Phaser.GameObjects.Graphics;
  private alertNpcId: VillageNpcId | null = null;
  private readonly sparkGfx: Phaser.GameObjects.Graphics;
  private sparkStartMs = -1;
  private readonly heroShadow: Phaser.GameObjects.Ellipse;
  private nowMs = 0;

  constructor(scene: Phaser.Scene, gateOpen: boolean) {
    this.scene = scene;
    this.buildGround();
    this.buildObjects();
    this.buildGate(gateOpen);
    this.buildNpcs();
    this.buildLighting();

    this.heroShadow = scene.add
      .ellipse(0, 0, 30, 9, 0x000000, 0.42)
      .setDepth(2);
    this.objects.push(this.heroShadow);

    this.alertMarker = scene.add.graphics().setDepth(44);
    this.objects.push(this.alertMarker);
    this.sparkGfx = scene.add.graphics().setDepth(41).setBlendMode(Phaser.BlendModes.ADD);
    this.objects.push(this.sparkGfx);
  }

  public static get mapWidth(): number {
    return VILLAGE_MAP_W;
  }

  public static get mapHeight(): number {
    return VILLAGE_MAP_H;
  }

  public getSpawn(point: 'start' | 'gate'): Vector2D {
    return point === 'gate' ? { ...HERO_GATE } : { ...HERO_START };
  }

  public isGateOpen(): boolean {
    return this.gateOpen;
  }

  public setGateOpen(open: boolean): void {
    this.gateOpen = open;
    const frame = open ? 'gate_open' : 'gate_closed';
    this.gateRects = this.footprintRects(
      VILLAGE_TEXTURES.gate,
      frame,
      VILLAGE_GATE_X,
      GATE_Y
    );
    if (this.gateSprite) {
      this.setSpriteFrame(this.gateSprite, VILLAGE_TEXTURES.gate, frame);
    }
  }

  public setAlertNpc(id: VillageNpcId | null): void {
    this.alertNpcId = id;
  }

  /** Move os pés de `from` para `to` deslizando nas colisões (eixo a eixo). */
  public resolveMove(from: Vector2D, to: Vector2D): Vector2D {
    const tx = Phaser.Math.Clamp(to.x, MIN_X, MAX_X);
    const ty = Phaser.Math.Clamp(to.y, MIN_Y, MAX_Y);
    let x = from.x;
    let y = from.y;
    if (!this.collides(tx, y)) x = tx;
    if (!this.collides(x, ty)) y = ty;
    return { x, y };
  }

  public collides(x: number, y: number): boolean {
    const hx = x - HERO_HALF_W;
    const hy = y - HERO_FOOT_H;
    const hw = HERO_HALF_W * 2;
    const hh = HERO_FOOT_H;
    const test = (r: Rect) =>
      hx < r.x + r.w && hx + hw > r.x && hy < r.y + r.h && hy + hh > r.y;
    return this.staticRects.some(test) || this.gateRects.some(test);
  }

  /** NPC ou portão ao alcance dos pés do herói (o mais próximo). */
  public findInteractable(feet: Vector2D): VillageProximity | null {
    let best: VillageProximity | null = null;
    let bestD = Number.POSITIVE_INFINITY;
    for (const npc of this.npcs) {
      const d = Math.hypot(feet.x - npc.config.pos.x, feet.y - npc.config.pos.y);
      if (d <= NPC_INTERACT_RADIUS && d < bestD) {
        bestD = d;
        best = { id: npc.config.id, label: npc.config.label };
      }
    }
    const gdx = Math.abs(feet.x - VILLAGE_GATE_X);
    const gd = Math.hypot(gdx, Math.max(0, feet.y - (GATE_Y + 6)));
    if (gdx <= 56 && feet.y <= GATE_Y + 44 && gd < bestD) {
      best = { id: 'gate', label: 'Portão' };
    }
    return best;
  }

  public getNpcPosition(id: VillageNpcId): Vector2D {
    const npc = VILLAGE_NPCS.find((n) => n.id === id)!;
    return { ...npc.pos };
  }

  /** Ponto em frente ao NPC/portão para o debug teletransportar o herói. */
  public getApproachPoint(id: VillageInteractableId): Vector2D {
    if (id === 'gate') {
      return { x: VILLAGE_GATE_X, y: GATE_Y + 26 };
    }
    const p = this.getNpcPosition(id);
    return { x: p.x + 4, y: p.y + 20 };
  }

  public update(timeMs: number, heroFeet: Vector2D, highlightId: VillageInteractableId | null): void {
    this.nowMs = timeMs;
    this.heroShadow.setPosition(heroFeet.x + 1, heroFeet.y - 1);

    for (const l of this.lights) {
      const f =
        Math.sin(timeMs * 0.011 + l.seed) * 0.5 + Math.sin(timeMs * 0.027 + l.seed * 2.3) * 0.5;
      l.image.setAlpha(l.baseAlpha * (0.86 + f * 0.1));
      l.image.setScale(l.baseScale * (1 + f * 0.025));
    }

    for (const npc of this.npcs) {
      const near = highlightId === npc.config.id;
      npc.label.setColor(near ? '#fff7d6' : '#f3e6cc');
      npc.label.setScale(near ? 1.06 : 1);
    }

    this.drawAlertMarker(timeMs);
    this.drawSparks(timeMs);
  }

  public destroy(): void {
    for (const obj of this.objects) {
      obj.destroy();
    }
    this.objects.length = 0;
    this.lights.length = 0;
    this.npcs.length = 0;
  }

  // ---------------------------------------------------------------------------

  private hasFrame(texture: string, index: number): boolean {
    return this.scene.textures.exists(texture) && this.scene.textures.get(texture).has(String(index));
  }

  private frameIndex(texture: VillageTextureKey, frame: string): number {
    const table = VILLAGE_FRAMES[texture] as Readonly<Record<string, number>>;
    const idx = table[frame] ?? 0;
    return this.hasFrame(texture, idx) ? idx : 0;
  }

  private setSpriteFrame(
    sprite: Phaser.GameObjects.Sprite | Phaser.GameObjects.Image,
    texture: VillageTextureKey,
    frame: string
  ): void {
    if (this.scene.textures.exists(texture)) {
      sprite.setFrame(this.frameIndex(texture, frame));
    }
  }

  private footprintRects(texture: VillageTextureKey, frame: string, x: number, y: number): Rect[] {
    return villageFootprint(texture, frame).map((f) => ({ x: x + f.x, y: y + f.y, w: f.w, h: f.h }));
  }

  private buildGround(): void {
    const key = VILLAGE_TEXTURES.tiles;
    const frames = buildVillageGroundFrames();
    const rt = this.scene.add
      .renderTexture(0, 0, VILLAGE_MAP_W, VILLAGE_MAP_H)
      .setOrigin(0, 0)
      .setDepth(1);
    if (this.scene.textures.exists(key)) {
      for (let r = 0; r < VILLAGE_ROWS; r++) {
        for (let c = 0; c < VILLAGE_COLS; c++) {
          const idx = this.frameIndex(key, frames[r][c]);
          rt.drawFrame(key, idx, c * VILLAGE_TILE, r * VILLAGE_TILE);
        }
      }
    } else {
      rt.fill(0x3f3a2c, 1);
    }
    rt.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.objects.push(rt);
  }

  private addWorldSprite(spec: VillageObjectSpec): Phaser.GameObjects.Sprite {
    const origin = VILLAGE_ORIGINS[spec.texture];
    const sprite = this.scene.add
      .sprite(spec.x, spec.y, spec.texture, this.frameIndex(spec.texture, spec.frame))
      .setOrigin(origin.x, origin.y)
      .setDepth(villageDepthForY(spec.sortY ?? spec.y));
    if (spec.anim && this.scene.anims.exists(spec.anim)) {
      sprite.play({ key: spec.anim, startFrame: spec.animOffset ?? 0 });
    }
    this.objects.push(sprite);
    return sprite;
  }

  private buildObjects(): void {
    for (const spec of buildObjectSpecs()) {
      this.addWorldSprite(spec);
      this.staticRects.push(...this.footprintRects(spec.texture, spec.frame, spec.x, spec.y));
    }
  }

  private buildGate(open: boolean): void {
    this.gateSprite = this.addWorldSprite({
      texture: VILLAGE_TEXTURES.gate,
      frame: open ? 'gate_open' : 'gate_closed',
      x: VILLAGE_GATE_X,
      y: GATE_Y,
    });
    this.setGateOpen(open);
  }

  private buildNpcs(): void {
    for (const cfg of VILLAGE_NPCS) {
      const shadow = this.scene.add
        .ellipse(cfg.pos.x + 1, cfg.pos.y - 1, 30, 9, 0x000000, 0.42)
        .setDepth(2);
      this.objects.push(shadow);

      const origin = VILLAGE_ORIGINS[cfg.texture];
      const sprite = this.scene.add
        .sprite(cfg.pos.x, cfg.pos.y, cfg.texture, 0)
        .setOrigin(origin.x, origin.y)
        .setScale(VILLAGE_ACTOR_SCALE)
        .setDepth(villageDepthForY(cfg.pos.y));
      if (this.scene.anims.exists(cfg.anim)) {
        sprite.play(cfg.anim);
      } else if (cfg.id === 'gorran' && this.scene.anims.exists(VILLAGE_ANIMS.gorranIdle)) {
        sprite.play(VILLAGE_ANIMS.gorranIdle);
      }
      if (cfg.id === 'gorran') {
        sprite.on(
          Phaser.Animations.Events.ANIMATION_UPDATE,
          (_anim: Phaser.Animations.Animation, frame: Phaser.Animations.AnimationFrame) => {
            if (Number(frame.textureFrame) === GORRAN_HAMMER_IMPACT_FRAME) {
              this.sparkStartMs = this.nowMs;
            }
          }
        );
      }
      this.objects.push(sprite);

      // Colisão pequena nos pés do NPC.
      this.staticRects.push({ x: cfg.pos.x - 10, y: cfg.pos.y - 6, w: 20, h: 6 });

      const label = this.scene.add
        .text(cfg.pos.x, cfg.pos.y - cfg.headHeight, cfg.label, {
          fontFamily: DF_FONTS.BODY,
          fontSize: '8.5px',
          color: '#f3e6cc',
          fontStyle: 'bold',
          stroke: '#05070c',
          strokeThickness: 2.4,
          resolution: 3,
        })
        .setOrigin(0.5, 1)
        .setDepth(43);
      this.objects.push(label);
      this.npcs.push({ config: cfg, sprite, label });
    }

  }

  private addLight(
    x: number,
    y: number,
    radius: number,
    tint: number,
    alpha: number,
    seed: number
  ): void {
    const key = VILLAGE_TEXTURES.light;
    if (!this.hasFrame(key, 0)) {
      return;
    }
    const frameW = this.scene.textures.get(key).get(0).width || 128;
    const scale = (radius * 2) / frameW;
    const image = this.scene.add
      .image(x, y, key, 0)
      .setOrigin(0.5)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setTint(tint)
      .setAlpha(alpha)
      .setScale(scale)
      .setDepth(45);
    this.objects.push(image);
    this.lights.push({ image, baseAlpha: alpha, baseScale: scale, seed });
  }

  private buildLighting(): void {
    // Tom quente de fim de tarde (multiplicado sobre o mundo; o HUD fica fora).
    const warm = this.scene.add
      .rectangle(0, 0, VILLAGE_MAP_W, VILLAGE_MAP_H, 0xc2a688, 1)
      .setOrigin(0, 0)
      .setBlendMode(Phaser.BlendModes.MULTIPLY)
      .setDepth(44.5);
    this.objects.push(warm);

    this.addLight(CAMPFIRE.x, CAMPFIRE.y - 16, 120, 0xffa04a, 1, 0.3);
    this.addLight(CAMPFIRE.x, CAMPFIRE.y - 20, 30, 0xffe0a0, 0.75, 1.7);
    this.addLight(FORGE.x, FORGE.y - 26, 74, 0xff8a3a, 0.85, 2.1);
    this.addLight(BRAZIER.x, BRAZIER.y - 30, 58, 0xffa04a, 0.85, 3.4);
    TORCHES.forEach((t, i) => {
      this.addLight(t.x, t.y - 56, 50, 0xffa850, 0.85, 4 + i * 1.3);
    });
    // Placa "SAÍDA": luz das tochas do portão, sem vinheta por cima (pedido do dono).
    this.addLight(VILLAGE_GATE_X, GATE_Y - 112, 60, 0xffc070, 0.5, 9.1);
    // Janelas da casa.
    for (const wx of [43, 133]) {
      this.addLight(HOUSE.x - 88 + wx, HOUSE.y - 30, 18, 0xffb050, 0.45, 11 + wx);
    }
  }

  private drawAlertMarker(timeMs: number): void {
    const g = this.alertMarker;
    g.clear();
    if (!this.alertNpcId) {
      return;
    }
    const npc = this.npcs.find((n) => n.config.id === this.alertNpcId);
    if (!npc) {
      return;
    }
    const pulse = 0.5 + Math.sin(timeMs * 0.006) * 0.5;
    const s = 0.62 + pulse * 0.08;
    const ex = npc.config.pos.x;
    const ey = npc.config.pos.y - npc.config.headHeight - 22 - pulse * 2;
    g.fillStyle(0xfacc15, 0.1 + pulse * 0.1);
    g.fillCircle(ex, ey - 4 * s, 15 * s);
    for (const [grow, color] of [
      [2.2, 0x28160a],
      [0, 0xfacc15],
    ] as const) {
      g.fillStyle(color, 1);
      g.fillPoints(
        [
          { x: ex - (5 + grow) * s, y: ey - (20 + grow) * s },
          { x: ex + (5 + grow) * s, y: ey - (20 + grow) * s },
          { x: ex + (2.4 + grow) * s, y: ey + (4 + grow) * s },
          { x: ex - (2.4 + grow) * s, y: ey + (4 + grow) * s },
        ],
        true
      );
      g.fillCircle(ex, ey + 11 * s, (3.6 + grow) * s);
    }
    g.fillStyle(0xfff1a0, 0.9);
    g.fillRect(ex - 3.5 * s, ey - 18.5 * s, 2 * s, 19 * s);
  }

  private drawSparks(timeMs: number): void {
    const g = this.sparkGfx;
    g.clear();
    if (this.sparkStartMs < 0) {
      return;
    }
    const t = (timeMs - this.sparkStartMs) / 240;
    if (t < 0 || t > 1) {
      return;
    }
    const gorran = VILLAGE_NPCS.find((n) => n.id === 'gorran')!.pos;
    const p = gorranImpactPoint(gorran);
    const fade = 1 - t;
    g.fillStyle(0xffd27a, 0.55 * fade);
    g.fillCircle(p.x, p.y, 4 + t * 6);
    g.fillStyle(0xfffadc, fade);
    g.fillCircle(p.x, p.y - 1, 1.6);
    for (let k = 0; k < 9; k++) {
      const a = Phaser.Math.DegToRad(-160 + k * 20 + (k % 2 ? 7 : -5));
      const len = 7 + ((k * 7) % 9);
      const d0 = len * t;
      const d1 = d0 + 3;
      g.lineStyle(1, k % 2 ? 0xfdba46 : 0xfff4c4, fade);
      g.lineBetween(
        p.x + Math.cos(a) * d0,
        p.y + Math.sin(a) * d0 * 0.8 - 1 + t * t * 6,
        p.x + Math.cos(a) * d1,
        p.y + Math.sin(a) * d1 * 0.8 - 1 + t * t * 6
      );
    }
  }
}
