import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, render, screen, fireEvent } from "@testing-library/react";
import React from "react";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, ...rest }: any) => React.createElement("a", { href: to, ...rest }, children),
  useParams: () => ({ id: "kb-1" }),
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
    get: vi.fn(),
    listArticles: vi.fn(),
    createArticle: vi.fn(),
    updateArticle: vi.fn(),
    deleteArticle: vi.fn(),
  },
}));

const { MobileKnowledgeBaseDetail } = await import("./MobileKnowledgeBaseDetail");

const mockKb = {
  id: "kb-1",
  name: "Roofing FAQ",
  description: "FAQ about roofing",
  ownership: "personal",
  visibility: "private",
  visibilityStatus: "draft",
  contentType: "general",
  articleCount: 2,
  createdAt: "2024-01-01T00:00:00Z",
  slug: "roofing-faq",
  ownerId: "owner-1",
  settings: {},
};

const mockArticlesData = {
  data: [
    {
      id: "art-1",
      title: "How to Install Shingles",
      isPublished: false,
      source: "manual",
      createdAt: "2024-01-01T00:00:00Z",
      updatedAt: "2024-01-02T00:00:00Z",
    },
    {
      id: "art-2",
      title: "Roof Maintenance Guide",
      isPublished: true,
      source: "manual",
      createdAt: "2024-01-03T00:00:00Z",
      updatedAt: "2024-01-04T00:00:00Z",
    },
  ],
  total: 2,
  page: 1,
  limit: 15,
};

function makeQueryMock(kbResponse: any, articlesResponse: any) {
  return (opts: any) => {
    const key = opts?.queryKey?.[0];
    if (key === "knowledge-base") return kbResponse;
    if (key === "kb-articles") return articlesResponse;
    return { data: undefined, isLoading: false };
  };
}

const defaultQueryMock = makeQueryMock(
  { data: mockKb, isLoading: false },
  { data: mockArticlesData, isLoading: false }
);

describe("MobileKnowledgeBaseDetail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseQuery.mockImplementation(defaultQueryMock);
    mockUseMutation.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      isError: false,
      isSuccess: false,
    });
  });

  it("renders loading state when KB is loading", () => {
    mockUseQuery.mockImplementation(
      makeQueryMock({ data: undefined, isLoading: true }, { data: undefined, isLoading: true })
    );

    render(<MobileKnowledgeBaseDetail />);

    expect(screen.getByTestId("mobile-kb-detail-loading")).toBeInTheDocument();
    expect(screen.getByTestId("mobile-kb-detail-loading")).toHaveTextContent("Loading...");
  });

  it("renders KB header with name when data is loaded", () => {
    render(<MobileKnowledgeBaseDetail />);

    expect(screen.getByTestId("mobile-kb-detail-heading")).toHaveTextContent("Roofing FAQ");
  });

  it("renders article count in the header", () => {
    render(<MobileKnowledgeBaseDetail />);

    expect(screen.getByTestId("mobile-kb-detail-article-count")).toHaveTextContent("2 articles");
  });

  it("renders articles list when articles are loaded", () => {
    render(<MobileKnowledgeBaseDetail />);

    expect(screen.getByTestId("mobile-kb-articles-list")).toBeInTheDocument();
    expect(screen.getByTestId("mobile-article-card-art-1")).toBeInTheDocument();
    expect(screen.getByTestId("mobile-article-card-art-2")).toBeInTheDocument();
  });

  it("renders articles loading skeleton when articles are loading", () => {
    mockUseQuery.mockImplementation(
      makeQueryMock({ data: mockKb, isLoading: false }, { data: undefined, isLoading: true })
    );

    render(<MobileKnowledgeBaseDetail />);

    expect(screen.getByTestId("mobile-kb-articles-loading")).toBeInTheDocument();
  });

  it("renders empty articles state when no articles exist", () => {
    mockUseQuery.mockImplementation(
      makeQueryMock(
        { data: mockKb, isLoading: false },
        { data: { data: [], total: 0, page: 1, limit: 15 }, isLoading: false }
      )
    );

    render(<MobileKnowledgeBaseDetail />);

    expect(screen.getByTestId("mobile-kb-articles-empty")).toBeInTheDocument();
  });

  it("publish button calls mutate with isPublished: true for unpublished article", () => {
    const toggleMutate = vi.fn();
    mockUseMutation
      .mockReturnValueOnce({ mutate: vi.fn(), isPending: false, isError: false })
      .mockReturnValueOnce({ mutate: toggleMutate, isPending: false, isError: false })
      .mockReturnValueOnce({ mutate: vi.fn(), isPending: false, isError: false });

    render(<MobileKnowledgeBaseDetail />);

    const publishButton = screen.getByTestId("mobile-article-toggle-publish-art-1");
    expect(publishButton).toHaveTextContent("Publish");
    fireEvent.click(publishButton);

    expect(toggleMutate).toHaveBeenCalledWith({ articleId: "art-1", isPublished: true });
  });

  it("unpublish button calls mutate with isPublished: false for published article", () => {
    const toggleMutate = vi.fn();
    mockUseMutation
      .mockReturnValueOnce({ mutate: vi.fn(), isPending: false, isError: false })
      .mockReturnValueOnce({ mutate: toggleMutate, isPending: false, isError: false })
      .mockReturnValueOnce({ mutate: vi.fn(), isPending: false, isError: false });

    render(<MobileKnowledgeBaseDetail />);

    const unpublishButton = screen.getByTestId("mobile-article-toggle-publish-art-2");
    expect(unpublishButton).toHaveTextContent("Unpublish");
    fireEvent.click(unpublishButton);

    expect(toggleMutate).toHaveBeenCalledWith({ articleId: "art-2", isPublished: false });
  });

  it("delete article calls mutate after confirmation", () => {
    const deleteMutate = vi.fn();
    mockUseMutation
      .mockReturnValueOnce({ mutate: vi.fn(), isPending: false, isError: false })
      .mockReturnValueOnce({ mutate: vi.fn(), isPending: false, isError: false })
      .mockReturnValueOnce({ mutate: deleteMutate, isPending: false, isError: false });
    vi.spyOn(window, "confirm").mockReturnValue(true);

    render(<MobileKnowledgeBaseDetail />);
    fireEvent.click(screen.getByTestId("mobile-article-delete-art-1"));

    expect(deleteMutate).toHaveBeenCalledWith("art-1");
  });

  it("delete article does not call mutate when user cancels", () => {
    const deleteMutate = vi.fn();
    mockUseMutation
      .mockReturnValueOnce({ mutate: vi.fn(), isPending: false, isError: false })
      .mockReturnValueOnce({ mutate: vi.fn(), isPending: false, isError: false })
      .mockReturnValueOnce({ mutate: deleteMutate, isPending: false, isError: false });
    vi.spyOn(window, "confirm").mockReturnValue(false);

    render(<MobileKnowledgeBaseDetail />);
    fireEvent.click(screen.getByTestId("mobile-article-delete-art-1"));

    expect(deleteMutate).not.toHaveBeenCalled();
  });

  it("create article form is hidden by default", () => {
    render(<MobileKnowledgeBaseDetail />);

    expect(screen.queryByTestId("mobile-kb-article-create-form")).not.toBeInTheDocument();
  });

  it("create article form toggles open when create button is clicked", () => {
    render(<MobileKnowledgeBaseDetail />);
    fireEvent.click(screen.getByTestId("mobile-kb-article-create-button"));

    expect(screen.getByTestId("mobile-kb-article-create-form")).toBeInTheDocument();
  });

  it("create article submit calls mutate when title is filled", () => {
    const createMutate = vi.fn();
    // Use mockReturnValue (stable across re-renders) since state changes
    // (showing the form, updating title) cause re-renders that re-call useMutation.
    mockUseMutation.mockReturnValue({ mutate: createMutate, isPending: false, isError: false });

    render(<MobileKnowledgeBaseDetail />);
    fireEvent.click(screen.getByTestId("mobile-kb-article-create-button"));
    fireEvent.change(screen.getByTestId("mobile-kb-article-title-input"), {
      target: { value: "New Article" },
    });
    fireEvent.click(screen.getByTestId("mobile-kb-article-create-submit"));

    expect(createMutate).toHaveBeenCalled();
  });

  it("create article submit button is disabled when title is empty", () => {
    render(<MobileKnowledgeBaseDetail />);
    fireEvent.click(screen.getByTestId("mobile-kb-article-create-button"));

    expect(screen.getByTestId("mobile-kb-article-create-submit")).toBeDisabled();
  });

  it("does not show pagination for a single page", () => {
    render(<MobileKnowledgeBaseDetail />);

    expect(screen.queryByTestId("mobile-articles-pagination-info")).not.toBeInTheDocument();
  });

  it("shows pagination when there are multiple pages", () => {
    mockUseQuery.mockImplementation(
      makeQueryMock(
        { data: mockKb, isLoading: false },
        { data: { ...mockArticlesData, total: 40, limit: 15 }, isLoading: false }
      )
    );

    render(<MobileKnowledgeBaseDetail />);

    expect(screen.getByTestId("mobile-articles-pagination-info")).toBeInTheDocument();
    expect(screen.getByTestId("mobile-articles-pagination-info")).toHaveTextContent("1 / 3");
  });

  it("shows mobile-kb-article-create-error when createArticleMutation.isError is true", () => {
    mockUseMutation.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      isError: true,
      isSuccess: false,
    });

    render(<MobileKnowledgeBaseDetail />);
    fireEvent.click(screen.getByTestId("mobile-kb-article-create-button"));

    expect(screen.getByTestId("mobile-kb-article-create-error")).toBeInTheDocument();
    expect(screen.getByTestId("mobile-kb-article-create-error")).toHaveTextContent(
      "Failed to create article"
    );
  });

  it("does not show mobile-kb-article-create-error when createArticleMutation.isError is false", () => {
    render(<MobileKnowledgeBaseDetail />);
    fireEvent.click(screen.getByTestId("mobile-kb-article-create-button"));

    expect(screen.queryByTestId("mobile-kb-article-create-error")).not.toBeInTheDocument();
  });

  it("onSuccess of createArticleMutation resets form state and closes form", () => {
    let capturedOnSuccess: (() => void) | undefined;

    mockUseMutation.mockImplementation((opts: any) => {
      if (!capturedOnSuccess && opts?.onSuccess) capturedOnSuccess = opts.onSuccess;
      return { mutate: vi.fn(), isPending: false, isError: false };
    });

    render(<MobileKnowledgeBaseDetail />);
    // Open create form
    fireEvent.click(screen.getByTestId("mobile-kb-article-create-button"));
    expect(screen.getByTestId("mobile-kb-article-create-form")).toBeInTheDocument();

    // Fill title
    fireEvent.change(screen.getByTestId("mobile-kb-article-title-input"), {
      target: { value: "My Article" },
    });
    expect(screen.getByTestId("mobile-kb-article-title-input")).toHaveValue("My Article");

    // Simulate onSuccess
    act(() => {
      capturedOnSuccess?.();
    });

    // Form should be closed
    expect(screen.queryByTestId("mobile-kb-article-create-form")).not.toBeInTheDocument();
  });
});
