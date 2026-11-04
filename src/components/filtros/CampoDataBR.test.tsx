import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CampoDataBR } from "./CampoDataBR";

afterEach(cleanup);

describe("calendar selection bounds", () => {
  it("rejects a start after the final date but accepts the same day", () => {
    const onChange = vi.fn();
    render(<CampoDataBR id="inicio" label="De" value="2026-10-01" max="2026-10-15" onChange={onChange} />);
    fireEvent.click(screen.getByLabelText("De"));
    const grid = screen.getByRole("grid");
    const forbidden = within(grid).getByRole("gridcell", { name: "16", exact: true });
    expect(forbidden).toBeDisabled();
    fireEvent.click(forbidden);
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.click(within(grid).getByRole("gridcell", { name: "15", exact: true }));
    expect(onChange).toHaveBeenCalledWith("2026-10-15");
  });

  it("rejects an end before the initial date but accepts the same day", () => {
    const onChange = vi.fn();
    render(<CampoDataBR id="fim" label="Até" value="2026-10-31" min="2026-10-10" onChange={onChange} />);
    fireEvent.click(screen.getByLabelText("Até"));
    const grid = screen.getByRole("grid");
    const forbidden = within(grid).getByRole("gridcell", { name: "9", exact: true });
    expect(forbidden).toBeDisabled();
    fireEvent.click(forbidden);
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.click(within(grid).getByRole("gridcell", { name: "10", exact: true }));
    expect(onChange).toHaveBeenCalledWith("2026-10-10");
  });
});