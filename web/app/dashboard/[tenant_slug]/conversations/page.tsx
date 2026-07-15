"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Flex,
  IconButton,
  Icon,
  Spinner,
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverBody,
  VStack,
  HStack,
  Text,
  Input,
  Switch,
  Select,
  FormControl,
  FormLabel,
} from "@chakra-ui/react";
import { FiDownload, FiSettings } from "react-icons/fi";
import { useUser } from "@clerk/nextjs";
import { trpc } from "@/lib/trpc";
import { useTenant } from "@/lib/use-tenant";
import { useRole } from "@/lib/use-role";
import { Conversation, InternalNote, Message } from "@/lib/types";
import { useDepartments } from "@/lib/department-store";
import TicketSidebar, { ViewFilter } from "@/components/TicketSidebar";
import TicketTable from "@/components/TicketTable";
import TicketDetailPanel from "@/components/TicketDetailPanel";

export default function ConversationsPage() {
  const { tenantId, slug } = useTenant();
  const { user } = useUser();
  const myName = [user?.firstName, user?.lastName].filter(Boolean).join(" ");
  const { canEdit, canAssign, canAdmin, isStaff, isMember, departmentId: userDepartmentId } = useRole();

  // Fetch conversations from DB
  const convsQuery = trpc.conversationsAdmin.list.useQuery(
    { tenantId: tenantId! },
    { enabled: !!tenantId, refetchInterval: 10000 },
  );
  const dataFetchedAt = convsQuery.dataUpdatedAt || Date.now();
  const utils = trpc.useUtils();

  const updateMut = trpc.conversationsAdmin.update.useMutation({
    onSuccess: () => utils.conversationsAdmin.list.invalidate(),
  });
  const addNoteMut = trpc.conversationsAdmin.addNote.useMutation({
    onSuccess: () => utils.conversationsAdmin.list.invalidate(),
  });

  // SLA settings
  const settingsQuery = trpc.settings.get.useQuery(
    { tenantId: tenantId! },
    { enabled: !!tenantId },
  );
  const slaSettings = settingsQuery.data?.widgetSettings ?? {};
  const updateSettingsMut = trpc.settings.update.useMutation({
    onSuccess: () => {
      utils.settings.get.invalidate();
      utils.conversationsAdmin.list.invalidate();
      utils.conversationsAdmin.stats.invalidate();
    },
  });
  const updateSla = (patch: Record<string, unknown>) => {
    if (!tenantId) return;
    updateSettingsMut.mutate({ tenantId, widgetSettings: patch as Parameters<typeof updateSettingsMut.mutate>[0]["widgetSettings"] });
  };

  // Local state for SLA number inputs (save on blur, not on every keystroke)
  const serverFirstResponse = (slaSettings as Record<string, unknown>).slaFirstResponseHours as number ?? 24;
  const serverResolution = (slaSettings as Record<string, unknown>).slaResolutionHours as number ?? 72;
  const [localFirstResponse, setLocalFirstResponse] = useState(String(serverFirstResponse));
  const [localResolution, setLocalResolution] = useState(String(serverResolution));
  useEffect(() => { setLocalFirstResponse(String(serverFirstResponse)); }, [serverFirstResponse]);
  useEffect(() => { setLocalResolution(String(serverResolution)); }, [serverResolution]);
  // Map DB data to the Conversation type the components expect
  const conversations: Conversation[] = useMemo(() => {
    if (!convsQuery.data) return [];
    return convsQuery.data.map((c) => ({
      id: c.id,
      sessionId: c.sessionId,
      status: c.status as Conversation["status"],
      department: c.departmentName ?? undefined,
      routedDepartments: c.routedDepartments?.map((rd) => ({
        departmentId: rd.departmentId,
        departmentName: rd.departmentName,
        reason: rd.reason,
        detectedAt: rd.detectedAt,
        triggerMessageId: rd.triggerMessageId ?? null,
      })),
      intent: c.intent ?? undefined,
      priority: (c.priority ?? "normal") as Conversation["priority"],
      assignedTo: c.assignedTo ?? undefined,
      wasEscalated: c.wasEscalated,
      slaStatus: c.slaStatus as Conversation["slaStatus"],
      slaRemainingMs: c.slaRemainingMs ?? null,
      escalationContact: (c.escalationContact as Conversation["escalationContact"]) ?? null,
      notes: c.notes as InternalNote[],
      messages: c.messages as Message[],
      startedAt: c.createdAt.toISOString?.() ?? String(c.createdAt),
      updatedAt: c.updatedAt.toISOString?.() ?? String(c.updatedAt),
    }));
  }, [convsQuery.data]);

  // For staff: look up their department name to filter conversations
  const { departments } = useDepartments(tenantId);
  const userDepartmentName = useMemo(() => {
    if (!isStaff || !userDepartmentId) return null;
    return departments.find((d) => d.id === userDepartmentId)?.name ?? null;
  }, [isStaff, userDepartmentId, departments]);

  // Staff only sees their department's tickets
  const visibleConversations = useMemo(() => {
    if (!isStaff || !userDepartmentName) return conversations;
    return conversations.filter((c) => c.department === userDepartmentName);
  }, [conversations, isStaff, userDepartmentName]);

  const [activeView, setActiveView] = useState<ViewFilter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [recentlyViewed, setRecentlyViewed] = useState<{ id: string; viewedAt: number }[]>([]);

  const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
  const recentlyViewedIds = useMemo(() => {
    const now = Date.now();
    return recentlyViewed
      .filter((rv) => now - rv.viewedAt < TWENTY_FOUR_HOURS)
      .map((rv) => rv.id);
  }, [recentlyViewed]);

  const handleSelectTicket = useCallback((id: string) => {
    setSelectedId(id);
    setRecentlyViewed((prev) => {
      const now = Date.now();
      const filtered = prev.filter((rv) => rv.id !== id && now - rv.viewedAt < TWENTY_FOUR_HOURS);
      return [{ id, viewedAt: now }, ...filtered];
    });
  }, []);

  const filtered = useMemo(() => {
    const sorted = [...visibleConversations].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );

    if (activeView === "all") return sorted;
    if (activeView === "view:mine") {
      return myName ? sorted.filter((c) => c.assignedTo === myName) : [];
    }
    if (activeView === "view:recent") {
      const idSet = new Set(recentlyViewedIds);
      return sorted.filter((c) => idSet.has(c.id));
    }
    if (activeView === "view:breached") {
      return sorted.filter((c) => c.status !== "resolved" && c.slaStatus === "breached");
    }
    if (["new", "open", "escalated", "resolved", "auto-resolved"].includes(activeView)) {
      return sorted.filter((c) => c.status === activeView);
    }
    if (activeView === "dept:unassigned") {
      return sorted.filter((c) => !c.department);
    }
    if (activeView.startsWith("dept:")) {
      const deptName = activeView.slice(5);
      return sorted.filter(
        (c) =>
          c.department === deptName ||
          c.routedDepartments?.some((rd) => rd.departmentName === deptName),
      );
    }
    return sorted;
  }, [visibleConversations, activeView, myName, recentlyViewedIds]);

  const selectedConversation = selectedId
    ? visibleConversations.find((c) => c.id === selectedId) || null
    : null;

  const handleStatusChange = useCallback(
    (id: string, status: string) => {
      if (!tenantId) return;
      const updates: Record<string, unknown> = {
        status: status as "new" | "open" | "resolved" | "escalated",
      };
      if (status === "escalated") updates.wasEscalated = true;
      updateMut.mutate({
        tenantId,
        conversationId: id,
        ...updates,
      } as Parameters<typeof updateMut.mutate>[0]);
    },
    [tenantId, updateMut],
  );

  const handleDepartmentChange = useCallback(
    (id: string, department: string) => {
      if (!tenantId) return;
      updateMut.mutate({
        tenantId,
        conversationId: id,
        departmentId: department || null,
      });
    },
    [tenantId, updateMut],
  );

  const handlePriorityChange = useCallback(
    (id: string, priority: string) => {
      if (!tenantId) return;
      updateMut.mutate({
        tenantId,
        conversationId: id,
        priority: priority as "low" | "normal" | "high" | "urgent",
      });
    },
    [tenantId, updateMut],
  );

  const handleAssigneeChange = useCallback(
    (id: string, assignee: string) => {
      if (!tenantId) return;
      updateMut.mutate({
        tenantId,
        conversationId: id,
        assignedTo: assignee || null,
      });
    },
    [tenantId, updateMut],
  );

  const handleAddNote = useCallback(
    (id: string, note: InternalNote) => {
      if (!tenantId) return;
      addNoteMut.mutate({
        tenantId,
        conversationId: id,
        content: note.content,
        authorId: note.authorId,
        authorName: note.authorName,
      });
    },
    [tenantId, addNoteMut],
  );

  const handleBulkStatusChange = useCallback(
    (ids: string[], status: string) => {
      if (!tenantId) return;
      for (const id of ids) {
        updateMut.mutate({
          tenantId,
          conversationId: id,
          status: status as "new" | "open" | "resolved" | "escalated",
          ...(status === "escalated" ? { wasEscalated: true } : {}),
        });
      }
      setSelectedIds([]);
    },
    [tenantId, updateMut],
  );

  const handleBulkPriorityChange = useCallback(
    (ids: string[], priority: string) => {
      if (!tenantId) return;
      for (const id of ids) {
        updateMut.mutate({
          tenantId,
          conversationId: id,
          priority: priority as "low" | "normal" | "high" | "urgent",
        });
      }
      setSelectedIds([]);
    },
    [tenantId, updateMut],
  );

  const handleExportCSV = useCallback(() => {
    const rows = filtered.map((c) => {
      const subject = c.messages.find((m) => m.role === "user")?.content || "No subject";
      return [
        c.id,
        c.status,
        c.priority || "normal",
        c.department || "Unassigned",
        c.intent || "",
        `"${subject.replace(/"/g, '""')}"`,
        c.messages.length,
        c.startedAt,
        c.updatedAt,
      ].join(",");
    });
    const csv = [
      "ID,Status,Priority,Department,Intent,Subject,Messages,Created,Updated",
      ...rows,
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `conversations-${slug}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [filtered, slug]);

  if (!tenantId) {
    return (
      <Flex minH="200px" align="center" justify="center">
        <Spinner color="blue.500" />
      </Flex>
    );
  }

  return (
    <Flex h="100vh" overflow="hidden">
      <TicketSidebar
        conversations={visibleConversations}
        activeView={activeView}
        recentlyViewedIds={recentlyViewedIds}
        onViewChange={setActiveView}
        tenantId={tenantId}
        isStaff={isStaff}
      />
      {selectedConversation ? (
        <TicketDetailPanel
          conversation={selectedConversation}
          onBack={() => setSelectedId(null)}
          onStatusChange={handleStatusChange}
          onDepartmentChange={handleDepartmentChange}
          onPriorityChange={handlePriorityChange}
          onAssigneeChange={handleAssigneeChange}
          onAddNote={handleAddNote}
          tenantId={tenantId}
          readOnly={isMember}
          canAssign={canAssign}
        />
      ) : (
        <Flex flex={1} direction="column" overflow="hidden">
          <Flex
            px={4}
            py={1.5}
            borderBottom="1px solid"
            borderColor="gray.100"
            justify="flex-end"
            gap={1}
            bg="white"
          >
            {(canAdmin || canAssign) && <Popover placement="bottom-end">
              <PopoverTrigger>
                <IconButton
                  aria-label="SLA Settings"
                  icon={<Icon as={FiSettings} />}
                  size="xs"
                  variant="ghost"
                  color="gray.500"
                />
              </PopoverTrigger>
              <PopoverContent w="300px">
                <PopoverBody p={4}>
                  <Text fontSize="xs" fontWeight="600" color="gray.600" mb={3}>
                    SLA Configuration
                  </Text>
                  <VStack spacing={3} align="stretch">
                    <HStack justify="space-between">
                      <Text fontSize="xs" color="gray.600">First Response</Text>
                      <HStack spacing={1}>
                        <Input
                          size="xs"
                          type="number"
                          min={1}
                          max={720}
                          value={localFirstResponse}
                          onChange={(e) => setLocalFirstResponse(e.target.value)}
                          onBlur={() => {
                            const v = Math.max(1, Math.min(720, Number(localFirstResponse) || 24));
                            setLocalFirstResponse(String(v));
                            updateSla({ slaFirstResponseHours: v });
                          }}
                          onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                          w="60px"
                          textAlign="center"
                        />
                        <Text fontSize="xs" color="gray.400">hrs</Text>
                      </HStack>
                    </HStack>
                    <HStack justify="space-between">
                      <Text fontSize="xs" color="gray.600">Resolution</Text>
                      <HStack spacing={1}>
                        <Input
                          size="xs"
                          type="number"
                          min={1}
                          max={720}
                          value={localResolution}
                          onChange={(e) => setLocalResolution(e.target.value)}
                          onBlur={() => {
                            const v = Math.max(1, Math.min(720, Number(localResolution) || 72));
                            setLocalResolution(String(v));
                            updateSla({ slaResolutionHours: v });
                          }}
                          onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                          w="60px"
                          textAlign="center"
                        />
                        <Text fontSize="xs" color="gray.400">hrs</Text>
                      </HStack>
                    </HStack>
                    <FormControl display="flex" alignItems="center" justifyContent="space-between">
                      <FormLabel fontSize="xs" color="gray.600" mb={0}>
                        Exclude weekends
                      </FormLabel>
                      <Switch
                        size="sm"
                        isChecked={((slaSettings as Record<string, unknown>).slaExcludeWeekends as boolean) ?? true}
                        onChange={() => updateSla({ slaExcludeWeekends: !((slaSettings as Record<string, unknown>).slaExcludeWeekends as boolean ?? true) })}
                      />
                    </FormControl>
                    <Text fontSize="10px" fontWeight="600" color="gray.400" textTransform="uppercase" letterSpacing="wider" pt={1}>
                      Business Hours
                    </Text>
                    <HStack justify="space-between">
                      <Text fontSize="xs" color="gray.600">Start</Text>
                      <Select
                        size="xs"
                        w="120px"
                        value={(slaSettings as Record<string, unknown>).slaBusinessHoursStart as number ?? ""}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (v === "") {
                            updateSla({ slaBusinessHoursStart: undefined, slaBusinessHoursEnd: undefined });
                          } else {
                            updateSla({ slaBusinessHoursStart: Number(v) });
                          }
                        }}
                      >
                        <option value="">24/7</option>
                        {Array.from({ length: 24 }, (_, i) => (
                          <option key={i} value={i}>
                            {i === 0 ? "12 AM" : i < 12 ? `${i} AM` : i === 12 ? "12 PM" : `${i - 12} PM`}
                          </option>
                        ))}
                      </Select>
                    </HStack>
                    <HStack justify="space-between">
                      <Text fontSize="xs" color="gray.600">End</Text>
                      <Select
                        size="xs"
                        w="120px"
                        value={(slaSettings as Record<string, unknown>).slaBusinessHoursEnd as number ?? ""}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (v === "") {
                            updateSla({ slaBusinessHoursStart: undefined, slaBusinessHoursEnd: undefined });
                          } else {
                            updateSla({ slaBusinessHoursEnd: Number(v) });
                          }
                        }}
                      >
                        <option value="">24/7</option>
                        {Array.from({ length: 24 }, (_, i) => (
                          <option key={i} value={i}>
                            {i === 0 ? "12 AM" : i < 12 ? `${i} AM` : i === 12 ? "12 PM" : `${i - 12} PM`}
                          </option>
                        ))}
                      </Select>
                    </HStack>
                  </VStack>
                </PopoverBody>
              </PopoverContent>
            </Popover>}
            {canAssign && <IconButton
              aria-label="Export CSV"
              icon={<Icon as={FiDownload} />}
              size="xs"
              variant="ghost"
              color="gray.500"
              onClick={handleExportCSV}
            />}
          </Flex>
          <TicketTable
            conversations={filtered}
            selectedId={selectedId}
            currentPage={currentPage}
            searchQuery={searchQuery}
            selectedIds={selectedIds}
            fetchedAt={dataFetchedAt}
            onPageChange={setCurrentPage}
            onSelect={handleSelectTicket}
            onSearchChange={setSearchQuery}
            onSelectionChange={setSelectedIds}
            onBulkStatusChange={handleBulkStatusChange}
            onBulkPriorityChange={handleBulkPriorityChange}
            readOnly={isMember}
          />
        </Flex>
      )}
    </Flex>
  );
}
