import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  native: false,
  login: vi.fn(),
  useGoogleLogin: vi.fn(),
}));
vi.mock("@/lib/platform", () => ({ isNativeApp: () => mocks.native }));
vi.mock("@react-oauth/google", () => ({
  useGoogleLogin: mocks.useGoogleLogin,
}));
import { GoogleLoginButton } from "./GoogleLoginButton";

beforeEach(() => {
  mocks.native = false;
  mocks.login.mockClear();
  mocks.useGoogleLogin.mockReset().mockReturnValue(mocks.login);
});

describe("GoogleLoginButton", () => {
  it("offers Google sign-in on the web", () => {
    render(<GoogleLoginButton onSuccess={vi.fn()} />);
    fireEvent.click(
      screen.getByRole("button", { name: "Continue with Google" })
    );
    expect(mocks.login).toHaveBeenCalledTimes(1);
  });

  it("renders nothing in the native app and never starts Google sign-in", () => {
    mocks.native = true;
    const { container } = render(<GoogleLoginButton onSuccess={vi.fn()} />);
    expect(container.innerHTML).toBe("");
    expect(mocks.useGoogleLogin).not.toHaveBeenCalled();
  });
});
