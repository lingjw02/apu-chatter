import { useEffect, useRef } from 'react';

export function useMotionFeedback(enabled: boolean, scene: string) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!enabled || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const surface = root.current?.querySelector('.chat-scroll, .updates-view, .albums-view');
    const animation = surface?.animate([{ opacity: .35, transform: 'translateY(8px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 240, easing: 'cubic-bezier(.16,1,.3,1)' });
    return () => animation?.cancel();
  }, [enabled, scene]);
  return root;
}
