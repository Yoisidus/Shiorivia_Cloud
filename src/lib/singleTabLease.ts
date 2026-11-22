"use client";

/**
 * Exclusive, origin-scoped Web Lock, held for the lifetime of the active tab.
 * No polling or timeouts: browsers release the lock when a page exits/crashes.
 * A rejected second tab cannot load application providers or browser credentials.
 */
export const CLOUD_TAB_LOCK = "shiorivia-cloud-primary-tab-v1";
export type SingleTabStatus = "active" | "blocked" | "unsupported";

export function startSingleTabLease(
  manager: Pick<LockManager, "request"> | null | undefined,
  updateStatus: (status: SingleTabStatus) => void,
): () => void {
  let stopped = false;
  let release: (() => void) | undefined;
  if (!manager || typeof manager.request !== "function") {
    updateStatus("unsupported");
    return () => { stopped = true; };
  }

  void manager.request(CLOUD_TAB_LOCK, { mode: "exclusive", ifAvailable: true }, async lock => {
    if (stopped) return;
    if (!lock) {
      updateStatus("blocked");
      return;
    }
    await new Promise<void>(resolve => {
      release = resolve;
      if (stopped) resolve();
      else updateStatus("active");
    });
  }).catch(() => {
    if (!stopped) updateStatus("unsupported");
  });

  return () => {
    stopped = true;
    release?.();
  };
}
