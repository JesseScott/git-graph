import { useState, useEffect, useCallback } from 'react';

/**
 * Manages keyboard-driven navigation through a list of positioned commits.
 *
 * Walk model:
 *   ↑ / W  — step to the next commit in time (towards newest, lower zIndex)
 *   ↓ / S  — step to the previous commit in time (towards oldest, higher zIndex)
 *   ← / A  — shift to the nearest commit one lane to the left
 *   → / D  — shift to the nearest commit one lane to the right
 *   O      — toggle free-orbit mode
 *
 * Returns { currentIndex, orbitMode, setCurrentIndex, setOrbitMode }
 */
export function useKeyboardNav(commits) {
  // Start at the most recent commit (index 0 after sorting newest-first)
  const [currentIndex, setCurrentIndex] = useState(0);
  const [orbitMode, setOrbitMode] = useState(false);

  const step = useCallback((direction) => {
    if (!commits.length) return;

    setCurrentIndex(prev => {
      const current = commits[prev];

      if (direction === 'forward') {
        // Move towards newer commits (lower index)
        return Math.max(0, prev - 1);
      }

      if (direction === 'back') {
        // Move towards older commits (higher index)
        return Math.min(commits.length - 1, prev + 1);
      }

      if (direction === 'left' || direction === 'right') {
        const currentLane = current.lane;
        const targetLane = direction === 'left' ? currentLane - 1 : currentLane + 1;

        // Find the closest commit in the target lane by zIndex proximity
        const candidates = commits
          .map((c, i) => ({ ...c, i }))
          .filter(c => c.lane === targetLane);

        if (!candidates.length) return prev; // no lane in that direction

        // Pick the candidate closest in zIndex (time) to current
        const closest = candidates.reduce((best, c) =>
          Math.abs(c.zIndex - current.zIndex) < Math.abs(best.zIndex - current.zIndex) ? c : best
        );

        return closest.i;
      }

      return prev;
    });
  }, [commits]);

  useEffect(() => {
    function onKeyDown(e) {
      // Don't capture if user is typing in an input
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      switch (e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
          e.preventDefault();
          if (!orbitMode) step('forward');
          break;
        case 'ArrowDown':
        case 's':
        case 'S':
          e.preventDefault();
          if (!orbitMode) step('back');
          break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
          e.preventDefault();
          if (!orbitMode) step('left');
          break;
        case 'ArrowRight':
        case 'd':
        case 'D':
          e.preventDefault();
          if (!orbitMode) step('right');
          break;
        case 'o':
        case 'O':
          setOrbitMode(m => !m);
          break;
        default:
          break;
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [orbitMode, step]);

  return { currentIndex, orbitMode, setCurrentIndex, setOrbitMode };
}
