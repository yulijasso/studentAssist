"use client";

import { useState } from "react";
import {
  Box,
  Heading,
  Text,
  VStack,
  HStack,
  Icon,
  Button,
  Input,
  Badge,
  Flex,
  IconButton,
  Spinner,
} from "@chakra-ui/react";
import {
  FiUsers,
  FiPlus,
  FiTrash2,
  FiPhone,
  FiMail,
  FiTag,
  FiEdit2,
  FiX,
  FiCheck,
  FiClock,
} from "react-icons/fi";
import { trpc } from "@/lib/trpc";
import { useTenant } from "@/lib/use-tenant";

export default function DepartmentsPage() {
  const { tenantId } = useTenant();

  // Fetch departments
  const deptsQuery = trpc.departments.list.useQuery(
    { tenantId: tenantId! },
    { enabled: !!tenantId },
  );
  const departments = deptsQuery.data ?? [];

  // Mutations
  const utils = trpc.useUtils();
  const invalidate = () => utils.departments.list.invalidate();
  const createMut = trpc.departments.create.useMutation({ onSuccess: invalidate });
  const updateMut = trpc.departments.update.useMutation({ onSuccess: invalidate });
  const deleteMut = trpc.departments.delete.useMutation({ onSuccess: invalidate });

  // Local UI state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newKeyword, setNewKeyword] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [newDept, setNewDept] = useState({ name: "", email: "", phone: "", hours: "" });
  const [errors, setErrors] = useState<{ name?: string; email?: string; phone?: string }>({});
  const [editErrors, setEditErrors] = useState<{ email?: string; phone?: string }>({});

  const validateEmail = (email: string) => {
    if (!email.trim()) return undefined;
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email) ? undefined : "Invalid email format";
  };

  const validatePhone = (phone: string) => {
    if (!phone.trim()) return undefined;
    const digits = phone.replace(/\D/g, "");
    if (digits.length === 0) return "Enter a valid phone number";
    if (digits.length < 10) return `Too few digits (${digits.length}/10 minimum)`;
    if (digits.length > 15) return `Too many digits (${digits.length}/15 maximum)`;
    return undefined;
  };

  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, "");
    if (digits.length <= 3) return digits.length > 0 ? `(${digits}` : "";
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
  };

  const handleAdd = () => {
    if (!tenantId) return;
    const nameErr = !newDept.name.trim() ? "Department name is required" : undefined;
    const emailErr = !newDept.email.trim() ? "Contact email is required" : validateEmail(newDept.email);
    const phoneErr = !newDept.phone.trim() ? "Contact phone is required" : validatePhone(newDept.phone);
    setErrors({ name: nameErr, email: emailErr, phone: phoneErr });
    if (nameErr || emailErr || phoneErr) return;

    createMut.mutate({
      tenantId,
      name: newDept.name.trim(),
      email: newDept.email.trim(),
      phone: newDept.phone.trim(),
      hours: newDept.hours.trim() || null,
      keywords: [],
    });
    setNewDept({ name: "", email: "", phone: "", hours: "" });
    setErrors({});
    setShowAddForm(false);
  };

  const handleRemove = (deptId: string) => {
    if (!tenantId) return;
    deleteMut.mutate({ tenantId, deptId });
    if (editingId === deptId) setEditingId(null);
  };

  const getKeywords = (dept: (typeof departments)[0]): string[] => {
    if (!dept.keywords) return [];
    return dept.keywords
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean);
  };

  const handleAddKeyword = (deptId: string) => {
    if (!tenantId || !newKeyword.trim()) return;
    const dept = departments.find((d) => d.id === deptId);
    if (!dept) return;
    const current = getKeywords(dept);
    updateMut.mutate({
      tenantId,
      deptId,
      keywords: [...current, newKeyword.trim().toLowerCase()],
    });
    setNewKeyword("");
  };

  const handleRemoveKeyword = (deptId: string, keyword: string) => {
    if (!tenantId) return;
    const dept = departments.find((d) => d.id === deptId);
    if (!dept) return;
    const current = getKeywords(dept);
    updateMut.mutate({
      tenantId,
      deptId,
      keywords: current.filter((k) => k !== keyword),
    });
  };

  const handleUpdateField = (deptId: string, field: "email" | "phone" | "hours", value: string) => {
    if (!tenantId) return;
    updateMut.mutate({ tenantId, deptId, [field]: value || null });
  };

  if (!tenantId) {
    return (
      <Flex minH="200px" align="center" justify="center">
        <Spinner color="blue.500" />
      </Flex>
    );
  }

  return (
    <Box p={8} maxW="100%">
      <HStack justify="space-between" mb={6}>
        <Box>
          <Heading size="md" color="gray.800">Departments</Heading>
          <Text fontSize="sm" color="gray.500" mt={1}>
            Configure routing keywords and contact info — no code required
          </Text>
        </Box>
        <Button
          size="sm"
          leftIcon={<Icon as={FiPlus} />}
          colorScheme="blue"
          onClick={() => setShowAddForm(!showAddForm)}
        >
          Add Department
        </Button>
      </HStack>

      {showAddForm && (
        <Box bg="white" border="1px solid" borderColor="blue.200" borderRadius="lg" p={5} mb={4}>
          <Text fontWeight="600" fontSize="sm" color="gray.700" mb={3}>New Department</Text>
          <VStack spacing={3} align="stretch">
            <Box>
              <Input
                size="sm"
                placeholder="Department name"
                value={newDept.name}
                isInvalid={!!errors.name}
                onChange={(e) => { setNewDept({ ...newDept, name: e.target.value }); setErrors({ ...errors, name: undefined }); }}
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              />
              {errors.name && <Text fontSize="xs" color="red.500" mt={1}>{errors.name}</Text>}
            </Box>
            <Box>
              <HStack>
                <Box flex={1}>
                  <Input
                    size="sm"
                    placeholder="Contact email"
                    type="email"
                    value={newDept.email}
                    isInvalid={!!errors.email}
                    onChange={(e) => { setNewDept({ ...newDept, email: e.target.value }); setErrors({ ...errors, email: validateEmail(e.target.value) }); }}
                  />
                  {errors.email && <Text fontSize="xs" color="red.500" mt={1}>{errors.email}</Text>}
                </Box>
                <Box flex={1}>
                  <Input
                    size="sm"
                    placeholder="Contact phone"
                    type="tel"
                    value={newDept.phone}
                    isInvalid={!!errors.phone}
                    onChange={(e) => { const formatted = formatPhone(e.target.value); setNewDept({ ...newDept, phone: formatted }); setErrors({ ...errors, phone: undefined }); }}
                  />
                  {errors.phone && <Text fontSize="xs" color="red.500" mt={1}>{errors.phone}</Text>}
                </Box>
              </HStack>
            </Box>
            <Input
              size="sm"
              placeholder="Business hours (e.g. Mon – Fri: 8 AM – 5 PM)"
              value={newDept.hours}
              onChange={(e) => setNewDept({ ...newDept, hours: e.target.value })}
            />
            <HStack justify="flex-end">
              <Button size="sm" variant="ghost" onClick={() => { setShowAddForm(false); setErrors({}); }}>Cancel</Button>
              <Button size="sm" colorScheme="blue" onClick={handleAdd} isLoading={createMut.isPending}>Create</Button>
            </HStack>
          </VStack>
        </Box>
      )}

      <VStack spacing={4} align="stretch">
        {departments.length === 0 && !showAddForm && (
          <Flex
            direction="column"
            align="center"
            py={16}
            color="gray.400"
            bg="white"
            border="1px solid"
            borderColor="gray.200"
            borderRadius="lg"
          >
            <Icon as={FiUsers} boxSize={10} mb={3} />
            <Text fontSize="sm" fontWeight="500" color="gray.500">No departments yet</Text>
            <Text fontSize="xs" color="gray.400" mt={1}>Click &quot;Add Department&quot; to get started</Text>
          </Flex>
        )}
        {departments.map((dept) => {
          const isEditing = editingId === dept.id;
          const keywords = getKeywords(dept);
          return (
            <Box
              key={dept.id}
              bg="white"
              border="1px solid"
              borderColor={isEditing ? "blue.200" : "gray.200"}
              borderRadius="lg"
              overflow="hidden"
              transition="all 0.15s"
            >
              <Flex px={5} py={4} align="center" justify="space-between">
                <HStack spacing={3}>
                  <Flex w={8} h={8} bg="blue.50" borderRadius="md" align="center" justify="center">
                    <Icon as={FiUsers} color="blue.500" boxSize={4} />
                  </Flex>
                  <Box>
                    <Text fontWeight="600" fontSize="sm" color="gray.800">{dept.name}</Text>
                    <HStack spacing={3} fontSize="xs" color="gray.400" flexWrap="wrap">
                      <HStack spacing={1}>
                        <Icon as={FiMail} boxSize={3} />
                        <Text>{dept.email || "—"}</Text>
                      </HStack>
                      <HStack spacing={1}>
                        <Icon as={FiPhone} boxSize={3} />
                        <Text>{dept.phone || "—"}</Text>
                      </HStack>
                      <HStack spacing={1}>
                        <Icon as={FiClock} boxSize={3} />
                        <Text>{dept.hours || "—"}</Text>
                      </HStack>
                    </HStack>
                  </Box>
                </HStack>
                <HStack spacing={2}>
                  <IconButton
                    aria-label="Edit"
                    icon={<Icon as={isEditing ? FiCheck : FiEdit2} />}
                    size="xs"
                    variant="ghost"
                    onClick={() => setEditingId(isEditing ? null : dept.id)}
                  />
                  <IconButton
                    aria-label="Delete"
                    icon={<Icon as={FiTrash2} />}
                    size="xs"
                    variant="ghost"
                    color="gray.400"
                    _hover={{ color: "red.500" }}
                    onClick={() => handleRemove(dept.id)}
                  />
                </HStack>
              </Flex>

              <Box px={5} pb={4}>
                <HStack spacing={1} mb={2}>
                  <Icon as={FiTag} boxSize={3} color="gray.400" />
                  <Text fontSize="xs" fontWeight="500" color="gray.500">Routing Keywords</Text>
                </HStack>
                <Flex gap={2} flexWrap="wrap">
                  {keywords.map((kw, i) => (
                    <Badge
                      key={`${kw}-${i}`}
                      px={2}
                      py={0.5}
                      borderRadius="full"
                      fontSize="11px"
                      colorScheme="gray"
                      variant="subtle"
                      display="flex"
                      alignItems="center"
                      gap={1}
                    >
                      {kw}
                      {isEditing && (
                        <Icon
                          as={FiX}
                          boxSize={3}
                          cursor="pointer"
                          _hover={{ color: "red.500" }}
                          onClick={() => handleRemoveKeyword(dept.id, kw)}
                        />
                      )}
                    </Badge>
                  ))}
                  {keywords.length === 0 && (
                    <Text fontSize="xs" color="gray.300">No keywords</Text>
                  )}
                </Flex>
              </Box>

              {isEditing && (
                <Box px={5} pb={4} pt={2} borderTop="1px solid" borderColor="gray.100">
                  <VStack spacing={3} align="stretch">
                    <HStack>
                      <Input
                        size="sm"
                        placeholder="Add keyword..."
                        value={newKeyword}
                        onChange={(e) => setNewKeyword(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleAddKeyword(dept.id)}
                      />
                      <Button size="sm" onClick={() => handleAddKeyword(dept.id)} leftIcon={<Icon as={FiPlus} />}>
                        Add
                      </Button>
                    </HStack>
                    <HStack align="start">
                      <Box flex={1}>
                        <Input
                          size="sm"
                          placeholder="Email"
                          type="email"
                          defaultValue={dept.email ?? ""}
                          isInvalid={!!editErrors.email}
                          onBlur={(e) => {
                            const err = validateEmail(e.target.value);
                            setEditErrors((prev) => ({ ...prev, email: err }));
                            if (!err) handleUpdateField(dept.id, "email", e.target.value);
                          }}
                        />
                        {editErrors.email && <Text fontSize="xs" color="red.500" mt={1}>{editErrors.email}</Text>}
                      </Box>
                      <Box flex={1}>
                        <Input
                          size="sm"
                          placeholder="Contact phone"
                          type="tel"
                          defaultValue={dept.phone ?? ""}
                          isInvalid={!!editErrors.phone}
                          onBlur={(e) => {
                            const formatted = formatPhone(e.target.value);
                            const err = validatePhone(formatted);
                            setEditErrors((prev) => ({ ...prev, phone: err }));
                            if (!err) handleUpdateField(dept.id, "phone", formatted);
                          }}
                        />
                        {editErrors.phone && <Text fontSize="xs" color="red.500" mt={1}>{editErrors.phone}</Text>}
                      </Box>
                    </HStack>
                    <Input
                      size="sm"
                      placeholder="Business hours (e.g. Mon – Fri: 8 AM – 5 PM)"
                      defaultValue={dept.hours ?? ""}
                      onBlur={(e) => handleUpdateField(dept.id, "hours", e.target.value)}
                    />
                  </VStack>
                </Box>
              )}
            </Box>
          );
        })}
      </VStack>
    </Box>
  );
}
