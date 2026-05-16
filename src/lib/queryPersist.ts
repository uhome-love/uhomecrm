// Persistência do React Query em IndexedDB via idb-keyval.
// Stale-while-revalidate: ao reabrir o CRM, os dados aparecem instantâneos
// do cache enquanto o React Query revalida em background.
//
// REGRAS DE OURO:
// - NÃO persistir queries sensíveis (auth, presença, health). Filtragem por whitelist de prefixos.
// - NÃO interceptar fetches. Só armazena resultado das queries do React Query.
// - Em caso de QUALQUER erro de IndexedDB, segue sem persistência (não quebra app).
//
// Compatível com a regra do projeto: nenhum wrapper de rede, cliente Supabase intocado.

import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { get, set, del } from "idb-keyval";

const DB_KEY = "uhome-rq-cache-v1";
const BUSTER = "v1"; // bump quando schema de cache mudar

// Whitelist de prefixos de queryKey que PODEM ser persistidos.
// Tudo fora dessa lista NÃO entra no IndexedDB.
const PERSIST_ALLOW_PREFIXES = [
  "pipeline-",
  "parcerias",
  "negocios-",
  "pipeline-kanban-tarefas",
  "pipeline-visita-lead-ids",
];

function shouldPersistQuery(queryKey: readonly unknown[]): boolean {
  if (!queryKey || queryKey.length === 0) return false;
  const first = queryKey[0];
  if (typeof first !== "string") return false;
  return PERSIST_ALLOW_PREFIXES.some((p) => first === p || first.startsWith(p));
}

// Persister tolerante a falha de IndexedDB (modo anônimo, quota, Safari ITP).
export const idbPersister = createAsyncStoragePersister({
  storage: {
    getItem: async (key: string) => {
      try {
        return (await get(key)) ?? null;
      } catch {
        return null;
      }
    },
    setItem: async (key: string, value: string) => {
      try {
        await set(key, value);
      } catch {
        // sem persistência, sem alarme.
      }
    },
    removeItem: async (key: string) => {
      try {
        await del(key);
      } catch {}
    },
  },
  key: DB_KEY,
  throttleTime: 1000, // batch writes
});

export const persistOptions = {
  persister: idbPersister,
  maxAge: 1000 * 60 * 60 * 24, // 24h — cache fica disponível pra reabertura no dia seguinte
  buster: BUSTER,
  dehydrateOptions: {
    shouldDehydrateQuery: (q: { queryKey: readonly unknown[]; state: { status: string } }) =>
      q.state.status === "success" && shouldPersistQuery(q.queryKey),
  },
};
