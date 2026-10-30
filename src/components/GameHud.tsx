import React from 'react';
import { WAYANAD_ZONES } from '../game/levels';
import { CameraPreset, HudSnapshot } from '../game/types';
import {
  IconChrono4d,
  IconDistance,
  IconGoldCoin,
  IconMonsterHorn,
  IconSound,
  WayanadTitleLockup,
} from './GameIcons';

interface GameHudProps {
  hud: HudSnapshot;
  onStartGame: (zoneIdx?: number) => void;
  onSelectZone: (zoneIdx: number) => void;
  onTriggerChrono: () => void;
  onToggleFx4d: () => void;
  onTogglePause: () => void;
  onReturnTitle: () => void;
  onToggleMute: () => void;
  onAmbienceVolume: (percent: number) => void;
  onToggleDock: () => void;
  onCameraPreset: (preset: CameraPreset) => void;
}

export const GameHud: React.FC<GameHudProps> = ({
  hud,
  onStartGame,
  onSelectZone,
  onTriggerChrono,
  onToggleFx4d,
  onTogglePause,
  onReturnTitle,
  onToggleMute,
  onAmbienceVolume,
  onToggleDock,
  onCameraPreset,
}) => {
  const chronoReady = hud.chronoCharge >= 100 && !hud.chronoActive;
  const showPerimeterSensory = hud.phase === 'playing' && hud.fx4dEnabled;
  const windTiltDeg = Math.round(hud.windCrossForce * 16);

  return (
    <div className="fixed inset-0 z-10 pointer-events-none flex flex-col justify-between">
      {/* ==================== 4D PERIMETER SENSORY LAYER (ZERO CENTER OCCLUSION) ==================== */}
      {showPerimeterSensory && (
        <>
          {/* Temporal 4D Chrono-Shift or Storm Lightning Edge Aura */}
          {(hud.chronoActive || hud.lightningFlash > 0.08) && (
            <div
              className="fixed inset-0 pointer-events-none transition-opacity duration-150"
              style={{
                boxShadow: hud.chronoActive
                  ? 'inset 0 0 68px rgba(56, 189, 248, 0.28), inset 0 0 24px rgba(245, 196, 69, 0.18)'
                  : `inset 0 0 80px rgba(210, 232, 255, ${(
                      hud.lightningFlash * 0.36
                    ).toFixed(2)})`,
              }}
            />
          )}

          {/* Subtle Monsoon Rain Streaks strictly on outer 5% left/right viewport margins */}
          {hud.lensWetness > 0.34 && (
            <svg
              viewBox="0 0 1000 600"
              preserveAspectRatio="none"
              className="fixed inset-0 w-full h-full pointer-events-none"
              style={{
                opacity: Math.min(0.42, (hud.lensWetness - 0.25) * 0.55),
              }}
              aria-hidden="true"
            >
              <g
                stroke="#cfe8f7"
                strokeWidth="1.2"
                strokeLinecap="round"
                transform={`skewX(${windTiltDeg})`}
              >
                <line x1="18" y1="42" x2="18" y2="68" />
                <line x1="36" y1="190" x2="36" y2="222" />
                <line x1="24" y1="360" x2="24" y2="392" />
                <line x1="44" y1="490" x2="44" y2="520" />
                <line x1="964" y1="74" x2="964" y2="104" />
                <line x1="980" y1="240" x2="980" y2="274" />
                <line x1="956" y1="410" x2="956" y2="440" />
                <line x1="974" y1="525" x2="974" y2="554" />
              </g>
            </svg>
          )}
        </>
      )}

      {/* ==================== TITLE SCREEN OVERLAY ==================== */}
      {hud.phase === 'title' && (
        <div className="flex-1 flex flex-col justify-between p-6 sm:p-10">
          {/* Left Hero Lockup over generous negative space so live 3D Highway, Runner & Monster shine */}
          <div className="max-w-xl pointer-events-auto">
            <WayanadTitleLockup />

            <p
              className="mt-3 text-sm sm:text-[15px] leading-relaxed text-[#e6dfd1] max-w-[48ch]"
              style={{ textWrap: 'balance' }}
            >
              Sprint up the real-life NH-766 Thamarassery Churam hairpins,
              Meppadi tea estates, Edakkal pass, and Banasura crest from an
              elevated chase vista. Gather Malabar gold coins, bend time in the
              4th dimension, and outrun the pursuing Churam Guardian through
              shifting monsoon storms.
            </p>

            {/* Unboxed Personal Records Metadata */}
            {(hud.highScore > 0 || hud.totalCoinsBank > 0) && (
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[#cbd8d0]">
                <span>
                  Best Score{' '}
                  <strong className="font-mono-num text-[#f5d98e]">
                    {hud.highScore}
                  </strong>
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  Furthest Run{' '}
                  <strong className="font-mono-num text-[#f3efe6]">
                    {hud.bestDistance}m
                  </strong>
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  Gold Vault{' '}
                  <strong className="font-mono-num text-[#f5c445]">
                    {hud.totalCoinsBank}
                  </strong>
                </span>
              </div>
            )}

            {/* Primary Start CTA + Mute */}
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => onStartGame(hud.zoneIndex)}
                className="px-6 py-3 rounded-lg bg-[#e2b24a] hover:bg-[#efc360] active:scale-[0.98] text-[#0d1914] font-semibold text-sm tracking-wide transition-transform duration-150 cursor-pointer whitespace-nowrap shrink-0 shadow-[0_8px_24px_rgba(0,0,0,0.45)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ffe28a]"
              >
                Start Run
              </button>

              <button
                type="button"
                onClick={onToggleMute}
                aria-label={hud.muted ? 'Unmute audio' : 'Mute audio'}
                className="p-3 rounded-lg bg-[#0c1813]/92 hover:bg-[#14261e] text-[#d9ccb4] border border-[#d4a853]/30 transition-colors duration-150 cursor-pointer shrink-0"
              >
                <IconSound muted={hud.muted} className="w-4 h-4" />
              </button>
            </div>

            {/* Real-Life Wayanad Route Corridor Selector (01–06) */}
            <div className="mt-5">
              <div className="text-xs text-[#b8c7be] mb-2">
                Select Real-Life Wayanad Highway Corridor
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {WAYANAD_ZONES.map((z) => {
                  const selected = z.index === hud.zoneIndex;
                  return (
                    <button
                      key={z.index}
                      type="button"
                      onClick={() => onSelectZone(z.index)}
                      className={`px-3 py-1.5 rounded-md text-xs border transition-colors duration-150 cursor-pointer whitespace-nowrap shrink-0 ${
                        selected
                          ? 'bg-[#1b362b] text-[#ffe28a] border-[#e2b24a]/70 font-semibold'
                          : 'bg-[#0c1813]/88 hover:bg-[#172d23] text-[#e6dfd1] border-[#d4a853]/25'
                      }`}
                    >
                      <span className="font-mono-num text-[#e2b24a] mr-1.5">
                        0{z.index + 1}
                      </span>
                      {z.name}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Bottom Flat Control-Hint Line (Zero-pill clean text) */}
          <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-[#d4a853]/20 text-xs text-[#cbd8d0] bg-gradient-to-t from-[#08110d]/88 via-[#08110d]/45 to-transparent -mx-6 -mb-6 px-6 py-4 sm:-mx-10 sm:-mb-10 sm:px-10">
            <div className="font-medium tracking-wide">
              A / D or Left / Right Switch Lane · W / Space Jump · S / Down Slide · Shift / E 4D Time-Shift
            </div>
            <div className="text-[#b8c7be]">
              Swipe Move · Double-Tap or Right-Click 4D Time-Shift
            </div>
          </div>
        </div>
      )}

      {/* ==================== ACTIVE GAMEPLAY PERIMETER HUD ==================== */}
      {hud.phase === 'playing' && (
        <>
          {/* Top Perimeter Bar: Compact World-Matched Status Cluster (Zero backdrop-filter!) */}
          <div className="flex items-start justify-between gap-4 p-4">
            {/* Top-Left Wayanad Route, 4D Atmosphere, Coins, Distance, 4D Chrono-Shift & Monster */}
            <div className="pointer-events-auto bg-[#0c1813]/92 border border-[#d4a853]/28 rounded-xl px-4 py-3 shadow-[0_8px_24px_rgba(0,0,0,0.45)] max-w-md">
              <div className="flex items-center gap-2 text-xs text-[#b8c7be]">
                <span className="font-mono-num text-[#e2b24a] font-semibold">
                  Zone 0{hud.zoneIndex + 1}
                </span>
                <span aria-hidden="true">·</span>
                <span className="truncate">{hud.malayalamRegion}</span>
              </div>

              <h1 className="font-display text-lg sm:text-xl font-semibold text-[#f3efe6] leading-snug mt-0.5">
                {hud.zoneName}
              </h1>

              {/* Unboxed 4D Live Atmosphere & Biome Soundscape Readout */}
              <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-[#9eb5a8]">
                <span className="text-[#d9e3dc]">{hud.timeOfDayLabel}</span>
                <span aria-hidden="true">·</span>
                <span>{hud.weatherLabel}</span>
                <span aria-hidden="true">·</span>
                <span className="truncate">
                  {hud.muted ? 'Audio Muted' : hud.soundscapeLabel}
                </span>
              </div>

              {/* Integer Tabular Readouts: Coins, Distance, Score & Multiplier */}
              <div className="mt-2.5 pt-2 border-t border-white/10 flex flex-wrap items-center gap-4 text-xs">
                <div className="flex items-center gap-1.5" title="Gold Coins Collected">
                  <IconGoldCoin />
                  <span className="font-mono-num text-sm font-semibold text-[#ffe28a]">
                    {hud.coins}
                  </span>
                </div>

                <div className="flex items-center gap-1.5" title="Highway Distance & Running Pace">
                  <IconDistance />
                  <span className="font-mono-num text-sm font-semibold text-[#f3efe6]">
                    {hud.distanceMeters}m
                  </span>
                  <span className="text-[#9eb5a8]" aria-hidden="true">
                    ·
                  </span>
                  <span className="font-mono-num text-xs text-[#cbd8d0]">
                    {hud.runSpeedKmh.toFixed(1)} km/h
                  </span>
                </div>

                <div className="ml-auto flex items-center gap-2">
                  <span className="text-[#9eb5a8] font-mono-num">
                    x{hud.multiplier}
                  </span>
                  <span className="font-mono-num text-sm text-[#e2b24a] font-semibold">
                    {hud.score} pts
                  </span>
                </div>
              </div>

              {/* 4D Chrono-Shift Temporal Gauge & Action Trigger */}
              <div className="mt-2 pt-2 border-t border-white/10 flex items-center gap-2.5 text-xs">
                <IconChrono4d
                  className={`w-4 h-4 shrink-0 ${
                    hud.chronoActive
                      ? 'text-[#7dd3fc]'
                      : chronoReady
                      ? 'text-[#ffe28a]'
                      : 'text-[#9eb5a8]'
                  }`}
                />
                <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className={`h-full transition-transform duration-150 origin-left ${
                      hud.chronoActive
                        ? 'bg-[#38bdf8]'
                        : chronoReady
                        ? 'bg-[#e2b24a]'
                        : 'bg-[#648a78]'
                    }`}
                    style={{
                      transform: `scaleX(${
                        hud.chronoActive
                          ? Math.max(0.05, Math.min(1, hud.chronoSeconds / 4.8))
                          : Math.max(0.04, Math.min(1, hud.chronoCharge / 100))
                      })`,
                    }}
                  />
                </div>
                <button
                  type="button"
                  onClick={onTriggerChrono}
                  disabled={!chronoReady}
                  className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 ${
                    hud.chronoActive
                      ? 'bg-[#123547] text-[#7dd3fc] border border-[#38bdf8]/50 font-mono-num'
                      : chronoReady
                      ? 'bg-[#e2b24a] hover:bg-[#efc360] text-[#0d1914] font-semibold cursor-pointer'
                      : 'bg-white/5 text-[#9eb5a8] font-mono-num cursor-default'
                  }`}
                >
                  {hud.chronoActive
                    ? `4D Shift · ${hud.chronoSeconds.toFixed(1)}s`
                    : chronoReady
                    ? 'Time Shift (Shift)'
                    : `4D ${hud.chronoCharge}%`}
                </button>
              </div>

              {/* Monster Chase Distance Bar (Explicit Text + Bar for Accessibility) */}
              <div className="mt-2 pt-2 border-t border-white/10 flex items-center gap-2.5 text-xs">
                <IconMonsterHorn
                  className={`w-4 h-4 shrink-0 ${
                    hud.monsterAlert ? 'text-[#fb7185]' : 'text-[#d4a853]'
                  }`}
                />
                <span
                  className={`font-medium whitespace-nowrap ${
                    hud.monsterAlert ? 'text-[#fda4af]' : 'text-[#cbd8d0]'
                  }`}
                >
                  {hud.monsterAlert ? 'Guardian On Heels' : 'Guardian Trailing'}
                </span>
                <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className={`h-full transition-transform duration-150 origin-left ${
                      hud.monsterAlert ? 'bg-[#f43f5e]' : 'bg-[#d4a853]'
                    }`}
                    style={{
                      transform: `scaleX(${Math.max(
                        0.08,
                        Math.min(1, hud.monsterProximity)
                      )})`,
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Top-Right Compact Utility Controls */}
            <div className="pointer-events-auto flex items-center gap-2">
              <button
                type="button"
                onClick={onToggleMute}
                aria-label={hud.muted ? 'Unmute' : 'Mute'}
                className="p-2.5 rounded-lg bg-[#0c1813]/92 hover:bg-[#162b22] text-[#e6dfd1] border border-[#d4a853]/28 transition-colors cursor-pointer shrink-0"
              >
                <IconSound muted={hud.muted} />
              </button>
              <button
                type="button"
                onClick={onTogglePause}
                className="px-3.5 py-2 rounded-lg bg-[#0c1813]/92 hover:bg-[#162b22] text-xs font-medium text-[#e6dfd1] border border-[#d4a853]/28 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                Pause
              </button>
            </div>
          </div>

          {/* Center-Top Discreet Status Banner for 100m Speed Milestones, 4D Shift, Powerups, or Monster Surge */}
          {(hud.milestoneBannerMeters > 0 ||
            hud.chronoActive ||
            hud.magnetSeconds > 0 ||
            hud.boostSeconds > 0 ||
            hud.monsterAlert) && (
            <div className="mx-auto px-4 pointer-events-none">
              <div className="bg-[#0c1813]/94 border border-[#d4a853]/45 rounded-lg px-4 py-1.5 text-xs font-medium text-[#f3efe6] shadow-lg flex flex-wrap items-center justify-center gap-3">
                {hud.milestoneBannerMeters > 0 && (
                  <span className="text-[#ffe28a] font-mono-num">
                    {hud.milestoneBannerMeters}m Reached · Pace{' '}
                    {hud.runSpeedKmh.toFixed(1)} km/h
                  </span>
                )}
                {hud.chronoActive && (
                  <span className="text-[#7dd3fc] font-mono-num">
                    4D Time-Shift Active · 2x Score · {hud.chronoSeconds.toFixed(1)}s
                  </span>
                )}
                {hud.boostSeconds > 0 && (
                  <span className="text-[#6ee7b7] font-mono-num">
                    Spice Sprint Boost · {hud.boostSeconds}s
                  </span>
                )}
                {hud.magnetSeconds > 0 && (
                  <span className="text-[#bae6fd] font-mono-num">
                    Coin Magnet · {hud.magnetSeconds}s
                  </span>
                )}
                {hud.monsterAlert &&
                  hud.milestoneBannerMeters <= 0 &&
                  hud.boostSeconds <= 0 &&
                  !hud.chronoActive && (
                    <span className="text-[#fda4af]">
                      Guardian right behind you — avoid stumbling!
                    </span>
                  )}
              </div>
            </div>
          )}

          {/* ==================== COLLAPSIBLE UNIFIED BOTTOM CONTROL DOCK ==================== */}
          <div className="mx-auto mb-4 px-3 w-full max-w-[860px] flex flex-col items-center">
            <button
              type="button"
              onClick={onToggleDock}
              className="pointer-events-auto mb-1 px-3 py-1 rounded-t-lg bg-[#0c1813]/92 hover:bg-[#162b22] border border-b-0 border-[#d4a853]/28 text-[11px] font-medium text-[#cbd8d0] transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              {hud.dockCollapsed ? '▴ Show Controls (H)' : '▾ Hide Controls (H)'}
            </button>

            {!hud.dockCollapsed && (
              <div className="pointer-events-auto w-full bg-[#0c1813]/92 border border-[#d4a853]/30 rounded-xl px-4 py-2.5 shadow-[0_12px_32px_rgba(0,0,0,0.55)] flex flex-wrap items-center justify-between gap-3">
                {/* Real-Life Wayanad Route Quick-Select */}
                <div className="flex items-center gap-1">
                  <span className="text-[11px] text-[#9eb5a8] mr-1.5 hidden sm:inline">
                    Route
                  </span>
                  {WAYANAD_ZONES.map((z) => {
                    const active = z.index === hud.zoneIndex;
                    return (
                      <button
                        key={z.index}
                        type="button"
                        onClick={() => onSelectZone(z.index)}
                        title={`${z.name} (${z.malayalamRegion})`}
                        className={`px-2.5 py-1 rounded-md text-xs font-mono-num font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                          active
                            ? 'bg-[#e2b24a] text-[#0d1914]'
                            : 'text-[#cbd8d0] hover:bg-white/10'
                        }`}
                      >
                        0{z.index + 1}
                      </button>
                    );
                  })}
                </div>

                {/* Elevated / Aerial / Close Camera Angle Presets */}
                <div className="flex items-center gap-1 bg-[#08110d] p-1 rounded-lg border border-white/10">
                  {(
                    [
                      ['elevated', 'Elevated'],
                      ['aerial', 'Aerial'],
                      ['close', 'Close'],
                    ] as const
                  ).map(([preset, label]) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => onCameraPreset(preset)}
                      className={`px-2.5 py-1 rounded text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                        hud.cameraPreset === preset
                          ? 'bg-[#214033] text-[#ffe28a]'
                          : 'text-[#9eb5a8] hover:text-[#f3efe6]'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {/* 4D Sensory Immersion Toggle */}
                <button
                  type="button"
                  onClick={onToggleFx4d}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    hud.fx4dEnabled
                      ? 'bg-[#173329] text-[#ffe28a] border-[#d4a853]/45'
                      : 'bg-[#08110d] text-[#9eb5a8] border-white/10 hover:text-[#f3efe6]'
                  }`}
                >
                  {hud.fx4dEnabled ? '4D Effects On' : '4D Effects Off'}
                </button>

                {/* Ambience Soundscape Volume Slider */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onToggleMute}
                    aria-label={hud.muted ? 'Unmute ambience' : 'Mute ambience'}
                    className="text-[#cbd8d0] hover:text-[#ffe28a] transition-colors cursor-pointer shrink-0"
                  >
                    <IconSound muted={hud.muted} className="w-4 h-4" />
                  </button>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={hud.muted ? 0 : hud.ambienceVolume}
                    onChange={(e) => onAmbienceVolume(Number(e.target.value))}
                    aria-label="Ambience Soundscape Volume"
                    className="w-20 accent-[#e2b24a] cursor-pointer"
                  />
                  <span className="font-mono-num text-[11px] text-[#9eb5a8] w-8 text-right shrink-0">
                    {hud.muted ? 0 : hud.ambienceVolume}%
                  </span>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* ==================== PAUSE & GAME OVER MODALS ==================== */}
      {(hud.phase === 'paused' || hud.phase === 'game_over') && (
        <div className="fixed inset-0 z-20 pointer-events-auto bg-[#07100c]/80 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#0e1d17] border border-[#d4a853]/40 rounded-2xl p-6 sm:p-7 shadow-[0_20px_50px_rgba(0,0,0,0.75)]">
            {hud.phase === 'paused' ? (
              <>
                <div className="text-xs text-[#e2b24a] font-medium">
                  Run Paused · {hud.malayalamRegion}
                </div>
                <h2 className="font-display text-2xl font-bold text-[#f3efe6] mt-1">
                  {hud.zoneName}
                </h2>
                <p className="mt-2 text-sm text-[#cbd8d0] leading-relaxed">
                  Distance covered:{' '}
                  <strong className="font-mono-num text-[#f3efe6]">
                    {hud.distanceMeters}m
                  </strong>{' '}
                  · Gold coins:{' '}
                  <strong className="font-mono-num text-[#ffe28a]">
                    {hud.coins}
                  </strong>
                </p>

                <div className="mt-6 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={onTogglePause}
                    className="flex-1 py-2.5 px-4 rounded-lg bg-[#e2b24a] hover:bg-[#efc360] text-[#0d1914] font-semibold text-sm cursor-pointer whitespace-nowrap"
                  >
                    Resume Run
                  </button>
                  <button
                    type="button"
                    onClick={() => onStartGame(hud.zoneIndex)}
                    className="py-2.5 px-4 rounded-lg bg-white/10 hover:bg-white/15 text-[#f3efe6] text-sm font-medium cursor-pointer whitespace-nowrap"
                  >
                    Restart
                  </button>
                  <button
                    type="button"
                    onClick={onReturnTitle}
                    className="py-2.5 px-4 rounded-lg bg-white/10 hover:bg-white/15 text-[#cbd8d0] text-sm font-medium cursor-pointer whitespace-nowrap"
                  >
                    Title Screen
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="text-xs text-[#fda4af] font-medium">
                  Run Ended · {hud.zoneName}
                </div>
                <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#f3efe6] mt-1">
                  Caught on the Ghat Pass
                </h2>
                <p className="mt-2 text-sm text-[#cbd8d0] leading-relaxed">
                  {hud.deathReason}
                </p>

                <div className="mt-5 py-3.5 px-4 rounded-xl bg-[#09130f] border border-white/10 grid grid-cols-3 gap-3 text-center">
                  <div>
                    <div className="text-[11px] text-[#9eb5a8]">Distance</div>
                    <div className="font-mono-num text-lg font-bold text-[#f3efe6]">
                      {hud.distanceMeters}m
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-[#9eb5a8]">Gold Coins</div>
                    <div className="font-mono-num text-lg font-bold text-[#ffe28a]">
                      {hud.coins}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-[#9eb5a8]">Final Score</div>
                    <div className="font-mono-num text-lg font-bold text-[#e2b24a]">
                      {hud.score}
                    </div>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between text-xs text-[#9eb5a8]">
                  <span>
                    Best Score:{' '}
                    <strong className="font-mono-num text-[#f3efe6]">
                      {hud.highScore}
                    </strong>
                  </span>
                  <span>
                    Total Vault:{' '}
                    <strong className="font-mono-num text-[#ffe28a]">
                      {hud.totalCoinsBank} coins
                    </strong>
                  </span>
                </div>

                <div className="mt-6 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => onStartGame(hud.zoneIndex)}
                    className="flex-1 py-2.5 px-5 rounded-lg bg-[#e2b24a] hover:bg-[#efc360] text-[#0d1914] font-semibold text-sm cursor-pointer whitespace-nowrap"
                  >
                    Run Again (Enter)
                  </button>
                  <button
                    type="button"
                    onClick={onReturnTitle}
                    className="py-2.5 px-4 rounded-lg bg-white/10 hover:bg-white/15 text-[#cbd8d0] text-sm font-medium cursor-pointer whitespace-nowrap"
                  >
                    Title Screen
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
