import { Crosshair, HelpCircle, Play, RotateCcw, Smartphone, Volume2, VolumeX, X } from 'lucide-react';
import type { HudSnapshot } from '../game/types';

interface OverlaysProps {
  hud: HudSnapshot;
  showTutorial: boolean;
  onStart: () => void;
  onResume: () => void;
  onRestart: () => void;
  onReturnTitle: () => void;
  onToggleTutorial: () => void;
  onToggleMute: () => void;
  onSensitivityChange: (val: number) => void;
  onToggleTouch: () => void;
}

function getRankGrade(score: number, kills: number, accuracy: number): { grade: string; color: string; label: string } {
  if (score >= 3200 || (kills >= 22 && accuracy >= 35)) {
    return { grade: 'S', color: 'text-amber-400', label: '王牌教官级' };
  }
  if (score >= 2000 || kills >= 14) {
    return { grade: 'A', color: 'text-cyan-300', label: '精英突击手' };
  }
  if (score >= 1000 || kills >= 7) {
    return { grade: 'B', color: 'text-emerald-400', label: '合格作战员' };
  }
  return { grade: 'C', color: 'text-slate-300', label: '新兵演练' };
}

export function Overlays({
  hud,
  showTutorial,
  onStart,
  onResume,
  onRestart,
  onReturnTitle,
  onToggleTutorial,
  onToggleMute,
  onSensitivityChange,
  onToggleTouch,
}: OverlaysProps) {
  const accuracy =
    hud.shotsFired > 0 ? Math.min(100, Math.round((hud.shotsHit / hud.shotsFired) * 100)) : 0;

  return (
    <>
      {/* 1. TITLE SCREEN OVER LIVE 3D ARENA PAN */}
      {hud.phase === 'title' && (
        <div className="fixed inset-0 z-20 flex flex-col justify-between p-6 sm:p-10 pointer-events-none bg-gradient-to-t from-[#090d13]/92 via-[#090d13]/35 to-[#090d13]/55">
          {/* Top-Right Quick Audio & Tutorial Trigger */}
          <div className="flex items-center justify-end gap-2 pointer-events-auto">
            <button
              type="button"
              onClick={onToggleTouch}
              className={`h-10 px-3.5 rounded border text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                hud.touchMode
                  ? 'bg-amber-500/20 border-amber-400/50 text-amber-300'
                  : 'bg-[#0c1118]/85 border-white/12 text-slate-300 hover:text-white hover:border-white/30'
              }`}
            >
              <Smartphone className="w-4 h-4" />
              <span>{hud.touchMode ? '触屏模式已开' : '触屏控制'}</span>
            </button>

            <button
              type="button"
              onClick={onToggleMute}
              className="h-10 px-3.5 rounded bg-[#0c1118]/85 border border-white/12 text-xs font-medium text-slate-300 hover:text-white hover:border-white/30 flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
            >
              {hud.muted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4" />}
              <span>{hud.muted ? '已静音' : '音效开启'}</span>
            </button>
          </div>

          {/* Center-Left Bespoke Tactical Title Lockup (leaves open calm 3D arena showcase) */}
          <div className="my-auto max-w-xl pointer-events-auto">
            {/* Bespoke Inline SVG Emblem & Wordmark */}
            <div className="mb-3 flex items-center gap-3">
              <svg viewBox="0 0 44 44" className="w-10 h-10 shrink-0" aria-hidden="true">
                <polygon
                  points="22,2 41,12 41,32 22,42 3,32 3,12"
                  fill="#0c1118"
                  stroke="#f59e0b"
                  strokeWidth="2.2"
                />
                <circle cx="22" cy="22" r="8" fill="none" stroke="#f8fafc" strokeWidth="1.8" />
                <line x1="22" y1="8" x2="22" y2="15" stroke="#f59e0b" strokeWidth="2" />
                <line x1="22" y1="29" x2="22" y2="36" stroke="#f59e0b" strokeWidth="2" />
                <line x1="8" y1="22" x2="15" y2="22" stroke="#f59e0b" strokeWidth="2" />
                <line x1="29" y1="22" x2="36" y2="22" stroke="#f59e0b" strokeWidth="2" />
                <circle cx="22" cy="22" r="2.2" fill="#22d3ee" />
              </svg>
              <div className="text-xs font-tactical-mono tracking-[0.22em] text-amber-400 font-semibold">
                FRONTLINE: TRAINING GROUNDS
              </div>
            </div>

            <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-slate-50 leading-tight">
              前线：战术训练场
            </h1>

            <p className="mt-3 text-sm sm:text-base text-slate-300 leading-relaxed max-w-md">
              第一人称工业竞技场实战演练。穿行三条集装箱通道、抢占中路斜坡高台，在限时演习内以精准爆头与连杀刷新战绩。
            </p>

            {/* Primary CTA + Secondary Tutorial Button */}
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={onStart}
                className="h-12 px-7 rounded bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-slate-950 font-bold text-base flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>开始训练</span>
              </button>

              <button
                type="button"
                onClick={onToggleTutorial}
                className="h-12 px-5 rounded bg-[#0c1118]/90 hover:bg-slate-800 border border-white/15 text-slate-100 font-medium text-sm flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
              >
                <HelpCircle className="w-4 h-4 text-cyan-300" />
                <span>操作教程</span>
              </button>
            </div>
          </div>

          {/* Single Flat Control-Hint Line */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-white/10 text-xs text-slate-400">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
              <span className="text-slate-200 font-medium">WASD 移动</span>
              <span>·</span>
              <span>Shift 冲刺</span>
              <span>·</span>
              <span>Space 跳跃</span>
              <span>·</span>
              <span>左键 射击</span>
              <span>·</span>
              <span>右键 瞄准</span>
              <span>·</span>
              <span>R 换弹</span>
              <span>·</span>
              <span>Esc 暂停</span>
            </div>
            <div className="text-slate-500">按 Enter 或点击“开始训练”立即进入战斗</div>
          </div>
        </div>
      )}

      {/* 2. PAUSE MODAL */}
      {hud.phase === 'paused' && !showTutorial && (
        <div className="fixed inset-0 z-30 flex items-center justify-center p-4 bg-[#070b10]/78">
          <div className="w-full max-w-md bg-[#0e141d] border border-white/15 rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-50">训练已暂停</h2>
                <p className="mt-0.5 text-xs text-slate-400">
                  当前波次 {hud.wave} · 得分 {hud.score} · 击杀 {hud.kills}
                </p>
              </div>
              <Crosshair className="w-5 h-5 text-amber-400" />
            </div>

            <div className="mt-5 space-y-3">
              <button
                type="button"
                onClick={onResume}
                className="w-full h-11 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>继续作战</span>
              </button>

              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={onRestart}
                  className="h-10 rounded bg-slate-800 hover:bg-slate-700 border border-white/10 text-slate-100 text-sm font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>重新开始</span>
                </button>
                <button
                  type="button"
                  onClick={onToggleTutorial}
                  className="h-10 rounded bg-slate-800 hover:bg-slate-700 border border-white/10 text-slate-100 text-sm font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <HelpCircle className="w-4 h-4 text-cyan-300" />
                  <span>操作教程</span>
                </button>
              </div>
            </div>

            {/* Sensitivity & Audio Settings */}
            <div className="mt-5 pt-4 border-t border-white/10 space-y-3.5">
              <div>
                <div className="flex items-center justify-between text-xs text-slate-300">
                  <span>鼠标/触屏灵敏度</span>
                  <span className="font-tactical-mono text-amber-400">
                    {hud.sensitivity.toFixed(2)}×
                  </span>
                </div>
                <input
                  type="range"
                  min={0.35}
                  max={2.4}
                  step={0.05}
                  value={hud.sensitivity}
                  onChange={(e) => onSensitivityChange(parseFloat(e.target.value))}
                  className="mt-1.5 w-full accent-amber-400 cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={onToggleMute}
                  className="flex-1 h-9 rounded bg-slate-900 hover:bg-slate-800 border border-white/10 text-xs text-slate-200 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {hud.muted ? <VolumeX className="w-3.5 h-3.5 text-red-400" /> : <Volume2 className="w-3.5 h-3.5" />}
                  <span>{hud.muted ? '已静音' : '音效开启'}</span>
                </button>
                <button
                  type="button"
                  onClick={onToggleTouch}
                  className="flex-1 h-9 rounded bg-slate-900 hover:bg-slate-800 border border-white/10 text-xs text-slate-200 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Smartphone className="w-3.5 h-3.5 text-cyan-300" />
                  <span>{hud.touchMode ? '关闭触控按键' : '开启触控按键'}</span>
                </button>
              </div>

              <button
                type="button"
                onClick={onReturnTitle}
                className="w-full h-9 rounded text-xs text-slate-400 hover:text-slate-100 hover:bg-white/5 transition-colors cursor-pointer"
              >
                返回主界面
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. GAME OVER / TRAINING REPORT MODAL */}
      {hud.phase === 'gameover' && (
        <div className="fixed inset-0 z-30 flex items-center justify-center p-4 bg-[#070b10]/84">
          <div className="w-full max-w-lg bg-[#0e141d] border border-white/15 rounded-lg p-6 sm:p-7">
            {(() => {
              const rank = getRankGrade(hud.score, hud.kills, accuracy);
              return (
                <>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-xs font-medium text-amber-400">
                        {hud.endReason === 'eliminated' ? '生命值耗尽 · 演习中止' : '演习计时结束 · 训练完成'}
                      </div>
                      <h2 className="mt-1 text-2xl font-bold text-slate-50">
                        {hud.endReason === 'eliminated' ? '战损阵亡' : '战术评估报告'}
                      </h2>
                    </div>

                    <div className="text-right">
                      <div className={`font-tactical-mono text-4xl font-extrabold leading-none ${rank.color}`}>
                        {rank.grade}
                      </div>
                      <div className="mt-1 text-[11px] text-slate-400">{rank.label}</div>
                    </div>
                  </div>

                  {/* Clean Quantitative Telemetry Grid */}
                  <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 gap-3 border-y border-white/10 py-5">
                    <div>
                      <div className="text-xs text-slate-400">总得分</div>
                      <div className="mt-1 font-tactical-mono text-2xl font-bold text-amber-400">
                        {hud.score}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-400">摧毁靶机</div>
                      <div className="mt-1 font-tactical-mono text-2xl font-bold text-slate-100">
                        {hud.kills}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-400">精准爆头</div>
                      <div className="mt-1 font-tactical-mono text-2xl font-bold text-red-400">
                        {hud.headshots}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-400">命中率</div>
                      <div className="mt-1 font-tactical-mono text-xl font-bold text-cyan-300">
                        {accuracy}%
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-400">最高连杀</div>
                      <div className="mt-1 font-tactical-mono text-xl font-bold text-orange-400">
                        {hud.maxStreak}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-400">推进波次</div>
                      <div className="mt-1 font-tactical-mono text-xl font-bold text-emerald-400">
                        第 {hud.wave} 波
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 flex flex-col sm:flex-row items-center gap-3">
                    <button
                      type="button"
                      onClick={onRestart}
                      className="w-full sm:flex-1 h-11 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
                    >
                      <RotateCcw className="w-4 h-4" />
                      <span>再来一局</span>
                    </button>
                    <button
                      type="button"
                      onClick={onReturnTitle}
                      className="w-full sm:w-auto h-11 px-5 rounded bg-slate-800 hover:bg-slate-700 border border-white/10 text-slate-200 font-medium text-sm transition-colors cursor-pointer"
                    >
                      返回主界面
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* 4. TUTORIAL / CONTROLS OVERLAY */}
      {showTutorial && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-[#070b10]/85">
          <div className="w-full max-w-xl bg-[#0e141d] border border-white/15 rounded-lg p-6">
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <div>
                <h2 className="text-lg font-bold text-slate-50">战术操作指南</h2>
                <p className="text-xs text-slate-400 mt-0.5">前线：战术训练场基础按键与得分规则</p>
              </div>
              <button
                type="button"
                onClick={onToggleTutorial}
                className="h-8 w-8 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center cursor-pointer"
                aria-label="关闭教程"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="flex items-center justify-between py-2 border-b border-white/6">
                <span className="text-slate-300">前后左右移动</span>
                <kbd className="font-tactical-mono bg-slate-800 border border-white/15 rounded px-2 py-0.5 text-amber-300">
                  W A S D
                </kbd>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-white/6">
                <span className="text-slate-300">视角瞄准</span>
                <kbd className="font-tactical-mono bg-slate-800 border border-white/15 rounded px-2 py-0.5 text-amber-300">
                  鼠标移动
                </kbd>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-white/6">
                <span className="text-slate-300">全自动射击</span>
                <kbd className="font-tactical-mono bg-slate-800 border border-white/15 rounded px-2 py-0.5 text-amber-300">
                  鼠标左键
                </kbd>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-white/6">
                <span className="text-slate-300">全息开镜精准瞄准</span>
                <kbd className="font-tactical-mono bg-slate-800 border border-white/15 rounded px-2 py-0.5 text-cyan-300">
                  按住右键
                </kbd>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-white/6">
                <span className="text-slate-300">战术冲刺</span>
                <kbd className="font-tactical-mono bg-slate-800 border border-white/15 rounded px-2 py-0.5 text-slate-200">
                  Shift
                </kbd>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-white/6">
                <span className="text-slate-300">跳跃 / 登高台</span>
                <kbd className="font-tactical-mono bg-slate-800 border border-white/15 rounded px-2 py-0.5 text-slate-200">
                  Space
                </kbd>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-white/6">
                <span className="text-slate-300">更换弹匣</span>
                <kbd className="font-tactical-mono bg-slate-800 border border-white/15 rounded px-2 py-0.5 text-slate-200">
                  R
                </kbd>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-white/6">
                <span className="text-slate-300">释放鼠标 / 暂停</span>
                <kbd className="font-tactical-mono bg-slate-800 border border-white/15 rounded px-2 py-0.5 text-slate-200">
                  Esc / P
                </kbd>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-white/10 space-y-1.5 text-xs text-slate-300 leading-relaxed">
              <div>
                <span className="text-amber-400 font-semibold">爆头暴击：</span>
                命中靶机头部发光面罩可触发 2 倍暴击伤害与额外加分。
              </div>
              <div>
                <span className="text-cyan-300 font-semibold">高台与掩体：</span>
                沿斜坡登上中路及两侧集装箱高台可获得开阔射界；靶机面罩变红蓄力时请及时侧移或躲入掩体。
              </div>
              <div>
                <span className="text-emerald-400 font-semibold">波次补给：</span>
                每次摧毁靶机可获得少量弹药与护甲回复，完成当前波次目标将恢复生命并解锁高阶靶机。
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2.5">
              {hud.phase === 'title' ? (
                <button
                  type="button"
                  onClick={() => {
                    onToggleTutorial();
                    onStart();
                  }}
                  className="h-10 px-6 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm cursor-pointer"
                >
                  立即开始训练
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onToggleTutorial}
                  className="h-10 px-6 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm cursor-pointer"
                >
                  我知道了
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 5. WEBGL FALLBACK BANNER */}
      {hud.webglError && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-[#0b1017]">
          <div className="max-w-md bg-[#121923] border border-red-500/40 rounded-lg p-6 text-center">
            <h2 className="text-lg font-bold text-red-400">渲染初始化失败</h2>
            <p className="mt-2 text-sm text-slate-300">{hud.webglError}</p>
          </div>
        </div>
      )}
    </>
  );
}
