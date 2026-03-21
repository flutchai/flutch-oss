import {
  filterSystemFields,
  getCrmToolName,
  SYSTEM_FIELDS,
  buildCrmCredentials,
  parseMcpResult,
  buildLookupArgs,
} from "./crm.constants";

describe("crm.constants", () => {
  describe("filterSystemFields", () => {
    it("filters twenty system fields", () => {
      const data = {
        id: "rec-1",
        createdAt: "2024-01-01",
        updatedAt: "2024-01-02",
        deletedAt: null,
        position: 1,
        createdBy: "admin",
        updatedBy: "admin",
        __typename: "Person",
        searchVector: "...",
        avatarUrl: "http://...",
        name: { firstName: "Ivan", lastName: "Petrov" },
        emails: { primaryEmail: "ivan@test.com" },
        jobTitle: "Engineer",
      };

      const result = filterSystemFields(data);

      expect(result).toEqual({
        name: { firstName: "Ivan", lastName: "Petrov" },
        emails: { primaryEmail: "ivan@test.com" },
        jobTitle: "Engineer",
      });
    });

    it("filters zoho system fields", () => {
      const data = {
        id: "rec-1",
        Created_Time: "2024-01-01",
        Modified_Time: "2024-01-02",
        Created_By: { name: "Admin" },
        Modified_By: { name: "Admin" },
        Owner: { name: "Agent" },
        $approved: true,
        $approval: {},
        $editable: true,
        $review: null,
        $currency_symbol: "₽",
        $converted: false,
        $process_flow: false,
        $orchestration: false,
        $in_merge: false,
        $approval_state: "approved",
        Last_Name: "Петров",
        Email: "petrov@test.com",
      };

      const result = filterSystemFields(data);

      expect(result).toEqual({ Last_Name: "Петров", Email: "petrov@test.com" });
    });

    it("filters out null values", () => {
      const data = {
        name: "Ivan",
        email: null,
        phone: undefined,
      };

      const result = filterSystemFields(data);

      expect(result).toEqual({ name: "Ivan" });
      expect(result).not.toHaveProperty("email");
      expect(result).not.toHaveProperty("phone");
    });

    it("returns empty object when all fields are system fields", () => {
      const data = { id: "1", createdAt: "2024", __typename: "Person" };
      const result = filterSystemFields(data);
      expect(result).toEqual({});
    });

    it("returns empty object when input is empty", () => {
      expect(filterSystemFields({})).toEqual({});
    });

    it("keeps falsy values like 0 and false", () => {
      const data = { score: 0, active: false, name: "Test" };
      const result = filterSystemFields(data);
      expect(result.score).toBe(0);
      expect(result.active).toBe(false);
      expect(result.name).toBe("Test");
    });
  });

  describe("getCrmToolName", () => {
    it("returns correct tool names for twenty", () => {
      expect(getCrmToolName("twenty", "find")).toBe("twenty_list_people");
      expect(getCrmToolName("twenty", "get")).toBe("twenty_get_person");
      expect(getCrmToolName("twenty", "create")).toBe("twenty_create_person");
      expect(getCrmToolName("twenty", "update")).toBe("twenty_update_person");
      expect(getCrmToolName("twenty", "upsert")).toBe("twenty_upsert_person");
    });

    it("returns correct tool names for zoho", () => {
      expect(getCrmToolName("zoho", "find")).toBe("zoho_search_contacts");
      expect(getCrmToolName("zoho", "create")).toBe("zoho_create_contact");
      expect(getCrmToolName("zoho", "update")).toBe("zoho_update_contact");
      expect(getCrmToolName("zoho", "upsert")).toBe("zoho_upsert_contact");
    });

    it("returns fallback name for unknown provider", () => {
      expect(getCrmToolName("hubspot", "find")).toBe("hubspot_find_contact");
      expect(getCrmToolName("hubspot", "create")).toBe("hubspot_create_contact");
      expect(getCrmToolName("unknown", "update")).toBe("unknown_update_contact");
    });
  });

  describe("SYSTEM_FIELDS", () => {
    it("is a single universal Set", () => {
      expect(SYSTEM_FIELDS).toBeInstanceOf(Set);
    });

    it("includes twenty system fields", () => {
      expect(SYSTEM_FIELDS.has("id")).toBe(true);
      expect(SYSTEM_FIELDS.has("createdAt")).toBe(true);
      expect(SYSTEM_FIELDS.has("__typename")).toBe(true);
      expect(SYSTEM_FIELDS.has("searchVector")).toBe(true);
    });

    it("includes zoho system fields", () => {
      expect(SYSTEM_FIELDS.has("Created_Time")).toBe(true);
      expect(SYSTEM_FIELDS.has("Owner")).toBe(true);
      expect(SYSTEM_FIELDS.has("$approved")).toBe(true);
    });
  });

  describe("buildCrmCredentials", () => {
    it("returns credentials when apiKey and baseUrl are set", () => {
      expect(buildCrmCredentials({ apiKey: "key1", baseUrl: "http://crm" }))
        .toEqual({ apiKey: "key1", baseUrl: "http://crm" });
    });

    it("returns credentials with only apiKey", () => {
      expect(buildCrmCredentials({ apiKey: "key1" }))
        .toEqual({ apiKey: "key1" });
    });

    it("returns undefined when no credentials", () => {
      expect(buildCrmCredentials({})).toBeUndefined();
    });

    it("returns undefined when values are empty strings", () => {
      expect(buildCrmCredentials({ apiKey: "", baseUrl: "" })).toBeUndefined();
    });
  });

  describe("parseMcpResult", () => {
    it("returns null for null/undefined", () => {
      expect(parseMcpResult(null)).toBeNull();
      expect(parseMcpResult(undefined)).toBeNull();
    });

    it("returns object as-is", () => {
      const obj = { id: "1", name: "Test" };
      expect(parseMcpResult(obj)).toBe(obj);
    });

    it("parses JSON object from text", () => {
      const text = '✅ Created person: Test\n\n{"id": "abc", "name": "Test"}';
      expect(parseMcpResult(text)).toEqual({ id: "abc", name: "Test" });
    });

    it("parses JSON array from text", () => {
      const text = 'Found 2 people\n\n[{"id": "1"}, {"id": "2"}]';
      expect(parseMcpResult(text)).toEqual([{ id: "1" }, { id: "2" }]);
    });

    it("returns string as-is when no JSON found", () => {
      expect(parseMcpResult("No results")).toBe("No results");
    });
  });

  describe("buildLookupArgs", () => {
    it("builds twenty filter for email lookup", () => {
      const args = buildLookupArgs("twenty", "email", "test@example.com");
      const parsed = JSON.parse(args.filter);
      expect(parsed).toEqual({
        emails: { primaryEmail: { eq: "test@example.com" } },
      });
      expect(args.limit).toBe(1);
    });

    it("builds twenty filter for phone lookup", () => {
      const args = buildLookupArgs("twenty", "phone", "+7999");
      const parsed = JSON.parse(args.filter);
      expect(parsed).toEqual({
        phones: { primaryPhoneNumber: { eq: "+7999" } },
      });
      expect(args.limit).toBe(1);
    });

    it("builds simple key=value for other providers", () => {
      const args = buildLookupArgs("zoho", "email", "test@example.com");
      expect(args).toEqual({ email: "test@example.com" });
    });

    it("passes unknown twenty field as-is", () => {
      const args = buildLookupArgs("twenty", "customField", "value");
      const parsed = JSON.parse(args.filter);
      expect(parsed).toEqual({ customField: { eq: "value" } });
    });
  });
});
