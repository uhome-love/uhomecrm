import { describe, it, expect, vi, beforeEach } from "vitest";

const inserts: Record<string, unknown[]> = {};
let falhar = false;
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (t: string) => ({
      insert: async (row: unknown) => {
        (inserts[t] ||= []).push(row);
        return { error: t === "pipeline_atividades" && falhar ? { message: "Failed to fetch" } : null };
      },
    }),
  },
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

import { registrarAtividade } from "./registrarAtividade";

describe("registrarAtividade", () => {
  beforeEach(() => { for (const k in inserts) delete inserts[k]; });

  it("lança erro e grava rastro quando a gravação falha", async () => {
    falhar = true;
    await expect(registrarAtividade({ pipeline_lead_id: "L1", tipo: "ligacao", titulo: "x" })).rejects.toBeTruthy();
    expect(inserts["ops_events"]?.length).toBe(1);
  });

  it("não grava rastro quando salva", async () => {
    falhar = false;
    await registrarAtividade({ pipeline_lead_id: "L1", tipo: "ligacao", titulo: "x" });
    expect(inserts["ops_events"]).toBeUndefined();
  });
});
