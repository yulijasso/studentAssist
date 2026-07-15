/**
 * Tech Admin — Active Directory.
 *
 * Lists all users with inline editing for name, email, role, city,
 * department, and active status. Supports search and user management.
 */
"use client";

import { useState, useMemo } from "react";
import {
  Box,
  Flex,
  Text,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Badge,
  Spinner,
  HStack,
  VStack,
  Input,
  InputGroup,
  InputLeftElement,
  Icon,
  IconButton,
  Select,
  Tooltip,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseButton,
  FormControl,
  FormLabel,
  Button,
  SimpleGrid,
  useDisclosure,
  useToast,
  Link as ChakraLink,
} from "@chakra-ui/react";
import NextLink from "next/link";
import {
  FiSearch,
  FiEdit2,
  FiTrash2,
  FiShield,
} from "react-icons/fi";
import { trpc } from "@/lib/trpc";

const ROLE_COLORS: Record<string, string> = {
  tech_admin: "purple",
  city_admin: "blue",
  supervisor: "teal",
  staff: "cyan",
  member: "gray",
};

type UserRow = {
  id: string;
  name: string | null;
  email: string;
  createdAt: string | Date;
  memberships: {
    membershipId: string;
    roleId: string;
    role: string;
    tenantId: string | null;
    city: string | null;
    departmentId: string | null;
    department: string | null;
    isActive: boolean;
  }[];
};

export default function AdminUsersPage() {
  const { data: users, isLoading } = trpc.admin.listUsers.useQuery();
  const { data: roles } = trpc.admin.listRoles.useQuery();
  const { data: cities } = trpc.admin.listCities.useQuery();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [editUser, setEditUser] = useState<UserRow | null>(null);
  const { isOpen, onOpen, onClose } = useDisclosure();

  const filtered = useMemo(() => {
    if (!users) return [];
    let result = users;

    if (roleFilter !== "all") {
      result = result.filter((u) =>
        u.memberships.some((m) => m.role === roleFilter),
      );
    }

    if (statusFilter === "active") {
      result = result.filter((u) => u.memberships.some((m) => m.isActive));
    } else if (statusFilter === "inactive") {
      result = result.filter(
        (u) => u.memberships.length > 0 && !u.memberships.some((m) => m.isActive),
      );
    } else if (statusFilter === "unassigned") {
      result = result.filter((u) => u.memberships.length === 0);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (u) =>
          u.email.toLowerCase().includes(q) ||
          (u.name ?? "").toLowerCase().includes(q) ||
          u.memberships.some(
            (m) =>
              m.role.toLowerCase().includes(q) ||
              (m.city ?? "").toLowerCase().includes(q),
          ),
      );
    }

    return result;
  }, [users, search, roleFilter, statusFilter]);

  const activeCount = useMemo(
    () => users?.filter((u) => u.memberships.some((m) => m.isActive)).length ?? 0,
    [users],
  );

  const disabledCount = useMemo(
    () => users?.filter((u) => u.memberships.length > 0 && !u.memberships.some((m) => m.isActive)).length ?? 0,
    [users],
  );

  const unassignedCount = useMemo(
    () => users?.filter((u) => u.memberships.length === 0).length ?? 0,
    [users],
  );

  const handleEdit = (user: UserRow) => {
    setEditUser(user);
    onOpen();
  };

  const handleClose = () => {
    setEditUser(null);
    onClose();
  };

  return (
    <Box p={8}>
      <Flex justify="space-between" align="center" mb={6}>
        <HStack spacing={3}>
          <Icon as={FiShield} boxSize={6} color="blue.500" />
          <Box>
            <Text fontSize="2xl" fontWeight="700" color="gray.800">
              Active Directory
            </Text>
            <Text fontSize="xs" color="gray.500">
              Manage users, roles, and permissions
            </Text>
          </Box>
        </HStack>
        <HStack spacing={5}>
          <VStack spacing={0} align="center">
            <Text fontSize="lg" fontWeight="700" color="gray.800">
              {users?.length ?? 0}
            </Text>
            <Text fontSize="10px" color="gray.400" textTransform="uppercase" letterSpacing="wider">
              Total
            </Text>
          </VStack>
          <Box h="28px" w="1px" bg="gray.200" />
          <VStack spacing={0} align="center">
            <Text fontSize="lg" fontWeight="700" color="green.500">
              {activeCount}
            </Text>
            <Text fontSize="10px" color="gray.400" textTransform="uppercase" letterSpacing="wider">
              Active
            </Text>
          </VStack>
          <Box h="28px" w="1px" bg="gray.200" />
          <VStack spacing={0} align="center">
            <Text fontSize="lg" fontWeight="700" color="red.400">
              {disabledCount}
            </Text>
            <Text fontSize="10px" color="gray.400" textTransform="uppercase" letterSpacing="wider">
              Disabled
            </Text>
          </VStack>
          <Box h="28px" w="1px" bg="gray.200" />
          <VStack spacing={0} align="center">
            <Text fontSize="lg" fontWeight="700" color="orange.400">
              {unassignedCount}
            </Text>
            <Text fontSize="10px" color="gray.400" textTransform="uppercase" letterSpacing="wider">
              Unassigned
            </Text>
          </VStack>
          <Box h="28px" w="1px" bg="gray.200" />
          <Select
            size="sm"
            w="140px"
            fontSize="xs"
            borderRadius="lg"
            bg="white"
            border="1px solid"
            borderColor="gray.200"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
          >
            <option value="all">All Roles</option>
            <option value="tech_admin">Tech Admin</option>
            <option value="city_admin">City Admin</option>
            <option value="supervisor">Supervisor</option>
            <option value="staff">Staff</option>
            <option value="member">Member</option>
          </Select>
          <Select
            size="sm"
            w="130px"
            fontSize="xs"
            borderRadius="lg"
            bg="white"
            border="1px solid"
            borderColor="gray.200"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="unassigned">Unassigned</option>
          </Select>
          <Box h="28px" w="1px" bg="gray.200" />
          <InputGroup size="sm" w="220px">
            <InputLeftElement>
              <Icon as={FiSearch} color="gray.400" boxSize={3} />
            </InputLeftElement>
            <Input
              placeholder="Search users..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              borderRadius="lg"
              fontSize="xs"
              bg="white"
              border="1px solid"
              borderColor="gray.200"
              _focus={{ borderColor: "blue.400", boxShadow: "0 0 0 1px #3182ce" }}
            />
          </InputGroup>
        </HStack>
      </Flex>

      <Box
        bg="white"
        border="1px solid"
        borderColor="gray.200"
        borderRadius="lg"
        overflow="hidden"
      >
        {isLoading ? (
          <Flex p={8} justify="center">
            <Spinner color="blue.500" />
          </Flex>
        ) : (
          <Table size="sm">
            <Thead bg="gray.50">
              <Tr>
                <Th fontSize="10px" py={3}>User</Th>
                <Th fontSize="10px" py={3}>Email</Th>
                <Th fontSize="10px" py={3}>Role</Th>
                <Th fontSize="10px" py={3}>City</Th>
                <Th fontSize="10px" py={3}>Department</Th>
                <Th fontSize="10px" py={3}>Status</Th>
                <Th fontSize="10px" py={3}>Joined</Th>
                <Th fontSize="10px" py={3} w="80px">Actions</Th>
              </Tr>
            </Thead>
            <Tbody>
              {filtered.map((user) => {
                const activeMembership = user.memberships.find((m) => m.isActive);
                const role = activeMembership?.role ?? null;
                const city = activeMembership?.city ?? null;
                const hasAnyMembership = user.memberships.length > 0;
                const isActive = !!activeMembership;

                return (
                  <Tr
                    key={user.id}
                    _hover={{ bg: "gray.50" }}
                    opacity={isActive ? 1 : 0.6}
                    transition="all 0.15s"
                  >
                    <Td py={0}>
                      <Text fontSize="sm" fontWeight="500" color="gray.800">
                        {user.name || "—"}
                      </Text>
                    </Td>
                    <Td py={0}>
                      <Text fontSize="sm" color="gray.600">
                        {user.email}
                      </Text>
                    </Td>
                    <Td py={0}>
                      {role ? (
                        <Badge
                          fontSize="10px"
                          colorScheme={ROLE_COLORS[role] ?? "gray"}
                        >
                          {role}
                        </Badge>
                      ) : (
                        <Text fontSize="xs" color="gray.400">—</Text>
                      )}
                    </Td>
                    <Td py={0}>
                      <Text fontSize="xs" color="gray.500">
                        {city ?? (role === "tech_admin" ? "Global" : "—")}
                      </Text>
                    </Td>
                    <Td py={0}>
                      <Text fontSize="xs" color="gray.500">
                        {activeMembership?.department ?? "—"}
                      </Text>
                    </Td>
                    <Td py={0}>
                      <Badge
                        fontSize="10px"
                        colorScheme={
                          isActive ? "green" : hasAnyMembership ? "red" : "yellow"
                        }
                      >
                        {isActive ? "Active" : hasAnyMembership ? "Disabled" : "Unassigned"}
                      </Badge>
                    </Td>
                    <Td py={0}>
                      <Text fontSize="xs" color="gray.400">
                        {new Date(user.createdAt).toLocaleDateString()}
                      </Text>
                    </Td>
                    <Td py={0}>
                      <HStack spacing={1}>
                        <Tooltip label="Edit user">
                          <IconButton
                            aria-label="Edit"
                            icon={<FiEdit2 />}
                            size="xs"
                            variant="ghost"
                            color="gray.500"
                            _hover={{ color: "blue.500" }}
                            onClick={() => handleEdit(user as UserRow)}
                          />
                        </Tooltip>
                      </HStack>
                    </Td>
                  </Tr>
                );
              })}
            </Tbody>
          </Table>
        )}
        {!isLoading && filtered.length === 0 && (
          <Flex p={8} justify="center">
            <Text color="gray.500" fontSize="sm">
              {search ? "No users match your search" : "No users yet"}
            </Text>
          </Flex>
        )}
      </Box>

      {editUser && (
        <EditUserModal
          isOpen={isOpen}
          onClose={handleClose}
          user={editUser}
          roles={roles ?? []}
          cities={cities ?? []}
        />
      )}
    </Box>
  );
}

function EditUserModal({
  isOpen,
  onClose,
  user,
  roles,
  cities,
}: {
  isOpen: boolean;
  onClose: () => void;
  user: UserRow;
  roles: { id: string; name: string; tenantId: string | null }[];
  cities: { id: string; name: string }[];
}) {
  const toast = useToast();
  const utils = trpc.useUtils();

  const [name, setName] = useState(user.name ?? "");
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [showDeleteInput, setShowDeleteInput] = useState(false);
  const [inviteRoleId, setInviteRoleId] = useState("");
  const [inviteTenantId, setInviteTenantId] = useState("");
  const [inviteDeptId, setInviteDeptId] = useState("");

  const activeMembership = user.memberships.find((m) => m.isActive);
  const [roleId, setRoleId] = useState(activeMembership?.roleId ?? "");
  const [tenantId, setTenantId] = useState(activeMembership?.tenantId ?? "");
  const [deptId, setDeptId] = useState(activeMembership?.departmentId ?? "");

  // Fetch departments for the user's current city
  const { data: memberDepts } = trpc.departments.list.useQuery(
    { tenantId: activeMembership?.tenantId! },
    { enabled: !!activeMembership?.tenantId },
  );

  // Fetch departments for the selected invite city
  const { data: inviteDepts } = trpc.departments.list.useQuery(
    { tenantId: inviteTenantId },
    { enabled: !!inviteTenantId },
  );

  const updateUser = trpc.admin.updateUser.useMutation({
    onSuccess: () => {
      utils.admin.listUsers.invalidate();
      toast({ title: "User updated", status: "success", duration: 2000 });
    },
    onError: (err) => {
      toast({ title: "Failed", description: err.message, status: "error", duration: 3000 });
    },
  });

  const updateMember = trpc.admin.updateMember.useMutation({
    onSuccess: () => {
      utils.admin.listUsers.invalidate();
      toast({ title: "Role updated", status: "success", duration: 2000 });
    },
    onError: (err) => {
      toast({ title: "Failed", description: err.message, status: "error", duration: 3000 });
    },
  });

  const deactivateUser = trpc.admin.deactivateUser.useMutation({
    onSuccess: () => {
      utils.admin.listUsers.invalidate();
      toast({ title: "User deactivated", status: "info", duration: 2000 });
      onClose();
    },
    onError: (err) => {
      toast({ title: "Failed", description: err.message, status: "error", duration: 3000 });
    },
  });

  const reactivateUser = trpc.admin.reactivateUser.useMutation({
    onSuccess: () => {
      utils.admin.listUsers.invalidate();
      toast({ title: "User reactivated", status: "success", duration: 2000 });
      onClose();
    },
    onError: (err) => {
      toast({ title: "Failed", description: err.message, status: "error", duration: 3000 });
    },
  });

  const assignRole = trpc.admin.assignRole.useMutation({
    onSuccess: () => {
      utils.admin.listUsers.invalidate();
      utils.admin.userStats.invalidate();
      toast({ title: "Role assigned", status: "success", duration: 2000 });
      setInviteRoleId("");
      setInviteTenantId("");
      setInviteDeptId("");
      onClose();
    },
    onError: (err) => {
      toast({ title: "Failed", description: err.message, status: "error", duration: 3000 });
    },
  });

  const deleteUser = trpc.admin.deleteUser.useMutation({
    onSuccess: () => {
      utils.admin.listUsers.invalidate();
      toast({ title: "User deleted permanently", status: "info", duration: 2000 });
      onClose();
    },
    onError: (err) => {
      toast({ title: "Failed", description: err.message, status: "error", duration: 3000 });
    },
  });

  const isActive = !!activeMembership;
  const hasAnyMembership = user.memberships.length > 0;

  const handleSaveInfo = () => {
    if (name !== (user.name ?? "")) {
      updateUser.mutate({ userId: user.id, name });
    }
  };

  const isPending = updateUser.isPending || updateMember.isPending || deleteUser.isPending || deactivateUser.isPending || reactivateUser.isPending || assignRole.isPending;

  const roleName = activeMembership?.role ?? null;
  const roleColor = ROLE_COLORS[roleName ?? ""] ?? "gray";

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md" isCentered>
      <ModalOverlay bg="blackAlpha.400" backdropFilter="blur(4px)" />
      <ModalContent borderRadius="xl" overflow="hidden" boxShadow="xl">
        {/* Header with user info */}
        <Box bg="gray.50" px={6} pt={5} pb={4} borderBottom="1px solid" borderColor="gray.100">
          <Flex align="center" gap={3}>
            <Flex
              w={10}
              h={10}
              borderRadius="full"
              bg={isActive ? `${roleColor}.100` : "gray.100"}
              align="center"
              justify="center"
              flexShrink={0}
            >
              <Text fontSize="sm" fontWeight="700" color={isActive ? `${roleColor}.600` : "gray.400"}>
                {(user.name ?? user.email).charAt(0).toUpperCase()}
              </Text>
            </Flex>
            <Box flex={1} minW={0}>
              <Text fontSize="sm" fontWeight="600" color="gray.800" isTruncated>
                {user.name || "Unnamed User"}
              </Text>
              <Text fontSize="xs" color="gray.500" isTruncated>
                {user.email}
              </Text>
            </Box>
            <HStack spacing={2}>
              {roleName && (
                <Badge fontSize="10px" colorScheme={roleColor} px={2}>
                  {roleName}
                </Badge>
              )}
              <Badge
                fontSize="10px"
                colorScheme={isActive ? "green" : hasAnyMembership ? "red" : "orange"}
                px={2}
              >
                {isActive ? "Active" : hasAnyMembership ? "Disabled" : "Unassigned"}
              </Badge>
            </HStack>
          </Flex>
        </Box>

        <ModalCloseButton top={3} right={3} size="sm" color="gray.400" _hover={{ color: "gray.600", bg: "transparent" }} />

        <ModalBody px={6} py={5}>
          <VStack spacing={5} align="stretch">
            {/* Profile Section */}
            <Box
              border="1px solid"
              borderColor="gray.100"
              borderRadius="lg"
              overflow="hidden"
            >
              <Flex px={4} py={2.5} bg="gray.50" borderBottom="1px solid" borderColor="gray.100">
                <Text fontSize="11px" fontWeight="600" color="gray.500" textTransform="uppercase" letterSpacing="wider">
                  Profile
                </Text>
              </Flex>
              <Box px={4} py={3}>
                <FormControl>
                  <FormLabel fontSize="xs" color="gray.500" mb={1}>Name</FormLabel>
                  <Input
                    size="sm"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Full name"
                    borderRadius="md"
                    bg="white"
                    _focus={{ borderColor: "blue.400", boxShadow: "0 0 0 1px #3182ce" }}
                  />
                </FormControl>
                {name !== (user.name ?? "") && (
                  <Flex justify="flex-end" mt={2}>
                    <Button
                      size="xs"
                      colorScheme="blue"
                      borderRadius="full"
                      isLoading={updateUser.isPending}
                      onClick={handleSaveInfo}
                    >
                      Save Name
                    </Button>
                  </Flex>
                )}
              </Box>
            </Box>

            {/* Role & Assignment Section */}
            <Box
              border="1px solid"
              borderColor="gray.100"
              borderRadius="lg"
              overflow="hidden"
            >
              <Flex px={4} py={2.5} bg="gray.50" borderBottom="1px solid" borderColor="gray.100">
                <Text fontSize="11px" fontWeight="600" color="gray.500" textTransform="uppercase" letterSpacing="wider">
                  Role & Assignment
                </Text>
              </Flex>
              <Box px={4} py={3}>
                {activeMembership ? (
                  <VStack spacing={3} align="stretch">
                    <SimpleGrid columns={2} spacing={3}>
                      <FormControl>
                        <FormLabel fontSize="xs" color="gray.500" mb={1}>Role</FormLabel>
                        <Select
                          size="sm"
                          value={roleId}
                          onChange={(e) => setRoleId(e.target.value)}
                          borderRadius="md"
                        >
                          {roles.map((r) => (
                            <option key={r.id} value={r.id}>{r.name}</option>
                          ))}
                        </Select>
                      </FormControl>
                      <FormControl>
                        <FormLabel fontSize="xs" color="gray.500" mb={1}>City</FormLabel>
                        <Input
                          size="sm"
                          value={activeMembership.city ?? (activeMembership.role === "tech_admin" ? "Global" : "—")}
                          isReadOnly
                          bg="gray.50"
                          borderRadius="md"
                          color="gray.600"
                          cursor="default"
                        />
                      </FormControl>
                    </SimpleGrid>
                    {activeMembership.tenantId && memberDepts && memberDepts.length > 0 && (
                      <FormControl>
                        <FormLabel fontSize="xs" color="gray.500" mb={1}>Department</FormLabel>
                        <Select
                          size="sm"
                          value={deptId}
                          onChange={(e) => setDeptId(e.target.value)}
                          placeholder="No department"
                          borderRadius="md"
                        >
                          {memberDepts.map((d) => (
                            <option key={d.id} value={d.id}>{d.name}</option>
                          ))}
                        </Select>
                      </FormControl>
                    )}
                    {(roleId !== activeMembership.roleId || deptId !== (activeMembership.departmentId ?? "")) && (
                      <Flex justify="flex-end">
                        <Button
                          size="xs"
                          colorScheme="blue"
                          borderRadius="full"
                          isLoading={updateMember.isPending}
                          onClick={() => {
                            updateMember.mutate({
                              membershipId: activeMembership.membershipId,
                              ...(roleId !== activeMembership.roleId ? { roleId } : {}),
                              ...(deptId !== (activeMembership.departmentId ?? "") ? { departmentId: deptId || null } : {}),
                            });
                          }}
                        >
                          Save Changes
                        </Button>
                      </Flex>
                    )}
                  </VStack>
                ) : (
                  <VStack spacing={3} align="stretch">
                    <Flex
                      align="center"
                      gap={2}
                      bg="orange.50"
                      border="1px solid"
                      borderColor="orange.100"
                      borderRadius="md"
                      px={3}
                      py={2}
                    >
                      <Box w="6px" h="6px" borderRadius="full" bg="orange.400" />
                      <Text fontSize="xs" color="orange.700">
                        No active membership. Assign a role directly below.
                      </Text>
                    </Flex>
                    <SimpleGrid columns={2} spacing={3}>
                      <FormControl>
                        <FormLabel fontSize="xs" color="gray.500" mb={1}>Role</FormLabel>
                        <Select
                          size="sm"
                          placeholder="Select role"
                          value={inviteRoleId}
                          onChange={(e) => setInviteRoleId(e.target.value)}
                          borderRadius="md"
                        >
                          {roles.map((r) => (
                            <option key={r.id} value={r.id}>{r.name}</option>
                          ))}
                        </Select>
                      </FormControl>
                      <FormControl>
                        <FormLabel fontSize="xs" color="gray.500" mb={1}>City</FormLabel>
                        <Select
                          size="sm"
                          placeholder="Global (no city)"
                          value={inviteTenantId}
                          onChange={(e) => { setInviteTenantId(e.target.value); setInviteDeptId(""); }}
                          borderRadius="md"
                        >
                          {cities.map((c) => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </Select>
                      </FormControl>
                    </SimpleGrid>
                    {inviteTenantId && inviteDepts && inviteDepts.length > 0 && (
                      <FormControl>
                        <FormLabel fontSize="xs" color="gray.500" mb={1}>Department</FormLabel>
                        <Select
                          size="sm"
                          placeholder="No department"
                          value={inviteDeptId}
                          onChange={(e) => setInviteDeptId(e.target.value)}
                          borderRadius="md"
                        >
                          {inviteDepts.map((d) => (
                            <option key={d.id} value={d.id}>{d.name}</option>
                          ))}
                        </Select>
                      </FormControl>
                    )}
                    <Flex justify="flex-end">
                      <Button
                        size="xs"
                        colorScheme="blue"
                        borderRadius="full"
                        isDisabled={!inviteRoleId}
                        isLoading={assignRole.isPending}
                        onClick={() => {
                          assignRole.mutate({
                            userId: user.id,
                            roleId: inviteRoleId,
                            tenantId: inviteTenantId || null,
                            departmentId: inviteDeptId || null,
                          });
                        }}
                      >
                        Assign Role
                      </Button>
                    </Flex>
                  </VStack>
                )}
              </Box>
            </Box>

            {/* Account Actions Section */}
            <Box
              border="1px solid"
              borderColor="gray.100"
              borderRadius="lg"
              overflow="hidden"
            >
              <Flex px={4} py={2.5} bg="gray.50" borderBottom="1px solid" borderColor="gray.100">
                <Text fontSize="11px" fontWeight="600" color="gray.500" textTransform="uppercase" letterSpacing="wider">
                  Account Actions
                </Text>
              </Flex>

              {/* Status Toggle */}
              {hasAnyMembership && (
                <Flex
                  align="center"
                  justify="space-between"
                  px={4}
                  py={3}
                  borderBottom="1px solid"
                  borderColor="gray.100"
                >
                  <HStack spacing={2.5}>
                    <Box
                      w="8px"
                      h="8px"
                      borderRadius="full"
                      bg={isActive ? "green.400" : "red.400"}
                    />
                    <Box>
                      <Text fontSize="xs" fontWeight="500" color="gray.700">
                        {isActive ? "Active" : "Inactive"}
                      </Text>
                      <Text fontSize="10px" color="gray.400">
                        {isActive ? "User can access the platform" : "Access is currently disabled"}
                      </Text>
                    </Box>
                  </HStack>
                  <Button
                    size="xs"
                    colorScheme={isActive ? "red" : "green"}
                    variant="outline"
                    borderRadius="full"
                    isLoading={deactivateUser.isPending || reactivateUser.isPending}
                    onClick={() => {
                      if (isActive) {
                        deactivateUser.mutate({ userId: user.id });
                      } else {
                        reactivateUser.mutate({ userId: user.id });
                      }
                    }}
                  >
                    {isActive ? "Deactivate" : "Reactivate"}
                  </Button>
                </Flex>
              )}

              {/* Delete */}
              <Flex
                align="center"
                justify="space-between"
                px={4}
                py={3}
              >
                <HStack spacing={2.5}>
                  <Box w="8px" h="8px" borderRadius="full" bg="red.400" />
                  <Box>
                    <Text fontSize="xs" fontWeight="500" color="gray.700">
                      Delete User
                    </Text>
                    <Text fontSize="10px" color="gray.400">
                      Permanently remove this user and all data
                    </Text>
                  </Box>
                </HStack>
                <Button
                  size="xs"
                  leftIcon={<FiTrash2 />}
                  colorScheme="red"
                  variant={showDeleteInput ? "solid" : "outline"}
                  borderRadius="full"
                  isLoading={deleteUser.isPending}
                  isDisabled={showDeleteInput && deleteConfirm !== "Delete user"}
                  onClick={() => {
                    if (!showDeleteInput) {
                      setShowDeleteInput(true);
                    } else {
                      deleteUser.mutate({ userId: user.id });
                    }
                  }}
                >
                  Delete
                </Button>
              </Flex>
              {showDeleteInput && (
                <Box px={4} pb={3}>
                  <Input
                    size="sm"
                    borderRadius="md"
                    placeholder="Type 'Delete user' to confirm"
                    value={deleteConfirm}
                    onChange={(e) => setDeleteConfirm(e.target.value)}
                    bg="gray.50"
                    autoFocus
                  />
                </Box>
              )}
            </Box>
          </VStack>
        </ModalBody>

        <ModalFooter borderTop="1px solid" borderColor="gray.100" px={6} py={3} flexDir="column" gap={2}>
          <Text fontSize="10px" color="gray.400" textAlign="center">
            To change a user's email or city, create a new invitation via the{" "}
            <ChakraLink as={NextLink} href="/admin/invitations" color="blue.400" fontWeight="500">
              Invitations
            </ChakraLink>{" "}
            tab.
          </Text>
          <Button variant="ghost" size="sm" onClick={onClose} isDisabled={isPending} borderRadius="full">
            Close
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
