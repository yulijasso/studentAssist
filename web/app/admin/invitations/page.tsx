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
  Button,
  Spinner,
  IconButton,
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
  Input,
  InputGroup,
  InputLeftElement,
  Select,
  HStack,
  VStack,
  Icon,
  useDisclosure,
  useToast,
} from "@chakra-ui/react";
import { FiPlus, FiXCircle, FiTrash2, FiMail, FiSearch, FiCopy } from "react-icons/fi";
import { trpc } from "@/lib/trpc";

const ROLE_COLORS: Record<string, string> = {
  tech_admin: "purple",
  city_admin: "blue",
  supervisor: "teal",
  staff: "cyan",
  member: "gray",
};

export default function AdminInvitationsPage() {
  const { data: invitations, isLoading } = trpc.admin.listInvitations.useQuery();
  const { data: roles } = trpc.admin.listRoles.useQuery();
  const { data: cities } = trpc.admin.listCities.useQuery();
  const utils = trpc.useUtils();
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const [lastRevokeAction, setLastRevokeAction] = useState<"revoke" | "delete">("delete");
  const revokeInvitation = trpc.admin.revokeInvitation.useMutation({
    onSuccess: () => {
      utils.admin.listInvitations.invalidate();
      toast({
        title: lastRevokeAction === "revoke" ? "Invitation revoked" : "Record deleted",
        status: "info",
        duration: 2000,
      });
    },
  });

  const deleteOld = trpc.admin.deleteOldInvitations.useMutation({
    onSuccess: (data) => {
      utils.admin.listInvitations.invalidate();
      toast({
        title: `${data.deleted} invitation${data.deleted === 1 ? "" : "s"} deleted`,
        status: "success",
        duration: 3000,
      });
    },
  });

  const { isOpen, onOpen, onClose } = useDisclosure();

  const filtered = useMemo(() => {
    if (!invitations) return [];
    let result = invitations;

    if (roleFilter !== "all") {
      result = result.filter((inv) => inv.roleName === roleFilter);
    }

    if (statusFilter !== "all") {
      result = result.filter((inv) => inv.status === statusFilter);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (inv) =>
          inv.email.toLowerCase().includes(q) ||
          (inv.tenantName ?? "").toLowerCase().includes(q),
      );
    }

    return result;
  }, [invitations, search, roleFilter, statusFilter]);

  const pendingCount = useMemo(
    () => invitations?.filter((inv) => inv.status === "pending").length ?? 0,
    [invitations],
  );

  const copyInviteLink = (token: string) => {
    const url = `${window.location.origin}/invite/${token}`;
    navigator.clipboard.writeText(url);
    toast({ title: "Link copied", status: "success", duration: 2000 });
  };

  return (
    <Box p={8}>
      <Flex justify="space-between" align="center" mb={6}>
        <HStack spacing={3}>
          <Icon as={FiMail} boxSize={6} color="blue.500" />
          <Box>
            <Text fontSize="2xl" fontWeight="700" color="gray.800">
              Invitations
            </Text>
            <Text fontSize="xs" color="gray.500">
              Manage and track user invitations
            </Text>
          </Box>
        </HStack>
        <HStack spacing={5}>
          <VStack spacing={0} align="center">
            <Text fontSize="lg" fontWeight="700" color="gray.800">
              {invitations?.length ?? 0}
            </Text>
            <Text fontSize="10px" color="gray.400" textTransform="uppercase" letterSpacing="wider">
              Total
            </Text>
          </VStack>
          <Box h="28px" w="1px" bg="gray.200" />
          <VStack spacing={0} align="center">
            <Text fontSize="lg" fontWeight="700" color="yellow.500">
              {pendingCount}
            </Text>
            <Text fontSize="10px" color="gray.400" textTransform="uppercase" letterSpacing="wider">
              Pending
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
            <option value="pending">Pending</option>
            <option value="accepted">Accepted</option>
            <option value="expired">Expired</option>
            <option value="revoked">Revoked</option>
          </Select>
          <Box h="28px" w="1px" bg="gray.200" />
          <InputGroup size="sm" w="220px">
            <InputLeftElement>
              <Icon as={FiSearch} color="gray.400" boxSize={3} />
            </InputLeftElement>
            <Input
              placeholder="Search invitations..."
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
          <Tooltip label="Remove expired & accepted invitations older than 30 days">
            <IconButton
              aria-label="Clean up old invitations"
              icon={<FiTrash2 />}
              size="sm"
              variant="ghost"
              color="gray.500"
              _hover={{ color: "red.500" }}
              isLoading={deleteOld.isPending}
              onClick={() => {
                if (confirm("Delete all expired and accepted invitations older than 30 days?")) {
                  deleteOld.mutate({ olderThanDays: 30 });
                }
              }}
            />
          </Tooltip>
          <Button
            size="sm"
            variant="ghost"
            leftIcon={<FiPlus size={14} />}
            fontWeight="500"
            color="gray.500"
            _hover={{ bg: "gray.100", color: "blue.600" }}
            onClick={onOpen}
          >
            Send Invitation
          </Button>
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
                <Th fontSize="10px" py={3}>Email</Th>
                <Th fontSize="10px" py={3}>City</Th>
                <Th fontSize="10px" py={3}>Department</Th>
                <Th fontSize="10px" py={3}>Role</Th>
                <Th fontSize="10px" py={3}>Status</Th>
                <Th fontSize="10px" py={3}>Expires</Th>
                <Th fontSize="10px" py={3} w="80px">Actions</Th>
              </Tr>
            </Thead>
            <Tbody>
              {filtered.map((inv) => (
                <Tr
                  key={inv.id}
                  _hover={{ bg: "gray.50" }}
                  opacity={inv.status === "expired" || inv.status === "revoked" ? 0.6 : 1}
                  transition="all 0.15s"
                >
                  <Td py={0}>
                    <Text fontSize="sm" color="gray.800">
                      {inv.email}
                    </Text>
                  </Td>
                  <Td py={0}>
                    <Text fontSize="xs" color="gray.500">
                      {inv.tenantName ?? "Global"}
                    </Text>
                  </Td>
                  <Td py={0}>
                    <Text fontSize="xs" color="gray.500">
                      {inv.departmentName ?? "—"}
                    </Text>
                  </Td>
                  <Td py={0}>
                    <Badge
                      fontSize="10px"
                      colorScheme={ROLE_COLORS[inv.roleName] ?? "gray"}
                    >
                      {inv.roleName}
                    </Badge>
                  </Td>
                  <Td py={0}>
                    <Badge
                      colorScheme={
                        inv.status === "accepted"
                          ? "green"
                          : inv.status === "expired"
                            ? "red"
                            : inv.status === "revoked"
                              ? "gray"
                              : "yellow"
                      }
                      fontSize="10px"
                    >
                      {inv.status}
                    </Badge>
                  </Td>
                  <Td py={0}>
                    <Text fontSize="xs" color="gray.400">
                      {new Date(inv.expiresAt).toLocaleDateString()}
                    </Text>
                  </Td>
                  <Td py={0}>
                    <HStack spacing={0}>
                      {inv.status === "pending" && (
                        <Tooltip label="Copy invite link">
                          <IconButton
                            aria-label="Copy link"
                            icon={<FiCopy size={13} />}
                            size="xs"
                            variant="ghost"
                            color="gray.400"
                            _hover={{ color: "blue.500", bg: "transparent" }}
                          onClick={() => copyInviteLink(inv.token)}
                          />
                        </Tooltip>
                      )}
                      <Tooltip label={inv.status === "pending" ? "Revoke" : "Delete record"}>
                        <IconButton
                          aria-label={inv.status === "pending" ? "Revoke" : "Delete record"}
                          icon={inv.status === "pending" ? <FiXCircle size={13} /> : <FiTrash2 size={13} />}
                          size="xs"
                          variant="ghost"
                          color="gray.400"
                          _hover={{ color: "red.500", bg: "transparent" }}
                          isLoading={revokeInvitation.isPending}
                          onClick={() => {
                            setLastRevokeAction(inv.status === "pending" ? "revoke" : "delete");
                            revokeInvitation.mutate({ id: inv.id });
                          }}
                        />
                      </Tooltip>
                    </HStack>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        )}
        {!isLoading && filtered.length === 0 && (
          <Flex p={8} justify="center">
            <Text color="gray.500" fontSize="sm">
              {search || roleFilter !== "all" || statusFilter !== "all"
                ? "No invitations match your filters"
                : "No invitations sent yet"}
            </Text>
          </Flex>
        )}
      </Box>

      <SendInvitationModal
        isOpen={isOpen}
        onClose={onClose}
        roles={roles ?? []}
        cities={cities ?? []}
      />
    </Box>
  );
}

function SendInvitationModal({
  isOpen,
  onClose,
  roles,
  cities,
}: {
  isOpen: boolean;
  onClose: () => void;
  roles: { id: string; name: string; tenantId: string | null }[];
  cities: { id: string; name: string }[];
}) {
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | undefined>(undefined);
  const [tenantId, setTenantId] = useState<string>("");
  const [roleId, setRoleId] = useState("");
  const [deptId, setDeptId] = useState("");
  const toast = useToast();
  const utils = trpc.useUtils();

  const { data: depts } = trpc.departments.list.useQuery(
    { tenantId },
    { enabled: !!tenantId },
  );

  const sendInvitation = trpc.admin.sendInvitation.useMutation({
    onSuccess: () => {
      toast({ title: "Invitation sent", status: "success", duration: 3000 });
      utils.admin.listInvitations.invalidate();
      setEmail("");
      setEmailError(undefined);
      setTenantId("");
      setRoleId("");
      setDeptId("");
      onClose();
    },
    onError: (err) => {
      toast({ title: "Failed", description: err.message, status: "error", duration: 5000 });
    },
  });

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md" isCentered>
      <ModalOverlay bg="blackAlpha.400" backdropFilter="blur(4px)" />
      <ModalContent borderRadius="xl" overflow="hidden" boxShadow="xl">
        {/* Header */}
        <Box bg="gray.50" px={6} pt={5} pb={4} borderBottom="1px solid" borderColor="gray.100">
          <Flex align="center" gap={3}>
            <Flex
              w={10}
              h={10}
              borderRadius="full"
              bg="blue.100"
              align="center"
              justify="center"
              flexShrink={0}
            >
              <Icon as={FiMail} boxSize={4} color="blue.600" />
            </Flex>
            <Box>
              <Text fontSize="sm" fontWeight="600" color="gray.800">
                Send Invitation
              </Text>
              <Text fontSize="xs" color="gray.500">
                Invite a user to join the platform
              </Text>
            </Box>
          </Flex>
        </Box>
        <ModalCloseButton top={3} right={3} size="sm" color="gray.400" _hover={{ color: "gray.600", bg: "transparent" }} />

        <ModalBody px={6} py={5}>
          {/* Recipient */}
          <Box border="1px solid" borderColor="gray.100" borderRadius="lg" overflow="hidden" mb={4}>
            <Flex px={4} py={2.5} bg="gray.50" borderBottom="1px solid" borderColor="gray.100">
              <Text fontSize="11px" fontWeight="600" color="gray.500" textTransform="uppercase" letterSpacing="wider">
                Recipient
              </Text>
            </Flex>
            <Box px={4} py={3}>
              <FormControl isInvalid={!!emailError}>
                <FormLabel fontSize="xs" color="gray.500" mb={1}>Email Address</FormLabel>
                <Input
                  size="sm"
                  type="email"
                  value={email}
                  isInvalid={!!emailError}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    const val = e.target.value;
                    if (!val.trim()) { setEmailError(undefined); return; }
                    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                    setEmailError(re.test(val) ? undefined : "Invalid email format");
                  }}
                  placeholder="user@example.com"
                  borderRadius="md"
                />
                {emailError ? (
                  <Text fontSize="xs" color="red.500" mt={1}>{emailError}</Text>
                ) : (
                  <Text fontSize="10px" color="gray.400" mt={1.5}>
                    The invitation link will be sent to this email.
                  </Text>
                )}
              </FormControl>
            </Box>
          </Box>

          {/* Assignment */}
          <Box border="1px solid" borderColor="gray.100" borderRadius="lg" overflow="hidden">
            <Flex px={4} py={2.5} bg="gray.50" borderBottom="1px solid" borderColor="gray.100">
              <Text fontSize="11px" fontWeight="600" color="gray.500" textTransform="uppercase" letterSpacing="wider">
                Assignment
              </Text>
            </Flex>
            <Box px={4} py={3}>
              <VStack spacing={3} align="stretch">
                <HStack spacing={3}>
                  <FormControl>
                    <FormLabel fontSize="xs" color="gray.500" mb={1}>Role</FormLabel>
                    <Select
                      size="sm"
                      value={roleId}
                      onChange={(e) => setRoleId(e.target.value)}
                      placeholder="Select role"
                      borderRadius="md"
                    >
                      {roles.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                    </Select>
                  </FormControl>
                  <FormControl>
                    <FormLabel fontSize="xs" color="gray.500" mb={1}>City</FormLabel>
                    <Select
                      size="sm"
                      value={tenantId}
                      onChange={(e) => { setTenantId(e.target.value); setDeptId(""); }}
                      placeholder="Global (no city)"
                      borderRadius="md"
                    >
                      {cities.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </Select>
                  </FormControl>
                </HStack>
                {tenantId && depts && depts.length > 0 && (
                  <FormControl>
                    <FormLabel fontSize="xs" color="gray.500" mb={1}>Department (optional)</FormLabel>
                    <Select
                      size="sm"
                      value={deptId}
                      onChange={(e) => setDeptId(e.target.value)}
                      placeholder="No department"
                      borderRadius="md"
                    >
                      {depts.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </Select>
                  </FormControl>
                )}
              </VStack>
            </Box>
          </Box>
        </ModalBody>

        <ModalFooter borderTop="1px solid" borderColor="gray.100" px={6} py={3}>
          <Button variant="ghost" size="sm" mr={2} onClick={onClose} borderRadius="full">
            Cancel
          </Button>
          <Button
            colorScheme="blue"
            size="sm"
            borderRadius="full"
            isLoading={sendInvitation.isPending}
            isDisabled={!email || !roleId || !!emailError}
            onClick={() =>
              sendInvitation.mutate({
                email,
                tenantId: tenantId || null,
                roleId,
                departmentId: deptId || null,
              })
            }
          >
            Send Invitation
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
