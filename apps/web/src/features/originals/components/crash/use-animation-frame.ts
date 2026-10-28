'use client';

import { useEffect } from 'react';

/** Calls `frame` on every animation frame while mounted (draw through refs, not React state). */
export function useAnimationFrame(frame: () => void, deps: unknown[]) {
  useEffect(() => {
    let id = requestAnimationFrame(function loop() {
      frame();
      id = requestAnimationFrame(loop);
    });
    return () => cancelAnimationFrame(id);
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- `frame` is recreated every render on purpose; deps say when to restart.
  }, deps);
}
