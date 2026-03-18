import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, render, screen, fireEvent } from "@testing-library/react";
import React from "react";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, params, "data-testid": testid }: any) =>
    React.createElement("a", { href: `${to}/${params?.id ?? ""}`, "data-testid": testid }, children),
}));

const mockUseQuery = vi.fn();
const mockUseMutation = vi.fn();

vi.mock("@tanstack/react-query", () => ({
  useQuery: (...args: any[]) => mockUseQuery(...args),
  useMutation: (...args: any[]) => mockUseMutation(...args),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

vi.mock("@/api/knowledgeBase", () => ({
  kbApi: {
    list: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
  },
}));

const { MobileKnowledgeBases } = await import("./MobileKnowledgeBases");

const mockKbData = {
  data: [
    {
      id: "kb-1",
      name: "Roofing FAQ",
      description: "Frequently asked questions",
      ownership: "personal",
      visibility: "private",
      visibilityStatus: "draft",
      contentType: "general",
      articleCount: 5,
      createdAt: "2024-01-01T00:00:00Z",
    },
    {
      id: "kb-2",
      name: "Installation Guide",
      description: undefined,
      ownership: "company",
      visibility: "public",
      visibilityStatus: "published",
      contentType: "documentation",
      articleCount: 12,
      createdAt: "2024-02-01T00:00:00Z",
    },
  ],
  total: 2,
  page: 1,
  limit: 15,
};

describe("MobileKnowledgeBases", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseQuery.mockReturnValue({ data: mockKbData, isLoading: false });
    mockUseMutation.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      isError: false,
      isSuccess: false,
    });
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });

  it("renders loading skeleton when isLoading is true", () => {
    mockUseQuery.mockReturnValue({ data: undefined, isLoading: true });

    render(<MobileKnowledgeBases />);

    expect(screen.getByTestId("mobile-kb-loading")).toBeInTheDocument();
  });

  it("renders page heading", () => {
    render(<MobileKnowledgeBases />);

    expect(screen.getByTestId("mobile-kb-heading")).toBeInTheDocument();
    expect(screen.getByTestId("mobile-kb-heading")).toHaveTextContent("Knowledge Bases");
  });

  it("renders list of knowledge bases when data is loaded", () => {
    render(<MobileKnowledgeBases />);

    expect(screen.getByTestId("mobile-kb-list")).toBeInTheDocument();
    expect(screen.getByTestId("mobile-kb-card-kb-1")).toBeInTheDocument();
    expect(screen.getByTestId("mobile-kb-card-kb-2")).toBeInTheDocument();
  });

  it("renders empty state when no knowledge bases exist", () => {
    mockUseQuery.mockReturnValue({
      data: { data: [], total: 0, page: 1, limit: 15 },
      isLoading: false,
    });

    render(<MobileKnowledgeBases />);

    expect(screen.getByTestId("mobile-kb-empty")).toBeInTheDocument();
  });

  it("create form is hidden by default", () => {
    render(<MobileKnowledgeBases />);

    expect(screen.queryByTestId("mobile-kb-create-form")).not.toBeInTheDocument();
  });

  it("create form toggles open when create button is clicked", () => {
    render(<MobileKnowledgeBases />);
    fireEvent.click(screen.getByTestId("mobile-kb-create-button"));

    expect(screen.getByTestId("mobile-kb-create-form")).toBeInTheDocument();
  });

  it("create form closes when create button is clicked again", () => {
    render(<MobileKnowledgeBases />);
    fireEvent.click(screen.getByTestId("mobile-kb-create-button"));
    fireEvent.click(screen.getByTestId("mobile-kb-create-button"));

    expect(screen.queryByTestId("mobile-kb-create-form")).not.toBeInTheDocument();
  });

  it("create submit button calls mutate when name is filled", () => {
    const mutate = vi.fn();
    mockUseMutation.mockReturnValue({ mutate, isPending: false, isError: false });

    render(<MobileKnowledgeBases />);
    fireEvent.click(screen.getByTestId("mobile-kb-create-button"));
    fireEvent.change(screen.getByTestId("mobile-kb-name-input"), {
      target: { value: "New KB" },
    });
    fireEvent.click(screen.getByTestId("mobile-kb-create-submit"));

    expect(mutate).toHaveBeenCalled();
  });

  it("create submit button is disabled when name is empty", () => {
    render(<MobileKnowledgeBases />);
    fireEvent.click(screen.getByTestId("mobile-kb-create-button"));

    expect(screen.getByTestId("mobile-kb-create-submit")).toBeDisabled();
  });

  it("does not show pagination for a single page", () => {
    render(<MobileKnowledgeBases />);

    expect(screen.queryByTestId("mobile-kb-pagination-info")).not.toBeInTheDocument();
  });

  it("shows pagination when there are multiple pages", () => {
    mockUseQuery.mockReturnValue({
      data: { ...mockKbData, total: 40, limit: 15 },
      isLoading: false,
    });

    render(<MobileKnowledgeBases />);

    expect(screen.getByTestId("mobile-kb-pagination-info")).toBeInTheDocument();
    expect(screen.getByTestId("mobile-kb-pagination-info")).toHaveTextContent("Page 1 of 3");
  });

  it("renders article count on kb card", () => {
    render(<MobileKnowledgeBases />);

    expect(screen.getByTestId("mobile-kb-article-count-kb-1")).toHaveTextContent("5 articles");
    expect(screen.getByTestId("mobile-kb-article-count-kb-2")).toHaveTextContent("12 articles");
  });

  it("renders delete button for each KB card", () => {
    render(<MobileKnowledgeBases />);

    expect(screen.getByTestId("kb-delete-kb-1")).toBeInTheDocument();
    expect(screen.getByTestId("kb-delete-kb-2")).toBeInTheDocument();
  });

  it("delete button calls deleteMutation.mutate after confirmation", () => {
    const createMutate = vi.fn();
    const deleteMutate = vi.fn();
    mockUseMutation
      .mockReturnValueOnce({ mutate: createMutate, isPending: false, isError: false })
      .mockReturnValueOnce({ mutate: deleteMutate, isPending: false, isError: false });

    render(<MobileKnowledgeBases />);
    fireEvent.click(screen.getByTestId("kb-delete-kb-1"));

    expect(deleteMutate).toHaveBeenCalledWith("kb-1");
  });

  it("delete button does not call mutate when user cancels", () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    const deleteMutate = vi.fn();
    mockUseMutation
      .mockReturnValueOnce({ mutate: vi.fn(), isPending: false, isError: false })
      .mockReturnValueOnce({ mutate: deleteMutate, isPending: false, isError: false });

    render(<MobileKnowledgeBases />);
    fireEvent.click(screen.getByTestId("kb-delete-kb-1"));

    expect(deleteMutate).not.toHaveBeenCalled();
  });

  it("shows mobile-kb-create-error when createMutation.isError is true", () => {
    mockUseMutation.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      isError: true,
      isSuccess: false,
    });

    render(<MobileKnowledgeBases />);
    fireEvent.click(screen.getByTestId("mobile-kb-create-button"));

    expect(screen.getByTestId("mobile-kb-create-error")).toBeInTheDocument();
    expect(screen.getByTestId("mobile-kb-create-error")).toHaveTextContent(
      "Failed to create knowledge base"
    );
  });

  it("does not show mobile-kb-create-error when createMutation.isError is false", () => {
    render(<MobileKnowledgeBases />);
    fireEvent.click(screen.getByTestId("mobile-kb-create-button"));

    expect(screen.queryByTestId("mobile-kb-create-error")).not.toBeInTheDocument();
  });

  it("onSuccess of createMutation resets form state and closes form", () => {
    let capturedOnSuccess: (() => void) | undefined;

    mockUseMutation.mockImplementation((opts: any) => {
      if (!capturedOnSuccess && opts?.onSuccess) capturedOnSuccess = opts.onSuccess;
      return { mutate: vi.fn(), isPending: false, isError: false };
    });

    render(<MobileKnowledgeBases />);
    // Open form
    fireEvent.click(screen.getByTestId("mobile-kb-create-button"));
    expect(screen.getByTestId("mobile-kb-create-form")).toBeInTheDocument();

    // Fill name input so we can confirm it resets
    fireEvent.change(screen.getByTestId("mobile-kb-name-input"), {
      target: { value: "My KB" },
    });
    expect(screen.getByTestId("mobile-kb-name-input")).toHaveValue("My KB");

    // Simulate onSuccess being called by react-query
    act(() => {
      capturedOnSuccess?.();
    });

    // Form should be closed after onSuccess
    expect(screen.queryByTestId("mobile-kb-create-form")).not.toBeInTheDocument();
  });
});
