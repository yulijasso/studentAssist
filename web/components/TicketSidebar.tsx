"use client";

import { Box, VStack, HStack, Text, Icon, Badge, Divider } from "@chakra-ui/react";
import {
  FiInbox,
  FiAlertCircle,
  FiMessageSquare,
  FiAlertTriangle,
  FiCheckCircle,
  FiUsers,
  FiMinusCircle,
  FiClock,
  FiUser,
  FiBell,
  FiZap,
} from "react-icons/fi";
import { useUser } from "@clerk/nextjs";
import { Conversation } from "@/lib/types";
import { useDepartments } from "@/lib/department-store";

export type ViewFilter = string;

interface Props {
  conversations: Conversation[];
  activeView: ViewFilter;
  recentlyViewedIds: string[];
  onViewChange: (view: ViewFilter) => void;
  tenantId: string | null;
  /** When true, hides the Unassigned department filter. */
  isStaff?: boolean;
}

const STATUS_VIEWS: { key: string; label: string; icon: typeof FiInbox; color: string }[] = [
  { key: "all", label: "All Tickets", icon: FiInbox, color: "gray.600" },
  { key: "new", label: "New", icon: FiBell, color: "orange.500" },
  { key: "open", label: "Open", icon: FiMessageSquare, color: "green.500" },
  { key: "escalated", label: "Escalated", icon: FiAlertTriangle, color: "red.500" },
  { key: "resolved", label: "Solved", icon: FiCheckCircle, color: "gray.400" },
  { key: "auto-resolved", label: "Auto-Resolved", icon: FiZap, color: "teal.500" },
];

const QUICK_VIEWS: { key: string; label: string; icon: typeof FiClock; color: string }[] = [
  { key: "view:mine", label: "My Tickets", icon: FiUser, color: "blue.500" },
  { key: "view:recent", label: "Recently Viewed", icon: FiClock, color: "gray.500" },
  { key: "view:breached", label: "Breached SLA", icon: FiAlertCircle, color: "red.500" },
];

function SidebarItem({
  isActive,
  icon,
  label,
  count,
  color,
  onClick,
}: {
  isActive: boolean;
  icon: typeof FiInbox;
  label: string;
  count: number;
  color: string;
  onClick: () => void;
}) {
  return (
    <HStack
      px={4}
      py={1.5}
      cursor="pointer"
      bg={isActive ? "blue.50" : "transparent"}
      color={isActive ? "blue.700" : "gray.600"}
      _hover={{ bg: isActive ? "blue.50" : "gray.50" }}
      onClick={onClick}
      justify="space-between"
      transition="all 0.1s"
    >
      <HStack spacing={2}>
        <Icon as={icon} boxSize={3.5} color={isActive ? "blue.500" : color} />
        <Text fontSize="13px" fontWeight={isActive ? "600" : "400"} noOfLines={1}>
          {label}
        </Text>
      </HStack>
      {count > 0 && (
        <Badge
          fontSize="10px"
          borderRadius="full"
          px={1.5}
          minW="20px"
          textAlign="center"
          colorScheme={isActive ? "blue" : "gray"}
          variant="subtle"
        >
          {count}
        </Badge>
      )}
    </HStack>
  );
}

export default function TicketSidebar({ conversations, activeView, recentlyViewedIds, onViewChange, tenantId, isStaff }: Props) {
  const { departments } = useDepartments(tenantId);
  const { user } = useUser();
  const myName = [user?.firstName, user?.lastName].filter(Boolean).join(" ");

  const getStatusCount = (view: string) => {
    if (view === "all") return conversations.length;
    return conversations.filter((c) => c.status === view).length;
  };

  const getDeptCount = (deptName: string) => {
    return conversations.filter(
      (c) =>
        c.department === deptName ||
        c.routedDepartments?.some((rd) => rd.departmentName === deptName),
    ).length;
  };

  const getQuickViewCount = (key: string) => {
    if (key === "view:mine") {
      return myName ? conversations.filter((c) => c.assignedTo === myName).length : 0;
    }
    if (key === "view:recent") {
      return recentlyViewedIds.length;
    }
    if (key === "view:breached") {
      return conversations.filter((c) => c.status !== "resolved" && c.slaStatus === "breached").length;
    }
    return 0;
  };

  return (
    <Box
      w="200px"
      bg="white"
      borderRight="1px solid"
      borderColor="gray.200"
      flexShrink={0}
      py={4}
      overflowY="auto"
    >
      {/* Quick Views */}
      <Text fontSize="11px" fontWeight="600" color="gray.400" px={4} mb={2} textTransform="uppercase" letterSpacing="wider">
        Views
      </Text>
      <VStack spacing={0} align="stretch">
        {QUICK_VIEWS.map((view) => (
          <SidebarItem
            key={view.key}
            isActive={activeView === view.key}
            icon={view.icon}
            label={view.label}
            count={getQuickViewCount(view.key)}
            color={view.color}
            onClick={() => onViewChange(view.key)}
          />
        ))}
      </VStack>

      <Divider my={3} />

      {/* Status */}
      <Text fontSize="11px" fontWeight="600" color="gray.400" px={4} mb={2} textTransform="uppercase" letterSpacing="wider">
        Status
      </Text>
      <VStack spacing={0} align="stretch">
        {STATUS_VIEWS.map((view) => (
          <SidebarItem
            key={view.key}
            isActive={activeView === view.key}
            icon={view.icon}
            label={view.label}
            count={getStatusCount(view.key)}
            color={view.color}
            onClick={() => onViewChange(view.key)}
          />
        ))}
      </VStack>

      <Divider my={3} />

      {/* Departments */}
      <Text fontSize="11px" fontWeight="600" color="gray.400" px={4} mb={2} textTransform="uppercase" letterSpacing="wider">
        Departments
      </Text>
      <VStack spacing={0} align="stretch">
        {!isStaff && (
          <SidebarItem
            isActive={activeView === "dept:unassigned"}
            icon={FiMinusCircle}
            label="Unassigned"
            count={conversations.filter((c) => !c.department).length}
            color="gray.400"
            onClick={() => onViewChange("dept:unassigned")}
          />
        )}
        {departments.map((dept) => (
          <SidebarItem
            key={dept.id}
            isActive={activeView === `dept:${dept.name}`}
            icon={FiUsers}
            label={dept.name}
            count={getDeptCount(dept.name)}
            color="gray.400"
            onClick={() => onViewChange(`dept:${dept.name}`)}
          />
        ))}
      </VStack>
    </Box>
  );
}
