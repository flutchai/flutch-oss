import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";

const mockUseQuery = vi.fn();
const mockUseMutation = vi.fn();
const mockLogout = vi.fn();
const mockPasswordChanged = vi.fn();

vi.mock("@tanstack/react-query", () => ({
  useQuery: (...args: any[]) => mockUseQuery(...args),
  useMutation: (...args: any[]) => mockUseMutation(...args),
}));

vi.mock("@/api/settings", () => ({
  settingsApi: { get: vi.fn(), registerWebhook: vi.fn() },
}));

vi.mock("@/api/agents", () => ({
  agentsApi: { list: vi.fn() },
}));

vi.mock("@/api/auth", () => ({
  authApi: { changePassword: vi.fn() },
}));

vi.mock("@/store/auth", () => ({
  useAuthStore: (selector: any) =>
    selector({ logout: mockLogout, passwordChanged: mockPasswordChanged }),
}));

const { MobileSettings } = await import("./MobileSettings");

const mockSettings = {
  configMode: "local",
  flutchPlatformUrl: null,
  openaiKeyMasked: "sk-...xyz",
  anthropicKeyMasked: null,
};

const mockAgentsWithTelegram = [
  {
    id: "agent-1",
    graphType: "v1.0.0",
    graphSettings: {},
    platforms: { telegram: { configured: true, botTokenMasked: "...bot9" }, widget: null },
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

describe("MobileSettings", () => {
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

  it("renders engine section", () => {
    render(<MobileSettings />);
    expect(screen.getByTestId("engine-section")).toBeInTheDocument();
  });

  it("shows config mode from settings", () => {
    mockUseQuery.mockImplementation(makeQueryMock(mockSettings, []));
    render(<MobileSettings />);
    expect(screen.getByTestId("settings-config-mode")).toHaveTextContent("local");
  });

  it("shows — for config mode when no settings", () => {
    render(<MobileSettings />);
    expect(screen.getByTestId("settings-config-mode")).toHaveTextContent("—");
  });

  it("shows dots for openai key when configured", () => {
    mockUseQuery.mockImplementation(makeQueryMock(mockSettings, []));
    render(<MobileSettings />);
    expect(screen.getByTestId("openai-key-value")).toHaveTextContent("••••••••");
  });

  it("shows Not configured for openai key when absent", () => {
    mockUseQuery.mockImplementation(makeQueryMock({ ...mockSettings, openaiKeyMasked: null }, []));
    render(<MobileSettings />);
    expect(screen.getByTestId("openai-key-value")).toHaveTextContent("Not configured");
  });

  it("shows Not configured for anthropic key when absent", () => {
    mockUseQuery.mockImplementation(makeQueryMock(mockSettings, []));
    render(<MobileSettings />);
    expect(screen.getByTestId("anthropic-key-value")).toHaveTextContent("Not configured");
  });

  it("shows dots for anthropic key when configured", () => {
    mockUseQuery.mockImplementation(
      makeQueryMock({ ...mockSettings, anthropicKeyMasked: "sk-ant-...xxx" }, [])
    );
    render(<MobileSettings />);
    expect(screen.getByTestId("anthropic-key-value")).toHaveTextContent("••••••••");
  });

  it("shows Telegram Webhooks section when agents have telegram configured", () => {
    mockUseQuery.mockImplementation(makeQueryMock(mockSettings, mockAgentsWithTelegram));
    render(<MobileSettings />);
    expect(screen.getByTestId("telegram-webhooks-section")).toBeInTheDocument();
    expect(screen.getByTestId("webhook-register-agent-1")).toBeInTheDocument();
  });

  it("hides Telegram Webhooks section when no telegram agents", () => {
    mockUseQuery.mockImplementation(makeQueryMock(mockSettings, []));
    render(<MobileSettings />);
    expect(screen.queryByTestId("telegram-webhooks-section")).not.toBeInTheDocument();
  });

  it("renders change password section", () => {
    render(<MobileSettings />);
    expect(screen.getByTestId("change-password-section")).toBeInTheDocument();
    expect(screen.getByTestId("save-password-button")).toBeInTheDocument();
  });

  it("renders password input fields", () => {
    render(<MobileSettings />);
    expect(screen.getByTestId("current-password-input")).toBeInTheDocument();
    expect(screen.getByTestId("new-password-input")).toBeInTheDocument();
    expect(screen.getByTestId("confirm-password-input")).toBeInTheDocument();
  });

  it("renders logout button", () => {
    render(<MobileSettings />);
    expect(screen.getByTestId("mobile-logout-button")).toBeInTheDocument();
  });

  it("calls logout when logout button clicked", () => {
    render(<MobileSettings />);
    fireEvent.click(screen.getByTestId("mobile-logout-button"));
    expect(mockLogout).toHaveBeenCalledTimes(1);
  });

  it("renders switch-to-desktop link", () => {
    render(<MobileSettings />);
    expect(screen.getByTestId("switch-to-desktop")).toBeInTheDocument();
  });

  it("shows error state from mutation", () => {
    mockUseMutation.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      isError: true,
      isSuccess: false,
    });
    render(<MobileSettings />);
    expect(screen.getByTestId("change-password-error")).toBeInTheDocument();
    expect(screen.getByTestId("change-password-error")).toHaveTextContent("Incorrect current password");
  });

  it("shows success state from mutation", () => {
    mockUseMutation.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      isError: false,
      isSuccess: true,
    });
    render(<MobileSettings />);
    expect(screen.getByTestId("change-password-success")).toBeInTheDocument();
    expect(screen.getByTestId("change-password-success")).toHaveTextContent("Password changed");
  });
});
