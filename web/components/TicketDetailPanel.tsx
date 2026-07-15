"use client";

import { useState } from "react";
import {
  Box,
  Flex,
  HStack,
  VStack,
  Text,
  Badge,
  Icon,
  IconButton,
  Select,
  Divider,
  Input,
  Button,
  Textarea,
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverBody,
} from "@chakra-ui/react";
import {
  FiArrowLeft,
  FiClock,
  FiUser,
  FiHash,
  FiZap,
  FiMessageSquare,
  FiPlus,
  FiTrash2,
} from "react-icons/fi";
import { Conversation, INTENT_LABELS, InternalNote, RoutedDepartment } from "@/lib/types";
import { useDepartments } from "@/lib/department-store";
import { useMacros } from "@/lib/macro-store";
import ConversationThread from "./ConversationThread";

const STATUS_OPTIONS: { value: Conversation["status"]; label: string; color: string }[] = [
  { value: "open", label: "Open", color: "green" },
  { value: "escalated", label: "Escalated", color: "red" },
  { value: "resolved", label: "Solved", color: "gray" },
];

const STATUS_BADGE_COLOR: Record<string, string> = {
  new: "orange",
  open: "green",
  escalated: "red",
  resolved: "gray",
  "auto-resolved": "teal",
};

const STATUS_LABEL: Record<string, string> = {
  new: "New",
  open: "Open",
  escalated: "Escalated",
  resolved: "Solved",
  "auto-resolved": "Auto-Resolved",
};

const PRIORITY_OPTIONS: { value: string; label: string; color: string }[] = [
  { value: "urgent", label: "Urgent", color: "red" },
  { value: "high", label: "High", color: "orange" },
  { value: "normal", label: "Normal", color: "blue" },
  { value: "low", label: "Low", color: "gray" },
];

interface Props {
  conversation: Conversation;
  onBack: () => void;
  onStatusChange: (id: string, status: Conversation["status"]) => void;
  onDepartmentChange: (id: string, department: string) => void;
  onPriorityChange: (id: string, priority: string) => void;
  onAssigneeChange: (id: string, assignee: string) => void;
  onAddNote: (id: string, note: InternalNote) => void;
  tenantId: string | null;
  /** When true, all editing controls are hidden (member role). */
  readOnly?: boolean;
  /** When true, assignee and department fields are shown (supervisor+). */
  canAssign?: boolean;
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <Text fontSize="11px" fontWeight="600" color="gray.500" textTransform="uppercase" letterSpacing="wider">
      {children}
    </Text>
  );
}

export default function TicketDetailPanel({
  conversation,
  onBack,
  onStatusChange,
  onDepartmentChange,
  onPriorityChange,
  onAssigneeChange,
  onAddNote,
  tenantId,
  readOnly = false,
  canAssign = true,
}: Props) {
  const { departments } = useDepartments(tenantId);
  const { macros, addMacro, removeMacro } = useMacros(tenantId);
  const statusCfg = STATUS_OPTIONS.find((s) => s.value === conversation.status);
  const isAutoResolved = conversation.status === "auto-resolved";
  const effectiveReadOnly = readOnly || isAutoResolved;

  // Departments for dropdown

  const [noteText, setNoteText] = useState("");
  const [showNotes, setShowNotes] = useState(false);
  const [showMacroManager, setShowMacroManager] = useState(false);
  const [newMacroTitle, setNewMacroTitle] = useState("");
  const [newMacroContent, setNewMacroContent] = useState("");

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" }) +
      " " +
      d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const handleAddNote = () => {
    if (!noteText.trim()) return;
    const note: InternalNote = {
      id: `note-${Date.now()}`,
      content: noteText.trim(),
      authorId: "admin",
      authorName: "Admin",
      timestamp: new Date().toISOString(),
    };
    onAddNote(conversation.id, note);
    setNoteText("");
  };

  const handleAddMacro = () => {
    if (!newMacroTitle.trim() || !newMacroContent.trim()) return;
    addMacro(newMacroTitle.trim(), newMacroContent.trim());
    setNewMacroTitle("");
    setNewMacroContent("");
    setShowMacroManager(false);
  };

  const notes = conversation.notes || [];

  return (
    <Flex flex={1} overflow="hidden">
      {/* Left Properties Sidebar */}
      <Box
        w="220px"
        bg="white"
        borderRight="1px solid"
        borderColor="gray.200"
        flexShrink={0}
        overflowY="auto"
        py={4}
      >
        <HStack px={4} mb={4} spacing={2}>
          <IconButton
            aria-label="Back to list"
            icon={<Icon as={FiArrowLeft} />}
            size="xs"
            variant="ghost"
            onClick={onBack}
          />
          <Text fontWeight="600" fontSize="xs" color="gray.500">
            Ticket #{conversation.id.split("-").pop()}
          </Text>
        </HStack>

        <VStack spacing={4} align="stretch" px={4}>
          {/* Status */}
          <Box>
            <FieldLabel>Status</FieldLabel>
            {conversation.status === "auto-resolved" ? (
              <Badge
                mt={1}
                fontSize="11px"
                colorScheme="teal"
                variant="subtle"
                display="block"
                w="fit-content"
              >
                Auto-Resolved
              </Badge>
            ) : effectiveReadOnly ? (
              <Badge mt={1} fontSize="11px" colorScheme={statusCfg?.color || "gray"} variant="subtle">
                {statusCfg?.label || conversation.status}
              </Badge>
            ) : (
              <Select
                size="xs"
                mt={1}
                value={conversation.status}
                onChange={(e) => onStatusChange(conversation.id, e.target.value as Conversation["status"])}
                bg="gray.50"
                borderColor="gray.200"
                fontSize="12px"
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </Select>
            )}
          </Box>

          {/* Department */}
          <Box>
            <FieldLabel>Department</FieldLabel>
            {effectiveReadOnly || !canAssign ? (
              <Text fontSize="12px" color="gray.700" mt={1}>
                {conversation.department || "Unassigned"}
              </Text>
            ) : (
              <Select
                size="xs"
                mt={1}
                value={departments.find((d) => d.name === conversation.department)?.id || ""}
                onChange={(e) => onDepartmentChange(conversation.id, e.target.value)}
                bg="gray.50"
                borderColor="gray.200"
                fontSize="12px"
                placeholder="Unassigned"
              >
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </Select>
            )}
          </Box>

          {/* Auto-routed departments */}
          {conversation.routedDepartments && conversation.routedDepartments.length > 0 && (
            <Box>
              <FieldLabel>Auto-routed to</FieldLabel>
              <VStack spacing={1} mt={1} align="stretch">
                {(conversation.routedDepartments as RoutedDepartment[]).map((rd) => (
                  <Box
                    key={rd.departmentId}
                    bg="blue.50"
                    border="1px solid"
                    borderColor="blue.100"
                    borderRadius="md"
                    px={2}
                    py={1}
                  >
                    <Text fontSize="11px" fontWeight="600" color="blue.700">
                      {rd.departmentName}
                    </Text>
                    {rd.reason && (
                      <Text fontSize="10px" color="blue.500" mt={0.5}>
                        {rd.reason}
                      </Text>
                    )}
                  </Box>
                ))}
              </VStack>
            </Box>
          )}

          {/* Assignee */}
          <Box>
            <FieldLabel>Assignee</FieldLabel>
            {effectiveReadOnly || !canAssign ? (
              <Text fontSize="12px" color="gray.700" mt={1}>
                {conversation.assignedTo || "Unassigned"}
              </Text>
            ) : (
              <Input
                size="xs"
                mt={1}
                value={conversation.assignedTo || ""}
                onChange={(e) => onAssigneeChange(conversation.id, e.target.value)}
                bg="gray.50"
                borderColor="gray.200"
                fontSize="12px"
                placeholder="Unassigned"
              />
            )}
          </Box>

          {/* Priority */}
          <Box>
            <FieldLabel>Priority</FieldLabel>
            {effectiveReadOnly ? (
              <Badge mt={1} fontSize="11px" colorScheme={PRIORITY_OPTIONS.find((p) => p.value === (conversation.priority || "normal"))?.color || "gray"} variant="subtle">
                {PRIORITY_OPTIONS.find((p) => p.value === (conversation.priority || "normal"))?.label || "Normal"}
              </Badge>
            ) : (
              <Select
                size="xs"
                mt={1}
                value={conversation.priority || "normal"}
                onChange={(e) => onPriorityChange(conversation.id, e.target.value)}
                bg="gray.50"
                borderColor="gray.200"
                fontSize="12px"
              >
                {PRIORITY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </Select>
            )}
          </Box>

          {/* Intent */}
          <Box>
            <FieldLabel>Intent</FieldLabel>
            <Text fontSize="12px" color="gray.700" mt={1}>
              {conversation.intent ? INTENT_LABELS[conversation.intent] || conversation.intent : "—"}
            </Text>
          </Box>

          {/* SLA Status */}
          <Box>
            <FieldLabel>SLA</FieldLabel>
            <Badge
              mt={1}
              fontSize="10px"
              colorScheme={
                conversation.slaStatus === "breached" ? "red" :
                conversation.slaStatus === "warning" ? "yellow" : "green"
              }
              variant="subtle"
            >
              {conversation.slaStatus === "breached" ? "Breached" :
               conversation.slaStatus === "warning" ? "Warning" : "On Track"}
            </Badge>
          </Box>

          {/* Escalation Contact — shown when collected via widget */}
          {conversation.escalationContact && (
            <>
              <Divider />
              <Box>
                <FieldLabel>Escalation Contact</FieldLabel>
                <HStack mt={1} spacing={1.5}>
                  <Text fontSize="12px" color="gray.700">👤 {conversation.escalationContact.name}</Text>
                </HStack>
                <HStack mt={1} spacing={1.5}>
                  <Text fontSize="12px" color="gray.700">📞 {conversation.escalationContact.phone}</Text>
                </HStack>
                {conversation.escalationContact.email && (
                  <HStack mt={1} spacing={1.5}>
                    <Text fontSize="12px" color="gray.700">✉ {conversation.escalationContact.email}</Text>
                  </HStack>
                )}
              </Box>
            </>
          )}

          <Divider />

          {/* Requester */}
          <Box>
            <FieldLabel>Requester</FieldLabel>
            <HStack mt={1} spacing={1.5}>
              <Icon as={FiUser} boxSize={3} color="gray.400" />
              <Text fontSize="12px" color="gray.700">
                {conversation.sessionId || "Anonymous"}
              </Text>
            </HStack>
          </Box>

          {/* Conversation ID */}
          <Box>
            <FieldLabel>Conversation ID</FieldLabel>
            <HStack mt={1} spacing={1.5}>
              <Icon as={FiHash} boxSize={3} color="gray.400" />
              <Text fontSize="11px" color="gray.500" wordBreak="break-all">
                {conversation.id}
              </Text>
            </HStack>
          </Box>

          <Divider />

          {/* Created */}
          <Box>
            <FieldLabel>Created</FieldLabel>
            <HStack mt={1} spacing={1.5}>
              <Icon as={FiClock} boxSize={3} color="gray.400" />
              <Text fontSize="12px" color="gray.600">{formatDate(conversation.startedAt)}</Text>
            </HStack>
          </Box>

          {/* Updated */}
          <Box>
            <FieldLabel>Updated</FieldLabel>
            <HStack mt={1} spacing={1.5}>
              <Icon as={FiClock} boxSize={3} color="gray.400" />
              <Text fontSize="12px" color="gray.600">{formatDate(conversation.updatedAt)}</Text>
            </HStack>
          </Box>

          {/* Messages count */}
          <Box>
            <FieldLabel>Messages</FieldLabel>
            <Text fontSize="12px" color="gray.700" mt={1}>
              {conversation.messages.length}
            </Text>
          </Box>

          <Divider />

          {/* Internal Notes */}
          <Box>
            <HStack justify="space-between" cursor="pointer" onClick={() => setShowNotes(!showNotes)}>
              <HStack spacing={1.5}>
                <FieldLabel>Notes</FieldLabel>
                {notes.length > 0 && (
                  <Badge fontSize="9px" colorScheme="gray" borderRadius="full" px={1.5}>
                    {notes.length}
                  </Badge>
                )}
              </HStack>
              <Text fontSize="10px" color="gray.400">{showNotes ? "Hide" : "Show"}</Text>
            </HStack>

            {showNotes && (
              <VStack spacing={2} mt={2} align="stretch">
                {notes.map((note) => (
                  <Box key={note.id} bg="yellow.50" p={2} borderRadius="md" border="1px solid" borderColor="yellow.200">
                    <Text fontSize="11px" color="gray.700" lineHeight="1.4">{note.content}</Text>
                    <Text fontSize="10px" color="gray.400" mt={1}>
                      {note.authorName} — {new Date(note.timestamp).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </Text>
                  </Box>
                ))}
                {!readOnly && (
                  <>
                    <Textarea
                      size="xs"
                      placeholder="Add a note..."
                      value={noteText}
                      onChange={(e) => setNoteText(e.target.value)}
                      fontSize="11px"
                      rows={2}
                      resize="none"
                    />
                    <HStack spacing={1}>
                      <Button size="xs" colorScheme="yellow" variant="ghost" onClick={handleAddNote} isDisabled={!noteText.trim()} flex={1}>
                        Add Note
                      </Button>
                      {/* Macros for notes */}
                      <Popover placement="top-end">
                        <PopoverTrigger>
                          <IconButton
                            aria-label="Macros"
                            icon={<Icon as={FiZap} boxSize={3} />}
                            size="xs"
                            variant="ghost"
                            color="gray.500"
                          />
                        </PopoverTrigger>
                        <PopoverContent w="280px">
                          <PopoverBody p={2}>
                            <HStack justify="space-between" mb={2}>
                              <Text fontSize="xs" fontWeight="600" color="gray.600">Macros</Text>
                              <Button size="xs" variant="ghost" leftIcon={<Icon as={showMacroManager ? FiMessageSquare : FiPlus} boxSize={3} />} onClick={() => setShowMacroManager(!showMacroManager)}>
                                {showMacroManager ? "List" : "New"}
                              </Button>
                            </HStack>
                            {showMacroManager ? (
                              <VStack spacing={2} align="stretch">
                                <Input size="xs" placeholder="Title" value={newMacroTitle} onChange={(e) => setNewMacroTitle(e.target.value)} fontSize="xs" />
                                <Textarea size="xs" placeholder="Note content..." value={newMacroContent} onChange={(e) => setNewMacroContent(e.target.value)} fontSize="xs" rows={3} resize="none" />
                                <Button size="xs" colorScheme="blue" onClick={handleAddMacro} isDisabled={!newMacroTitle.trim() || !newMacroContent.trim()}>
                                  Save Macro
                                </Button>
                              </VStack>
                            ) : macros.length === 0 ? (
                              <Text fontSize="xs" color="gray.400" textAlign="center" py={3}>
                                No macros yet
                              </Text>
                            ) : (
                              <VStack spacing={1} align="stretch" maxH="200px" overflowY="auto">
                                {macros.map((m) => (
                                  <HStack
                                    key={m.id}
                                    px={2}
                                    py={1.5}
                                    borderRadius="md"
                                    cursor="pointer"
                                    _hover={{ bg: "gray.50" }}
                                    onClick={() => setNoteText(m.content)}
                                    justify="space-between"
                                  >
                                    <Box>
                                      <Text fontSize="xs" fontWeight="500" color="gray.700">{m.title}</Text>
                                      <Text fontSize="10px" color="gray.400" noOfLines={1}>{m.content}</Text>
                                    </Box>
                                    <IconButton
                                      aria-label="Delete macro"
                                      icon={<Icon as={FiTrash2} boxSize={3} />}
                                      size="xs"
                                      variant="ghost"
                                      color="gray.300"
                                      _hover={{ color: "red.500" }}
                                      onClick={(e) => { e.stopPropagation(); removeMacro(m.id); }}
                                    />
                                  </HStack>
                                ))}
                              </VStack>
                            )}
                          </PopoverBody>
                        </PopoverContent>
                      </Popover>
                    </HStack>
                  </>
                )}
              </VStack>
            )}
          </Box>
        </VStack>
      </Box>

      {/* Right: Conversation Thread + Admin Reply */}
      <Box flex={1} display="flex" flexDirection="column" bg="white" overflow="hidden">
        {/* Thread Header */}
        <Flex px={4} py={3} borderBottom="1px solid" borderColor="gray.200" align="center" gap={3}>
          <Text fontWeight="600" fontSize="sm" color="gray.800">Conversation</Text>
          <Badge colorScheme={statusCfg?.color || "gray"} fontSize="11px" textTransform="capitalize">
            {conversation.status}
          </Badge>
          {conversation.routedDepartments && conversation.routedDepartments.length > 0
            ? (conversation.routedDepartments as RoutedDepartment[]).map((rd) => (
                <Badge key={rd.departmentId} fontSize="11px" colorScheme="blue" variant="subtle">
                  {rd.departmentName}
                </Badge>
              ))
            : conversation.department && (
                <Badge fontSize="11px" colorScheme="blue" variant="subtle">{conversation.department}</Badge>
              )
          }
          {conversation.priority && conversation.priority !== "normal" && (
            <Badge
              fontSize="11px"
              colorScheme={PRIORITY_OPTIONS.find((p) => p.value === conversation.priority)?.color || "gray"}
              variant="subtle"
            >
              {conversation.priority}
            </Badge>
          )}
        </Flex>

        {/* Thread */}
        <Box flex={1} overflow="auto">
          <ConversationThread conversation={conversation} hideHeader tenantId={tenantId} />
        </Box>

      </Box>
    </Flex>
  );
}
