# BRF-045 — AG08 — T-044 Sintetizador de Áudio Procedural (Web Audio API)

**Leia:** `docs/agentes/AG08_Arte.md`, `docs/GDD_Submundo.md` (seção 7 — Pipeline de Áudio). **Regra:** zero dependências externas de áudio; 100% seguro em ambientes headless/Vitest sem `AudioContext`; zero git commands.
**Decisão do dono:** Autorização explícita da `T-044` (M4 `v0.4.0`).
**Fazer:**
Criar `src/view/audio/SoundManager.ts` implementando efeitos sonoros (SFX) procedurais via **Web Audio API**:
1. Exportar tipo `export type SoundEventId = 'attack' | 'crit' | 'dash' | 'skill_inferno' | 'skill_submundo' | 'skill_empireo' | 'potion' | 'loot_drop' | 'loot_legendary' | 'soul_pickup' | 'hit_player' | 'ui_click' | 'dialogue_blip' | 'forge' | 'altar' | 'victory' | 'defeat';`.
2. Exportar classe `SoundManager` e singleton `soundManager` (além de constante `MUTE_STORAGE_KEY = 'submundo_muted_v1'`):
   - Lazy init de `AudioContext` (suportando `window.AudioContext || window.webkitAudioContext`) somente no browser e quando `unlock()` ou `play()` for chamado durante interação; se não existir ou estiver bloqueado, falha silenciosamente (sem exceções).
   - `isMuted(): boolean`, `setMuted(muted: boolean): void`, `toggleMute(): boolean`, `unlock(): void`, `play(event: SoundEventId): void`, com debounce mínimo (~35ms por evento para não saturar som em múltiplos hits simultâneos).
   - Síntese distinta para cada `SoundEventId` usando osciladores (`sine`, `triangle`, `sawtooth`, `square`), envelopes ADSR curtos e ruído branco filtrado (corte metálico para espada, trovão/estalo para Empíreo, chiado/subgrave para Inferno, acorde sombrio para Submundo, sino cristalino para loot/almas, blip curto para diálogos, som metálico de bigorna para forja).
**Permitido:** `src/view/audio/SoundManager.ts`.
**Proibido:** tocar outras pastas, usar arquivos `.mp3/.wav` externos ou executar comandos git.
**Pronto quando:** `npm run typecheck` e `npm run build` passam sem erros.
**Entrega:** até 4 linhas listando a API exportada e os eventos sintetizados em `SoundManager.ts`.
