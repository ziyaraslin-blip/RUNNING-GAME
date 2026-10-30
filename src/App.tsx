import { useCallback, useEffect, useRef, useState } from 'react';
import { GameHud } from './components/GameHud';
import { LANDMARK_SOUNDSCAPE_LABELS } from './game/ambience';
import { WayanadRunnerEngine } from './game/engine';
import { WAYANAD_ZONES } from './game/levels';
import { CameraPreset, HudSnapshot } from './game/types';

const INITIAL_HUD: HudSnapshot = {
  phase: 'title',
  zoneIndex: 0,
  zoneName: WAYANAD_ZONES[0].name,
  malayalamRegion: WAYANAD_ZONES[0].malayalamRegion,
  soundscapeLabel: LANDMARK_SOUNDSCAPE_LABELS[WAYANAD_ZONES[0].landmark],
  distanceMeters: 0,
  runSpeedKmh: Number((WAYANAD_ZONES[0].baseSpeed * 2.0).toFixed(1)),
  milestoneBannerMeters: 0,
  coins: 0,
  totalCoinsBank: 0,
  score: 0,
  highScore: 0,
  bestDistance: 0,
  multiplier: 1,
  monsterProximity: 0.78,
  monsterAlert: false,
  magnetSeconds: 0,
  boostSeconds: 0,
  chronoCharge: 100,
  chronoActive: false,
  chronoSeconds: 0,
  timeOfDayLabel: 'Golden Ghat Dawn',
  weatherLabel: 'Misty Breeze',
  fx4dEnabled: true,
  lensWetness: 0.2,
  windCrossForce: 0.25,
  lightningFlash: 0,
  deathReason: '',
  cameraPreset: 'elevated',
  muted: false,
  ambienceVolume: 75,
  dockCollapsed: false,
  webglFallback: false,
};

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<WayanadRunnerEngine | null>(null);
  const [hud, setHud] = useState<HudSnapshot>(INITIAL_HUD);

  useEffect(() => {
    const mountEl = canvasMountRef.current;
    if (!mountEl) return;

    const engine = new WayanadRunnerEngine(mountEl, (snapshot) => {
      setHud(snapshot);
    });
    engineRef.current = engine;

    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  const handleStartGame = useCallback((zoneIdx = 0) => {
    engineRef.current?.startGame(zoneIdx);
  }, []);

  const handleSelectZone = useCallback((zoneIdx: number) => {
    engineRef.current?.selectZone(zoneIdx);
  }, []);

  const handleTriggerChrono = useCallback(() => {
    engineRef.current?.triggerChronoShift();
  }, []);

  const handleToggleFx4d = useCallback(() => {
    engineRef.current?.toggleFx4d();
  }, []);

  const handleTogglePause = useCallback(() => {
    engineRef.current?.togglePause();
  }, []);

  const handleReturnTitle = useCallback(() => {
    engineRef.current?.returnToTitle();
  }, []);

  const handleToggleMute = useCallback(() => {
    engineRef.current?.toggleMute();
  }, []);

  const handleAmbienceVolume = useCallback((percent: number) => {
    engineRef.current?.setAmbienceVolume(percent);
  }, []);

  const handleToggleDock = useCallback(() => {
    engineRef.current?.toggleDock();
  }, []);

  const handleCameraPreset = useCallback((preset: CameraPreset) => {
    engineRef.current?.applyCameraPreset(preset);
  }, []);

  return (
    <main className="relative w-full h-full overflow-hidden bg-[#0d1914]">
      {/* Isolated WebGL Canvas Mount Container — never re-rendered by React HUD updates */}
      <div
        ref={canvasMountRef}
        className="absolute inset-0 w-full h-full"
        aria-label="4D Wayanad Highway Endless Runner Viewport"
      />

      {/* Graceful Static Fallback if WebGL is Completely Unavailable */}
      {hud.webglFallback && (
        <div className="absolute inset-0 flex items-center justify-center p-8 bg-gradient-to-b from-[#13261e] to-[#0a1410] text-center">
          <div className="max-w-md border border-[#d4a853]/30 rounded-2xl p-6 bg-[#0e1d17]">
            <h1 className="font-display text-2xl font-bold text-[#f3efe6]">
              Ghats of Wayanad
            </h1>
            <p className="mt-2 text-sm text-[#cbd8d0]">
              WebGL rendering is currently unavailable in this browser
              environment. Enable hardware acceleration or WebGL to play the 4D
              Wayanad highway runner.
            </p>
          </div>
        </div>
      )}

      {/* Semantic Low-Occlusion Game Shell Overlay */}
      <GameHud
        hud={hud}
        onStartGame={handleStartGame}
        onSelectZone={handleSelectZone}
        onTriggerChrono={handleTriggerChrono}
        onToggleFx4d={handleToggleFx4d}
        onTogglePause={handleTogglePause}
        onReturnTitle={handleReturnTitle}
        onToggleMute={handleToggleMute}
        onAmbienceVolume={handleAmbienceVolume}
        onToggleDock={handleToggleDock}
        onCameraPreset={handleCameraPreset}
      />
    </main>
  );
}
