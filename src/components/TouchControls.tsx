import { useRef, useState } from 'react';
import type { TouchInputState } from '../game/types';

interface TouchControlsProps {
  isAds: boolean;
  isSprinting: boolean;
  onTouchInput: (partial: Partial<TouchInputState>) => void;
  onTouchLook: (dx: number, dy: number) => void;
  onJump: () => void;
  onReload: () => void;
}

/**
 * Responsive touch-friendly on-screen FPS controls:
 * Left virtual joystick for movement, right swipe zone for look/aim,
 * and >= 44px tactile buttons for Fire, ADS, Jump, Reload, and Sprint.
 */
export function TouchControls({
  isAds,
  isSprinting,
  onTouchInput,
  onTouchLook,
  onJump,
  onReload,
}: TouchControlsProps) {
  const [knobOffset, setKnobOffset] = useState({ x: 0, y: 0 });
  const stickPointerId = useRef<number | null>(null);
  const stickCenter = useRef({ x: 0, y: 0 });

  const lookPointerId = useRef<number | null>(null);
  const lastLookPos = useRef({ x: 0, y: 0 });

  const maxRadius = 42;

  const handleStickDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    const rect = e.currentTarget.getBoundingClientRect();
    stickPointerId.current = e.pointerId;
    stickCenter.current = {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    };
    updateStick(e.clientX, e.clientY);
  };

  const handleStickMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (stickPointerId.current !== e.pointerId) return;
    e.stopPropagation();
    updateStick(e.clientX, e.clientY);
  };

  const handleStickUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (stickPointerId.current !== e.pointerId) return;
    e.stopPropagation();
    stickPointerId.current = null;
    setKnobOffset({ x: 0, y: 0 });
    onTouchInput({ moveX: 0, moveY: 0 });
  };

  const updateStick = (clientX: number, clientY: number) => {
    const dx = clientX - stickCenter.current.x;
    const dy = clientY - stickCenter.current.y;
    const dist = Math.hypot(dx, dy);
    const clamped = Math.min(dist, maxRadius);
    const angle = Math.atan2(dy, dx);
    const kx = dist > 0.01 ? Math.cos(angle) * clamped : 0;
    const ky = dist > 0.01 ? Math.sin(angle) * clamped : 0;
    setKnobOffset({ x: kx, y: ky });
    onTouchInput({
      moveX: kx / maxRadius,
      moveY: -ky / maxRadius,
    });
  };

  const handleLookDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (lookPointerId.current !== null) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    lookPointerId.current = e.pointerId;
    lastLookPos.current = { x: e.clientX, y: e.clientY };
  };

  const handleLookMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (lookPointerId.current !== e.pointerId) return;
    const dx = e.clientX - lastLookPos.current.x;
    const dy = e.clientY - lastLookPos.current.y;
    lastLookPos.current = { x: e.clientX, y: e.clientY };
    onTouchLook(dx, dy);
  };

  const handleLookUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (lookPointerId.current !== e.pointerId) return;
    lookPointerId.current = null;
  };

  return (
    <div className="fixed inset-0 z-20 pointer-events-none select-none">
      {/* Right-half touch drag area for smooth camera look */}
      <div
        onPointerDown={handleLookDown}
        onPointerMove={handleLookMove}
        onPointerUp={handleLookUp}
        onPointerCancel={handleLookUp}
        className="absolute top-14 right-0 bottom-0 left-[42%] pointer-events-auto"
        aria-label="滑动调整视角"
      />

      {/* Left Virtual Movement Stick */}
      <div className="absolute bottom-5 left-5 flex items-end gap-3 pointer-events-auto">
        <div
          onPointerDown={handleStickDown}
          onPointerMove={handleStickMove}
          onPointerUp={handleStickUp}
          onPointerCancel={handleStickUp}
          className="relative w-28 h-28 rounded-full bg-[#0b1017]/75 border border-white/20 flex items-center justify-center touch-none"
        >
          <div className="w-12 h-12 rounded-full border border-white/10" />
          <div
            className="absolute w-11 h-11 rounded-full bg-amber-400/90 border-2 border-white/80"
            style={{
              transform: `translate(${knobOffset.x}px, ${knobOffset.y}px)`,
            }}
          />
        </div>

        <button
          type="button"
          onPointerDown={(e) => {
            e.stopPropagation();
            onTouchInput({ sprinting: !isSprinting });
          }}
          className={`h-11 px-3.5 rounded border text-xs font-semibold whitespace-nowrap ${
            isSprinting
              ? 'bg-amber-500 text-slate-950 border-amber-300'
              : 'bg-[#0b1017]/82 text-slate-200 border-white/20'
          }`}
        >
          冲刺
        </button>
      </div>

      {/* Right Action Cluster: Fire, ADS, Jump, Reload */}
      <div className="absolute bottom-5 right-5 flex flex-col items-end gap-2.5 pointer-events-auto">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onPointerDown={(e) => {
              e.stopPropagation();
              onTouchInput({ ads: !isAds });
            }}
            className={`h-12 min-w-[54px] px-3 rounded border text-xs font-semibold whitespace-nowrap ${
              isAds
                ? 'bg-cyan-400 text-slate-950 border-cyan-200'
                : 'bg-[#0b1017]/82 text-slate-100 border-white/20'
            }`}
          >
            开镜
          </button>

          <button
            type="button"
            onPointerDown={(e) => {
              e.stopPropagation();
              onReload();
            }}
            className="h-12 min-w-[54px] px-3 rounded bg-[#0b1017]/82 border border-white/20 text-xs font-semibold text-slate-100 active:bg-slate-700 whitespace-nowrap"
          >
            换弹
          </button>

          <button
            type="button"
            onPointerDown={(e) => {
              e.stopPropagation();
              onJump();
            }}
            className="h-12 min-w-[54px] px-3 rounded bg-[#0b1017]/82 border border-white/20 text-xs font-semibold text-slate-100 active:bg-slate-700 whitespace-nowrap"
          >
            跳跃
          </button>
        </div>

        <button
          type="button"
          onPointerDown={(e) => {
            e.stopPropagation();
            e.currentTarget.setPointerCapture(e.pointerId);
            onTouchInput({ firing: true });
          }}
          onPointerUp={(e) => {
            e.stopPropagation();
            onTouchInput({ firing: false });
          }}
          onPointerCancel={(e) => {
            e.stopPropagation();
            onTouchInput({ firing: false });
          }}
          className="h-16 w-32 rounded bg-amber-500 active:bg-amber-400 text-slate-950 font-bold text-base tracking-wide border border-amber-200/60"
        >
          射击
        </button>
      </div>
    </div>
  );
}
