import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Mock all external dependencies
vi.mock("@/hooks/useOfertaAtiva", () => ({
  useOAListas: () => ({ listas: [], isLoading: false }),
  useOAFila: () => ({ fila: [], isLoading: false }),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "test-user-id" }, loading: false }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({ or: () => ({ count: 0 }) }),
          gte: () => ({ count: 0 }),
          in: () => ({ data: [], error: null }),
        }),
        in: () => ({ data: [], error: null }),
      }),
    }),
  },
}));

import CorretorListSelection from "../CorretorListSelection";

function renderWithProviders(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe("CorretorListSelection — smoke tests", () => {
  it("renders empty state when no listas are released", () => {
    renderWithProviders(<CorretorListSelection />);
    expect(screen.getByText("Nenhuma lista liberada")).toBeInTheDocument();
  });

  it("shows waiting message in empty state", () => {
    renderWithProviders(<CorretorListSelection />);
    expect(
      screen.getByText("Aguarde o Admin liberar uma campanha para começar.")
    ).toBeInTheDocument();
  });
});
