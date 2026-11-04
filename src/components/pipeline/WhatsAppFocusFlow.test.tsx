import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

const mocks = vi.hoisted(() => ({
  activity: vi.fn(), touch: vi.fn(), update: vi.fn(), insert: vi.fn(), open: vi.fn(), copy: vi.fn(),
}));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "sender" } }) }));
vi.mock("@/hooks/useProfileNames", () => ({ useProfileNames: () => ({ sender: "Pedro Jorge" }) }));
vi.mock("@/hooks/useWhatsAppProduto", () => ({ useWhatsAppProduto: () => ({ data: { produto: { nome: "Essence Canoas" }, flagStatus: {} } }) }));
vi.mock("@/lib/registrarAtividade", () => ({ registrarAtividadeComAviso: mocks.activity }));
vi.mock("@/lib/registrarToque", () => ({ registrarToque: mocks.touch }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: () => ({
  update: (payload: unknown) => { mocks.update(payload); return { eq: () => Promise.resolve({ error: null }) }; },
  insert: (payload: unknown) => { mocks.insert(payload); return Promise.resolve({ error: null }); },
}) } }));
import WhatsAppFocusFlow from "./WhatsAppFocusFlow";

function mount() {
  const onClose = vi.fn();
  render(<Dialog open><DialogContent aria-describedby={undefined}><DialogTitle>Ficha de cliente de teste</DialogTitle>
    <WhatsAppFocusFlow isOpen onClose={onClose} onRefresh={vi.fn()} stageTipo="novo_lead"
      lead={{ id: "test-client", nome: "Andrio Teste", telefone: "51999999999", empreendimento: "Essence Canoas - Natal", stage_id: "new" }} />
  </DialogContent></Dialog>);
  return onClose;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.activity.mockResolvedValue(undefined);
  mocks.touch.mockResolvedValue(undefined);
  mocks.copy.mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: mocks.copy } });
  vi.spyOn(window, "open").mockImplementation(mocks.open);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("Janela WhatsApp dentro da ficha do cliente", () => {
  it("cancelar a personalização não registra atividade nem toque", () => {
    const onClose = mount();
    fireEvent.click(screen.getAllByRole("button", { name: "Editar" })[0]);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Texto personalizado" } });
    expect(document.activeElement).toBe(screen.getByRole("textbox"));
    fireEvent.click(screen.getAllByRole("button", { name: "Cancelar" }).at(-1) as HTMLElement);
    expect(onClose).toHaveBeenCalledOnce();
    expect(mocks.activity).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("copia o rascunho e segue para observação/tarefa com um registro e um toque", async () => {
    mount();
    fireEvent.click(screen.getAllByRole("button", { name: "Editar" })[0]);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Texto personalizado" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Copiar" })[0]);
    await screen.findByRole("button", { name: "Fechar sem tarefa" });
    expect(mocks.copy).toHaveBeenCalledWith("Texto personalizado");
    expect(mocks.activity).toHaveBeenCalledOnce();
    expect(mocks.activity).toHaveBeenCalledWith(expect.objectContaining({ pipeline_lead_id: "test-client", tipo: "whatsapp", created_by: "sender" }));
    expect(mocks.touch).toHaveBeenCalledWith("test-client");
    expect(mocks.insert).not.toHaveBeenCalled();
  });
  it("abre o WhatsApp com o rascunho exato codificado", async () => {
    mount();
    fireEvent.click(screen.getAllByRole("button", { name: "Editar" })[0]);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Olá! Entrada & parcela?" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Abrir WhatsApp" })[0]);
    await waitFor(() => expect(mocks.open).toHaveBeenCalledOnce());
    expect(mocks.open).toHaveBeenCalledWith(`https://wa.me/5551999999999?text=${encodeURIComponent("Olá! Entrada & parcela?")}`, "_blank", "noopener,noreferrer");
  });
  it("falha ao copiar não registra contato nem avança", async () => {
    mocks.copy.mockRejectedValueOnce(new Error("clipboard denied"));
    mount();
    fireEvent.click(screen.getAllByRole("button", { name: "Copiar" })[0]);
    await waitFor(() => expect(mocks.copy).toHaveBeenCalledOnce());
    expect(mocks.activity).not.toHaveBeenCalled();
    expect(mocks.touch).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Fechar sem tarefa" })).not.toBeInTheDocument();
  });
});