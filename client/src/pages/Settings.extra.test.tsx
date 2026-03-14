import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";

const mockUseQuery = vi.fn();
const mockUseMutation = vi.fn();
const mockRegisterWebhook = vi.fn();

vi.mock("@tanstack/react-query", () => ({
  useQuery: (...args: any[]) => mockUseQuery(...args),
  useMutation: (...args: any[]) => mockUseMutation(...args),
}));

vi.mock("@tanstack/react-router", () => ({
  useLocation: () => ({ pathname: "/settings" }),
}));

vi.mock("@/api/settings", () => ({
  settingsApi: { get: vi.fn(), registerWebhook: mockRegisterWebhook },
}));

vi.mock("@/api/agents", () => ({
  agentsApi: { list: vi.fn() },
}));

vi.mock("@/api/auth", () => ({
  authApi: { changePassword: vi.fn() },
}));

vi.mock("@/store/auth", () => ({
  useAuthStore: (selector: any) =>
    selector({ token: "jwt", mustChangePassword: false, passwordChanged: vi.fn() }),
}));

const { SettingsPage } = await import("./Settings");

const mockSettingsWithBothKeys = {
  configMode: "local",
  flutchPlatformUrl: "https://platform.example.com",
  openaiKeyMasked: "sk-...abcd",
  anthropicKeyMasked: "sk-ant-...efgh",
};

const mockAgentsWithTelegram = [
  {
    id: "agent-toggle",
    graphType: "v1.0.0",
    graphSettings: {},
    platforms: { telegram: { configured: true, botTokenMasked: "...bot7" }, widget: null },
  },
];

const makeQueryMock =
  (settingsData: any = undefined, agentsData: any = []) =>
  (opts: any) => {
    const key = opts?.queryKey?.[0];
    if (key === "settings") return { data: settingsData, isLoading: false };
    if (key === "agents") return { data: agentsData, isLoading: false };
    return { data: undefined, isLoading: false };
  };

describe("SettingsPage — extra coverage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseQuery.mockImplementation(makeQueryMock());
    mockUseMutation.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      isError: false,
      isSuccess: false,
    });
  });

  it("toggles OpenAI key visibility when eye button clicked", () => {
    mockUseQuery.mockImplementation(makeQueryMock(mockSettingsWithBothKeys, []));
    render(<SettingsPage />);

    // Initially shows dots
    expect(screen.getByTestId("openai-key-value")).toHaveTextContent("••••••••••••");

    // Click toggle button to reveal
    const toggleButtons = screen.getAllByRole("button", { hidden: true }).filter(btn =>
      btn.closest("[data-testid]") === null && btn.className.includes("h-7")
    );
    // Find the eye button next to OpenAI — it's the first ghost button
    const allButtons = screen.getAllByRole("button");
    // The toggle buttons are ghost buttons with h-7 class
    const eyeButtons = allButtons.filter(btn => btn.className.includes("h-7"));
    fireEvent.click(eyeButtons[0]);

    // After toggle, shows masked value
    expect(screen.getByTestId("openai-key-value")).toHaveTextContent("sk-...abcd");
  });

  it("toggles Anthropic key visibility when eye button clicked", () => {
    mockUseQuery.mockImplementation(makeQueryMock(mockSettingsWithBothKeys, []));
    render(<SettingsPage />);

    expect(screen.getByTestId("anthropic-key-value")).toHaveTextContent("••••••••••••");

    const allButtons = screen.getAllByRole("button");
    const eyeButtons = allButtons.filter(btn => btn.className.includes("h-7"));
    fireEvent.click(eyeButtons[1]);

    expect(screen.getByTestId("anthropic-key-value")).toHaveTextContent("sk-ant-...efgh");
  });

  it("shows Flutch Platform URL when present", () => {
    mockUseQuery.mockImplementation(makeQueryMock(mockSettingsWithBothKeys, []));
    render(<SettingsPage />);

    expect(screen.getByText("https://platform.example.com")).toBeInTheDocument();
  });

  it("calls registerWebhook when register button clicked", async () => {
    mockRegisterWebhook.mockResolvedValue({ success: true, webhookUrl: "https://..." });
    mockUseQuery.mockImplementation(makeQueryMock(mockSettingsWithBothKeys, mockAgentsWithTelegram));
    render(<SettingsPage />);

    fireEvent.click(screen.getByTestId("webhook-register-agent-toggle"));

    await waitFor(() => {
      expect(mockRegisterWebhook).toHaveBeenCalledWith("agent-toggle");
    });
  });

  it("shows change-password-error when mutation isError", () => {
    mockUseMutation.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      isError: true,
      isSuccess: false,
    });
    render(<SettingsPage />);

    expect(screen.getByTestId("change-password-error")).toBeInTheDocument();
    expect(screen.getByTestId("change-password-error")).toHaveTextContent("Incorrect current password");
  });

  it("shows change-password-success when mutation isSuccess", () => {
    mockUseMutation.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      isError: false,
      isSuccess: true,
    });
    render(<SettingsPage />);

    expect(screen.getByTestId("change-password-success")).toBeInTheDocument();
    expect(screen.getByTestId("change-password-success")).toHaveTextContent("Password changed");
  });

  it("shows Saving... text when mutation isPending", () => {
    mockUseMutation.mockReturnValue({
      mutate: vi.fn(),
      isPending: true,
      isError: false,
      isSuccess: false,
    });
    render(<SettingsPage />);

    expect(screen.getByTestId("change-password-submit")).toHaveTextContent("Saving...");
    expect(screen.getByTestId("change-password-submit")).toBeDisabled();
  });
});
