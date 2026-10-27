/**
 * PWA Safe Update Manager for Phantom Chat
 *
 * Handles update checking, foreground cooldowns, waiting service worker activation,
 * and single clean reloads without touching user data or Device ID.
 *
 * Root-cause fixes applied:
 * 1. `checkForUpdates` now subscribes to `updatefound`→`statechange` from `reg.update()`,
 *    resolving the race where reg.waiting is checked too early (before the new SW has
 *    finished installing). A promise + 8-second timeout makes this reliable.
 * 2. `deferUpdate` preserves the `waitingWorker` reference so the user can apply the
 *    deferred update later without having to wait for the next background check.
 * 3. `applyUpdate` loop-guard now uses sessionStorage (per-tab, cleared on close) which
 *    prevents both same-tab reload loops AND cross-tab false positives.
 * 4. `initUpdateManager` subscribes to `sw-update-waiting` events dispatched by
 *    index.html's registration script, covering the foreground-tab case where the browser
 *    detects the new SW but React hasn't mounted yet.
 */

declare global {
  interface Window {
    __swRegistration?: ServiceWorkerRegistration;
  }
}

const UPDATE_CHECK_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes between auto-checks
const CLIENT_VERSION = '2.4.0';

let lastAutoCheckTimestamp = 0;
let isApplyingUpdate = false;

export interface UpdateStatus {
  isChecking: boolean;
  updateAvailable: boolean;
  waitingWorker: ServiceWorker | null;
  currentVersion: string;
  latestVersion?: string;
  lastCheckedTime: number | null;
  message?: string;
}

type UpdateListener = (status: UpdateStatus) => void;
const listeners = new Set<UpdateListener>();

let state: UpdateStatus = {
  isChecking: false,
  updateAvailable: false,
  waitingWorker: null,
  currentVersion: CLIENT_VERSION,
  lastCheckedTime: null,
};

function notify() {
  listeners.forEach((fn) => {
    try {
      fn({ ...state });
    } catch (e) {
      console.warn('Update listener error:', e);
    }
  });
}

/**
 * Register a listener to react to update state changes.
 * The listener is called immediately with the current state snapshot.
 */
export function subscribeToUpdates(listener: UpdateListener): () => void {
  listeners.add(listener);
  listener({ ...state });
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Get current update state snapshot (non-reactive).
 */
export function getUpdateStatus(): UpdateStatus {
  return { ...state };
}

/**
 * Dismiss the update banner/modal for this session ("Later" action).
 * Preserves the waitingWorker reference so the update can still be applied later.
 */
export function deferUpdate() {
  // Keep waitingWorker so the user can still apply the update after choosing "Later".
  state = {
    ...state,
    updateAvailable: false,
    // waitingWorker intentionally preserved — not cleared.
  };
  notify();
}

/**
 * Activate the new service worker version and perform a single controlled reload.
 *
 * Safety guarantees:
 * - Never clears localStorage, IndexedDB, cookies, Device ID, or Pro access.
 * - Uses sessionStorage to detect and abort reload loops (10-second window).
 * - Listens for `controllerchange` before reloading to ensure the new SW is active.
 */
export function applyUpdate() {
  if (isApplyingUpdate) return;
  isApplyingUpdate = true;

  // Reload-loop guard: bail if we reloaded less than 10 seconds ago in this tab.
  const now = Date.now();
  const lastReload = Number(sessionStorage.getItem('phantom_last_update_reload') || '0');
  if (now - lastReload < 10_000) {
    console.warn('[PWA] Reload loop detected — aborting duplicate reload.');
    isApplyingUpdate = false;
    return;
  }
  sessionStorage.setItem('phantom_last_update_reload', String(now));

  if ('serviceWorker' in navigator) {
    let reloaded = false;

    const doReload = () => {
      if (!reloaded) {
        reloaded = true;
        window.location.reload();
      }
    };

    // Reload as soon as the new SW becomes the active controller.
    navigator.serviceWorker.addEventListener('controllerchange', doReload);

    // Resolve the waiting worker from module state or the live registration.
    const waitingWorker =
      state.waitingWorker ||
      window.__swRegistration?.waiting ||
      null;

    if (waitingWorker) {
      waitingWorker.postMessage({ type: 'SKIP_WAITING' });
      // Safety net: reload even if controllerchange doesn't fire within 2 s.
      setTimeout(doReload, 2000);
      return;
    }
  }

  // No waiting worker found — do a plain reload as a last resort.
  window.location.reload();
}

// ─── Internal helper ──────────────────────────────────────────────────────────

/**
 * Wait for a new service worker to finish installing after reg.update() is called.
 * Returns the waiting worker, or null if no update was found within `timeoutMs`.
 *
 * This fixes the race condition where reg.waiting is checked immediately after
 * await reg.update(), but the new SW may still be in 'installing' state at that
 * point. We subscribe to updatefound + statechange to know when it reaches
 * 'installed' (which is when it becomes reg.waiting).
 */
function waitForInstalledWorker(
  reg: ServiceWorkerRegistration,
  timeoutMs = 8000
): Promise<ServiceWorker | null> {
  return new Promise((resolve) => {
    // Already waiting — nothing to observe.
    if (reg.waiting) {
      resolve(reg.waiting);
      return;
    }

    let resolved = false;
    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        resolve(null);
      }
    }, timeoutMs);

    const onUpdateFound = () => {
      const newWorker = reg.installing;
      if (!newWorker) return;

      const onStateChange = () => {
        if (newWorker.state === 'installed') {
          if (!resolved) {
            resolved = true;
            clearTimeout(timeout);
            // Give the browser one tick to move the worker to reg.waiting.
            setTimeout(() => resolve(reg.waiting || newWorker), 0);
          }
          newWorker.removeEventListener('statechange', onStateChange);
        }
        if (newWorker.state === 'redundant') {
          newWorker.removeEventListener('statechange', onStateChange);
          if (!resolved) {
            resolved = true;
            clearTimeout(timeout);
            resolve(null);
          }
        }
      };

      newWorker.addEventListener('statechange', onStateChange);
    };

    reg.addEventListener('updatefound', onUpdateFound);

    // Clean up listener if we time out.
    setTimeout(() => {
      reg.removeEventListener('updatefound', onUpdateFound);
    }, timeoutMs + 100);
  });
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Check for a newer service worker.
 *
 * @param manual  true when triggered by the user (bypasses cooldown, shows feedback)
 *
 * This function is the authoritative update checker. It:
 * 1. Calls reg.update() to force the browser to re-fetch /sw.js.
 * 2. Subscribes to updatefound→statechange to wait for the new SW to reach 'installed'.
 * 3. Optionally cross-checks /api/version for a server-side version string.
 */
export async function checkForUpdates(manual = false): Promise<UpdateStatus> {
  const now = Date.now();

  // Enforce cooldown for automatic background checks only.
  if (!manual && now - lastAutoCheckTimestamp < UPDATE_CHECK_COOLDOWN_MS) {
    return state;
  }

  lastAutoCheckTimestamp = now;
  state = { ...state, isChecking: true };
  notify();

  let hasUpdate = false;
  let waitingWorker: ServiceWorker | null = state.waitingWorker; // preserve deferred ref
  let latestVer = CLIENT_VERSION;
  let statusMessage = 'Phantom Chat is up to date.';

  try {
    if ('serviceWorker' in navigator) {
      try {
        const reg =
          window.__swRegistration ||
          (await navigator.serviceWorker.getRegistration('/')) ||
          null;

        if (reg) {
          window.__swRegistration = reg;

          if (reg.waiting) {
            // A new worker is already waiting (installed in a previous check or tab).
            hasUpdate = true;
            waitingWorker = reg.waiting;
            statusMessage = 'A new app version is ready to install.';
          } else {
            // Trigger a fresh fetch of /sw.js and wait for the result.
            // reg.update() resolves once the fetch + install attempt completes,
            // but `reg.waiting` may not be set yet at that moment — hence we
            // use waitForInstalledWorker() which subscribes to the lifecycle events.
            const updatePromise = waitForInstalledWorker(reg, 8000);
            await reg.update().catch(() => {});
            const newWorker = await updatePromise;
            if (newWorker && navigator.serviceWorker.controller) {
              hasUpdate = true;
              waitingWorker = newWorker;
              statusMessage = 'A new app version is ready to install.';
            }
          }
        }
      } catch (swErr) {
        console.warn('[PWA] SW update check error:', swErr);
      }
    }

    // Optional: cross-check with the server version endpoint.
    // If the endpoint is not deployed this always 404s silently.
    try {
      const res = await fetch(`/api/version?_t=${now}`, {
        method: 'GET',
        headers: { 'Cache-Control': 'no-cache' },
        signal: AbortSignal.timeout(4000),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.version) {
          latestVer = data.version;
          if (data.version !== CLIENT_VERSION) {
            hasUpdate = true;
            statusMessage = `Version ${data.version} is available.`;
          }
        }
      }
    } catch {
      // Network failure or endpoint not present — ignore silently.
    }
  } catch (e) {
    console.warn('[PWA] Update check failed:', e);
  } finally {
    state = {
      isChecking: false,
      updateAvailable: hasUpdate,
      waitingWorker: waitingWorker,
      currentVersion: CLIENT_VERSION,
      latestVersion: latestVer,
      lastCheckedTime: now,
      message: statusMessage,
    };
    notify();
  }

  return state;
}

/**
 * Initialize the PWA update manager lifecycle listeners.
 *
 * Call once on app mount (inside a useEffect with [] deps).
 * Sets up:
 * - Immediate check 3.5 s after app opens.
 * - Foreground (visibilitychange + focus) re-checks with cooldown.
 * - sw-update-waiting listener for events dispatched by the registration script.
 * - sw-registered listener to keep window.__swRegistration up to date.
 */
export function initUpdateManager() {
  if (typeof window === 'undefined') return;

  // ── Listen for sw-update-waiting dispatched by index.html ─────────────────
  // This covers the case where the new SW is detected by the browser's own
  // update mechanism (background check, or prior tab visit) before React mounts.
  window.addEventListener('sw-update-waiting', (event: any) => {
    const reg: ServiceWorkerRegistration = event.detail;
    if (reg && reg.waiting) {
      state = {
        ...state,
        updateAvailable: true,
        waitingWorker: reg.waiting,
        message: 'A new version of Phantom Chat is ready.',
      };
      notify();
    }
  });

  // Keep window.__swRegistration up to date.
  window.addEventListener('sw-registered', (event: any) => {
    window.__swRegistration = event.detail;
  });

  // Initial check shortly after app opens (gives the SW registration time to settle).
  setTimeout(() => {
    checkForUpdates(false).catch(() => {});
  }, 3500);

  // Re-check when the user returns to the tab.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      checkForUpdates(false).catch(() => {});
    }
  });

  // Re-check when the window regains focus (covers desktop window switching).
  window.addEventListener('focus', () => {
    checkForUpdates(false).catch(() => {});
  });
}
