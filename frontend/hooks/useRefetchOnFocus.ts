import { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';

type Options = {
  enabled?: boolean;
  // If provided, runs the callback repeatedly at this interval
  intervalMs?: number;
  // Throttle repeated focus events (ms)
  focusThrottleMs?: number;
  // Run once immediately when enabled
  immediate?: boolean;
};

/**
 * useRefetchOnFocus
 * - Calls the provided callback when the app/window gains focus.
 * - Optionally polls at a fixed interval.
 * - Works on native (AppState) and web (focus/visibility).
 */
export function useRefetchOnFocus(
  refetch: () => void | Promise<void>,
  { enabled = true, intervalMs, focusThrottleMs = 1000, immediate = false }: Options = {}
) {
  const lastFocusRunRef = useRef(0);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  useEffect(() => {
    if (!enabled) return;

    const maybeRun = () => {
      if (!enabledRef.current) return;
      const now = Date.now();
      if (now - lastFocusRunRef.current < focusThrottleMs) return;
      lastFocusRunRef.current = now;
      try {
        const ret = refetch();
        if (ret && typeof (ret as any).then === 'function') {
          // Best-effort swallow promise
          (ret as Promise<void>).catch(() => {});
        }
      } catch {
        // ignore
      }
    };

    if (immediate) {
      maybeRun();
    }

    // Native: AppState
    const onAppStateChange = (state: string) => {
      if (state === 'active') {
        maybeRun();
      }
    };
    const sub = AppState.addEventListener('change', onAppStateChange);

    // Web: window focus + visibility change
    let webFocusHandler: (() => void) | null = null;
    let visibilityHandler: (() => void) | null = null;
    if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof document !== 'undefined') {
      webFocusHandler = () => maybeRun();
      visibilityHandler = () => {
        if (document.visibilityState === 'visible') maybeRun();
      };
      window.addEventListener('focus', webFocusHandler);
      document.addEventListener('visibilitychange', visibilityHandler);
    }

    // Optional polling
    let intervalId: any = null;
    if (intervalMs && intervalMs > 0) {
      intervalId = setInterval(() => {
        if (!enabledRef.current) return;
        try {
          const ret = refetch();
          if (ret && typeof (ret as any).then === 'function') {
            (ret as Promise<void>).catch(() => {});
          }
        } catch {
          // ignore
        }
      }, intervalMs);
    }

    return () => {
      sub.remove();
      if (
        Platform.OS === 'web' &&
        typeof window !== 'undefined' &&
        typeof document !== 'undefined'
      ) {
        if (webFocusHandler) window.removeEventListener('focus', webFocusHandler);
        if (visibilityHandler) document.removeEventListener('visibilitychange', visibilityHandler);
      }
      if (intervalId) clearInterval(intervalId);
    };
  }, [enabled, intervalMs, focusThrottleMs, immediate, refetch]);
}
