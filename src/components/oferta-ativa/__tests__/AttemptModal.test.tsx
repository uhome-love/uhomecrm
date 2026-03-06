import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import AttemptModal from "../AttemptModal";

describe("AttemptModal — smoke tests", () => {
  const mockOnClose = vi.fn();
  const mockOnSubmit = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderModal = (open = true) =>
    render(
      <AttemptModal
        open={open}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
        leadName="João Silva"
        callDuration={45}
      />
    );

  it("renders all 4 result options when open", () => {
    renderModal();
    expect(screen.getByText("Não atendeu")).toBeInTheDocument();
    expect(screen.getByText("Número errado")).toBeInTheDocument();
    expect(screen.getByText("Sem interesse")).toBeInTheDocument();
    expect(screen.getByText("Com interesse")).toBeInTheDocument();
  });

  it("shows lead name and call duration", () => {
    renderModal();
    expect(screen.getByText("João Silva")).toBeInTheDocument();
    expect(screen.getByText("00:45")).toBeInTheDocument();
  });

  it("disables submit when no result selected", () => {
    renderModal();
    const btn = screen.getByText("Registrar e avançar ➜");
    expect(btn).toBeDisabled();
  });

  it("shows quick feedbacks after selecting a result", () => {
    renderModal();
    fireEvent.click(screen.getByText("Não atendeu"));
    expect(screen.getByText("Chamou e caiu na caixa postal")).toBeInTheDocument();
  });

  it("shows 'Marquei visita' checkbox only for 'Com interesse'", () => {
    renderModal();
    expect(screen.queryByText("Marquei visita")).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("Com interesse"));
    expect(screen.getByText("Marquei visita")).toBeInTheDocument();
  });

  it("requires min 10 chars feedback to enable submit", () => {
    renderModal();
    fireEvent.click(screen.getByText("Não atendeu"));

    const textarea = screen.getByPlaceholderText(/Já comprou/);
    fireEvent.change(textarea, { target: { value: "short" } });
    expect(screen.getByText("Registrar e avançar ➜")).toBeDisabled();

    fireEvent.change(textarea, { target: { value: "Chamou e caiu na caixa postal" } });
    expect(screen.getByText("Registrar e avançar ➜")).not.toBeDisabled();
  });

  it("calls onSubmit with correct params on submit", async () => {
    renderModal();
    fireEvent.click(screen.getByText("Sem interesse"));
    fireEvent.click(screen.getByText("Pediu para não ligar mais"));

    const btn = screen.getByText("Registrar e avançar ➜");
    fireEvent.click(btn);

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith(
        "sem_interesse",
        "Pediu para não ligar mais",
        false
      );
    });
  });

  it("calls onSubmit with visitaMarcada=true when checked", async () => {
    renderModal();
    fireEvent.click(screen.getByText("Com interesse"));
    fireEvent.click(screen.getByText("Marquei visita"));
    fireEvent.click(screen.getByText("Quer visitar o decorado no fim de semana"));

    const btn = screen.getByText("Registrar e avançar ➜");
    fireEvent.click(btn);

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith(
        "com_interesse",
        "Quer visitar o decorado no fim de semana",
        true
      );
    });
  });

  it("shows exit confirmation when result is selected and user closes", () => {
    renderModal();
    fireEvent.click(screen.getByText("Não atendeu"));
    // Try to close via escape / overlay — trigger the dialog's onOpenChange
    const closeBtn = screen.getAllByRole("button").find(
      (btn) => btn.getAttribute("aria-label") === "Close" || btn.classList.contains("absolute")
    );
    if (closeBtn) {
      fireEvent.click(closeBtn);
      expect(screen.getByText("Sair sem registrar?")).toBeInTheDocument();
    }
  });

  it("does not render when closed", () => {
    renderModal(false);
    expect(screen.queryByText("Resultado da tentativa")).not.toBeInTheDocument();
  });
});
