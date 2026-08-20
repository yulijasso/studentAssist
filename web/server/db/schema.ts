/**
 * Drizzle ORM schema for Campus Assist.
 *
 * Defines all tables, relations, and inferred TypeScript types for the
 * multi-tenant university support chatbot platform.
 */
import {
  boolean,
  doublePrecision,
  integer,
  json,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ── Timestamps mixin (applied manually per table) ─────────────────────────────

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
};

// ── Tenants ───────────────────────────────────────────────────────────────────

export const tenants = pgTable("tenants", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  apiKey: varchar("api_key", { length: 255 }).notNull().unique(),
  websiteDomain: varchar("website_domain", { length: 255 }).notNull(),
  searchDomains: json("search_domains").$type<string[]>().notNull().default([]),
  logoPath: varchar("logo_path", { length: 500 }),
  isActive: boolean("is_active").notNull().default(true),
  dailyRequestQuota: integer("daily_request_quota"),
  llmApiKey: varchar("llm_api_key", { length: 500 }),
  location: varchar("location", { length: 255 }),
  latitude: doublePrecision("latitude"),
  longitude: doublePrecision("longitude"),
  widgetSettings: json("widget_settings").$type<{
    cityName?: string;
    /** Display name for the AI assistant (e.g. "UTRGV Campus Assist"). Defaults to tenant name. */
    assistantName?: string;
    primaryColor?: string;
    welcomeMessage?: string;
    logoUrl?: string;
    autoOpen?: boolean;
    position?: string; // "bottom-right" | "bottom-left" | "top-right" | "top-left"
    slaFirstResponseHours?: number;   // default 24
    slaResolutionHours?: number;      // default 72
    slaExcludeWeekends?: boolean;     // default true
    slaBusinessHoursStart?: number;   // e.g. 8 (8 AM), null = 24/7
    slaBusinessHoursEnd?: number;     // e.g. 17 (5 PM), null = 24/7
  }>(),
  ...timestamps,
});

// ── Departments ───────────────────────────────────────────────────────────────

export const departments = pgTable("departments", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 50 }),
  email: varchar("email", { length: 255 }),
  keywords: text("keywords"),
  location: json("location").$type<{
    street?: string;
    city?: string;
    state?: string;
    zipcode?: string;
    country?: string;
  }>(),
  hours: text("hours"),
  ...timestamps,
});

// ── Documents (Knowledge Base) ────────────────────────────────────────────────

export const documents = pgTable("documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  departmentId: uuid("department_id").references(() => departments.id, {
    onDelete: "set null",
  }),
  name: varchar("name", { length: 500 }).notNull(),
  savedAs: varchar("saved_as", { length: 500 }).notNull(),
  type: varchar("type", { length: 10 }).notNull(), // "pdf" | "txt"
  size: integer("size").notNull(), // bytes
  status: varchar("status", { length: 20 }).notNull().default("processing"), // "processing" | "ingested" | "failed"
  textContent: text("text_content"),
  ...timestamps,
});

// ── FAQs (Knowledge Base) ────────────────────────────────────────────────────

export const faqs = pgTable("faqs", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  departmentId: uuid("department_id").references(() => departments.id, {
    onDelete: "set null",
  }),
  question: text("question").notNull(),
  answer: text("answer").notNull(),
  ...timestamps,
});

// ── Conversations ─────────────────────────────────────────────────────────────

export const conversations = pgTable("conversations", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  sessionId: varchar("session_id", { length: 255 }).notNull(),
  status: varchar("status", { length: 20 }).notNull().default("new"), // new | open | resolved | escalated | auto-resolved
  priority: varchar("priority", { length: 20 }).notNull().default("normal"), // low | normal | high | urgent
  departmentId: uuid("department_id").references(() => departments.id, {
    onDelete: "set null",
  }),
  intent: varchar("intent", { length: 100 }),
  assignedTo: varchar("assigned_to", { length: 255 }),
  wasEscalated: boolean("was_escalated").notNull().default(false),
  // SLA tracking timestamps
  firstResponseAt: timestamp("first_response_at", { withTimezone: true }),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  escalatedAt: timestamp("escalated_at", { withTimezone: true }),
  autoResolvedAt: timestamp("auto_resolved_at", { withTimezone: true }),
  // Escalation contact info — collected when user requests department callback
  escalationContact: json("escalation_contact").$type<{
    name: string;
    phone: string;
    email?: string;
  }>(),
  ...timestamps,
});

// ── Messages ──────────────────────────────────────────────────────────────────

export const messages = pgTable("messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  conversationId: uuid("conversation_id")
    .notNull()
    .references(() => conversations.id, { onDelete: "cascade" }),
  role: varchar("role", { length: 20 }).notNull(), // "user" | "assistant"
  content: text("content").notNull(),
  // Detected language of this conversational turn — "en" | "es" | "mixed" | null
  // (null = not yet classified, e.g. disclaimer rows or pre-migration history).
  // Populated by the escalation classifier's language field; see routing.ts.
  language: varchar("language", { length: 10 }),
  // Web source links returned by the search tool — only set on assistant messages
  sources: json("sources").$type<{ title: string; url: string }[]>(),
  // Arbitrary structured metadata — used by disclaimer events to store the LLM's
  // classifier reason for legal audit purposes.
  metadata: jsonb("metadata").$type<{ disclaimerReason?: string; [key: string]: unknown }>(),
  ...timestamps,
});

// ── Conversation Departments (junction table) ─────────────────────────────────

/**
 * Junction table linking conversations to one or more departments.
 *
 * Populated automatically by the LLM routing layer after each assistant response.
 * A conversation may belong to multiple departments (e.g. pothole → Public Works,
 * fire risk → Fire Department). The unique constraint prevents duplicate entries.
 */
export const conversationDepartments = pgTable(
  "conversation_departments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    departmentId: uuid("department_id")
      .notNull()
      .references(() => departments.id, { onDelete: "cascade" }),
    detectedAt: timestamp("detected_at", { withTimezone: true }).defaultNow().notNull(),
    triggerMessageId: uuid("trigger_message_id").references(() => messages.id, {
      onDelete: "set null",
    }),
    reason: text("reason"),
  },
  (table) => ({
    uniq: unique().on(table.conversationId, table.departmentId),
  }),
);

// ── Internal Notes ────────────────────────────────────────────────────────────

export const internalNotes = pgTable("internal_notes", {
  id: uuid("id").primaryKey().defaultRandom(),
  conversationId: uuid("conversation_id")
    .notNull()
    .references(() => conversations.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  authorId: varchar("author_id", { length: 255 }).notNull(),
  authorName: varchar("author_name", { length: 255 }).notNull(),
  ...timestamps,
});

// ── Macros ────────────────────────────────────────────────────────────────────

export const macros = pgTable("macros", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 255 }).notNull(),
  content: text("content").notNull(),
  ...timestamps,
});

// ── Users (internal registry, linked to Clerk) ──────────────────────────────

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  clerkId: text("clerk_id").notNull().unique(),
  email: text("email").notNull(),
  name: text("name"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ── Roles ────────────────────────────────────────────────────────────────────

export const roles = pgTable("roles", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  permissions: json("permissions").$type<string[]>().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ── Tenant Memberships ───────────────────────────────────────────────────────

export const tenantMemberships = pgTable("tenant_memberships", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }),
  roleId: uuid("role_id")
    .notNull()
    .references(() => roles.id),
  departmentId: uuid("department_id").references(() => departments.id, { onDelete: "set null" }),
  invitedBy: uuid("invited_by").references(() => users.id),
  joinedAt: timestamp("joined_at", { withTimezone: true }),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ── Invitations ──────────────────────────────────────────────────────────────

export const invitations = pgTable("invitations", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull(),
  tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }),
  roleId: uuid("role_id")
    .notNull()
    .references(() => roles.id),
  departmentId: uuid("department_id").references(() => departments.id, { onDelete: "set null" }),
  token: text("token").notNull().unique(),
  invitedBy: uuid("invited_by").references(() => users.id),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ── Relations ─────────────────────────────────────────────────────────────────

export const tenantsRelations = relations(tenants, ({ many }) => ({
  departments: many(departments),
  documents: many(documents),
  faqs: many(faqs),
  conversations: many(conversations),
  macros: many(macros),
  memberships: many(tenantMemberships),
  roles: many(roles),
  invitations: many(invitations),
}));

export const departmentsRelations = relations(departments, ({ one, many }) => ({
  tenant: one(tenants, { fields: [departments.tenantId], references: [tenants.id] }),
  documents: many(documents),
  faqs: many(faqs),
}));

export const documentsRelations = relations(documents, ({ one }) => ({
  tenant: one(tenants, { fields: [documents.tenantId], references: [tenants.id] }),
  department: one(departments, { fields: [documents.departmentId], references: [departments.id] }),
}));

export const faqsRelations = relations(faqs, ({ one }) => ({
  tenant: one(tenants, { fields: [faqs.tenantId], references: [tenants.id] }),
  department: one(departments, { fields: [faqs.departmentId], references: [departments.id] }),
}));

export const conversationsRelations = relations(conversations, ({ one, many }) => ({
  tenant: one(tenants, { fields: [conversations.tenantId], references: [tenants.id] }),
  department: one(departments, { fields: [conversations.departmentId], references: [departments.id] }),
  messages: many(messages),
  notes: many(internalNotes),
  conversationDepartments: many(conversationDepartments),
}));

export const conversationDepartmentsRelations = relations(conversationDepartments, ({ one }) => ({
  conversation: one(conversations, {
    fields: [conversationDepartments.conversationId],
    references: [conversations.id],
  }),
  department: one(departments, {
    fields: [conversationDepartments.departmentId],
    references: [departments.id],
  }),
}));

export const internalNotesRelations = relations(internalNotes, ({ one }) => ({
  conversation: one(conversations, {
    fields: [internalNotes.conversationId],
    references: [conversations.id],
  }),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  conversation: one(conversations, {
    fields: [messages.conversationId],
    references: [conversations.id],
  }),
}));

export const macrosRelations = relations(macros, ({ one }) => ({
  tenant: one(tenants, { fields: [macros.tenantId], references: [tenants.id] }),
}));

export const usersRelations = relations(users, ({ many }) => ({
  memberships: many(tenantMemberships),
}));

export const rolesRelations = relations(roles, ({ one, many }) => ({
  tenant: one(tenants, { fields: [roles.tenantId], references: [tenants.id] }),
  memberships: many(tenantMemberships),
}));

export const tenantMembershipsRelations = relations(tenantMemberships, ({ one }) => ({
  user: one(users, { fields: [tenantMemberships.userId], references: [users.id] }),
  tenant: one(tenants, { fields: [tenantMemberships.tenantId], references: [tenants.id] }),
  role: one(roles, { fields: [tenantMemberships.roleId], references: [roles.id] }),
}));

export const invitationsRelations = relations(invitations, ({ one }) => ({
  tenant: one(tenants, { fields: [invitations.tenantId], references: [tenants.id] }),
  role: one(roles, { fields: [invitations.roleId], references: [roles.id] }),
}));

// ── Inferred types ────────────────────────────────────────────────────────────

export type Tenant = typeof tenants.$inferSelect;
export type NewTenant = typeof tenants.$inferInsert;
export type Department = typeof departments.$inferSelect;
export type NewDepartment = typeof departments.$inferInsert;
export type Document = typeof documents.$inferSelect;
export type NewDocument = typeof documents.$inferInsert;
export type FAQ = typeof faqs.$inferSelect;
export type NewFAQ = typeof faqs.$inferInsert;
export type Conversation = typeof conversations.$inferSelect;
export type NewConversation = typeof conversations.$inferInsert;
export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
export type InternalNote = typeof internalNotes.$inferSelect;
export type NewInternalNote = typeof internalNotes.$inferInsert;
export type MacroRow = typeof macros.$inferSelect;
export type NewMacro = typeof macros.$inferInsert;
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Role = typeof roles.$inferSelect;
export type NewRole = typeof roles.$inferInsert;
export type TenantMembership = typeof tenantMemberships.$inferSelect;
export type NewTenantMembership = typeof tenantMemberships.$inferInsert;
export type Invitation = typeof invitations.$inferSelect;
export type NewInvitation = typeof invitations.$inferInsert;
export type ConversationDepartment = typeof conversationDepartments.$inferSelect;
export type NewConversationDepartment = typeof conversationDepartments.$inferInsert;

// ── Audit log ────────────────────────────────────────────────────────────────
// Immutable record of governance actions (create/suspend/delete institution,
// role changes, member removal, user lifecycle). Actor and target are
// denormalized (labels stored at write time) so entries survive later deletions.
export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  action: varchar("action", { length: 64 }).notNull(),
  actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
  actorLabel: varchar("actor_label", { length: 255 }),
  targetType: varchar("target_type", { length: 32 }).notNull(),
  targetId: varchar("target_id", { length: 255 }),
  targetLabel: varchar("target_label", { length: 255 }),
  tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "set null" }),
  // "platform" = tech-admin action, "tenant" = institution-admin action.
  scope: varchar("scope", { length: 16 }),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;
