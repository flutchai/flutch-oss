import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, render, screen, fireEvent } from "@testing-library/react";
import React from "react";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, params }: any) =>
    React.createElement("a", { href: `${to}/${params?.id ?? ""}` }, children),
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

const { KnowledgeBasesPage } = await import("./KnowledgeBases");

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
  limit: 20,
};

describe("KnowledgeBasesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseQuery.mockReturnValue({ data: mockKbData, isLoading: false });
    mockUseMutation.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      isError: false,
      isSuccess: false,
    });
  });

  it("renders loading state when isLoading is true", () => {
    mockUseQuery.mockReturnValue({ data: undefined, isLoading: true });

    render(<KnowledgeBasesPage />);

    expect(screen.getByTestId("kb-loading")).toBeInTheDocument();
    expect(screen.getByTestId("kb-loading")).toHaveTextContent("Loading...");
  });

  it("renders page heading", () => {
    render(<KnowledgeBasesPage />);

    expect(screen.getByTestId("kb-heading")).toBeInTheDocument();
    expect(screen.getByTestId("kb-heading")).toHaveTextContent("Knowledge Bases");
  });

  it("renders list of knowledge bases when data is loaded", () => {
    render(<KnowledgeBasesPage />);

    expect(screen.getByTestId("kb-row-kb-1")).toBeInTheDocument();
    expect(screen.getByTestId("kb-row-kb-2")).toBeInTheDocument();
  });

  it("renders total count", () => {
    render(<KnowledgeBasesPage />);

    expect(screen.getByTestId("kb-total")).toHaveTextContent("2 knowledge bases");
  });

  it("renders empty state when data has no items", () => {
    mockUseQuery.mockReturnValue({
      data: { data: [], total: 0, page: 1, limit: 20 },
      isLoading: false,
    });

    render(<KnowledgeBasesPage />);

    expect(screen.getByTestId("kb-empty")).toBeInTheDocument();
  });

  it("create form is hidden by default", () => {
    render(<KnowledgeBasesPage />);

    expect(screen.queryByTestId("kb-create-form")).not.toBeInTheDocument();
  });

  it("create form toggles open when create button is clicked", () => {
    render(<KnowledgeBasesPage />);
    fireEvent.click(screen.getByTestId("kb-create-button"));

    expect(screen.getByTestId("kb-create-form")).toBeInTheDocument();
  });

  it("create form closes when create button is clicked again", () => {
    render(<KnowledgeBasesPage />);
    fireEvent.click(screen.getByTestId("kb-create-button"));
    fireEvent.click(screen.getByTestId("kb-create-button"));

    expect(screen.queryByTestId("kb-create-form")).not.toBeInTheDocument();
  });

  it("create form submit button calls mutate when name is filled", () => {
    const mutate = vi.fn();
    mockUseMutation.mockReturnValue({ mutate, isPending: false, isError: false });

    render(<KnowledgeBasesPage />);
    fireEvent.click(screen.getByTestId("kb-create-button"));
    fireEvent.change(screen.getByTestId("kb-name-input"), {
      target: { value: "New KB" },
    });
    fireEvent.click(screen.getByTestId("kb-create-submit"));

    expect(mutate).toHaveBeenCalled();
  });

  it("create submit button is disabled when name is empty", () => {
    render(<KnowledgeBasesPage />);
    fireEvent.click(screen.getByTestId("kb-create-button"));

    expect(screen.getByTestId("kb-create-submit")).toBeDisabled();
  });

  it("shows delete button for each kb row", () => {
    render(<KnowledgeBasesPage />);

    expect(screen.getByTestId("kb-delete-kb-1")).toBeInTheDocument();
    expect(screen.getByTestId("kb-delete-kb-2")).toBeInTheDocument();
  });

  it("delete button calls mutate after confirmation", () => {
    const createMutate = vi.fn();
    const deleteMutate = vi.fn();
    mockUseMutation
      .mockReturnValueOnce({ mutate: createMutate, isPending: false, isError: false })
      .mockReturnValueOnce({ mutate: deleteMutate, isPending: false, isError: false });
    vi.spyOn(window, "confirm").mockReturnValue(true);

    render(<KnowledgeBasesPage />);
    fireEvent.click(screen.getByTestId("kb-delete-kb-1"));

    expect(deleteMutate).toHaveBeenCalledWith("kb-1");
  });

  it("delete does not call mutate when user cancels confirmation", () => {
    const deleteMutate = vi.fn();
    mockUseMutation
      .mockReturnValueOnce({ mutate: vi.fn(), isPending: false, isError: false })
      .mockReturnValueOnce({ mutate: deleteMutate, isPending: false, isError: false });
    vi.spyOn(window, "confirm").mockReturnValue(false);

    render(<KnowledgeBasesPage />);
    fireEvent.click(screen.getByTestId("kb-delete-kb-1"));

    expect(deleteMutate).not.toHaveBeenCalled();
  });

  it("does not show pagination when total fits on one page", () => {
    render(<KnowledgeBasesPage />);

    expect(screen.queryByTestId("kb-pagination-info")).not.toBeInTheDocument();
  });

  it("shows pagination info when there are multiple pages", () => {
    mockUseQuery.mockReturnValue({
      data: { ...mockKbData, total: 50, limit: 20 },
      isLoading: false,
    });

    render(<KnowledgeBasesPage />);

    expect(screen.getByTestId("kb-pagination-info")).toHaveTextContent("Page 1 of 3");
  });

  it("renders pagination prev/next buttons when there are multiple pages", () => {
    mockUseQuery.mockReturnValue({
      data: { ...mockKbData, total: 50, limit: 20 },
      isLoading: false,
    });

    render(<KnowledgeBasesPage />);

    expect(screen.getByTestId("kb-pagination-prev")).toBeInTheDocument();
    expect(screen.getByTestId("kb-pagination-next")).toBeInTheDocument();
  });

  it("prev pagination button is disabled on first page", () => {
    mockUseQuery.mockReturnValue({
      data: { ...mockKbData, total: 50, limit: 20 },
      isLoading: false,
    });

    render(<KnowledgeBasesPage />);

    expect(screen.getByTestId("kb-pagination-prev")).toBeDisabled();
    expect(screen.getByTestId("kb-pagination-next")).not.toBeDisabled();
  });

  it("shows kb-create-error when createMutation.isError is true", () => {
    mockUseMutation.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      isError: true,
      isSuccess: false,
    });

    render(<KnowledgeBasesPage />);
    fireEvent.click(screen.getByTestId("kb-create-button"));

    expect(screen.getByTestId("kb-create-error")).toBeInTheDocument();
    expect(screen.getByTestId("kb-create-error")).toHaveTextContent(
      "Failed to create knowledge base"
    );
  });

  it("onSuccess of createMutation resets form state and closes form", () => {
    let capturedOnSuccess: (() => void) | undefined;

    mockUseMutation.mockImplementation((opts: any) => {
      if (!capturedOnSuccess && opts?.onSuccess) capturedOnSuccess = opts.onSuccess;
      return { mutate: vi.fn(), isPending: false, isError: false };
    });

    render(<KnowledgeBasesPage />);
    // Open form
    fireEvent.click(screen.getByTestId("kb-create-button"));
    expect(screen.getByTestId("kb-create-form")).toBeInTheDocument();

    // Fill name input
    fireEvent.change(screen.getByTestId("kb-name-input"), {
      target: { value: "My KB" },
    });
    expect(screen.getByTestId("kb-name-input")).toHaveValue("My KB");

    // Simulate onSuccess
    act(() => {
      capturedOnSuccess?.();
    });

    // Form should be closed
    expect(screen.queryByTestId("kb-create-form")).not.toBeInTheDocument();
  });
});
