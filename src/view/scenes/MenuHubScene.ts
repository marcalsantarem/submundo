import Phaser from 'phaser';
import {
  MENU_HUB_ITEMS,
  resolveViewportConfig,
  type EquipSlot,
  type MenuHubItemId,
  type RunEndReport,
  type SaveProfile,
} from '../../core/index';
import {
  applyRunOutcomeToProfile,
  buildHeroFromProfile,
  equipStashItem,
  isMenuItemUnlocked,
  loadOrCreateProfile,
  persistProfile,
  unequipProfileSlot,
} from '../../core/progression/ProfileManager';
import { soundManager } from '../audio/SoundManager';
import { DF_FONTS } from '../ui/DarkFantasyUiBuilder';
import { InventoryModal, type InventoryHudSnapshot } from '../ui/InventoryModal';

/** Texturas do menu (Decisão #29); caminhos relativos a `public/`. */
const MENU_TEXTURES: ReadonlyArray<readonly [string, string]> = [
  ['menu_panel_frame_tall', 'assets/ui/menu/panel_frame_tall.png'],
  ['menu_compass_logo', 'assets/ui/menu/compass_logo.png'],
  ['menu_btn_normal', 'assets/ui/menu/btn_normal.png'],
  ['menu_btn_selected', 'assets/ui/menu/btn_selected.png'],
  ['menu_btn_gold', 'assets/ui/menu/btn_gold.png'],
  ['menu_slot_dashed', 'assets/ui/menu/slot_dashed.png'],
  ['menu_panel_frame_wide', 'assets/ui/menu/panel_frame_wide.png'],
  ['menu_panel_frame_wide_glow', 'assets/ui/menu/panel_frame_wide_glow.png'],
  ['menu_icon_souls', 'assets/ui/menu/icon_souls.png'],
  ['menu_icon_essence', 'assets/ui/menu/icon_essence.png'],
  ['menu_btn_locked', 'assets/ui/menu/btn_locked.png'],
  ['menu_icon_lock', 'assets/ui/menu/icon_lock.png'],
  ['menu_bg', 'assets/ui/menu/menu_bg.png'],
  ['menu_bg_mobile', 'assets/ui/menu/menu_bg_mobile.png'],
];

/** 9-slice (esquerda, direita, topo, base) conforme o manifest. */
const NINE: Record<string, readonly [number, number, number, number]> = {
  menu_panel_frame_tall: [72, 72, 72, 72],
  menu_btn_normal: [28, 28, 14, 14],
  menu_btn_selected: [36, 36, 18, 18],
  menu_btn_gold: [28, 28, 14, 14],
  menu_slot_dashed: [20, 20, 20, 20],
  menu_panel_frame_wide: [56, 56, 56, 56],
  menu_panel_frame_wide_glow: [64, 64, 64, 64],
  menu_btn_locked: [28, 28, 14, 14],
};

const COLOR_TEXT = '#e9dcc0';
const COLOR_GOLD = '#f5d58a';
const COLOR_MUTED = '#8c8576';
const COLOR_LOCKED = '#6f6a60';

const TEST_ENTRY_TITLE = 'Masmorra teste';
const TEST_ENTRY_SUBTITLE = 'Dungeon de teste';

export interface MenuHubCreateData {
  fromRun?: RunEndReport;
}

interface MenuDebugState {
  selected: MenuHubItemId;
  unlocked: MenuHubItemId[];
  rightPanelOpen: boolean;
  inventoryOpen: boolean;
  soulsText: string;
  essenceText: string;
}

interface MenuDebugApi {
  getState(): MenuDebugState;
  select(id: MenuHubItemId): void;
  enter(): void;
  openInventory(): void;
  closeInventory(): void;
}

declare global {
  interface Window {
    __SUBMUNDO_MENU_DEBUG__?: MenuDebugApi;
  }
}

interface Layout {
  mobile: boolean;
  w: number;
  h: number;
  leftX: number;
  leftY: number;
  leftW: number;
  leftH: number;
  compassH: number;
  btnW: number;
  btnH: number;
  btnGap: number;
  btnTop: number;
  rightX: number;
  rightY: number;
  rightW: number;
  rightH: number;
  fontBtn: number;
  fontSmall: number;
}

interface ButtonView {
  id: MenuHubItemId;
  container: Phaser.GameObjects.Container;
  unlocked: boolean;
}

export class MenuHubScene extends Phaser.Scene {
  private profile!: SaveProfile;
  private fromRun: RunEndReport | undefined;
  private selected: MenuHubItemId = 'masmorras';
  private rightPanelOpen = false;
  private inventoryOpen = false;
  private entrySelected = true;
  private entering = false;
  private soulsText = '0';
  private essenceText = '0';

  private L!: Layout;
  private inventoryModal: InventoryModal | null = null;
  private buttons: ButtonView[] = [];
  private rightObjs: Phaser.GameObjects.GameObject[] = [];
  private toast: Phaser.GameObjects.Container | null = null;
  private toastTimer: Phaser.Time.TimerEvent | null = null;

  constructor() {
    super({ key: 'MenuHub' });
  }

  public init(data?: MenuHubCreateData): void {
    this.fromRun = data?.fromRun;
    this.selected = 'masmorras';
    this.rightPanelOpen = false;
    this.inventoryOpen = false;
    this.entrySelected = true;
    this.entering = false;
    this.buttons = [];
    this.rightObjs = [];
    this.toast = null;
    this.toastTimer = null;
    this.inventoryModal = null;
  }

  public preload(): void {
    for (const [key, file] of MENU_TEXTURES) {
      if (!this.textures.exists(key)) {
        this.load.image(key, file);
      }
    }
  }

  public create(): void {
    this.profile = loadOrCreateProfile();
    let notice: string | null = null;
    if (this.fromRun) {
      applyRunOutcomeToProfile(this.profile, this.fromRun);
      persistProfile(this.profile);
      notice = this.formatRunNotice(this.fromRun);
    }
    this.soulsText = String(this.profile.souls);
    this.essenceText = String(this.profile.generalEssences);

    this.L = this.computeLayout();
    this.cameras.main.setBackgroundColor('#09090b');

    this.buildBackground();
    this.buildLeftPanel();
    this.buildTopBar();
    this.buildInventoryModal();
    // Masmorras vem selecionada ao abrir: o painel direito já abre.
    this.openRightPanel();

    if (notice) {
      this.showToast(notice, 4200);
    }

    this.installDebug();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.teardown());
    this.events.once(Phaser.Scenes.Events.DESTROY, () => this.teardown());
  }

  // ===========================================================================
  // LAYOUT
  // ===========================================================================

  private computeLayout(): Layout {
    const w = this.scale.width || 960;
    const h = this.scale.height || 540;
    const mobile = h <= 420 || w / h > 2;
    if (mobile) {
      const leftW = 236;
      const rightW = Math.min(380, w - leftW - 16 - 16 - 20);
      return {
        mobile,
        w,
        h,
        leftX: 16,
        leftY: 36,
        leftW,
        leftH: h - 36 - 8,
        compassH: 54,
        btnW: leftW - 56,
        btnH: 44,
        btnGap: 4,
        btnTop: 36 + 40,
        rightX: w - 16 - rightW,
        rightY: 36,
        rightW,
        rightH: h - 36 - 8,
        fontBtn: 15,
        fontSmall: 12,
      };
    }
    const leftW = 276;
    const rightW = 376;
    return {
      mobile,
      w,
      h,
      leftX: 36,
      leftY: 54,
      leftW,
      leftH: 456,
      compassH: 104,
      btnW: leftW - 70,
      btnH: 50,
      btnGap: 8,
      btnTop: 54 + 96,
      rightX: w - 36 - rightW,
      rightY: 54,
      rightW,
      rightH: 456,
      fontBtn: 18,
      fontSmall: 14,
    };
  }

  private nine(
    x: number,
    y: number,
    key: string,
    width: number,
    height: number
  ): Phaser.GameObjects.NineSlice | Phaser.GameObjects.Rectangle {
    const slice = NINE[key];
    if (!this.textures.exists(key) || !slice) {
      return this.add.rectangle(x, y, width, height, 0x141822).setStrokeStyle(2, 0x6b5a3a);
    }
    return this.add
      .nineslice(x, y, key, undefined, width, height, slice[0], slice[1], slice[2], slice[3])
      .setOrigin(0.5);
  }

  private text(
    x: number,
    y: number,
    value: string,
    size: number,
    color: string,
    bold = false
  ): Phaser.GameObjects.Text {
    return this.add
      .text(x, y, value, {
        fontFamily: DF_FONTS.TITLE,
        fontSize: `${size}px`,
        color,
        fontStyle: bold ? 'bold' : 'normal',
      })
      .setOrigin(0.5);
  }

  // ===========================================================================
  // CONSTRUÇÃO
  // ===========================================================================

  private buildBackground(): void {
    const { w, h, mobile } = this.L;
    const key = mobile ? 'menu_bg_mobile' : 'menu_bg';
    if (this.textures.exists(key)) {
      this.add.image(w / 2, h / 2, key).setDisplaySize(w, h);
    }
  }

  private buildLeftPanel(): void {
    const L = this.L;
    const cx = L.leftX + L.leftW / 2;
    this.nine(cx, L.leftY + L.leftH / 2, 'menu_panel_frame_tall', L.leftW, L.leftH);
    if (this.textures.exists('menu_compass_logo')) {
      const img = this.add.image(cx, L.leftY - (L.mobile ? 6 : 4) + L.compassH / 2 - 8, 'menu_compass_logo');
      img.setScale(L.compassH / img.height);
    }

    MENU_HUB_ITEMS.forEach((item, index) => {
      const y = L.btnTop + index * (L.btnH + L.btnGap) + L.btnH / 2;
      const unlocked = isMenuItemUnlocked(this.profile, item.id);
      const container = this.add.container(cx, y);
      container.setSize(L.btnW + 12, L.btnH);
      this.buttons.push({ id: item.id, container, unlocked });
      this.paintButton(index);
    });
  }

  /** (Re)desenha o botão do índice conforme seleção/bloqueio. */
  private paintButton(index: number): void {
    const L = this.L;
    const view = this.buttons[index];
    const item = MENU_HUB_ITEMS[index];
    view.container.removeAll(true);
    view.container.removeInteractive();

    const isSel = this.isHighlighted(item.id) && view.unlocked;
    let key = 'menu_btn_normal';
    let w = L.btnW;
    let h = L.btnH;
    if (!view.unlocked) {
      key = 'menu_btn_locked';
    } else if (isSel) {
      key = 'menu_btn_selected';
      w += 12;
      h += 6;
    }
    const bg = this.nine(0, 0, key, w, h);
    const label = this.text(
      view.unlocked ? 0 : -4,
      0,
      item.label.toUpperCase(),
      L.fontBtn,
      !view.unlocked ? COLOR_LOCKED : isSel ? COLOR_GOLD : COLOR_TEXT,
      isSel
    );
    const maxLabelW = w - (view.unlocked ? 36 : 76);
    if (label.width > maxLabelW) label.setScale(maxLabelW / label.width);
    view.container.add([bg, label]);
    if (!view.unlocked && this.textures.exists('menu_icon_lock')) {
      const lock = this.add.image(w / 2 - 26, 0, 'menu_icon_lock');
      lock.setScale(Math.min(22, L.btnH - 18) / lock.height);
      view.container.add(lock);
    }
    this.makeHit(view.container, L.btnW + 12, Math.max(L.btnH, 44));
    view.container.on('pointerdown', () => this.onButtonPressed(item.id));
  }

  private isHighlighted(id: MenuHubItemId): boolean {
    if (this.inventoryOpen) return id === 'inventario';
    if (id === 'masmorras') return this.selected === id && this.rightPanelOpen;
    return this.selected === id;
  }

  private repaintButtons(): void {
    this.buttons.forEach((_, i) => this.paintButton(i));
  }

  private buildTopBar(): void {
    const L = this.L;
    const y = L.mobile ? 18 : 28;
    let x = L.w - (L.mobile ? 20 : 40);
    const icon = L.mobile ? 22 : 28;
    const items: Array<[string, string]> = [
      ['menu_icon_essence', this.essenceText],
      ['menu_icon_souls', this.soulsText],
    ];
    for (const [key, value] of items) {
      const label = this.add
        .text(x, y, value, {
          fontFamily: DF_FONTS.TITLE,
          fontSize: `${L.mobile ? 16 : 20}px`,
          color: COLOR_TEXT,
        })
        .setOrigin(1, 0.5);
      x -= label.width + 8;
      if (this.textures.exists(key)) {
        const img = this.add.image(x - icon / 2, y, key);
        img.setScale(icon / img.height);
        x -= icon + 22;
      } else {
        x -= 22;
      }
    }
  }

  private buildInventoryModal(): void {
    this.inventoryModal = new InventoryModal(this, {
      onEquipItem: (instanceId) => {
        soundManager.unlock();
        if (equipStashItem(this.profile, instanceId)) {
          soundManager.play('ui_click');
          persistProfile(this.profile);
          this.inventoryModal?.update(this.buildInventorySnapshot());
        }
      },
      onUnequipSlot: (slot: EquipSlot) => {
        soundManager.unlock();
        if (!unequipProfileSlot(this.profile, slot)) {
          this.showToast('Baú cheio para desequipar este item.', 2600);
          return;
        }
        soundManager.play('ui_click');
        persistProfile(this.profile);
        this.inventoryModal?.update(this.buildInventorySnapshot());
      },
      onClose: () => {
        soundManager.play('ui_click');
        this.inventoryOpen = false;
        this.repaintButtons();
      },
    });
    const viewport = resolveViewportConfig(this.L.w, this.L.h);
    // `resolveViewportConfig` é fixo em 960x540: usa o tamanho real da cena.
    this.inventoryModal.resize({ ...viewport, width: this.L.w, height: this.L.h });
    if (this.L.mobile) {
      this.inventoryModal.setDisplayScale(Math.min(1, (this.L.h - 4) / 510, (this.L.w - 6) / 880));
    }
  }

  private buildInventorySnapshot(): InventoryHudSnapshot {
    const hero = buildHeroFromProfile(this.profile);
    return {
      equipped: { ...this.profile.equipped },
      bag: [...this.profile.stash],
      heroStats: { ...hero.stats },
      lifeSteal: hero.lifeSteal,
      cooldownReduction: hero.cooldownReduction,
      luck: hero.luck,
      activeForces: { ...hero.equippedForces },
    };
  }

  // ===========================================================================
  // PAINEL DIREITO: ESCOLHER DUNGEON
  // ===========================================================================

  private openRightPanel(): void {
    this.closeRightPanel();
    const L = this.L;
    const cx = L.rightX + L.rightW / 2;
    // Objetos soltos na cena (container interativo aninhado não recebe toque no Phaser).
    const g = {
      add: (o: Phaser.GameObjects.GameObject): void => {
        this.rightObjs.push(o);
      },
    };
    this.rightPanelOpen = true;

    g.add(this.nine(cx, L.rightY + L.rightH / 2, 'menu_panel_frame_wide', L.rightW, L.rightH));
    const titleY = L.rightY + (L.mobile ? 26 : 38);
    g.add(this.text(cx, titleY, 'Escolher dungeon', L.mobile ? 20 : 26, COLOR_TEXT));

    const entryW = L.rightW - (L.mobile ? 48 : 60);
    const entryH = 72;
    const listTop = titleY + (L.mobile ? 22 : 30);
    const entryY = listTop + entryH / 2;

    // Entrada "Masmorra teste".
    const sel = this.entrySelected;
    const entryContainer = this.add.container(cx, entryY);
    const entryBg = this.nine(
      0,
      0,
      sel ? 'menu_panel_frame_wide_glow' : 'menu_panel_frame_wide',
      entryW + (sel ? 10 : 0),
      entryH + (sel ? 8 : 0)
    );
    const t1 = this.text(0, -entryH * 0.16, TEST_ENTRY_TITLE, L.mobile ? 17 : 21, sel ? COLOR_GOLD : COLOR_TEXT, sel);
    const t2 = this.text(0, entryH * 0.2, TEST_ENTRY_SUBTITLE, L.fontSmall, COLOR_MUTED);
    entryContainer.add([entryBg, t1, t2]);
    this.makeHit(entryContainer, entryW, Math.max(entryH, 44));
    entryContainer.on('pointerdown', () => {
      soundManager.unlock();
      soundManager.play('ui_click');
      this.entrySelected = true;
      this.openRightPanel();
    });
    g.add(entryContainer);

    // Caixas pontilhadas vazias.
    const slotH = L.mobile ? 40 : 60;
    const gap = L.mobile ? 6 : 10;
    const bottomY = L.rightY + L.rightH - (L.mobile ? 62 : 84);
    let slotY = entryY + entryH / 2 + gap + slotH / 2;
    let first = true;
    while (slotY + slotH / 2 <= bottomY && slotY < entryY + 3 * (entryH + gap) - 20) {
      g.add(this.nine(cx, slotY, 'menu_slot_dashed', entryW, slotH));
      if (first) {
        g.add(this.text(cx, slotY, 'Mais masmorras · em breve', L.fontSmall, COLOR_LOCKED));
        first = false;
      }
      slotY += slotH + gap;
    }

    // Botões Voltar / Entrar.
    const btnH = L.mobile ? 44 : 52;
    const btnY = L.rightY + L.rightH - (L.mobile ? 38 : 52);
    const btnW = (entryW - 14) / 2;
    g.add(
      this.makeActionButton(cx - btnW / 2 - 7, btnY, btnW, btnH, 'Voltar', false, () => {
        soundManager.unlock();
        soundManager.play('ui_click');
        this.closeRightPanel();
        this.repaintButtons();
      })
    );
    g.add(
      this.makeActionButton(cx + btnW / 2 + 7, btnY, btnW, btnH, 'Entrar', true, () => this.enterTestDungeon())
    );
    this.repaintButtons();
  }

  private makeActionButton(
    x: number,
    y: number,
    w: number,
    h: number,
    label: string,
    gold: boolean,
    onPress: () => void
  ): Phaser.GameObjects.Container {
    const c = this.add.container(x, y);
    const bg = this.nine(0, 0, gold ? 'menu_btn_gold' : 'menu_btn_normal', w, h);
    const txt = this.text(0, 0, label, this.L.fontBtn, gold ? '#2b1c08' : COLOR_TEXT, gold);
    c.add([bg, txt]);
    this.makeHit(c, w, Math.max(h, 44));
    c.on('pointerdown', onPress);
    return c;
  }

  /** Área de toque do container (hit area padrão já é centrada via displayOrigin) (mínimo 44px). */
  private makeHit(c: Phaser.GameObjects.Container, w: number, h: number): void {
    c.setSize(w, h);
    c.setInteractive({ useHandCursor: true });
  }

  private closeRightPanel(): void {
    for (const o of this.rightObjs) o.destroy();
    this.rightObjs = [];
    this.rightPanelOpen = false;
  }

  // ===========================================================================
  // AÇÕES
  // ===========================================================================

  private onButtonPressed(id: MenuHubItemId): void {
    if (this.inventoryOpen || this.entering) return;
    soundManager.unlock();
    const view = this.buttons.find((b) => b.id === id);
    if (!view) return;
    if (!view.unlocked) {
      soundManager.play('ui_click');
      this.showToast('Em breve', 1600);
      return;
    }
    this.selectItem(id);
  }

  private selectItem(id: MenuHubItemId): void {
    soundManager.play('ui_click');
    if (id === 'inventario') {
      this.openInventory();
      return;
    }
    this.selected = id;
    if (id === 'masmorras') {
      this.openRightPanel();
    } else {
      this.closeRightPanel();
      this.repaintButtons();
    }
  }

  private openInventory(): void {
    if (this.inventoryOpen) return;
    this.inventoryOpen = true;
    this.inventoryModal?.open(this.buildInventorySnapshot());
    this.repaintButtons();
  }

  private closeInventory(): void {
    if (!this.inventoryOpen) return;
    this.inventoryModal?.close();
    this.inventoryOpen = false;
    this.repaintButtons();
  }

  private enterTestDungeon(): void {
    if (this.entering || !this.entrySelected) return;
    this.entering = true;
    soundManager.unlock();
    soundManager.play('ui_click');
    this.scene.start('DungeonScene', { testArena: true });
  }

  private formatRunNotice(report: RunEndReport): string {
    const kept = report.keptItems.length;
    if (report.victory) {
      return `Vitória! +${report.soulsGained} Almas, +${report.essencesGained} Essências, ${kept} item(ns) obtido(s).`;
    }
    return `Derrota. +${report.soulsGained} Almas salvas, ${report.lostItems.length} item(ns) perdido(s).`;
  }

  private showToast(message: string, durationMs: number): void {
    this.toast?.destroy(true);
    this.toastTimer?.remove(false);
    const L = this.L;
    const txt = this.text(0, 0, message, L.mobile ? 15 : 18, COLOR_TEXT);
    const w = txt.width + 36;
    const h = txt.height + 16;
    const bg = this.add.rectangle(0, 0, w, h, 0x0c0e14, 0.92).setStrokeStyle(2, 0x8a7048);
    const c = this.add.container(L.w / 2, L.h - (L.mobile ? 22 : 30), [bg, txt]);
    c.setDepth(2000);
    this.toast = c;
    this.toastTimer = this.time.delayedCall(durationMs, () => {
      c.destroy(true);
      if (this.toast === c) this.toast = null;
    });
  }

  // ===========================================================================
  // DEBUG / LIMPEZA
  // ===========================================================================

  private installDebug(): void {
    if (typeof window === 'undefined') return;
    window.__SUBMUNDO_MENU_DEBUG__ = {
      getState: () => ({
        selected: this.inventoryOpen ? 'inventario' : this.selected,
        unlocked: this.buttons.filter((b) => b.unlocked).map((b) => b.id),
        rightPanelOpen: this.rightPanelOpen,
        inventoryOpen: this.inventoryOpen,
        soulsText: this.soulsText,
        essenceText: this.essenceText,
      }),
      select: (id) => this.onButtonPressed(id),
      enter: () => this.enterTestDungeon(),
      openInventory: () => this.openInventory(),
      closeInventory: () => this.closeInventory(),
    };
  }

  private teardown(): void {
    if (typeof window !== 'undefined') {
      delete window.__SUBMUNDO_MENU_DEBUG__;
    }
    this.toastTimer?.remove(false);
    this.toastTimer = null;
    this.inventoryModal?.destroy();
    this.inventoryModal = null;
  }
}
