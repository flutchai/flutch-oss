import { filterSystemFields, getCrmToolName, CRM_SYSTEM_FIELDS } from "./crm.constants";

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
        name: "Иван",
        email: "ivan@test.com",
        phone: "+7999",
      };

      const result = filterSystemFields("twenty", data);

      expect(result).toEqual({ name: "Иван", email: "ivan@test.com", phone: "+7999" });
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

      const result = filterSystemFields("zoho", data);

      expect(result).toEqual({ Last_Name: "Петров", Email: "petrov@test.com" });
    });

    it("returns data as-is for unknown provider", () => {
      const data = { foo: "bar", baz: 42 };
      const result = filterSystemFields("unknown_crm", data);
      expect(result).toEqual({ foo: "bar", baz: 42 });
    });

    it("filters out null values regardless of blacklist", () => {
      const data = {
        name: "Иван",
        email: null,
        phone: undefined,
      };

      const result = filterSystemFields("twenty", data);

      expect(result).toEqual({ name: "Иван" });
      expect(result).not.toHaveProperty("email");
      expect(result).not.toHaveProperty("phone");
    });

    it("returns empty object when all fields are system fields", () => {
      const data = { id: "1", createdAt: "2024", __typename: "Person" };
      const result = filterSystemFields("twenty", data);
      expect(result).toEqual({});
    });

    it("returns empty object when input is empty", () => {
      expect(filterSystemFields("twenty", {})).toEqual({});
      expect(filterSystemFields("zoho", {})).toEqual({});
    });

    it("keeps non-null, non-blacklisted values including falsy ones like 0 and false", () => {
      const data = { score: 0, active: false, name: "Test" };
      // score=0 and active=false → filtered by `value != null` check → they pass (0 != null is true)
      const result = filterSystemFields("twenty", data);
      expect(result.score).toBe(0);
      expect(result.active).toBe(false);
      expect(result.name).toBe("Test");
    });
  });

  describe("getCrmToolName", () => {
    it("returns correct tool names for twenty", () => {
      expect(getCrmToolName("twenty", "find")).toBe("twenty_find_person");
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

  describe("CRM_SYSTEM_FIELDS", () => {
    it("has entries for twenty and zoho", () => {
      expect(CRM_SYSTEM_FIELDS.twenty).toBeInstanceOf(Set);
      expect(CRM_SYSTEM_FIELDS.zoho).toBeInstanceOf(Set);
    });

    it("twenty blacklist includes id, createdAt, __typename", () => {
      expect(CRM_SYSTEM_FIELDS.twenty.has("id")).toBe(true);
      expect(CRM_SYSTEM_FIELDS.twenty.has("createdAt")).toBe(true);
      expect(CRM_SYSTEM_FIELDS.twenty.has("__typename")).toBe(true);
    });

    it("zoho blacklist includes id, Created_Time, Owner", () => {
      expect(CRM_SYSTEM_FIELDS.zoho.has("id")).toBe(true);
      expect(CRM_SYSTEM_FIELDS.zoho.has("Created_Time")).toBe(true);
      expect(CRM_SYSTEM_FIELDS.zoho.has("Owner")).toBe(true);
    });
  });
});
