import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import BookingFormModal from "./BookingFormModal";

const mocks = vi.hoisted(() => ({ create: vi.fn(), invalidate: vi.fn() }));
vi.mock("@/_core/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "client", name: "Mia" } }),
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), info: vi.fn() } }));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({
      conversations: { list: { invalidate: mocks.invalidate } },
    }),
    upload: { uploadImage: { useMutation: () => ({ mutateAsync: vi.fn() }) } },
    funnel: {
      uploadPublicImage: { useMutation: () => ({ mutateAsync: vi.fn() }) },
      submitPublicBooking: { useMutation: () => ({ mutateAsync: vi.fn() }) },
    },
    consultations: {
      create: { useMutation: () => ({ mutateAsync: mocks.create }) },
    },
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.create.mockResolvedValue({ id: 1 });
});

const fill = () => {
  fireEvent.change(screen.getByLabelText("Describe your idea *"), {
    target: { value: "A fine line olive branch on my forearm" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Fine Line" }));
};

describe("Inline booking request", () => {
  it("submits once and confirms only when the client acknowledges success", async () => {
    const submitted = vi.fn();
    render(
      <BookingFormModal
        artistId="ella"
        artistName="Ella"
        artistSlug="ella"
        onClose={vi.fn()}
        onSubmitted={submitted}
      />
    );
    fill();
    fireEvent.click(screen.getByRole("button", { name: "Send Request" }));
    await screen.findByText("Request sent");
    expect(mocks.create).toHaveBeenCalledTimes(1);
    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({ artistId: "ella", style: "Fine Line" })
    );
    expect(mocks.invalidate).toHaveBeenCalledTimes(1);
    expect(submitted).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "OK" }));
    expect(submitted).toHaveBeenCalledTimes(1);
  });

  it("preserves the request after failure and allows a successful retry", async () => {
    mocks.create.mockRejectedValueOnce(new Error("Offline"));
    render(
      <BookingFormModal
        artistId="ella"
        artistName="Ella"
        artistSlug="ella"
        onClose={vi.fn()}
        onSubmitted={vi.fn()}
      />
    );
    fill();
    fireEvent.click(screen.getByRole("button", { name: "Send Request" }));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Your request was not sent"
      )
    );
    expect(screen.getByLabelText("Describe your idea *")).toHaveValue(
      "A fine line olive branch on my forearm"
    );
    fireEvent.click(screen.getByRole("button", { name: "Send Request" }));
    await screen.findByText("Request sent");
    expect(mocks.create).toHaveBeenCalledTimes(2);
  });

  it("keeps attachment buttons from submitting and labels the dialog", () => {
    render(
      <BookingFormModal
        artistId="ella"
        artistName="Ella"
        artistSlug="ella"
        onClose={vi.fn()}
        onSubmitted={vi.fn()}
      />
    );
    expect(
      screen.getByRole("dialog", { name: "Book with Ella" })
    ).toBeInTheDocument();
    fill();
    fireEvent.click(
      screen.getByRole("button", { name: "Add reference images" })
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Add placement photos" })
    );
    expect(mocks.create).not.toHaveBeenCalled();
  });
});
