import { isMobileUserAgent, cn, formatDate, relativeTime } from "./utils";

describe("isMobileUserAgent", () => {
  const originalUserAgent = navigator.userAgent;

  afterEach(() => {
    Object.defineProperty(navigator, "userAgent", {
      value: originalUserAgent,
      configurable: true,
    });
  });

  it("returns true for Android user agent", () => {
    Object.defineProperty(navigator, "userAgent", {
      value: "Mozilla/5.0 (Linux; Android 10; SM-G975F) AppleWebKit/537.36",
      configurable: true,
    });
    expect(isMobileUserAgent()).toBe(true);
  });

  it("returns true for iPhone user agent", () => {
    Object.defineProperty(navigator, "userAgent", {
      value: "Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15",
      configurable: true,
    });
    expect(isMobileUserAgent()).toBe(true);
  });

  it("returns true for iPad user agent", () => {
    Object.defineProperty(navigator, "userAgent", {
      value: "Mozilla/5.0 (iPad; CPU OS 15_0 like Mac OS X) AppleWebKit/605.1.15",
      configurable: true,
    });
    expect(isMobileUserAgent()).toBe(true);
  });

  it("returns true for iPod user agent", () => {
    Object.defineProperty(navigator, "userAgent", {
      value: "Mozilla/5.0 (iPod touch; CPU iPhone OS 15_0 like Mac OS X)",
      configurable: true,
    });
    expect(isMobileUserAgent()).toBe(true);
  });

  it("returns true for generic Mobile user agent", () => {
    Object.defineProperty(navigator, "userAgent", {
      value: "Mozilla/5.0 (Mobile; rv:68.0) Gecko/68.0 Firefox/68.0",
      configurable: true,
    });
    expect(isMobileUserAgent()).toBe(true);
  });

  it("returns false for desktop user agent", () => {
    Object.defineProperty(navigator, "userAgent", {
      value: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/91.0.4472.124",
      configurable: true,
    });
    expect(isMobileUserAgent()).toBe(false);
  });

  it("returns false for macOS desktop user agent", () => {
    Object.defineProperty(navigator, "userAgent", {
      value: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15",
      configurable: true,
    });
    expect(isMobileUserAgent()).toBe(false);
  });
});

describe("cn", () => {
  it("merges class names", () => {
    expect(cn("foo", "bar")).toBe("foo bar");
  });

  it("handles conditional classes", () => {
    expect(cn("base", false && "hidden", "visible")).toBe("base visible");
  });

  it("handles tailwind merge conflicts", () => {
    const result = cn("p-2", "p-4");
    expect(result).toBe("p-4");
  });
});

describe("formatDate", () => {
  it("returns a formatted string for a valid date string", () => {
    const result = formatDate("2024-06-15T10:30:00Z");
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  it("returns a formatted string for a Date object", () => {
    const result = formatDate(new Date("2024-01-01T00:00:00Z"));
    expect(typeof result).toBe("string");
    expect(result).toContain("2024");
  });
});

describe("relativeTime", () => {
  it("returns 'just now' for a date less than 1 minute ago", () => {
    const date = new Date(Date.now() - 30 * 1000).toISOString();
    expect(relativeTime(date)).toBe("just now");
  });

  it("returns minutes ago for a date 5 minutes ago", () => {
    const date = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    expect(relativeTime(date)).toBe("5m ago");
  });

  it("returns hours ago for a date 3 hours ago", () => {
    const date = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
    expect(relativeTime(date)).toBe("3h ago");
  });

  it("returns formatted date for a date more than 24 hours ago", () => {
    const date = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
    const result = relativeTime(date);
    // Should be a formatted date, not "h ago" or "m ago"
    expect(result).not.toContain("h ago");
    expect(result).not.toContain("m ago");
    expect(result).not.toBe("just now");
  });

  it("returns '1m ago' for exactly 1 minute ago", () => {
    const date = new Date(Date.now() - 60 * 1000).toISOString();
    expect(relativeTime(date)).toBe("1m ago");
  });

  it("returns '59m ago' for 59 minutes ago", () => {
    const date = new Date(Date.now() - 59 * 60 * 1000).toISOString();
    expect(relativeTime(date)).toBe("59m ago");
  });

  it("returns '1h ago' for exactly 60 minutes ago", () => {
    const date = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    expect(relativeTime(date)).toBe("1h ago");
  });

  it("returns '23h ago' for 23 hours ago", () => {
    const date = new Date(Date.now() - 23 * 60 * 60 * 1000).toISOString();
    expect(relativeTime(date)).toBe("23h ago");
  });
});
