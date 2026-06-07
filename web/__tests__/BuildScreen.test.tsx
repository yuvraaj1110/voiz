import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { BuildScreen } from "@/components/BuildScreen";

describe("BuildScreen", () => {
  it("renders the fintech eyebrow and a goal textarea", () => {
    render(<BuildScreen headlineEnabled={false} onDeploy={vi.fn()} />);
    expect(screen.getByText(/lending & collections/i)).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /agent goal/i })).toBeInTheDocument();
  });

  it("fills the goal when a preset is clicked", () => {
    render(<BuildScreen headlineEnabled={false} onDeploy={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /loan lead qualification/i }));
    const box = screen.getByRole("textbox", { name: /agent goal/i }) as HTMLTextAreaElement;
    expect(box.value).toMatch(/RPC the borrower/i);
  });

  it("calls onDeploy with the current goal and shows a deploying state", async () => {
    const onDeploy = vi.fn().mockResolvedValue(undefined);
    render(<BuildScreen headlineEnabled={false} onDeploy={onDeploy} />);
    fireEvent.click(screen.getByRole("button", { name: /loan lead qualification/i }));
    fireEvent.click(screen.getByRole("button", { name: /deploy/i }));
    await waitFor(() =>
      expect(onDeploy).toHaveBeenCalledWith(expect.objectContaining({ goal: expect.stringMatching(/RPC/i) }))
    );
  });

  it("disables deploy when the goal is empty", () => {
    render(<BuildScreen headlineEnabled={false} onDeploy={vi.fn()} />);
    expect(screen.getByRole("button", { name: /deploy/i })).toBeDisabled();
  });
});
