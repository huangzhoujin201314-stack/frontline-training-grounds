import { HelpCircle, Pause, RotateCcw, Smartphone, Volume2, VolumeX } from 'lucide-react';
import type { HudSnapshot } from '../game/types';

interface GameHudProps {
  hud: HudSnapshot;
  onToggleMute: () => void;
  onToggleTutorial: () => void;
  onPause: () => void;
  onRestart: () => void;
  onToggleTouch: () => void;
}

function formatTimer(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  const mins = Math.floor(s / 60);
  const secs = s % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function GameHud({
  hud,
  onToggleMute,
  onToggleTutorial,
  onPause,
  onRestart,
  onToggleTouch,
}: GameHudProps) {
  const spread = Math.round(hud.crosshairSpread);
  const isLowAmmo = hud.ammo <= Math.floor(hud.magSize * 0.25);
  const isLowHealth = hud.health <= 30;
  const wavePct = Math.min(100, Math.round((hud.waveKills / Math.max(1, hud.waveTarget)) * 100));

  return (
    <div className="fixed inset-0 z-10 pointer-events-none select-none overflow-hidden">
      {/* Subtle Damage Vignette + Directional Threat Arc */}
      {hud.damageFlash > 0.02 && (
        <>
          <div
            className="absolute inset-0"
            style={{
              background:
                'radial-gradient(circle at center, transparent 52%, rgba(220, 38, 38, 0.55) 100%)',
              opacity: Math.min(0.85, hud.damageFlash),
            }}
          />
          <div
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48"
            style={{
              transform: `translate(-50%, -50%) rotate(${hud.damageAngle}rad)`,
              opacity: Math.min(0.95, hud.damageFlash),
            }}
          >
            <svg viewBox="0 0 120 120" className="w-full h-full">
              <path
                d="M 40 12 A 50 50 0 0 1 80 12"
                fill="none"
                stroke="#ef4444"
                strokeWidth="5"
                strokeLinecap="round"
              />
            </svg>
          </div>
        </>
      )}

      {/* Top Row: Objective (Left) · Score / Kills / Timer (Center) · Utility Actions (Right) */}
      <div className="absolute top-3 left-3 right-3 sm:top-4 sm:left-5 sm:right-5 flex items-start justify-between gap-3">
        {/* Top-Left: Compact Objective Panel */}
        <div className="bg-[#0b1017]/82 border border-white/10 rounded px-3.5 py-2.5 max-w-[260px] hidden sm:block">
          <div className="flex items-center justify-between gap-3 text-[11px] text-amber-400 font-medium">
            <span>任务目标</span>
            <span className="font-tactical-mono text-slate-300">
              波次 {hud.wave} · {hud.waveKills}/{hud.waveTarget}
            </span>
          </div>
          <div className="mt-1 text-xs font-semibold text-slate-100 leading-snug">
            {hud.objectiveTitle}
          </div>
          <p className="mt-0.5 text-[11px] text-slate-400 leading-relaxed">
            {hud.objectiveDesc}
          </p>
          <div className="mt-2 h-1 w-full bg-slate-800 rounded-xs overflow-hidden">
            <div
              className="h-full bg-amber-400 transition-[width] duration-150"
              style={{ width: `${wavePct}%` }}
            />
          </div>
        </div>

        {/* Top-Center: Score · Timer · Kills Cluster */}
        <div className="mx-auto sm:mx-0 flex items-center gap-4 sm:gap-6 bg-[#0b1017]/85 border border-white/10 rounded px-4 sm:px-5 py-2">
          <div className="text-center min-w-[54px]">
            <div className="text-[10px] text-slate-400">得分</div>
            <div className="font-tactical-mono text-base sm:text-lg font-bold text-amber-400 leading-tight">
              {hud.score}
            </div>
          </div>

          <div className="h-6 w-px bg-white/10" />

          <div className="text-center min-w-[68px]">
            <div className="text-[10px] text-slate-400">剩余时间</div>
            <div
              className={`font-tactical-mono text-lg sm:text-xl font-bold leading-tight ${
                hud.timeLeft <= 20 ? 'text-red-400' : 'text-slate-100'
              }`}
            >
              {formatTimer(hud.timeLeft)}
            </div>
          </div>

          <div className="h-6 w-px bg-white/10" />

          <div className="text-center min-w-[54px]">
            <div className="text-[10px] text-slate-400">击杀</div>
            <div className="font-tactical-mono text-base sm:text-lg font-bold text-cyan-300 leading-tight">
              {hud.kills}
            </div>
          </div>

          {hud.streak >= 2 && (
            <>
              <div className="h-6 w-px bg-white/10 hidden sm:block" />
              <div className="text-center hidden sm:block">
                <div className="text-[10px] text-slate-400">连杀</div>
                <div className="font-tactical-mono text-base font-bold text-orange-400 leading-tight">
                  ×{hud.streak}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Top-Right: Compact Interactive Utility Buttons */}
        <div className="flex items-center gap-1.5 pointer-events-auto">
          <button
            type="button"
            onClick={onToggleTouch}
            title={hud.touchMode ? '关闭触屏摇杆' : '开启触屏摇杆'}
            className={`h-9 px-2.5 rounded border text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
              hud.touchMode
                ? 'bg-amber-500/20 border-amber-400/50 text-amber-300'
                : 'bg-[#0b1017]/82 border-white/10 text-slate-300 hover:text-white hover:border-white/25'
            }`}
          >
            <Smartphone className="w-4 h-4" />
            <span className="hidden md:inline whitespace-nowrap">触控</span>
          </button>

          <button
            type="button"
            onClick={onToggleMute}
            title={hud.muted ? '取消静音' : '静音'}
            className="h-9 w-9 rounded bg-[#0b1017]/82 border border-white/10 text-slate-300 hover:text-white hover:border-white/25 flex items-center justify-center transition-colors cursor-pointer"
          >
            {hud.muted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4" />}
          </button>

          <button
            type="button"
            onClick={onToggleTutorial}
            title="操作教程 (H)"
            className="h-9 w-9 rounded bg-[#0b1017]/82 border border-white/10 text-slate-300 hover:text-white hover:border-white/25 flex items-center justify-center transition-colors cursor-pointer"
          >
            <HelpCircle className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={onRestart}
            title="重新开始"
            className="h-9 w-9 rounded bg-[#0b1017]/82 border border-white/10 text-slate-300 hover:text-white hover:border-white/25 flex items-center justify-center transition-colors cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={onPause}
            title="暂停 (Esc / P)"
            className="h-9 px-2.5 rounded bg-[#0b1017]/82 border border-white/10 text-slate-200 hover:text-white hover:border-white/25 flex items-center gap-1 text-xs font-medium transition-colors cursor-pointer"
          >
            <Pause className="w-3.5 h-3.5" />
            <span className="hidden sm:inline whitespace-nowrap">暂停</span>
          </button>
        </div>
      </div>

      {/* Quiet Right-Side Kill Feed (Clean Unboxed Text) */}
      {hud.killFeed.length > 0 && (
        <div className="absolute top-20 right-4 sm:right-5 flex flex-col items-end gap-1">
          {hud.killFeed.map((item) => (
            <div
              key={item.id}
              className="bg-[#0b1017]/75 border border-white/8 rounded px-2.5 py-1 text-xs flex items-center gap-1.5"
            >
              <span className="text-slate-200 font-medium">摧毁 {item.botName}</span>
              <span className="text-slate-500">·</span>
              {item.headshot && (
                <>
                  <span className="text-red-400 font-semibold">爆头</span>
                  <span className="text-slate-500">·</span>
                </>
              )}
              <span className="font-tactical-mono text-amber-400 font-semibold">+{item.points}</span>
            </div>
          ))}
        </div>
      )}

      {/* Center Reticle: Dynamic Tactical Crosshair + Hitmarker + Reload Progress */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        {/* Crosshair ticks (subtle dot when ADS, 4 dynamic brackets in hipfire) */}
        <div className="relative w-0 h-0">
          {/* Center micro dot */}
          <div
            className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{
              width: hud.isAds ? '3px' : '2.5px',
              height: hud.isAds ? '3px' : '2.5px',
              backgroundColor: hud.isAds ? '#22d3ee' : 'rgba(248, 250, 252, 0.92)',
              boxShadow: '0 0 3px rgba(0,0,0,0.9)',
            }}
          />

          {!hud.isAds && (
            <>
              <div
                className="absolute left-1/2 -translate-x-1/2 w-[2px] h-[9px] bg-slate-100/90"
                style={{ bottom: `${spread}px`, boxShadow: '0 0 2px rgba(0,0,0,0.85)' }}
              />
              <div
                className="absolute left-1/2 -translate-x-1/2 w-[2px] h-[9px] bg-slate-100/90"
                style={{ top: `${spread}px`, boxShadow: '0 0 2px rgba(0,0,0,0.85)' }}
              />
              <div
                className="absolute top-1/2 -translate-y-1/2 h-[2px] w-[9px] bg-slate-100/90"
                style={{ right: `${spread}px`, boxShadow: '0 0 2px rgba(0,0,0,0.85)' }}
              />
              <div
                className="absolute top-1/2 -translate-y-1/2 h-[2px] w-[9px] bg-slate-100/90"
                style={{ left: `${spread}px`, boxShadow: '0 0 2px rgba(0,0,0,0.85)' }}
              />
            </>
          )}

          {/* Crisp Hitmarker X */}
          {hud.hitMarkerType !== 'none' && (
            <svg
              key={hud.hitSeq}
              viewBox="0 0 40 40"
              className="absolute -translate-x-1/2 -translate-y-1/2 w-8 h-8"
            >
              <g
                stroke={
                  hud.hitMarkerType === 'headshot'
                    ? '#ef4444'
                    : hud.hitMarkerType === 'kill'
                      ? '#f59e0b'
                      : '#f8fafc'
                }
                strokeWidth={hud.hitMarkerType === 'headshot' ? '2.8' : '2.2'}
                strokeLinecap="square"
              >
                <line x1="8" y1="8" x2="15" y2="15" />
                <line x1="32" y1="8" x2="25" y2="15" />
                <line x1="8" y1="32" x2="15" y2="25" />
                <line x1="32" y1="32" x2="25" y2="25" />
              </g>
            </svg>
          )}
        </div>

        {/* Reload Ring Indicator */}
        {hud.isReloading && (
          <div className="absolute top-7 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1">
            <div className="w-24 h-1.5 bg-slate-900/90 border border-white/15 rounded-xs overflow-hidden">
              <div
                className="h-full bg-amber-400"
                style={{ width: `${Math.round(hud.reloadProgress * 100)}%` }}
              />
            </div>
            <span className="text-[11px] font-medium text-amber-300 tracking-wide whitespace-nowrap">
              正在换弹
            </span>
          </div>
        )}
      </div>

      {/* Desktop Pointer Lock Prompt (if playing without touchMode and unlocked) */}
      {!hud.pointerLocked && !hud.touchMode && hud.phase === 'playing' && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 bg-[#0b1017]/90 border border-amber-400/40 rounded px-4 py-1.5 text-xs text-amber-200 whitespace-nowrap">
          点击画面任意位置锁定鼠标视角
        </div>
      )}

      {/* Bottom Row: Health & Armor (Left) · Weapon & Ammo (Right) */}
      <div
        className={`absolute left-3 right-3 sm:left-5 sm:right-5 flex items-end justify-between gap-4 ${
          hud.touchMode ? 'bottom-36 sm:bottom-5' : 'bottom-4 sm:bottom-5'
        }`}
      >
        {/* Bottom-Left: Health & Armor Bars */}
        <div className="bg-[#0b1017]/85 border border-white/10 rounded px-3.5 py-2.5 w-48 sm:w-56">
          {/* Health */}
          <div className="flex items-baseline justify-between text-xs">
            <span className="text-slate-400 font-medium">生命值</span>
            <span
              className={`font-tactical-mono text-base font-bold ${
                isLowHealth ? 'text-red-400' : 'text-slate-100'
              }`}
            >
              {hud.health}
            </span>
          </div>
          <div className="mt-1 h-2 w-full bg-slate-800 rounded-xs overflow-hidden">
            <div
              className={`h-full transition-[width] duration-100 ${
                isLowHealth ? 'bg-red-500' : 'bg-emerald-400'
              }`}
              style={{ width: `${Math.round((hud.health / hud.maxHealth) * 100)}%` }}
            />
          </div>

          {/* Armor */}
          <div className="mt-2.5 flex items-baseline justify-between text-xs">
            <span className="text-slate-400 font-medium">护甲值</span>
            <span className="font-tactical-mono text-sm font-semibold text-cyan-300">
              {hud.armor}
            </span>
          </div>
          <div className="mt-1 h-1.5 w-full bg-slate-800 rounded-xs overflow-hidden">
            <div
              className="h-full bg-cyan-400 transition-[width] duration-100"
              style={{ width: `${Math.round((hud.armor / hud.maxArmor) * 100)}%` }}
            />
          </div>
        </div>

        {/* Bottom-Center Quiet Key Hint on Desktop */}
        {!hud.touchMode && (
          <div className="hidden lg:flex items-center gap-2 text-[11px] text-slate-400 bg-[#0b1017]/70 border border-white/8 rounded px-3 py-1.5">
            <span>WASD 移动</span>
            <span className="text-slate-600">·</span>
            <span>Shift 冲刺</span>
            <span className="text-slate-600">·</span>
            <span>Space 跳跃</span>
            <span className="text-slate-600">·</span>
            <span>左键 射击</span>
            <span className="text-slate-600">·</span>
            <span>右键 瞄准</span>
            <span className="text-slate-600">·</span>
            <span>R 换弹</span>
            <span className="text-slate-600">·</span>
            <span>Esc 暂停</span>
          </div>
        )}

        {/* Bottom-Right: Weapon & Ammo Readout */}
        <div className="bg-[#0b1017]/85 border border-white/10 rounded px-4 py-2.5 min-w-[168px] sm:min-w-[196px] text-right">
          <div className="flex items-center justify-end gap-2 text-[11px] text-slate-400">
            <span>{hud.isAds ? '精准瞄准' : hud.isSprinting ? '战术冲刺' : '全自动'}</span>
            <span className="text-slate-600">·</span>
            <span className="text-slate-300 font-medium">VX-74 突击步枪</span>
          </div>
          <div className="mt-1 flex items-baseline justify-end gap-1.5">
            <span
              className={`font-tactical-mono text-2xl sm:text-3xl font-bold leading-none ${
                isLowAmmo ? 'text-red-400' : 'text-slate-100'
              }`}
            >
              {hud.ammo}
            </span>
            <span className="font-tactical-mono text-sm text-slate-500">/</span>
            <span className="font-tactical-mono text-base sm:text-lg font-medium text-slate-400">
              {hud.reserveAmmo}
            </span>
          </div>
          {isLowAmmo && !hud.isReloading && hud.reserveAmmo > 0 && (
            <div className="mt-1 text-[11px] text-amber-400 font-medium">弹药偏低 · 按 R 换弹</div>
          )}
        </div>
      </div>
    </div>
  );
}
