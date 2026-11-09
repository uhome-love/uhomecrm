import { beforeEach, describe, expect, it, vi } from "vitest";
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc } }));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));
import { contatoPermitido } from "./contatoPermitido";
beforeEach(() => rpc.mockReset());
describe("Contato na Arena", () => {
  it("nega cliente que pediu saída", async () => {
    rpc.mockResolvedValue({ data: { allowed: false }, error: null });
    expect(await contatoPermitido("5500000009000")).toBe(false);
  });
  it("nega quando não é possível conferir permissão", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "indisponível" } });
    expect(await contatoPermitido("5500000009000")).toBe(false);
  });
  it("permite somente autorização explícita", async () => {
    rpc.mockResolvedValue({ data: { allowed: true }, error: null });
    expect(await contatoPermitido("5500000009000")).toBe(true);
    expect(rpc).toHaveBeenCalledWith("check_send_allowed", { p_lead_id: null, p_phone: "5500000009000", p_template: null });
  });
});