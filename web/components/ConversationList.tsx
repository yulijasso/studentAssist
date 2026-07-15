"use client";

import {
  Box,
  VStack,
  Text,
  Input,
  Select,
  HStack,
  Badge,
  InputGroup,
  InputLeftElement,
  Icon,
} from "@chakra-ui/react";
import { FiSearch } from "react-icons/fi";
import { useState } from "react";
import { Conversation, DEPARTMENTS, INTENT_LABELS } from "@/lib/types";

const STATUS_COLORS: Record<string, string> = {
  open: "green",
  resolved: "gray",
  escalated: "red",
};

interface Props {
  conversations: Conversation[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export default function ConversationList({ conversations, selectedId, onSelect }: Props) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [deptFilter, setDeptFilter] = useState("all");

  const filtered = conversations.filter((c) => {
    if (statusFilter !== "all" && c.status !== statusFilter) return false;
    if (deptFilter !== "all" && c.department !== deptFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const hasMatch = c.messages.some((m) =>
        m.content.toLowerCase().includes(q)
      );
      if (!hasMatch) return false;
    }
    return true;
  });

  return (
    <Box
      w="360px"
      borderRight="1px solid"
      borderColor="gray.200"
      bg="white"
      display="flex"
      flexDirection="column"
      h="100%"
    >
      <Box p={3} borderBottom="1px solid" borderColor="gray.100">
        <InputGroup size="sm" mb={2}>
          <InputLeftElement>
            <Icon as={FiSearch} color="gray.400" />
          </InputLeftElement>
          <Input
            placeholder="Search conversations..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            bg="gray.50"
            border="1px solid"
            borderColor="gray.200"
          />
        </InputGroup>
        <HStack spacing={2}>
          <Select
            size="xs"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            bg="gray.50"
          >
            <option value="all">All Status</option>
            <option value="open">Open</option>
            <option value="resolved">Resolved</option>
            <option value="escalated">Escalated</option>
          </Select>
          <Select
            size="xs"
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            bg="gray.50"
          >
            <option value="all">All Depts</option>
            {DEPARTMENTS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </Select>
        </HStack>
      </Box>

      <VStack
        spacing={0}
        align="stretch"
        overflowY="auto"
        flex={1}
      >
        {filtered.length === 0 && (
          <Text fontSize="sm" color="gray.400" p={4} textAlign="center">
            No conversations found
          </Text>
        )}
        {filtered.map((conv) => {
          const firstUserMsg = conv.messages.find((m) => m.role === "user");
          const preview = firstUserMsg?.content || "No messages";
          const isSelected = conv.id === selectedId;
          const time = new Date(conv.updatedAt);
          const timeStr = time.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          });

          return (
            <Box
              key={conv.id}
              px={4}
              py={3}
              cursor="pointer"
              bg={isSelected ? "blue.50" : "white"}
              borderLeft={isSelected ? "3px solid" : "3px solid transparent"}
              borderLeftColor={isSelected ? "blue.500" : "transparent"}
              borderBottom="1px solid"
              borderBottomColor="gray.100"
              _hover={{ bg: isSelected ? "blue.50" : "gray.50" }}
              onClick={() => onSelect(conv.id)}
              transition="all 0.1s"
            >
              <HStack justify="space-between" mb={1}>
                <HStack spacing={2}>
                  <Badge
                    colorScheme={STATUS_COLORS[conv.status]}
                    fontSize="10px"
                    textTransform="capitalize"
                  >
                    {conv.status}
                  </Badge>
                  {conv.intent && (
                    <Badge fontSize="10px" colorScheme="purple" variant="outline">
                      {INTENT_LABELS[conv.intent] || conv.intent}
                    </Badge>
                  )}
                </HStack>
                <Text fontSize="10px" color="gray.400">
                  {timeStr}
                </Text>
              </HStack>
              <Text
                fontSize="sm"
                noOfLines={2}
                color="gray.700"
                lineHeight="1.4"
              >
                {preview}
              </Text>
              {conv.department && (
                <Text fontSize="11px" color="gray.400" mt={1}>
                  {conv.department}
                </Text>
              )}
            </Box>
          );
        })}
      </VStack>
    </Box>
  );
}
