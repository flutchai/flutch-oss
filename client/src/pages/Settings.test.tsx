import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";

const mockUseQuery = vi.fn();
const mockUseMutation = vi.fn();

vi.mock("@tanstack/react-query", () => ({
  useQuery: (...args: any[]) => mockUseQuery(...args),
  useMutation: (...args: any[]) => mockUseMutation(...args),
}));

vi.mock("@tanstack/react-router", () => ({
  useLocation: () => ({ pathname: "/settings" }),
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
    selector({ token: "jwt", mustChangePassword: false, passwordChanged: vi.fn() }),
}));

const { SettingsPage } = await import("./Settings");

const mockSettings = {
  configMode: "local",
  flutchPlatformUrl: null,
  openaiKeyMasked: "sk-...abcd",
  anthropicKeyMasked: null,
};

const mockAgentsWithTelegram = [
  {
    id: "agent-1",
    graphType: "v1.0.0",
    graphSettings: {},
    platforms: { telegram: { configured: true, botTokenMasked: "...xyz9" }, widget: null },
  },
];

// Use queryKey-based routing for stable multi-call behavior
const makeQueryMock =
  (settingsData: any = undefined, agentsData: any = []) =>
  (opts: any) => {
    const key = opts?.queryKey?.[0];
    if (key === "settings") return { data: settingsData, isLoading: false };
    if (key === "agents") return { data: agentsData, isLoading: false };
    return { data: undefined, isLoading: false };
  };

describe("SettingsPage", () => {
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

  it("renders page heading", () => {
    render(<SettingsPage />);

    expect(screen.getByTestId("settings-heading")).toBeInTheDocument();
  });

  it("shows config mode from settings data", () => {
    mockUseQuery.mockImplementation(makeQueryMock(mockSettings, []));

    render(<SettingsPage />);

    expect(screen.getByTestId("settings-config-mode")).toHaveTextContent("local");
  });

  it("shows dots for masked OpenAI key (before toggle)", () => {
    mockUseQuery.mockImplementation(makeQueryMock(mockSettings, []));

    render(<SettingsPage />);

    expect(screen.getByTestId("openai-key-value")).toHaveTextContent("••••••••••••");
  });

  it("shows 'Not configured' for missing Anthropic key", () => {
    mockUseQuery.mockImplementation(makeQueryMock(mockSettings, []));

    render(<SettingsPage />);

    expect(screen.getByTestId("anthropic-key-value")).toHaveTextContent("Not configured");
  });

  it("shows Telegram Webhooks section when agents have telegram configured", () => {
    mockUseQuery.mockImplementation(makeQueryMock(mockSettings, mockAgentsWithTelegram));

    render(<SettingsPage />);

    expect(screen.getByTestId("telegram-webhooks-section")).toBeInTheDocument();
    expect(screen.getByTestId("webhook-register-agent-1")).toBeInTheDocument();
  });

  it("hides Telegram Webhooks section when no telegram agents", () => {
    mockUseQuery.mockImplementation(makeQueryMock(mockSettings, []));

    render(<SettingsPage />);

    expect(screen.queryByTestId("telegram-webhooks-section")).not.toBeInTheDocument();
  });

  it("renders change password card", () => {
    render(<SettingsPage />);

    expect(screen.getByTestId("change-password-section")).toBeInTheDocument();
    expect(screen.getByTestId("change-password-submit")).toBeInTheDocument();
  });

  it("shows API Keys section headings", () => {
    render(<SettingsPage />);

    expect(screen.getByText("OpenAI API Key")).toBeInTheDocument();
    expect(screen.getByText("Anthropic API Key")).toBeInTheDocument();
  });

  it("shows Engine section", () => {
    render(<SettingsPage />);

    expect(screen.getByTestId("engine-section")).toBeInTheDocument();
  });
});
