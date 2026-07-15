/**
 * City detail page for the tech admin dashboard.
 *
 * Provides tabbed management of a single tenant: General settings (editable),
 * Departments, Knowledge Base (documents + FAQs), and Members.
 */
"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import {
  Box,
  Flex,
  Text,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  Spinner,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Badge,
  Button,
  IconButton,
  Tooltip,
  VStack,
  HStack,
  Input,
  Switch,
  FormControl,
  FormLabel,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalBody,
  ModalFooter,
  ModalCloseButton,
  useToast,
} from "@chakra-ui/react";
import { useParams, useRouter } from "next/navigation";
import {
  FiTrash2,
  FiArrowLeft,
  FiSave,
  FiRefreshCw,
} from "react-icons/fi";
import NextLink from "next/link";
import { trpc } from "@/lib/trpc";

const LocationAutocomplete = dynamic(() => import("@/components/LocationAutocomplete"), { ssr: false });

const ROLE_COLORS: Record<string, string> = {
  tech_admin: "purple",
  city_admin: "blue",
  supervisor: "teal",
  staff: "cyan",
  member: "gray",
};

export default function AdminCityDetailPage() {
  const params = useParams();
  const tenantId = params.tenantId as string;

  const { data: cities, isLoading: citiesLoading } =
    trpc.admin.listCities.useQuery();
  const { data: members, isLoading: membersLoading } =
    trpc.admin.listMembers.useQuery({ tenantId });
  const { data: depts, isLoading: deptsLoading } =
    trpc.departments.list.useQuery({ tenantId });

  const city = cities?.find((c) => c.id === tenantId);
  const triggerCrawl = trpc.admin.triggerCrawl.useMutation();
  const utils = trpc.useUtils();
  const [deletingMember, setDeletingMember] = useState<{ id: string; name: string } | null>(null);

  if (citiesLoading) {
    return (
      <Flex p={8} justify="center">
        <Spinner color="blue.500" />
      </Flex>
    );
  }

  if (!city) {
    return (
      <Box p={8}>
        <Text color="red.500">City not found</Text>
      </Box>
    );
  }

  return (
    <Box p={8}>
      <HStack spacing={3} mb={6}>
        <IconButton
          as={NextLink}
          href="/admin/cities"
          aria-label="Back"
          icon={<FiArrowLeft />}
          size="sm"
          variant="ghost"
        />
        <Box>
          <Text fontSize="2xl" fontWeight="700" color="gray.800">
            {city.name}
          </Text>
          <Text fontSize="sm" color="gray.500" fontFamily="mono">
            {city.slug}
          </Text>
        </Box>
        <Badge colorScheme={city.isActive ? "green" : "red"} ml={2}>
          {city.isActive ? "Active" : "Inactive"}
        </Badge>
      </HStack>

      <Tabs colorScheme="blue" size="sm">
        <TabList>
          <Tab>General</Tab>
          <Tab>Departments</Tab>
          <Tab>Knowledge Base</Tab>
          <Tab>Members</Tab>
        </TabList>

        <TabPanels>
          {/* General Tab */}
          <TabPanel px={0}>
            <GeneralTab city={city} tenantId={tenantId} />
          </TabPanel>

          {/* Departments Tab */}
          <TabPanel px={0}>
            <Box
              bg="white"
              border="1px solid"
              borderColor="gray.200"
              borderRadius="lg"
              overflow="hidden"
            >
              {deptsLoading ? (
                <Flex p={6} justify="center">
                  <Spinner size="sm" color="blue.500" />
                </Flex>
              ) : (
                <Table size="sm">
                  <Thead bg="gray.50">
                    <Tr>
                      <Th fontSize="10px" py={2}>Name</Th>
                      <Th fontSize="10px" py={2}>Phone</Th>
                      <Th fontSize="10px" py={2}>Email</Th>
                      <Th fontSize="10px" py={2}>Hours</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {depts?.map((d) => (
                      <Tr key={d.id} _hover={{ bg: "gray.50" }}>
                        <Td py={1} fontWeight="500">{d.name}</Td>
                        <Td py={1} fontSize="xs">{d.phone ?? "—"}</Td>
                        <Td py={1} fontSize="xs">{d.email ?? "—"}</Td>
                        <Td py={1} fontSize="xs">{d.hours ?? "—"}</Td>
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
              )}
              {!deptsLoading && depts?.length === 0 && (
                <Flex p={6} justify="center">
                  <Text color="gray.500" fontSize="sm">
                    No departments configured
                  </Text>
                </Flex>
              )}
            </Box>
          </TabPanel>

          {/* Knowledge Base Tab */}
          <TabPanel px={0}>
            <Box
              bg="white"
              border="1px solid"
              borderColor="gray.200"
              borderRadius="lg"
              p={6}
            >
              <Flex justify="space-between" align="center" mb={4}>
                <Text fontSize="sm" fontWeight="600" color="gray.700">
                  Knowledge Base
                </Text>
                <Button
                  leftIcon={<FiRefreshCw />}
                  size="xs"
                  colorScheme="blue"
                  variant="outline"
                  isLoading={triggerCrawl.isPending}
                  onClick={() => triggerCrawl.mutate({ tenantId })}
                >
                  Trigger Crawl
                </Button>
              </Flex>
              <Text fontSize="sm" color="gray.500">
                Document ingestion and FAQ management will be available in Phase
                2. Use the crawl button to trigger a web crawl for this city.
              </Text>
            </Box>
          </TabPanel>

          {/* Members Tab */}
          <TabPanel px={0}>
            <Box
              bg="white"
              border="1px solid"
              borderColor="gray.200"
              borderRadius="lg"
              overflow="hidden"
            >
              {membersLoading ? (
                <Flex p={6} justify="center">
                  <Spinner size="sm" color="blue.500" />
                </Flex>
              ) : (
                <Table size="sm">
                  <Thead bg="gray.50">
                    <Tr>
                      <Th fontSize="10px" py={2}>Name</Th>
                      <Th fontSize="10px" py={2}>Email</Th>
                      <Th fontSize="10px" py={2}>Role</Th>
                      <Th fontSize="10px" py={2}>Status</Th>
                      <Th fontSize="10px" py={2}>Joined</Th>
                      <Th fontSize="10px" py={2}>Actions</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {members?.map((m) => (
                      <Tr key={m.id} _hover={{ bg: "gray.50" }}>
                        <Td py={0}>{m.userName ?? "—"}</Td>
                        <Td py={0} fontSize="xs">{m.userEmail}</Td>
                        <Td py={0}>
                          <Badge fontSize="10px" colorScheme={ROLE_COLORS[m.roleName] ?? "gray"}>{m.roleName}</Badge>
                        </Td>
                        <Td py={0}>
                          <Badge
                            colorScheme={m.isActive ? "green" : "gray"}
                            fontSize="10px"
                          >
                            {m.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </Td>
                        <Td py={0} fontSize="xs">
                          {m.joinedAt
                            ? new Date(m.joinedAt).toLocaleDateString()
                            : "—"}
                        </Td>
                        <Td py={0}>
                          <Tooltip label="Remove member">
                            <IconButton
                              aria-label="Remove"
                              icon={<FiTrash2 />}
                              size="xs"
                              variant="ghost"
                              color="gray.400"
                              _hover={{ color: "red.500" }}
                              onClick={() =>
                                setDeletingMember({ id: m.id, name: m.userName ?? m.userEmail })
                              }
                            />
                          </Tooltip>
                        </Td>
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
              )}
              {!membersLoading && members?.length === 0 && (
                <Flex p={6} justify="center">
                  <Text color="gray.500" fontSize="sm">
                    No members yet. Send an invitation from the Invitations
                    page.
                  </Text>
                </Flex>
              )}
            </Box>
          </TabPanel>
        </TabPanels>
      </Tabs>

      {deletingMember && (
        <DeleteMemberModal
          membershipId={deletingMember.id}
          memberName={deletingMember.name}
          onClose={() => setDeletingMember(null)}
          onSuccess={() => {
            utils.admin.listMembers.invalidate();
            setDeletingMember(null);
          }}
        />
      )}
    </Box>
  );
}

/**
 * Editable General settings tab for a city.
 *
 * @param city - The city data from listCities query.
 * @param tenantId - The tenant UUID.
 */
function GeneralTab({
  city,
  tenantId,
}: {
  city: {
    name: string;
    websiteDomain: string;
    isActive: boolean;
    conversationCount: number;
    location: string | null;
    latitude: number | null;
    longitude: number | null;
    createdAt: string | Date;
  };
  tenantId: string;
}) {
  const [name, setName] = useState(city.name);
  const [domain, setDomain] = useState(city.websiteDomain);
  const [location, setLocation] = useState(city.location ?? "");
  const [lat, setLat] = useState(city.latitude?.toString() ?? "");
  const [lng, setLng] = useState(city.longitude?.toString() ?? "");
  const [isActive, setIsActive] = useState(city.isActive);
  const toast = useToast();
  const utils = trpc.useUtils();

  const updateCity = trpc.admin.updateCity.useMutation({
    onSuccess: () => {
      toast({ title: "City updated", status: "success", duration: 3000 });
      utils.admin.listCities.invalidate();
    },
    onError: (err) => {
      toast({
        title: "Update failed",
        description: err.message,
        status: "error",
        duration: 5000,
      });
    },
  });

  const hasChanges =
    name !== city.name ||
    domain !== city.websiteDomain ||
    location !== (city.location ?? "") ||
    lat !== (city.latitude?.toString() ?? "") ||
    lng !== (city.longitude?.toString() ?? "") ||
    isActive !== city.isActive;

  /**
   * Saves the edited general settings to the backend.
   */
  function handleSave() {
    updateCity.mutate({
      id: tenantId,
      name: name || undefined,
      websiteDomain: domain || undefined,
      location: location || null,
      latitude: lat ? parseFloat(lat) : null,
      longitude: lng ? parseFloat(lng) : null,
      isActive,
    });
  }

  return (
    <>
    <Box
      bg="white"
      border="1px solid"
      borderColor="gray.200"
      borderRadius="lg"
      p={6}
    >
      <VStack align="stretch" spacing={5}>
        <FormControl>
          <FormLabel fontSize="sm" color="gray.600">
            City Name
          </FormLabel>
          <Input
            size="sm"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </FormControl>

        <FormControl>
          <FormLabel fontSize="sm" color="gray.600">
            Website Domain
          </FormLabel>
          <Input
            size="sm"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            placeholder="e.g. cityname.gov"
          />
        </FormControl>

        <LocationAutocomplete
          latitude={lat ? parseFloat(lat) : null}
          longitude={lng ? parseFloat(lng) : null}
          locationName={location}
          onSelect={(newLat, newLng, displayName) => {
            setLocation(displayName);
            setLat(newLat.toString());
            setLng(newLng.toString());
          }}
        />

        <FormControl display="flex" alignItems="center">
          <FormLabel fontSize="sm" color="gray.600" mb={0}>
            Active
          </FormLabel>
          <Switch
            colorScheme="green"
            isChecked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
          />
        </FormControl>

        <Flex
          justify="space-between"
          pt={3}
          borderTop="1px solid"
          borderColor="gray.100"
        >
          <VStack align="start" spacing={1}>
            <Text fontSize="xs" color="gray.400">
              Conversations: {city.conversationCount}
            </Text>
            <Text fontSize="xs" color="gray.400">
              Created: {new Date(city.createdAt).toLocaleDateString()}
            </Text>
          </VStack>
          <Button
            leftIcon={<FiSave />}
            colorScheme="blue"
            size="sm"
            isLoading={updateCity.isPending}
            isDisabled={!hasChanges}
            onClick={handleSave}
          >
            Save Changes
          </Button>
        </Flex>
      </VStack>
    </Box>

    {/* Delete City */}
    <Box
      bg="white"
      border="1px solid"
      borderColor="gray.200"
      borderRadius="lg"
      overflow="hidden"
      mt={4}
    >
      <Flex px={4} py={2.5} bg="gray.50" borderBottom="1px solid" borderColor="gray.100">
        <Text fontSize="11px" fontWeight="600" color="gray.500" textTransform="uppercase" letterSpacing="wider">
          Danger Zone
        </Text>
      </Flex>
      <DeleteCitySection tenantId={tenantId} cityName={city.name} />
    </Box>
  </>
  );
}

/**
 * Delete city section with confirmation input.
 */
function DeleteCitySection({ tenantId, cityName }: { tenantId: string; cityName: string }) {
  const [showDeleteInput, setShowDeleteInput] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const toast = useToast();
  const router = useRouter();
  const utils = trpc.useUtils();

  const deleteCity = trpc.admin.deleteCity.useMutation({
    onSuccess: () => {
      utils.admin.listCities.invalidate();
      toast({ title: "City deleted permanently", status: "info", duration: 2000 });
      router.push("/admin/cities");
    },
    onError: (err) => {
      toast({ title: "Delete failed", description: err.message, status: "error", duration: 5000 });
    },
  });

  return (
    <>
      <Flex align="center" justify="space-between" px={4} py={3}>
        <HStack spacing={2.5}>
          <Box w="8px" h="8px" borderRadius="full" bg="red.400" />
          <Box>
            <Text fontSize="xs" fontWeight="500" color="gray.700">
              Delete City
            </Text>
            <Text fontSize="10px" color="gray.400">
              Permanently remove {cityName} and all associated data
            </Text>
          </Box>
        </HStack>
        <Button
          size="xs"
          leftIcon={<FiTrash2 />}
          colorScheme="red"
          variant={showDeleteInput ? "solid" : "outline"}
          borderRadius="full"
          isLoading={deleteCity.isPending}
          isDisabled={showDeleteInput && deleteConfirm !== "Delete city"}
          onClick={() => {
            if (!showDeleteInput) {
              setShowDeleteInput(true);
            } else {
              deleteCity.mutate({ tenantId });
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
            placeholder="Type 'Delete city' to confirm"
            value={deleteConfirm}
            onChange={(e) => setDeleteConfirm(e.target.value)}
            bg="gray.50"
            autoFocus
          />
        </Box>
      )}
    </>
  );
}

/**
 * Modal for confirming member removal with typed confirmation.
 */
function DeleteMemberModal({
  membershipId,
  memberName,
  onClose,
  onSuccess,
}: {
  membershipId: string;
  memberName: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [confirmText, setConfirmText] = useState("");
  const toast = useToast();

  const removeMember = trpc.admin.removeMember.useMutation({
    onSuccess: () => {
      toast({ title: "Member removed", status: "info", duration: 2000 });
      onSuccess();
    },
    onError: (err) => {
      toast({ title: "Remove failed", description: err.message, status: "error", duration: 5000 });
    },
  });

  return (
    <Modal isOpen onClose={onClose} size="md" isCentered>
      <ModalOverlay bg="blackAlpha.400" backdropFilter="blur(4px)" />
      <ModalContent borderRadius="xl" overflow="hidden" boxShadow="xl">
        <ModalCloseButton top={3} right={3} size="sm" color="gray.400" _hover={{ color: "gray.600", bg: "transparent" }} />

        <ModalBody px={6} pt={6} pb={5}>
          <Flex align="center" gap={3} mb={4}>
            <Flex
              w={10}
              h={10}
              borderRadius="full"
              bg="red.50"
              align="center"
              justify="center"
              flexShrink={0}
            >
              <FiTrash2 size={16} color="#E53E3E" />
            </Flex>
            <Box>
              <Text fontSize="sm" fontWeight="600" color="gray.800" mb={1}>
                Remove {memberName}?
              </Text>
              <Text fontSize="xs" color="gray.500">
                This will revoke their access to this city. They will need a new invitation or to be reassigned a role at a city to regain access.
              </Text>
            </Box>
          </Flex>

          <FormControl>
            <FormLabel fontSize="xs" color="gray.500" mb={1} textAlign="left">
              Type &quot;Delete member&quot; to confirm
            </FormLabel>
            <Input
              size="sm"
              borderRadius="md"
              placeholder="Delete member"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              autoFocus
              _focus={{ borderColor: "red.400", boxShadow: "0 0 0 1px #E53E3E" }}
            />
          </FormControl>
        </ModalBody>

        <ModalFooter borderTop="1px solid" borderColor="gray.100" px={6} py={3} justifyContent="center">
          <Button variant="ghost" size="sm" mr={2} onClick={onClose} borderRadius="full">
            Cancel
          </Button>
          <Button
            colorScheme="red"
            size="sm"
            borderRadius="full"
            leftIcon={<FiTrash2 />}
            isLoading={removeMember.isPending}
            isDisabled={confirmText !== "Delete member"}
            onClick={() => removeMember.mutate({ membershipId })}
          >
            Remove Member
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
