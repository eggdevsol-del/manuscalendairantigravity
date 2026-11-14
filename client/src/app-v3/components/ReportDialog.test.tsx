import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({
  mutate: vi.fn(),
  reset: vi.fn(),
  isPending: false,
  error: null as null | { message: string },
  onSuccess: undefined as undefined | (() => void),
}));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    safety: {
      report: {
        useMutation: (options: any) => {
          m.onSuccess = options?.onSuccess;
          return {
            mutate: m.mutate,
            reset: m.reset,
            isPending: m.isPending,
            error: m.error,
          };
        },
      },
    },
  },
}));
vi.mock("@/components/ui/overlays/sheet-shell", () => ({
  SheetShell: ({ isOpen, title, children }: any) =>
    isOpen ? (
      <div role="dialog" aria-label={title}>
        {children}
      </div>
    ) : null,
}));
vi.mock("../design/primitives", () => ({
  Action: ({ children, tone: _tone, ...props }: any) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
}));
import { act } from "react";
import { ReportDialog } from "./ReportDialog";

const onClose = vi.fn();
const open = (target: any = { conversationId: 9 }) =>
  render(<ReportDialog open onClose={onClose} target={target} subject="Jo" />);
beforeEach(() => {
  vi.clearAllMocks();
  m.isPending = false;
  m.error = null;
});

it("renders nothing while closed", () => {
  render(
    <ReportDialog
      open={false}
      onClose={onClose}
      target={{ conversationId: 9 }}
      subject="Jo"
    />
  );
  expect(screen.queryByRole("dialog")).toBeNull();
});

it("lists every reason and will not send until one is chosen", () => {
  open();
  expect(screen.getByRole("dialog", { name: "Report Jo" })).toBeTruthy();
  for (const label of [
    "Harassment or bullying",
    "Sexual or explicit content",
    "Hate speech or discrimination",
    "Scam or fraud",
    "Involves someone under 18",
    "Something else",
  ])
    expect(screen.getByLabelText(label)).toBeTruthy();
  const send = screen.getByRole("button", { name: "Send report" });
  expect((send as HTMLButtonElement).disabled).toBe(true);
  fireEvent.submit(send.closest("form")!);
  expect(m.mutate).not.toHaveBeenCalled();
});

it("sends the reason, the trimmed details and the target, then thanks the reporter", () => {
  open();
  fireEvent.click(screen.getByLabelText("Harassment or bullying"));
  fireEvent.change(screen.getByLabelText("Details (optional)"), {
    target: { value: "  Abusive messages  " },
  });
  fireEvent.click(screen.getByRole("button", { name: "Send report" }));
  expect(m.mutate).toHaveBeenCalledWith({
    conversationId: 9,
    reason: "harassment",
    details: "Abusive messages",
  });
  act(() => m.onSuccess?.());
  expect(screen.getByRole("status").textContent).toBe(
    "Thanks. We review reports within 24 hours."
  );
  expect(screen.queryByRole("button", { name: "Send report" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Done" }));
  expect(onClose).toHaveBeenCalledOnce();
});

it("reports a public profile without details", () => {
  open({ reportedUserId: "artist", artistSlug: "inkbyjo" });
  fireEvent.click(screen.getByLabelText("Scam or fraud"));
  fireEvent.click(screen.getByRole("button", { name: "Send report" }));
  expect(m.mutate).toHaveBeenCalledWith({
    reportedUserId: "artist",
    artistSlug: "inkbyjo",
    reason: "scam",
    details: undefined,
  });
});

it("shows the server's readable error and keeps the form", () => {
  m.error = { message: "You have sent 10 reports in the last 24 hours." };
  open();
  expect(screen.getByRole("alert").textContent).toContain("10 reports");
  expect(screen.getByRole("button", { name: "Send report" })).toBeTruthy();
});

it("limits details to 1000 characters", () => {
  open();
  expect(
    (screen.getByLabelText("Details (optional)") as HTMLTextAreaElement)
      .maxLength
  ).toBe(1000);
});
