import Phaser from 'phaser';
import {
  DEFAULT_SKILLS,
  distanceBetween,
  tickCombat,
  triggerHeroSkill,
  type CombatEvent,
} from '../../core/combat/CombatEngine';
import {
  advanceToNextRoom,
  createDungeonRun,
  evaluateRoomState,
  getCurrentRoom,
  type DungeonRunState,
} from '../../core/dungeon/DungeonRun';
import { createHero, moveHero, type HeroState } from '../../core/entities/Hero';
import { spawnMonster, type MonsterInstance } from '../../core/entities/Monster';
import {
  resolveViewportConfig,
  type MonsterDef,
  type SkillDef,
  type Vector2D,
} from '../../core/index';
import dialoguesData from '../../data/dialogues.json';
import monstersJson from '../../data/monsters.json';
import skillsJson from '../../data/skills.json';
import {
  CombatVfxManager,
  registerGameAnimations,
} from '../sprites/CombatVfx';
import { DungeonHud, type HudSnapshot } from '../ui/DungeonHud';

interface MonsterVisual {
  sprite: Phaser.GameObjects.Sprite;
  hpBar: Phaser.GameObjects.Graphics;
}

export interface SubmundoDebugApi {
  scene: DungeonScene;
  getRunState: () => DungeonRunState;
  getHero: () => HeroState;
  getMonsters: () => MonsterInstance[];
  triggerSkill: (id: string) => CombatEvent[];
  forceClearRoom: () => void;
  advanceRoom: () => void;
  restartRun: () => void;
}

declare global {
  interface Window {
    __SUBMUNDO_DEBUG__?: SubmundoDebugApi;
  }
}

const TILE_DISPLAY_SIZE = 32;
const ARENA_PADDING = 36;
const ROOM_CLEAR_AUTO_ADVANCE_MS = 1200;

export class DungeonScene extends Phaser.Scene {
  private readonly monstersCatalog: MonsterDef[] =
    monstersJson as MonsterDef[];
  private readonly skillsCatalog: SkillDef[] =
    (skillsJson as SkillDef[]) ?? DEFAULT_SKILLS;
  private readonly monsterDefMap = new Map<string, MonsterDef>();

  private runState!: DungeonRunState;
  private hero!: HeroState;
  private monsters: MonsterInstance[] = [];

  private vfx!: CombatVfxManager;
  private hud!: DungeonHud;

  private arenaLayer!: Phaser.GameObjects.Container;
  private lightingGraphics!: Phaser.GameObjects.Graphics;
  private heroAura!: Phaser.GameObjects.Graphics;
  private heroSprite!: Phaser.GameObjects.Sprite;
  private readonly monsterVisuals = new Map<string, MonsterVisual>();

  private portalContainer?: Phaser.GameObjects.Container;
  private portalPosition?: Vector2D;

  private elapsedTimeMs = 0;
  private roomClearTimerMs = 0;
  private bannerText?: string;
  private bannerExpiresAtMs = 0;
  private runSeedCounter = 1337;

  constructor() {
    super({ key: 'DungeonScene' });
    for (const def of this.monstersCatalog) {
      this.monsterDefMap.set(def.id, def);
    }
  }

  public create(): void {
    this.cameras.main.setBackgroundColor('#09090b');
    registerGameAnimations(this);

    this.arenaLayer = this.add.container(0, 0).setDepth(1);
    this.lightingGraphics = this.add.graphics().setDepth(5);
    this.heroAura = this.add.graphics().setDepth(19);

    this.vfx = new CombatVfxManager(this);
    this.hud = new DungeonHud(this, this.skillsCatalog, {
      onUseSkill: (skillId: string) => {
        this.handleUseSkill(skillId);
      },
      onRestartRun: () => {
        this.startNewRun();
      },
    });

    this.startNewRun();

    const onResize = (gameSize: Phaser.Structs.Size) => {
      this.handleViewportResize(gameSize.width, gameSize.height);
    };
    this.scale.on('resize', onResize);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off('resize', onResize);
      this.clearMonsterVisuals();
      this.destroyPortal();
      this.hud?.destroy();
    });

    if (typeof window !== 'undefined') {
      window.__SUBMUNDO_DEBUG__ = {
        scene: this,
        getRunState: () => this.runState,
        getHero: () => this.hero,
        getMonsters: () => this.monsters,
        triggerSkill: (id: string) => this.handleUseSkill(id),
        forceClearRoom: () => this.forceClearRoom(),
        advanceRoom: () => this.advanceRoomNow(),
        restartRun: () => this.startNewRun(),
      };
    }
  }

  public update(_time: number, delta: number): void {
    if (!this.runState || !this.hero || !this.hud) {
      return;
    }

    const clampedDelta = Math.min(Math.max(0, delta), 100);
    this.elapsedTimeMs += clampedDelta;
    const nowMs = this.elapsedTimeMs;

    const bounds = {
      width: this.scale.width || 800,
      height: this.scale.height || 600,
      padding: ARENA_PADDING,
    };

    const moveDir = this.hud.getMoveVector();

    if (this.runState.status === 'in_progress' && this.hero.isAlive) {
      this.runState.elapsedMs += clampedDelta;

      moveHero(this.hero, moveDir, clampedDelta, bounds);

      const events = tickCombat(
        this.hero,
        this.monsters,
        clampedDelta,
        nowMs
      );
      this.processCombatEvents(events);
      this.checkAndUpdateRoomState(nowMs);
    } else if (this.runState.status === 'room_cleared' && this.hero.isAlive) {
      moveHero(this.hero, moveDir, clampedDelta, bounds);
      this.roomClearTimerMs -= clampedDelta;

      const touchedPortal =
        this.portalPosition !== undefined &&
        distanceBetween(this.hero.position, this.portalPosition) <= 42;

      if (touchedPortal || this.roomClearTimerMs <= 0) {
        this.advanceRoomNow();
      }
    }

    this.syncVisuals(nowMs);
    this.updateHud(nowMs);
  }

  public handleUseSkill(skillIdOrSlot: string): CombatEvent[] {
    if (
      !this.hero ||
      !this.hero.isAlive ||
      this.runState.status === 'victory' ||
      this.runState.status === 'defeat'
    ) {
      return [];
    }

    const nowMs = this.elapsedTimeMs;
    const bounds = {
      width: this.scale.width || 800,
      height: this.scale.height || 600,
      padding: ARENA_PADDING,
    };
    const moveDir = this.hud.getMoveVector();
    const prevHeroPos = { ...this.hero.position };

    const events = triggerHeroSkill(
      this.hero,
      skillIdOrSlot,
      this.monsters,
      nowMs,
      {
        bounds,
        direction:
          moveDir.x !== 0 || moveDir.y !== 0 ? moveDir : this.hero.facing,
        skillsCatalog: this.skillsCatalog,
      }
    );

    if (events.length > 0) {
      // Show dash trail from previous position if dash occurred
      if (events.some((e) => e.type === 'hero_dash')) {
        this.vfx.showDashTrail(prevHeroPos.x, prevHeroPos.y);
      }
      this.processCombatEvents(events);
      this.checkAndUpdateRoomState(nowMs);
      this.syncVisuals(nowMs);
      this.updateHud(nowMs);
    }

    return events;
  }

  public forceClearRoom(): void {
    if (!this.runState || !this.hero) {
      return;
    }

    if (this.runState.status === 'room_cleared') {
      this.advanceRoomNow();
    }

    for (const monster of this.monsters) {
      if (monster.isAlive) {
        monster.hp = 0;
        monster.isAlive = false;
        this.hero.souls += monster.soulReward;
        this.runState.soulsCollected += monster.soulReward;
        this.runState.monstersKilled += 1;
        this.vfx.showSoulCollectEffect(
          monster.position.x,
          monster.position.y,
          monster.soulReward
        );
      }
    }

    this.checkAndUpdateRoomState(this.elapsedTimeMs);
    this.syncVisuals(this.elapsedTimeMs);
    this.updateHud(this.elapsedTimeMs);
  }

  public advanceRoomNow(): void {
    if (!this.runState || !this.hero.isAlive) {
      return;
    }

    const nextRoom = advanceToNextRoom(this.runState);
    if (!nextRoom) {
      return;
    }

    this.loadCurrentRoom();
  }

  private startNewRun(): void {
    const width = this.scale.width || 800;
    const height = this.scale.height || 600;

    this.elapsedTimeMs = 0;
    this.roomClearTimerMs = 0;
    this.runState = createDungeonRun(width, height, this.runSeedCounter);
    this.runSeedCounter += 7;

    this.hero = createHero({ x: Math.round(width / 2), y: Math.round(height / 2) });

    if (!this.heroSprite) {
      this.heroSprite = this.add
        .sprite(this.hero.position.x, this.hero.position.y, 'wraith_warrior', 0)
        .setScale(1.5)
        .setDepth(20);
    } else {
      this.heroSprite
        .setPosition(this.hero.position.x, this.hero.position.y)
        .setAlpha(1)
        .setTint(0xffffff);
    }

    if (this.anims.exists('wraith_idle')) {
      this.heroSprite.play('wraith_idle', true);
    }

    this.loadCurrentRoom();
    this.showTimedBanner(
      dialoguesData.entries.dungeon_enter.shortText,
      3200
    );
    this.syncVisuals(this.elapsedTimeMs);
    this.updateHud(this.elapsedTimeMs);
  }

  private loadCurrentRoom(): void {
    const width = this.scale.width || 800;
    const height = this.scale.height || 600;
    const currentRoom = getCurrentRoom(this.runState);

    this.destroyPortal();
    this.clearMonsterVisuals();
    this.buildArenaTilesAndLighting(width, height, currentRoom.roomNumber, currentRoom.isBossRoom);

    // Reposition hero at center of the new chamber
    this.hero.position = {
      x: Math.round(width / 2),
      y: Math.round(height / 2),
    };

    // Spawn room monsters from core RoomSpec + monsters.json catalog
    this.monsters = currentRoom.spawns.map((spawn, idx) => {
      const def =
        this.monsterDefMap.get(spawn.defId) ?? this.monstersCatalog[0];
      const clampedX = Math.max(
        ARENA_PADDING,
        Math.min(width - ARENA_PADDING, spawn.x)
      );
      const clampedY = Math.max(
        ARENA_PADDING + 24,
        Math.min(height - ARENA_PADDING - 24, spawn.y)
      );
      return spawnMonster(
        def,
        `r${currentRoom.roomNumber}_m${idx}_${def.id}`,
        { x: clampedX, y: clampedY }
      );
    });

    for (const monster of this.monsters) {
      const sprite = this.add
        .sprite(monster.position.x, monster.position.y, monster.spriteKey, 0)
        .setScale(1.5)
        .setDepth(monster.type === 'boss' ? 19 : 18);

      const animKey = this.resolveMonsterIdleAnim(monster.spriteKey);
      if (animKey && this.anims.exists(animKey)) {
        sprite.play(animKey, true);
      }

      const hpBar = this.add.graphics().setDepth(25);
      this.monsterVisuals.set(monster.instanceId, { sprite, hpBar });
    }

    if (currentRoom.isBossRoom) {
      this.showTimedBanner(
        dialoguesData.entries.boss_intro.shortText,
        4000
      );
    } else if (currentRoom.roomNumber > 1) {
      this.showTimedBanner(currentRoom.title, 2000);
    }
  }

  private buildArenaTilesAndLighting(
    width: number,
    height: number,
    roomNumber: number,
    isBossRoom: boolean
  ): void {
    this.arenaLayer.removeAll(true);

    const cols = Math.ceil(width / TILE_DISPLAY_SIZE);
    const rows = Math.ceil(height / TILE_DISPLAY_SIZE);
    const hasTileFrames =
      this.textures.exists('dungeon_tiles') &&
      this.textures.get('dungeon_tiles').frameTotal > 4;

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const isWall =
          row === 0 || row === rows - 1 || col === 0 || col === cols - 1;
        const hash = (col * 31 + row * 17 + roomNumber * 13) % 7;
        const frameIndex = isWall ? 2 : hash === 0 ? 1 : 0;

        const tileX = col * TILE_DISPLAY_SIZE + TILE_DISPLAY_SIZE / 2;
        const tileY = row * TILE_DISPLAY_SIZE + TILE_DISPLAY_SIZE / 2;

        const tile = this.add.image(
          tileX,
          tileY,
          'dungeon_tiles',
          hasTileFrames ? frameIndex : undefined
        );
        tile.setDisplaySize(TILE_DISPLAY_SIZE, TILE_DISPLAY_SIZE);

        if (isBossRoom && !isWall && hash === 2) {
          tile.setTint(0x991b1b);
        }

        this.arenaLayer.add(tile);
      }
    }

    // Spiritual / Infernal border lighting and corner braziers
    this.lightingGraphics.clear();
    const borderGlowColor = isBossRoom ? 0xf97316 : 0x38bdf8;
    const secondaryGlowColor = isBossRoom ? 0xdc2626 : 0x0284c7;

    // Outer dark vignette frame
    this.lightingGraphics.lineStyle(18, 0x09090b, 0.55);
    this.lightingGraphics.strokeRect(9, 9, width - 18, height - 18);

    // Inner spiritual barrier line
    this.lightingGraphics.lineStyle(2, borderGlowColor, 0.35);
    this.lightingGraphics.strokeRect(
      TILE_DISPLAY_SIZE,
      TILE_DISPLAY_SIZE,
      width - TILE_DISPLAY_SIZE * 2,
      height - TILE_DISPLAY_SIZE * 2
    );

    // 4 Corner spiritual braziers
    const corners: Vector2D[] = [
      { x: TILE_DISPLAY_SIZE + 12, y: TILE_DISPLAY_SIZE + 28 },
      { x: width - TILE_DISPLAY_SIZE - 12, y: TILE_DISPLAY_SIZE + 28 },
      { x: TILE_DISPLAY_SIZE + 12, y: height - TILE_DISPLAY_SIZE - 28 },
      { x: width - TILE_DISPLAY_SIZE - 12, y: height - TILE_DISPLAY_SIZE - 28 },
    ];

    for (const corner of corners) {
      this.lightingGraphics.fillStyle(secondaryGlowColor, 0.14);
      this.lightingGraphics.fillCircle(corner.x, corner.y, 44);
      this.lightingGraphics.fillStyle(borderGlowColor, 0.25);
      this.lightingGraphics.fillCircle(corner.x, corner.y, 20);
      this.lightingGraphics.fillStyle(0xe0f2fe, 0.65);
      this.lightingGraphics.fillCircle(corner.x, corner.y, 4);
    }
  }

  private processCombatEvents(events: CombatEvent[]): void {
    for (const event of events) {
      switch (event.type) {
        case 'hero_basic_attack': {
          this.vfx.showSlashEffect(
            this.hero.position.x,
            this.hero.position.y,
            event.position.x,
            event.position.y
          );
          if (this.anims.exists('wraith_attack')) {
            this.heroSprite.play('wraith_attack');
            this.heroSprite.once(
              Phaser.Animations.Events.ANIMATION_COMPLETE,
              () => {
                if (this.hero.isAlive && this.anims.exists('wraith_idle')) {
                  this.heroSprite.play('wraith_idle', true);
                }
              }
            );
          }
          break;
        }

        case 'hero_dash': {
          this.vfx.showDashTrail(event.position.x, event.position.y);
          if (this.anims.exists('wraith_dash')) {
            this.heroSprite.play('wraith_dash');
            this.heroSprite.once(
              Phaser.Animations.Events.ANIMATION_COMPLETE,
              () => {
                if (this.hero.isAlive && this.anims.exists('wraith_idle')) {
                  this.heroSprite.play('wraith_idle', true);
                }
              }
            );
          }
          break;
        }

        case 'hero_skill_used': {
          const skill = this.skillsCatalog.find((s) => s.id === event.skillId);
          if (
            skill &&
            (skill.slot === 'active_1' || skill.slot === 'active_2')
          ) {
            this.vfx.showSkillAreaEffect(
              event.position.x,
              event.position.y,
              skill.radius ?? 80,
              skill.force
            );
          }
          break;
        }

        case 'hero_healed': {
          this.vfx.showHealEffect(
            event.position.x,
            event.position.y,
            event.value ?? 0
          );
          break;
        }

        case 'monster_damaged': {
          this.vfx.showDamageNumber(
            event.position.x,
            event.position.y,
            event.value ?? 1,
            Boolean(event.isCrit),
            false
          );
          break;
        }

        case 'monster_killed': {
          const reward = event.value ?? 0;
          this.runState.soulsCollected += reward;
          this.runState.monstersKilled += 1;
          this.vfx.showSoulCollectEffect(
            event.position.x,
            event.position.y,
            reward
          );
          break;
        }

        case 'hero_damaged': {
          this.vfx.showDamageNumber(
            event.position.x,
            event.position.y,
            event.value ?? 1,
            false,
            true
          );
          break;
        }

        case 'hero_killed': {
          this.heroSprite.setTint(0xef4444);
          this.heroSprite.setAlpha(0.45);
          break;
        }
      }
    }
  }

  private checkAndUpdateRoomState(nowMs: number): void {
    const livingMonsters = this.monsters.filter((m) => m.isAlive).length;
    const previousStatus = this.runState.status;
    const nextStatus = evaluateRoomState(
      this.runState,
      livingMonsters,
      this.hero.isAlive
    );

    if (previousStatus !== nextStatus) {
      if (nextStatus === 'room_cleared') {
        this.roomClearTimerMs = ROOM_CLEAR_AUTO_ADVANCE_MS;
        this.spawnRoomPortal();
        this.showTimedBanner(
          dialoguesData.entries.room_clear.shortText,
          ROOM_CLEAR_AUTO_ADVANCE_MS
        );
      } else if (nextStatus === 'victory') {
        this.showTimedBanner(
          dialoguesData.entries.run_victory.text,
          60000
        );
      } else if (nextStatus === 'defeat') {
        this.showTimedBanner(
          dialoguesData.entries.run_death.text,
          60000
        );
      }
    }

    if (this.bannerText && nowMs >= this.bannerExpiresAtMs) {
      this.bannerText = undefined;
    }
  }

  private spawnRoomPortal(): void {
    this.destroyPortal();

    const width = this.scale.width || 800;
    const height = this.scale.height || 600;
    const portalX = Math.round(width / 2);
    const portalY = Math.round(Math.max(88, height * 0.24));

    this.portalPosition = { x: portalX, y: portalY };

    const glow = this.add.graphics();
    glow.fillStyle(0x38bdf8, 0.28);
    glow.fillCircle(0, 0, 26);
    glow.lineStyle(2, 0xe0f2fe, 0.9);
    glow.strokeCircle(0, 0, 20);

    const hasTileFrames =
      this.textures.exists('dungeon_tiles') &&
      this.textures.get('dungeon_tiles').frameTotal > 4;
    const sprite = this.add
      .image(0, 0, 'dungeon_tiles', hasTileFrames ? 3 : undefined)
      .setDisplaySize(36, 36);

    const label = this.add
      .text(0, -28, 'Portal Espectral', {
        fontFamily: 'monospace',
        fontSize: '11px',
        color: '#e0f2fe',
        stroke: '#09090b',
        strokeThickness: 3,
      })
      .setOrigin(0.5);

    this.portalContainer = this.add
      .container(portalX, portalY, [glow, sprite, label])
      .setDepth(15);
  }

  private destroyPortal(): void {
    if (this.portalContainer) {
      this.portalContainer.destroy();
      this.portalContainer = undefined;
    }
    this.portalPosition = undefined;
  }

  private syncVisuals(nowMs: number): void {
    // Sync Hero Sprite & Aura
    this.heroSprite.setPosition(this.hero.position.x, this.hero.position.y);
    this.heroSprite.setFlipX(this.hero.facing.x < 0);

    const isInvulnerable = nowMs < this.hero.invulnerableUntilMs;
    if (this.hero.isAlive) {
      this.heroSprite.setAlpha(isInvulnerable ? 0.65 : 1);
    }

    this.heroAura.clear();
    if (this.hero.isAlive) {
      this.heroAura.fillStyle(
        0x38bdf8,
        isInvulnerable ? 0.32 : 0.14
      );
      this.heroAura.fillCircle(
        this.hero.position.x,
        this.hero.position.y + 4,
        isInvulnerable ? 24 : 18
      );
    }

    // Sync Monster Sprites & Individual HP Bars
    for (const monster of this.monsters) {
      const visual = this.monsterVisuals.get(monster.instanceId);
      if (!visual) {
        continue;
      }

      if (!monster.isAlive || monster.hp <= 0) {
        visual.sprite.setVisible(false);
        visual.hpBar.clear();
        visual.hpBar.setVisible(false);
        continue;
      }

      visual.sprite.setVisible(true);
      visual.sprite.setPosition(monster.position.x, monster.position.y);
      visual.sprite.setFlipX(this.hero.position.x < monster.position.x);

      const isBoss = monster.type === 'boss';
      const barWidth = isBoss ? 56 : 34;
      const barHeight = isBoss ? 6 : 4;
      const offsetY = isBoss ? 44 : 26;
      const barX = monster.position.x - barWidth / 2;
      const barY = monster.position.y - offsetY;
      const ratio =
        monster.maxHp > 0
          ? Math.max(0, Math.min(1, monster.hp / monster.maxHp))
          : 0;

      visual.hpBar.clear();
      visual.hpBar.setVisible(true);
      visual.hpBar.fillStyle(0x09090b, 0.9);
      visual.hpBar.fillRect(barX - 1, barY - 1, barWidth + 2, barHeight + 2);
      visual.hpBar.fillStyle(0x272730, 0.95);
      visual.hpBar.fillRect(barX, barY, barWidth, barHeight);
      visual.hpBar.fillStyle(isBoss ? 0xf97316 : 0xef4444, 1);
      visual.hpBar.fillRect(
        barX,
        barY,
        Math.max(2, Math.round(barWidth * ratio)),
        barHeight
      );
    }
  }

  private updateHud(nowMs: number): void {
    const currentRoom = getCurrentRoom(this.runState);
    const bossMonster = currentRoom.isBossRoom
      ? this.monsters.find((m) => m.type === 'boss')
      : undefined;

    const skillCooldownsMs: Record<string, number> = {};
    for (const skill of this.skillsCatalog) {
      const readyAt = Math.max(
        this.hero.skillReadyAtMs[skill.id] ?? 0,
        this.hero.skillReadyAtMs[skill.slot] ?? 0
      );
      skillCooldownsMs[skill.id] = Math.max(0, readyAt - nowMs);
    }

    const activeBanner =
      this.bannerText && nowMs < this.bannerExpiresAtMs
        ? this.bannerText
        : undefined;

    const snapshot: HudSnapshot = {
      hp: this.hero.stats.hp,
      maxHp: this.hero.stats.maxHp,
      souls: this.hero.souls,
      roomNumber: currentRoom.roomNumber,
      totalRooms: this.runState.totalRooms,
      isBossRoom: currentRoom.isBossRoom,
      roomTitle: currentRoom.title,
      bossHp: bossMonster?.hp,
      bossMaxHp: bossMonster?.maxHp,
      bossName: bossMonster?.name,
      potionCharges: this.hero.potionCharges,
      maxPotionCharges: this.hero.maxPotionCharges,
      skillCooldownsMs,
      runStatus: this.runState.status,
      bannerText: activeBanner,
    };

    this.hud.update(snapshot);
  }

  private handleViewportResize(width: number, height: number): void {
    if (!this.runState || !this.hero || !this.hud) {
      return;
    }

    const viewport = resolveViewportConfig(width, height);
    const currentRoom = getCurrentRoom(this.runState);
    this.buildArenaTilesAndLighting(
      width,
      height,
      currentRoom.roomNumber,
      currentRoom.isBossRoom
    );

    this.hero.position.x = Math.max(
      ARENA_PADDING,
      Math.min(width - ARENA_PADDING, this.hero.position.x)
    );
    this.hero.position.y = Math.max(
      ARENA_PADDING,
      Math.min(height - ARENA_PADDING, this.hero.position.y)
    );

    for (const monster of this.monsters) {
      monster.position.x = Math.max(
        ARENA_PADDING,
        Math.min(width - ARENA_PADDING, monster.position.x)
      );
      monster.position.y = Math.max(
        ARENA_PADDING,
        Math.min(height - ARENA_PADDING, monster.position.y)
      );
    }

    this.hud.resize(viewport);
    this.syncVisuals(this.elapsedTimeMs);
    this.updateHud(this.elapsedTimeMs);
  }

  private showTimedBanner(text: string, durationMs: number): void {
    this.bannerText = text;
    this.bannerExpiresAtMs = this.elapsedTimeMs + durationMs;
  }

  private clearMonsterVisuals(): void {
    for (const visual of this.monsterVisuals.values()) {
      visual.sprite.destroy();
      visual.hpBar.destroy();
    }
    this.monsterVisuals.clear();
  }

  private resolveMonsterIdleAnim(spriteKey: string): string | null {
    switch (spriteKey) {
      case 'abyssal_slime':
        return 'slime_idle';
      case 'bone_sentinel':
        return 'sentinel_idle';
      case 'infernal_warden':
        return 'warden_idle';
      default:
        return null;
    }
  }
}
