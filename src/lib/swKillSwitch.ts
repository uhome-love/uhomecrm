// One-shot kill switch: limpa SW antigo, caches e IndexedDB do supabase.
// Roda exatamente UMA vez por usuário, controlado por flag em localStorage.
const KILL_SWITCH_KEY = "uhome:sw:killswitch:v1";

export async function runKillSwitch(): Promise<void> {
  if (typeof window === "undefined") return;
  if (localStorage.getItem(KILL_SWITCH_KEY) === "done") return;

  try {
    // 1. Unregister TODOS os service workers
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }

    // 2. Limpar TODOS os caches do Cache Storage
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }

    // 3. Limpar IndexedDB de supabase / uhome
    if ("indexedDB" in window && "databases" in indexedDB) {
      const dbs = await (indexedDB as any).databases();
      await Promise.all(
        dbs
          .filter(
            (db: any) =>
              db.name?.includes("supabase") ||
              db.name?.includes("uhome") ||
              db.name?.startsWith("sb-"),
          )
          .map(
            (db: any) =>
              new Promise<void>((res) => {
                const req = indexedDB.deleteDatabase(db.name);
                req.onsuccess = () => res();
                req.onerror = () => res();
                req.onblocked = () => res();
              }),
          ),
      );
    }

    // 4. Marcar como executado pra nunca rodar de novo
    localStorage.setItem(KILL_SWITCH_KEY, "done");

    // 5. Reload forçado uma única vez
    window.location.reload();
  } catch (err) {
    console.warn("[killswitch] failed but marking done anyway", err);
    localStorage.setItem(KILL_SWITCH_KEY, "done");
  }
}
