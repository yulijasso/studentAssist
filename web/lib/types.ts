export interface Message {
  id: string;
  role: "user" | "assistant" | "disclaimer";
  content: string;
  metadata?: { disclaimerReason?: string } | null;
  intent?: string;
  department?: string;
  confidence?: number;
  sources?: { file: string; page?: number }[];
  webSources?: { title: string; url: string }[] | null;
  /** Detected language of this message — "en" | "es" | "mixed" | null (not yet classified). */
  language?: "en" | "es" | "mixed" | null;
  timestamp: string;
}

export interface InternalNote {
  id: string;
  content: string;
  authorId: string;
  authorName: string;
  timestamp: string;
}

export interface RoutedDepartment {
  departmentId: string;
  departmentName: string;
  reason: string | null;
  detectedAt: string;
  triggerMessageId: string | null;
}

export interface Conversation {
  id: string;
  sessionId: string;
  status: "new" | "open" | "resolved" | "escalated" | "auto-resolved";
  department?: string;
  routedDepartments?: RoutedDepartment[];
  intent?: string;
  priority?: "low" | "normal" | "high" | "urgent";
  assignedTo?: string;
  wasEscalated?: boolean;
  slaStatus?: "ok" | "warning" | "breached";
  slaRemainingMs?: number | null;
  notes?: InternalNote[];
  messages: Message[];
  startedAt: string;
  updatedAt: string;
  escalationContact?: { name: string; phone: string; email?: string } | null;
}

export interface Macro {
  id: string;
  title: string;
  content: string;
}

export const DEPARTMENTS = [
  "Public Works",
  "Building Services",
  "Parks & Recreation",
  "Code Enforcement",
  "Utilities",
  "City Clerk",
] as const;

export const INTENT_LABELS: Record<string, string> = {
  information_request: "Info Request",
  process_guidance: "Process Guidance",
  complaint_report: "Complaint",
  emergency: "Emergency",
  out_of_scope: "Out of Scope",
};

export type Department = (typeof DEPARTMENTS)[number];

export interface DepartmentMember {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

export interface DepartmentConfig {
  id: string;
  name: string;
  contactEmail: string;
  contactPhone: string;
  keywords: string[];
  escalationEnabled: boolean;
  members?: DepartmentMember[];
}
