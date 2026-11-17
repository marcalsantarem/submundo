import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolveViewportConfig } from '../../src/core';
import { GAME_VERSION } from '../../src/version';

describe('Architecture & Viewport Contracts (T-001)', () => {
  it('exports GAME_VERSION as 0.1.0', () => {
    expect(GAME_VERSION).toBe('0.1.0');
  });

  it('resolves desktop landscape viewport (800x600, 4:3) when windowWidth >= windowHeight', () => {
    expect(resolveViewportConfig(1920, 1080)).toEqual({
      mode: 'desktop_landscape',
      width: 800,
      height: 600,
      aspectRatio: '4:3',
    });

    expect(resolveViewportConfig(800, 600)).toEqual({
      mode: 'desktop_landscape',
      width: 800,
      height: 600,
      aspectRatio: '4:3',
    });

    expect(resolveViewportConfig(600, 600)).toEqual({
      mode: 'desktop_landscape',
      width: 800,
      height: 600,
      aspectRatio: '4:3',
    });
  });

  it('resolves mobile portrait viewport (360x640, 9:16) when windowWidth < windowHeight', () => {
    expect(resolveViewportConfig(360, 640)).toEqual({
      mode: 'mobile_portrait',
      width: 360,
      height: 640,
      aspectRatio: '9:16',
    });

    expect(resolveViewportConfig(390, 844)).toEqual({
      mode: 'mobile_portrait',
      width: 360,
      height: 640,
      aspectRatio: '9:16',
    });
  });

  it('guarantees src/core/index.ts is 100% pure TypeScript and does not import phaser', () => {
    const coreIndexPath = resolve(process.cwd(), 'src/core/index.ts');
    const content = readFileSync(coreIndexPath, 'utf-8');
    expect(content.toLowerCase()).not.toContain('phaser');
  });
});
