import { fireEvent, render, screen, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WhatsAppMessagePicker } from "./WhatsAppMessagePicker";

afterEach(cleanup);
const messages = [{ id: "primeiro", title: "Primeiro contato", body: "Texto original" }];

describe("Personalização antes do WhatsApp", () => {
  it("Copiar e Abrir recebem o texto alterado, nunca o original", () => {
    const onCopy = vi.fn(), onOpen = vi.fn();
    render(<WhatsAppMessagePicker messages={messages} hasPhone busy={false} onCopy={onCopy} onOpen={onOpen} />);
    fireEvent.click(screen.getByRole("button", { name: "Editar" }));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Personalizado para o cliente" } });
    fireEvent.click(screen.getByRole("button", { name: "Copiar" }));
    fireEvent.click(screen.getByRole("button", { name: "Abrir WhatsApp" }));
    expect(onCopy).toHaveBeenCalledWith("Personalizado para o cliente");
    expect(onOpen).toHaveBeenCalledWith("Personalizado para o cliente");
    expect(onOpen).not.toHaveBeenCalledWith("Texto original");
  });
  it("apagar a mensagem não restaura e envia o texto original", () => {
    const onOpen = vi.fn();
    render(<WhatsAppMessagePicker messages={messages} hasPhone busy={false} onCopy={vi.fn()} onOpen={onOpen} />);
    fireEvent.click(screen.getByRole("button", { name: "Editar" }));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "   " } });
    fireEvent.click(screen.getByRole("button", { name: "Abrir WhatsApp" }));
    expect(onOpen).not.toHaveBeenCalled();
  });
  it("Mensagem livre preserva o texto digitado", () => {
    const onCopy = vi.fn();
    render(<WhatsAppMessagePicker messages={messages} hasPhone busy={false} onCopy={onCopy} onOpen={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Mensagem livre" }));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Minha mensagem livre" } });
    fireEvent.click(screen.getByRole("button", { name: "Copiar" }));
    expect(onCopy).toHaveBeenCalledWith("Minha mensagem livre");
  });
  it("não abre WhatsApp sem telefone", () => {
    const onOpen = vi.fn();
    render(<WhatsAppMessagePicker messages={messages} hasPhone={false} busy={false} onCopy={vi.fn()} onOpen={onOpen} />);
    fireEvent.click(screen.getByRole("button", { name: "Abrir WhatsApp" }));
    expect(onOpen).not.toHaveBeenCalled();
  });
});