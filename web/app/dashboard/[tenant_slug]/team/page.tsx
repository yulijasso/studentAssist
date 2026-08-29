/**
 * Team management — tenant-scoped members & invitations for a single institution.
 *
 * Backed by the `team.*` tRPC router (gated by tenantAdminProcedure), so a
 * `institution_admin` manages only their own tenant. All calls pass the current
 * `tenantId` (resolved from the URL slug); the server independently verifies
 * ownership — the UI scoping is convenience, not the security boundary.
 */
"use client";

import { useState } from "react";
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
  ModalBody,
  ModalFooter,
  ModalCloseButton,
  FormControl,
  FormLabel,
  Input,
  Select,
  HStack,
  VStack,
  Icon,
  useDisclosure,
  useToast,
} from "@chakra-ui/react";
import { FiPlus, FiXCircle, FiTrash2, FiMail, FiUsers, FiCopy } from "react-icons/fi";
import { trpc } from "@/lib/trpc";
import { useTenant } from "@/lib/use-tenant";

const ROLE_COLORS: Record<string, string> = {
  tech_admin: "purple",
  institution_admin: "blue",
  supervisor: "teal",
  staff: "cyan",
  member: "gray",
};

export default function TeamPage() {
  const { tenantId, tenant } = useTenant();
  const toast = useToast();
  const utils = trpc.useUtils();
  const { isOpen, onOpen, onClose } = useDisclosure();

  const membersQuery = trpc.team.listMembers.useQuery(
    { tenantId: tenantId ?? "" },
    { enabled: !!tenantId },
  );
  const invitationsQuery = trpc.team.listInvitations.useQuery(
    { tenantId: tenantId ?? "" },
    { enabled: !!tenantId },
  );
  const rolesQuery = trpc.team.listRoles.useQuery(
    { tenantId: tenantId ?? "" },
    { enabled: !!tenantId },
  );

  const grantableRoleNames = new Set((rolesQuery.data ?? []).map((r) => r.name));

  const updateMember = trpc.team.updateMember.useMutation({
    onSuccess: () => {
      utils.team.listMembers.invalidate();
      toast({ title: "Member updated", status: "success", duration: 2000 });
    },
    onError: (err) =>
      toast({ title: "Failed", description: err.message, status: "error", duration: 5000 }),
  });

  const removeMember = trpc.team.removeMember.useMutation({
    onSuccess: () => {
      utils.team.listMembers.invalidate();
      toast({ title: "Member removed", status: "info", duration: 2000 });
    },
    onError: (err) =>
      toast({ title: "Failed", description: err.message, status: "error", duration: 5000 }),
  });

  const revokeInvitation = trpc.team.revokeInvitation.useMutation({
    onSuccess: () => {
      utils.team.listInvitations.invalidate();
      toast({ title: "Invitation revoked", status: "info", duration: 2000 });
    },
    onError: (err) =>
      toast({ title: "Failed", description: err.message, status: "error", duration: 5000 }),
  });

  const copyInviteLink = (token: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/invite/${token}`);
    toast({ title: "Link copied", status: "success", duration: 2000 });
  };

  if (!tenantId) {
    return (
      <Flex h="60vh" align="center" justify="center">
        <Spinner color="blue.500" />
      </Flex>
    );
  }

  const members = membersQuery.data ?? [];
  const invitations = invitationsQuery.data ?? [];
  const pendingCount = invitations.filter((i) => i.status === "pending").length;

  return (
    <Box p={8}>
      {/* Header */}
      <Flex justify="space-between" align="center" mb={6}>
        <HStack spacing={3}>
          <Icon as={FiUsers} boxSize={6} color="blue.500" />
          <Box>
            <Text fontSize="2xl" fontWeight="700" color="gray.800">
              Team
            </Text>
            <Text fontSize="xs" color="gray.500">
              Manage members and invitations for {tenant?.name ?? "your institution"}
            </Text>
          </Box>
        </HStack>
        <Button
          size="sm"
          colorScheme="blue"
          leftIcon={<FiPlus size={14} />}
          borderRadius="full"
          onClick={onOpen}
        >
          Invite Member
        </Button>
      </Flex>

      {/* Members */}
      <Text fontSize="sm" fontWeight="600" color="gray.700" mb={2}>
        Members ({members.length})
      </Text>
      <Box bg="white" border="1px solid" borderColor="gray.200" borderRadius="lg" overflow="hidden" mb={8}>
        {membersQuery.isLoading ? (
          <Flex p={8} justify="center"><Spinner color="blue.500" /></Flex>
        ) : (
          <Table size="sm">
            <Thead bg="gray.50">
              <Tr>
                <Th fontSize="10px" py={3}>Name</Th>
                <Th fontSize="10px" py={3}>Email</Th>
                <Th fontSize="10px" py={3}>Role</Th>
                <Th fontSize="10px" py={3}>Status</Th>
                <Th fontSize="10px" py={3}>Joined</Th>
                <Th fontSize="10px" py={3} w="120px">Actions</Th>
              </Tr>
            </Thead>
            <Tbody>
              {members.map((m) => {
                const editable = grantableRoleNames.has(m.roleName);
                return (
                  <Tr key={m.id} _hover={{ bg: "gray.50" }} opacity={m.isActive ? 1 : 0.6}>
                    <Td py={0}>
                      <Text fontSize="sm" color="gray.800">{m.userName ?? "—"}</Text>
                    </Td>
                    <Td py={0}>
                      <Text fontSize="xs" color="gray.500">{m.userEmail}</Text>
                    </Td>
                    <Td py={0}>
                      {editable ? (
                        <Select
                          size="xs"
                          w="130px"
                          value={m.roleId}
                          onChange={(e) =>
                            updateMember.mutate({
                              tenantId,
                              membershipId: m.id,
                              roleId: e.target.value,
                            })
                          }
                          isDisabled={updateMember.isPending}
                        >
                          {(rolesQuery.data ?? []).map((r) => (
                            <option key={r.id} value={r.id}>{r.name}</option>
                          ))}
                        </Select>
                      ) : (
                        <Badge fontSize="10px" colorScheme={ROLE_COLORS[m.roleName] ?? "gray"}>
                          {m.roleName}
                        </Badge>
                      )}
                    </Td>
                    <Td py={0}>
                      <Badge fontSize="10px" colorScheme={m.isActive ? "green" : "gray"}>
                        {m.isActive ? "active" : "inactive"}
                      </Badge>
                    </Td>
                    <Td py={0}>
                      <Text fontSize="xs" color="gray.400">
                        {m.joinedAt ? new Date(m.joinedAt).toLocaleDateString() : "—"}
                      </Text>
                    </Td>
                    <Td py={0}>
                      <HStack spacing={0}>
                        <Tooltip label={m.isActive ? "Deactivate" : "Reactivate"}>
                          <IconButton
                            aria-label="Toggle active"
                            icon={<FiXCircle size={13} />}
                            size="xs"
                            variant="ghost"
                            color="gray.400"
                            _hover={{ color: "orange.500", bg: "transparent" }}
                            isDisabled={!editable}
                            onClick={() =>
                              updateMember.mutate({
                                tenantId,
                                membershipId: m.id,
                                isActive: !m.isActive,
                              })
                            }
                          />
                        </Tooltip>
                        <Tooltip label="Remove member">
                          <IconButton
                            aria-label="Remove member"
                            icon={<FiTrash2 size={13} />}
                            size="xs"
                            variant="ghost"
                            color="gray.400"
                            _hover={{ color: "red.500", bg: "transparent" }}
                            isDisabled={!editable}
                            onClick={() => {
                              if (confirm(`Remove ${m.userEmail} from this institution?`)) {
                                removeMember.mutate({ tenantId, membershipId: m.id });
                              }
                            }}
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
        {!membersQuery.isLoading && members.length === 0 && (
          <Flex p={8} justify="center">
            <Text color="gray.500" fontSize="sm">No members yet — invite someone to get started.</Text>
          </Flex>
        )}
      </Box>

      {/* Invitations */}
      <Text fontSize="sm" fontWeight="600" color="gray.700" mb={2}>
        Invitations ({pendingCount} pending)
      </Text>
      <Box bg="white" border="1px solid" borderColor="gray.200" borderRadius="lg" overflow="hidden">
        {invitationsQuery.isLoading ? (
          <Flex p={8} justify="center"><Spinner color="blue.500" /></Flex>
        ) : (
          <Table size="sm">
            <Thead bg="gray.50">
              <Tr>
                <Th fontSize="10px" py={3}>Email</Th>
                <Th fontSize="10px" py={3}>Department</Th>
                <Th fontSize="10px" py={3}>Role</Th>
                <Th fontSize="10px" py={3}>Status</Th>
                <Th fontSize="10px" py={3}>Expires</Th>
                <Th fontSize="10px" py={3} w="80px">Actions</Th>
              </Tr>
            </Thead>
            <Tbody>
              {invitations.map((inv) => (
                <Tr
                  key={inv.id}
                  _hover={{ bg: "gray.50" }}
                  opacity={inv.status === "expired" ? 0.6 : 1}
                >
                  <Td py={0}><Text fontSize="sm" color="gray.800">{inv.email}</Text></Td>
                  <Td py={0}><Text fontSize="xs" color="gray.500">{inv.departmentName ?? "—"}</Text></Td>
                  <Td py={0}>
                    <Badge fontSize="10px" colorScheme={ROLE_COLORS[inv.roleName] ?? "gray"}>
                      {inv.roleName}
                    </Badge>
                  </Td>
                  <Td py={0}>
                    <Badge
                      fontSize="10px"
                      colorScheme={
                        inv.status === "accepted" ? "green" : inv.status === "expired" ? "red" : "yellow"
                      }
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
                      <Tooltip label="Revoke">
                        <IconButton
                          aria-label="Revoke"
                          icon={<FiXCircle size={13} />}
                          size="xs"
                          variant="ghost"
                          color="gray.400"
                          _hover={{ color: "red.500", bg: "transparent" }}
                          isLoading={revokeInvitation.isPending}
                          onClick={() => revokeInvitation.mutate({ tenantId, id: inv.id })}
                        />
                      </Tooltip>
                    </HStack>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        )}
        {!invitationsQuery.isLoading && invitations.length === 0 && (
          <Flex p={8} justify="center">
            <Text color="gray.500" fontSize="sm">No invitations yet.</Text>
          </Flex>
        )}
      </Box>

      <InviteMemberModal
        isOpen={isOpen}
        onClose={onClose}
        tenantId={tenantId}
        roles={rolesQuery.data ?? []}
      />
    </Box>
  );
}

function InviteMemberModal({
  isOpen,
  onClose,
  tenantId,
  roles,
}: {
  isOpen: boolean;
  onClose: () => void;
  tenantId: string;
  roles: { id: string; name: string }[];
}) {
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | undefined>(undefined);
  const [roleId, setRoleId] = useState("");
  const [deptId, setDeptId] = useState("");
  const toast = useToast();
  const utils = trpc.useUtils();

  const { data: depts } = trpc.departments.list.useQuery(
    { tenantId },
    { enabled: !!tenantId },
  );

  const sendInvitation = trpc.team.sendInvitation.useMutation({
    onSuccess: () => {
      toast({ title: "Invitation sent", status: "success", duration: 3000 });
      utils.team.listInvitations.invalidate();
      setEmail("");
      setEmailError(undefined);
      setRoleId("");
      setDeptId("");
      onClose();
    },
    onError: (err) =>
      toast({ title: "Failed", description: err.message, status: "error", duration: 5000 }),
  });

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md" isCentered>
      <ModalOverlay bg="blackAlpha.400" backdropFilter="blur(4px)" />
      <ModalContent borderRadius="xl" overflow="hidden" boxShadow="xl">
        <Box bg="gray.50" px={6} pt={5} pb={4} borderBottom="1px solid" borderColor="gray.100">
          <Flex align="center" gap={3}>
            <Flex w={10} h={10} borderRadius="full" bg="blue.100" align="center" justify="center" flexShrink={0}>
              <Icon as={FiMail} boxSize={4} color="blue.600" />
            </Flex>
            <Box>
              <Text fontSize="sm" fontWeight="600" color="gray.800">Invite Member</Text>
              <Text fontSize="xs" color="gray.500">Send an invitation to join your institution</Text>
            </Box>
          </Flex>
        </Box>
        <ModalCloseButton top={3} right={3} size="sm" color="gray.400" _hover={{ color: "gray.600", bg: "transparent" }} />

        <ModalBody px={6} py={5}>
          <VStack spacing={4} align="stretch">
            <FormControl isInvalid={!!emailError}>
              <FormLabel fontSize="xs" color="gray.500" mb={1}>Email Address</FormLabel>
              <Input
                size="sm"
                type="email"
                value={email}
                isInvalid={!!emailError}
                onChange={(e) => {
                  const val = e.target.value;
                  setEmail(val);
                  if (!val.trim()) { setEmailError(undefined); return; }
                  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                  setEmailError(re.test(val) ? undefined : "Invalid email format");
                }}
                placeholder="user@example.com"
                borderRadius="md"
              />
              {emailError && <Text fontSize="xs" color="red.500" mt={1}>{emailError}</Text>}
            </FormControl>

            <HStack spacing={3} align="start">
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
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </Select>
              </FormControl>
              <FormControl>
                <FormLabel fontSize="xs" color="gray.500" mb={1}>Department (optional)</FormLabel>
                <Select
                  size="sm"
                  value={deptId}
                  onChange={(e) => setDeptId(e.target.value)}
                  placeholder="No department"
                  borderRadius="md"
                >
                  {(depts ?? []).map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </Select>
              </FormControl>
            </HStack>
          </VStack>
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
                tenantId,
                email,
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
