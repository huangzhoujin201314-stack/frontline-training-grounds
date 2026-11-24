import { useCallback, useEffect, useRef, useState } from 'react';
import { GameHud } from './components/GameHud';
import { Overlays } from './components/Overlays';
import { TouchControls } from './components/TouchControls';
import { FrontlineEngine } from './game/engine';
import type { HudSnapshot, TouchInputState } from './game/types';

const INITIAL_HUD: HudSnapshot = {
  phase: 'title',
  score: 0,
  kills: 0,
  headshots: 0,
  shotsFired: 0,
  shotsHit: 0,
  streak: 0,
  maxStreak: 0,
  health: 100,
  maxHealth: 100,
  armor: 100,
  maxArmor: 100,
  ammo: 30,
  magSize: 30,
  reserveAmmo: 150,
  isReloading: false,
  reloadProgress: 0,
  isAds: false,
  isSprinting: false,
  timeLeft: 120,
  totalTime: 120,
  wave: 1,
  waveKills: 0,
  waveTarget: 6,
  objectiveTitle: '第一阶段：基础清道',
  objectiveDesc: '熟悉三条战术通道并清除标准训练靶机，爆头可造成双倍伤害',
  hitMarkerType: 'none',
  hitSeq: 0,
  damageFlash: 0,
  damageAngle: 0,
  crosshairSpread: 6,
  killFeed: [],
  pointerLocked: false,
  endReason: 'time',
  muted: false,
  sensitivity: 1.0,
  touchMode: false,
  webglError: null,
};

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<FrontlineEngine | null>(null);
  const [hud, setHud] = useState<HudSnapshot>(INITIAL_HUD);
  const [showTutorial, setShowTutorial] = useState(false);

  // Mount Three.js engine once in an isolated canvas container
  useEffect(() => {
    const mount = canvasMountRef.current;
    if (!mount) return;
    const engine = new FrontlineEngine(mount, (snapshot) => {
      setHud(snapshot);
    });
    engineRef.current = engine;
    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  // Global keyboard shortcuts for Start (Enter/Space on Title) & Tutorial (H)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'KeyH') {
        if (hud.phase === 'playing') {
          engineRef.current?.pauseGame();
          setShowTutorial(true);
        } else {
          setShowTutorial((prev) => !prev);
        }
        return;
      }

      if (hud.phase === 'title' && !showTutorial && (e.code === 'Enter' || e.code === 'Space')) {
        e.preventDefault();
        engineRef.current?.startNewGame();
      } else if (e.code === 'Escape' && showTutorial) {
        setShowTutorial(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [hud.phase, showTutorial]);

  const handleStart = useCallback(() => {
    setShowTutorial(false);
    engineRef.current?.startNewGame();
  }, []);

  const handleResume = useCallback(() => {
    setShowTutorial(false);
    engineRef.current?.resumeGame();
  }, []);

  const handleRestart = useCallback(() => {
    setShowTutorial(false);
    engineRef.current?.startNewGame();
  }, []);

  const handlePause = useCallback(() => {
    engineRef.current?.pauseGame();
  }, []);

  const handleReturnTitle = useCallback(() => {
    setShowTutorial(false);
    engineRef.current?.returnToTitle();
  }, []);

  const handleToggleTutorial = useCallback(() => {
    setShowTutorial((prev) => {
      const next = !prev;
      if (next && hud.phase === 'playing') {
        engineRef.current?.pauseGame();
      }
      return next;
    });
  }, [hud.phase]);

  const handleToggleMute = useCallback(() => {
    engineRef.current?.toggleMute();
  }, []);

  const handleSensitivityChange = useCallback((val: number) => {
    engineRef.current?.setSensitivity(val);
  }, []);

  const handleToggleTouch = useCallback(() => {
    engineRef.current?.setTouchMode(!hud.touchMode);
  }, [hud.touchMode]);

  const handleTouchInput = useCallback((partial: Partial<TouchInputState>) => {
    engineRef.current?.setTouchInput(partial);
  }, []);

  const handleTouchLook = useCallback((dx: number, dy: number) => {
    engineRef.current?.applyTouchLook(dx, dy);
  }, []);

  const handleTouchJump = useCallback(() => {
    engineRef.current?.triggerTouchJump();
  }, []);

  const handleReload = useCallback(() => {
    engineRef.current?.triggerReload();
  }, []);

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-[#0c0f14]">
      {/* Isolated WebGL Canvas Mount — React state updates never recreate this container */}
      <div ref={canvasMountRef} className="absolute inset-0 w-full h-full" />

      {/* Active Gameplay HUD */}
      {(hud.phase === 'playing' || hud.phase === 'paused') && (
        <GameHud
          hud={hud}
          onToggleMute={handleToggleMute}
          onToggleTutorial={handleToggleTutorial}
          onPause={handlePause}
          onRestart={handleRestart}
          onToggleTouch={handleToggleTouch}
        />
      )}

      {/* Touch-Friendly On-Screen Controls */}
      {hud.phase === 'playing' && hud.touchMode && (
        <TouchControls
          isAds={hud.isAds}
          isSprinting={hud.isSprinting}
          onTouchInput={handleTouchInput}
          onTouchLook={handleTouchLook}
          onJump={handleTouchJump}
          onReload={handleReload}
        />
      )}

      {/* Title Screen, Pause Menu, Game Over Summary & Tutorial Modal */}
      <Overlays
        hud={hud}
        showTutorial={showTutorial}
        onStart={handleStart}
        onResume={handleResume}
        onRestart={handleRestart}
        onReturnTitle={handleReturnTitle}
        onToggleTutorial={handleToggleTutorial}
        onToggleMute={handleToggleMute}
        onSensitivityChange={handleSensitivityChange}
        onToggleTouch={handleToggleTouch}
      />
    </main>
  );
}
