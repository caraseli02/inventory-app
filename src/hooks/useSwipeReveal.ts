import { useEffect, useRef } from 'react';

type SwipeRevealState = {
  pointerId: number;
  startX: number;
  startY: number;
  baseX: number;
  active: boolean;
  cancelled: boolean;
};

type UseSwipeRevealOptions = {
  enabled: boolean;
  maxPx: number;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  disabled?: boolean;
};

export function useSwipeReveal({ enabled, maxPx, isOpen, onOpenChange, disabled }: UseSwipeRevealOptions) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const swipeRef = useRef<SwipeRevealState | null>(null);

  const setTranslateX = (x: number, animate: boolean) => {
    const node = cardRef.current;
    if (!node) return;
    node.style.transition = animate ? 'transform 180ms cubic-bezier(.2,.8,.2,1)' : 'none';
    node.style.transform = `translateX(${x}px)`;
  };

  const close = () => { onOpenChange(false); setTranslateX(0, true); };
  useEffect(() => { setTranslateX(enabled && isOpen ? -maxPx : 0, true); }, [enabled, isOpen, maxPx]);

  const onPointerDown: React.PointerEventHandler<HTMLDivElement> = (e) => {
    if (!enabled || disabled) return;
    if ((e.target as HTMLElement | null)?.closest('button')) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    swipeRef.current = { pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, baseX: isOpen ? -maxPx : 0, active: true, cancelled: false };
    try { (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId); } catch { /* ignore */ }
    setTranslateX(isOpen ? -maxPx : 0, false);
  };

  const onPointerMove: React.PointerEventHandler<HTMLDivElement> = (e) => {
    const s = swipeRef.current;
    if (!s || !s.active || s.pointerId !== e.pointerId) return;
    const dx = e.clientX - s.startX;
    const dy = e.clientY - s.startY;
    if (!s.cancelled && Math.abs(dy) > 18 && Math.abs(dy) > Math.abs(dx)) { s.cancelled = true; s.active = false; setTranslateX(isOpen ? -maxPx : 0, true); return; }
    if (s.cancelled) return;
    const raw = s.baseX + dx;
    const clamped = Math.max(-maxPx, Math.min(0, raw));
    setTranslateX(clamped, false);
  };

  const onPointerUpOrCancel: React.PointerEventHandler<HTMLDivElement> = (e) => {
    const s = swipeRef.current;
    if (!s || s.pointerId !== e.pointerId) return;
    swipeRef.current = null;
    if (!enabled || disabled) return;
    if (s.cancelled) return;
    const dx = e.clientX - s.startX;
    const current = Math.max(-maxPx, Math.min(0, s.baseX + dx));
    const shouldOpen = current < -Math.round(maxPx * 0.42);
    onOpenChange(shouldOpen);
    setTranslateX(shouldOpen ? -maxPx : 0, true);
  };

  return {
    cardRef,
    close,
    setTranslateX,
    swipeStyle: enabled ? ({ touchAction: 'pan-y', willChange: 'transform' } as const) : undefined,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: onPointerUpOrCancel,
      onPointerCancel: onPointerUpOrCancel,
    },
  };
}
