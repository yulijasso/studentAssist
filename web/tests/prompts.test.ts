import { describe, it, expect } from "vitest";
import { buildSystemPrompt } from "@/server/agent/prompts";
import type { Tenant, Department } from "@/server/db/schema";

const tenant: Tenant = {
  id: "t1",
  name: "City of Testville",
  slug: "city-of-testville",
  apiKey: "key-123",
  websiteDomain: "testville.gov",
  searchDomains: [],
  logoPath: null,
  isActive: true,
  dailyRequestQuota: null,
  llmApiKey: null,
  widgetSettings: null,
  location: null,
  latitude: null,
  longitude: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const dept: Department = {
  id: "d1",
  tenantId: "t1",
  name: "Public Works",
  phone: "555-555-5555",
  email: "pw@testville.gov",
  keywords: "roads,water,trash",
  location: { street: "100 Main St", city: "Testville", state: "TX", zipcode: "78000" },
  hours: "Mon–Fri: 8 AM–5 PM",
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("buildSystemPrompt", () => {
  it("includes city name and domain", () => {
    const prompt = buildSystemPrompt(tenant, []);
    expect(prompt).toContain("City of Testville");
    expect(prompt).toContain("testville.gov");
  });

  it("includes no department section when no departments", () => {
    const prompt = buildSystemPrompt(tenant, []);
    expect(prompt).not.toContain("Department Routing");
  });

  it("includes department routing when departments provided", () => {
    const prompt = buildSystemPrompt(tenant, [dept]);
    expect(prompt).toContain("Department Routing");
    expect(prompt).toContain("Public Works");
    expect(prompt).toContain("roads");
    expect(prompt).toContain("555-555-5555");
    expect(prompt).toContain("pw@testville.gov");
    expect(prompt).toContain("Mon–Fri: 8 AM–5 PM");
  });

  it("formats address from location object", () => {
    const prompt = buildSystemPrompt(tenant, [dept]);
    expect(prompt).toContain("100 Main St");
    expect(prompt).toContain("Testville");
  });
});
