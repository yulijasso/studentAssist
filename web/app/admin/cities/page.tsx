/**
 * Admin cities page with table view, toggleable map, and create city modal.
 */
"use client";

import { useState, useMemo } from "react";
import dynamic from "next/dynamic";
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
  Link as ChakraLink,
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
  Icon,
  VStack,
  useDisclosure,
  useToast,
  HStack,
} from "@chakra-ui/react";
import NextLink from "next/link";
import { FiRefreshCw, FiEdit2, FiPlus, FiMap, FiTrash2, FiSearch } from "react-icons/fi";
import { trpc } from "@/lib/trpc";

const CityMap = dynamic(() => import("@/components/CityMap"), { ssr: false });
const LocationAutocomplete = dynamic(
  () => import("@/components/LocationAutocomplete"),
  { ssr: false },
);

export default function AdminCitiesPage() {
  const { data: cities, isLoading } = trpc.admin.listCities.useQuery();
  const triggerCrawl = trpc.admin.triggerCrawl.useMutation();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [showMap, setShowMap] = useState(false);
  const [deletingCity, setDeletingCity] = useState<{ id: string; name: string } | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");

  const filtered = useMemo(() => {
    let result = cities ?? [];
    if (statusFilter === "active") result = result.filter((c) => c.isActive);
    if (statusFilter === "inactive") result = result.filter((c) => !c.isActive);
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.slug.toLowerCase().includes(q) ||
          (c.location ?? "").toLowerCase().includes(q),
      );
    }
    return result;
  }, [cities, search, statusFilter]);

  if (isLoading) {
    return (
      <Flex p={8} justify="center">
        <Spinner color="blue.500" />
      </Flex>
    );
  }

  return (
    <Box p={8}>
      <Flex justify="space-between" align="center" mb={6}>
        <Text fontSize="2xl" fontWeight="700" color="gray.800">
          Cities
        </Text>
        <HStack spacing={5}>
          <VStack spacing={0} align="center">
            <Text fontSize="lg" fontWeight="700" color="gray.800">
              {cities?.length ?? 0}
            </Text>
            <Text fontSize="10px" color="gray.400" textTransform="uppercase" letterSpacing="wider">
              Total
            </Text>
          </VStack>
          <Box h="28px" w="1px" bg="gray.200" />
          <VStack spacing={0} align="center">
            <Text fontSize="lg" fontWeight="700" color="green.500">
              {cities?.filter((c) => c.isActive).length ?? 0}
            </Text>
            <Text fontSize="10px" color="gray.400" textTransform="uppercase" letterSpacing="wider">
              Active
            </Text>
          </VStack>
          <Box h="28px" w="1px" bg="gray.200" />
          <VStack spacing={0} align="center">
            <Text fontSize="lg" fontWeight="700" color="red.500">
              {cities?.filter((c) => !c.isActive).length ?? 0}
            </Text>
            <Text fontSize="10px" color="gray.400" textTransform="uppercase" letterSpacing="wider">
              Inactive
            </Text>
          </VStack>
          <Box h="28px" w="1px" bg="gray.200" />
          <Select
            size="sm"
            w="130px"
            fontSize="xs"
            borderRadius="lg"
            bg="white"
            border="1px solid"
            borderColor="gray.200"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </Select>
          <Box h="28px" w="1px" bg="gray.200" />
          <InputGroup size="sm" w="220px">
            <InputLeftElement>
              <Icon as={FiSearch} color="gray.400" boxSize={3} />
            </InputLeftElement>
            <Input
              placeholder="Search cities..."
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
          <Box h="28px" w="1px" bg="gray.200" />
          <Button
            size="sm"
            variant="ghost"
            leftIcon={<FiMap size={14} />}
            fontWeight="500"
            color={showMap ? "blue.600" : "gray.500"}
            _hover={{ bg: "gray.100", color: "blue.600" }}
            onClick={() => setShowMap(!showMap)}
          >
            Map
          </Button>
          <Button
            size="sm"
            variant="ghost"
            leftIcon={<FiPlus size={14} />}
            fontWeight="500"
            color="gray.500"
            _hover={{ bg: "gray.100", color: "blue.600" }}
            onClick={onOpen}
          >
            Add City
          </Button>
        </HStack>
      </Flex>

      {/* Map (toggleable) */}
      {showMap && (
        <Box mb={6}>
          <CityMap cities={cities ?? []} height="400px" />
        </Box>
      )}

      <Box
        bg="white"
        border="1px solid"
        borderColor="gray.200"
        borderRadius="lg"
        overflow="hidden"
      >
        <Table size="sm">
          <Thead bg="gray.50">
            <Tr>
              <Th fontSize="10px" py={3}>Name</Th>
              <Th fontSize="10px" py={3}>Location</Th>
              <Th fontSize="10px" py={3}>Status</Th>
              <Th fontSize="10px" py={3} isNumeric>Conversations</Th>
              <Th fontSize="10px" py={3} w="80px">Actions</Th>
            </Tr>
          </Thead>
          <Tbody>
            {filtered.map((city) => (
              <Tr key={city.id} _hover={{ bg: "gray.50" }}>
                <Td py={0.5} fontWeight="500">
                  <ChakraLink
                    as={NextLink}
                    href={`/admin/cities/${city.id}`}
                    color="blue.600"
                    _hover={{ textDecoration: "underline" }}
                  >
                    {city.name}
                  </ChakraLink>
                </Td>
                <Td py={0.5}>
                  <Text fontSize="xs" color="gray.500">
                    {city.location ?? "—"}
                  </Text>
                </Td>
                <Td py={0.5}>
                  <Badge
                    colorScheme={city.isActive ? "green" : "red"}
                    fontSize="10px"
                  >
                    {city.isActive ? "Active" : "Inactive"}
                  </Badge>
                </Td>
                <Td py={0.5} isNumeric>{city.conversationCount}</Td>
                <Td py={0.5}>
                  <Flex gap={1}>
                    <Tooltip label="Edit city">
                      <IconButton
                        as={NextLink}
                        href={`/admin/cities/${city.id}`}
                        aria-label="Edit"
                        icon={<FiEdit2 />}
                        size="xs"
                        variant="ghost"
                      />
                    </Tooltip>
                    <Tooltip label="Trigger crawl">
                      <IconButton
                        aria-label="Crawl"
                        icon={<FiRefreshCw />}
                        size="xs"
                        variant="ghost"
                        isLoading={triggerCrawl.isPending}
                        onClick={() =>
                          triggerCrawl.mutate({ tenantId: city.id })
                        }
                      />
                    </Tooltip>
                    <Tooltip label="Delete city">
                      <IconButton
                        aria-label="Delete"
                        icon={<FiTrash2 />}
                        size="xs"
                        variant="ghost"
                        color="gray.400"
                        _hover={{ color: "red.500" }}
                        onClick={() => setDeletingCity({ id: city.id, name: city.name })}
                      />
                    </Tooltip>
                  </Flex>
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
        {filtered.length === 0 && (
          <Flex p={8} justify="center">
            <Text color="gray.500" fontSize="sm">
              {search || statusFilter !== "all"
                ? "No cities match your filters"
                : "No cities yet. Click \"Add City\" to get started."}
            </Text>
          </Flex>
        )}
      </Box>

      <CreateCityModal isOpen={isOpen} onClose={onClose} />
      {deletingCity && (
        <DeleteCityModal
          cityId={deletingCity.id}
          cityName={deletingCity.name}
          onClose={() => setDeletingCity(null)}
        />
      )}
    </Box>
  );
}

/**
 * Modal for creating a new city with location autocomplete.
 */
function CreateCityModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [domain, setDomain] = useState("");
  const [location, setLocation] = useState("");
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const toast = useToast();
  const utils = trpc.useUtils();

  const createCity = trpc.tenants.create.useMutation({
    onSuccess: () => {
      toast({ title: "City created", status: "success", duration: 3000 });
      utils.admin.listCities.invalidate();
      setName("");
      setSlug("");
      setDomain("");
      setLocation("");
      setLat(null);
      setLng(null);
      onClose();
    },
    onError: (err) => {
      toast({
        title: "Failed",
        description: err.message,
        status: "error",
        duration: 5000,
      });
    },
  });

  /**
   * Auto-generate slug from name.
   */
  function handleNameChange(val: string) {
    setName(val);
    setSlug(
      val
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, ""),
    );
  }

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
              <FiMap size={16} color="#3182ce" />
            </Flex>
            <Box>
              <Text fontSize="sm" fontWeight="600" color="gray.800">
                Add New City
              </Text>
              <Text fontSize="xs" color="gray.500">
                Register a new city or organization
              </Text>
            </Box>
          </Flex>
        </Box>
        <ModalCloseButton top={3} right={3} size="sm" color="gray.400" _hover={{ color: "gray.600", bg: "transparent" }} />

        <ModalBody px={6} py={5}>
          {/* City Details */}
          <Box border="1px solid" borderColor="gray.100" borderRadius="lg" overflow="hidden" mb={4}>
            <Flex px={4} py={2.5} bg="gray.50" borderBottom="1px solid" borderColor="gray.100">
              <Text fontSize="11px" fontWeight="600" color="gray.500" textTransform="uppercase" letterSpacing="wider">
                City Details
              </Text>
            </Flex>
            <Box px={4} py={3}>
              <FormControl mb={3}>
                <FormLabel fontSize="xs" color="gray.500" mb={1}>City / Organization Name</FormLabel>
                <Input
                  size="sm"
                  value={name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="e.g. City of Edinburg"
                  borderRadius="md"
                  _focus={{ borderColor: "blue.400", boxShadow: "0 0 0 1px #3182ce" }}
                />
              </FormControl>
              <HStack spacing={3}>
                <FormControl>
                  <FormLabel fontSize="xs" color="gray.500" mb={1}>Slug</FormLabel>
                  <Input
                    size="sm"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    placeholder="city-of-edinburg"
                    fontFamily="mono"
                    borderRadius="md"
                    bg={slug ? "gray.50" : "white"}
                    _focus={{ borderColor: "blue.400", boxShadow: "0 0 0 1px #3182ce" }}
                  />
                </FormControl>
                <FormControl>
                  <FormLabel fontSize="xs" color="gray.500" mb={1}>Website Domain</FormLabel>
                  <Input
                    size="sm"
                    value={domain}
                    onChange={(e) => setDomain(e.target.value)}
                    placeholder="cityofedinburg.com"
                    borderRadius="md"
                    _focus={{ borderColor: "blue.400", boxShadow: "0 0 0 1px #3182ce" }}
                  />
                </FormControl>
              </HStack>
            </Box>
          </Box>

          {/* Location */}
          <Box border="1px solid" borderColor="gray.100" borderRadius="lg" overflow="hidden">
            <Flex px={4} py={2.5} bg="gray.50" borderBottom="1px solid" borderColor="gray.100">
              <Text fontSize="11px" fontWeight="600" color="gray.500" textTransform="uppercase" letterSpacing="wider">
                Location
              </Text>
            </Flex>
            <Box px={4} py={3}>
              <LocationAutocomplete
                latitude={lat}
                longitude={lng}
                locationName={location}
                onSelect={(newLat, newLng, displayName) => {
                  setLocation(displayName);
                  setLat(newLat);
                  setLng(newLng);
                }}
              />
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
            isLoading={createCity.isPending}
            isDisabled={!name || !slug || !domain}
            onClick={() =>
              createCity.mutate({
                name,
                slug,
                websiteDomain: domain,
                location: location || undefined,
              })
            }
          >
            Create City
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

/**
 * Modal for deleting a city with typed confirmation.
 */
function DeleteCityModal({
  cityId,
  cityName,
  onClose,
}: {
  cityId: string;
  cityName: string;
  onClose: () => void;
}) {
  const [confirmText, setConfirmText] = useState("");
  const toast = useToast();
  const utils = trpc.useUtils();

  const deleteCity = trpc.admin.deleteCity.useMutation({
    onSuccess: () => {
      utils.admin.listCities.invalidate();
      toast({ title: "City deleted permanently", status: "info", duration: 2000 });
      onClose();
    },
    onError: (err) => {
      toast({ title: "Delete failed", description: err.message, status: "error", duration: 5000 });
    },
  });

  return (
    <Modal isOpen onClose={onClose} size="sm" isCentered>
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
                Delete {cityName}?
              </Text>
              <Text fontSize="xs" color="gray.500">
                This will permanently remove the city and all its departments, conversations, messages, and member assignments.
              </Text>
            </Box>
          </Flex>

          <FormControl>
            <FormLabel fontSize="xs" color="gray.500" mb={1} textAlign="left">
              Type &quot;Delete city&quot; to confirm
            </FormLabel>
            <Input
              size="sm"
              borderRadius="md"
              placeholder="Delete city"
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
            isLoading={deleteCity.isPending}
            isDisabled={confirmText !== "Delete city"}
            onClick={() => deleteCity.mutate({ tenantId: cityId })}
          >
            Delete City
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
