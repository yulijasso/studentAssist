"use client";

import { useState, useRef } from "react";
import {
  Box,
  Heading,
  Text,
  VStack,
  HStack,
  Icon,
  Button,
  Input,
  Textarea,
  Badge,
  Flex,
  Select,
  IconButton,
  Divider,
  Spinner,
} from "@chakra-ui/react";
import {
  FiUpload,
  FiFile,
  FiPlus,
  FiTrash2,
  FiCheck,
  FiClock,
  FiBook,
  FiEdit2,
} from "react-icons/fi";
import { trpc } from "@/lib/trpc";
import { useTenant } from "@/lib/use-tenant";

const STATUS_CONFIG = {
  ingested: { color: "green", icon: FiCheck, label: "Ingested" },
  processing: { color: "yellow", icon: FiClock, label: "Processing" },
  failed: { color: "red", icon: FiTrash2, label: "Failed" },
} as const;

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function KnowledgeBasePage() {
  const { tenantId } = useTenant();

  // Fetch departments for the filter dropdown
  const deptsQuery = trpc.departments.list.useQuery(
    { tenantId: tenantId! },
    { enabled: !!tenantId },
  );
  const departments = deptsQuery.data ?? [];

  // Fetch documents and FAQs
  const docsQuery = trpc.knowledgeBase.listDocuments.useQuery(
    { tenantId: tenantId! },
    { enabled: !!tenantId },
  );
  const faqsQuery = trpc.knowledgeBase.listFaqs.useQuery(
    { tenantId: tenantId! },
    { enabled: !!tenantId },
  );

  const documents = docsQuery.data ?? [];
  const faqsList = faqsQuery.data ?? [];

  // Mutations
  const utils = trpc.useUtils();
  const uploadDocMut = trpc.knowledgeBase.uploadDocument.useMutation({
    onSuccess: () => utils.knowledgeBase.listDocuments.invalidate(),
  });
  const updateDocStatusMut = trpc.knowledgeBase.updateDocumentStatus.useMutation({
    onSuccess: () => utils.knowledgeBase.listDocuments.invalidate(),
  });
  const deleteDocMut = trpc.knowledgeBase.deleteDocument.useMutation({
    onSuccess: () => utils.knowledgeBase.listDocuments.invalidate(),
  });
  const createFaqMut = trpc.knowledgeBase.createFaq.useMutation({
    onSuccess: () => utils.knowledgeBase.listFaqs.invalidate(),
  });
  const updateFaqMut = trpc.knowledgeBase.updateFaq.useMutation({
    onSuccess: () => utils.knowledgeBase.listFaqs.invalidate(),
  });
  const deleteFaqMut = trpc.knowledgeBase.deleteFaq.useMutation({
    onSuccess: () => utils.knowledgeBase.listFaqs.invalidate(),
  });

  // Local UI state
  const [dragOver, setDragOver] = useState(false);
  const [showFaqForm, setShowFaqForm] = useState(false);
  const [newFaq, setNewFaq] = useState({ question: "", answer: "", departmentId: "" });
  const [filterDeptId, setFilterDeptId] = useState("all");
  const [editingFaqId, setEditingFaqId] = useState<string | null>(null);
  const [editFaq, setEditFaq] = useState({ question: "", answer: "", departmentId: "" });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadFiles = async (files: File[]) => {
    if (!tenantId) return;
    const validFiles = files.filter(
      (f) => f.name.endsWith(".pdf") || f.name.endsWith(".txt"),
    );
    if (validFiles.length === 0) return;

    for (const file of validFiles) {
      const deptId =
        filterDeptId !== "all" ? filterDeptId : departments[0]?.id ?? null;

      // Upload file to /api/upload first
      const formData = new FormData();
      formData.append("file", file);
      formData.append("department", deptId ?? "General");

      try {
        const res = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) continue;
        const data = await res.json();

        // Create DB record
        const doc = await uploadDocMut.mutateAsync({
          tenantId,
          departmentId: deptId,
          name: file.name,
          savedAs: data.savedAs,
          type: file.name.endsWith(".pdf") ? "pdf" : "txt",
          size: file.size,
          textContent: data.textContent ?? null,
        });

        // Mark as ingested
        await updateDocStatusMut.mutateAsync({
          tenantId,
          docId: doc.id,
          status: "ingested",
        });
      } catch {
        // Upload failed — the mutation error is handled by tRPC
      }
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    uploadFiles(Array.from(e.dataTransfer.files));
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      uploadFiles(Array.from(e.target.files));
      e.target.value = "";
    }
  };

  const handleAddFaq = () => {
    if (!tenantId || !newFaq.question.trim() || !newFaq.answer.trim()) return;
    createFaqMut.mutate({
      tenantId,
      departmentId: newFaq.departmentId || null,
      question: newFaq.question,
      answer: newFaq.answer,
    });
    setNewFaq({ question: "", answer: "", departmentId: departments[0]?.id ?? "" });
    setShowFaqForm(false);
  };

  const removeDoc = (id: string) => {
    if (!tenantId) return;
    deleteDocMut.mutate({ tenantId, docId: id });
  };

  const removeFaq = (id: string) => {
    if (!tenantId) return;
    deleteFaqMut.mutate({ tenantId, faqId: id });
    if (editingFaqId === id) setEditingFaqId(null);
  };

  const startEditFaq = (faq: (typeof faqsList)[0]) => {
    setEditingFaqId(faq.id);
    setEditFaq({
      question: faq.question,
      answer: faq.answer,
      departmentId: faq.departmentId ?? "",
    });
  };

  const saveEditFaq = () => {
    if (!tenantId || !editingFaqId || !editFaq.question.trim() || !editFaq.answer.trim())
      return;
    updateFaqMut.mutate({
      tenantId,
      faqId: editingFaqId,
      question: editFaq.question,
      answer: editFaq.answer,
      departmentId: editFaq.departmentId || null,
    });
    setEditingFaqId(null);
  };

  // Filter by department
  const filteredDocs =
    filterDeptId === "all"
      ? documents
      : documents.filter((d) => d.departmentId === filterDeptId);
  const filteredFaqs =
    filterDeptId === "all"
      ? faqsList
      : faqsList.filter((f) => f.departmentId === filterDeptId);

  // Helper to get department name by id
  const getDeptName = (deptId: string | null) => {
    if (!deptId) return "General";
    return departments.find((d) => d.id === deptId)?.name ?? "General";
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
          <Heading size="md" color="gray.800">
            Knowledge Base
          </Heading>
          <Text fontSize="sm" color="gray.500" mt={1}>
            Upload documents and manage FAQs per department
          </Text>
        </Box>
        <Select
          size="sm"
          w="200px"
          value={filterDeptId}
          onChange={(e) => setFilterDeptId(e.target.value)}
        >
          <option value="all">All Departments</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </Select>
      </HStack>

      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        style={{ display: "none" }}
        accept=".pdf,.txt"
        multiple
        onChange={handleFileSelect}
      />

      {/* Document Upload Zone */}
      <Box
        border="2px dashed"
        borderColor={dragOver ? "blue.400" : "gray.200"}
        borderRadius="lg"
        p={8}
        mb={6}
        textAlign="center"
        bg={dragOver ? "blue.50" : "white"}
        transition="all 0.15s"
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        cursor="pointer"
        onClick={() => fileInputRef.current?.click()}
      >
        <Icon as={FiUpload} boxSize={8} color="gray.400" mb={3} />
        <Text fontSize="sm" color="gray.600" fontWeight="500">
          Drag & drop PDF or TXT files here
        </Text>
        <Text fontSize="xs" color="gray.400" mt={1}>
          or click to browse — files are uploaded per department
        </Text>
      </Box>

      {/* Documents Table */}
      <Box mb={8}>
        <Text fontWeight="600" fontSize="sm" color="gray.700" mb={3}>
          Documents ({filteredDocs.length})
        </Text>
        <VStack
          spacing={0}
          align="stretch"
          bg="white"
          borderRadius="lg"
          border="1px solid"
          borderColor="gray.200"
          overflow="hidden"
        >
          {filteredDocs.length === 0 && (
            <Text fontSize="sm" color="gray.400" p={4} textAlign="center">
              No documents uploaded
            </Text>
          )}
          {filteredDocs.map((doc) => {
            const cfg = STATUS_CONFIG[doc.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.processing;
            return (
              <Flex
                key={doc.id}
                px={4}
                py={3}
                align="center"
                justify="space-between"
                borderBottom="1px solid"
                borderColor="gray.100"
                _last={{ borderBottom: "none" }}
              >
                <HStack spacing={3} flex={1}>
                  <Icon as={FiFile} color="gray.400" />
                  <Box>
                    <Text fontSize="sm" fontWeight="500" color="gray.700">
                      {doc.name}
                    </Text>
                    <Text fontSize="xs" color="gray.400">
                      {getDeptName(doc.departmentId)} &middot;{" "}
                      {formatSize(doc.size)} &middot;{" "}
                      {new Date(doc.createdAt).toLocaleDateString()}
                    </Text>
                  </Box>
                </HStack>
                <HStack spacing={3}>
                  <Badge
                    colorScheme={cfg.color}
                    fontSize="10px"
                    display="flex"
                    alignItems="center"
                    gap={1}
                  >
                    <Icon as={cfg.icon} boxSize={3} />
                    {cfg.label}
                  </Badge>
                  <IconButton
                    aria-label="Remove"
                    icon={<Icon as={FiTrash2} />}
                    size="xs"
                    variant="ghost"
                    color="gray.400"
                    _hover={{ color: "red.500" }}
                    onClick={() => removeDoc(doc.id)}
                  />
                </HStack>
              </Flex>
            );
          })}
        </VStack>
      </Box>

      <Divider mb={8} />

      {/* Manual FAQ Section */}
      <Box>
        <HStack justify="space-between" mb={3}>
          <Box>
            <Text fontWeight="600" fontSize="sm" color="gray.700">
              Manual FAQs ({filteredFaqs.length})
            </Text>
            <Text fontSize="xs" color="gray.400">
              Add and edit Q&A pairs directly
            </Text>
          </Box>
          <Button
            size="sm"
            leftIcon={<Icon as={FiPlus} />}
            variant="outline"
            onClick={() => setShowFaqForm(!showFaqForm)}
          >
            Add FAQ
          </Button>
        </HStack>

        {/* Add FAQ Form */}
        {showFaqForm && (
          <Box
            bg="white"
            border="1px solid"
            borderColor="gray.200"
            borderRadius="lg"
            p={4}
            mb={4}
          >
            <VStack spacing={3} align="stretch">
              <Select
                size="sm"
                value={newFaq.departmentId}
                onChange={(e) =>
                  setNewFaq({ ...newFaq, departmentId: e.target.value })
                }
              >
                <option value="">General</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </Select>
              <Input
                size="sm"
                placeholder="Question"
                value={newFaq.question}
                onChange={(e) =>
                  setNewFaq({ ...newFaq, question: e.target.value })
                }
              />
              <Textarea
                size="sm"
                placeholder="Answer"
                rows={3}
                value={newFaq.answer}
                onChange={(e) =>
                  setNewFaq({ ...newFaq, answer: e.target.value })
                }
              />
              <HStack justify="flex-end">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowFaqForm(false)}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  colorScheme="blue"
                  onClick={handleAddFaq}
                  isLoading={createFaqMut.isPending}
                >
                  Save
                </Button>
              </HStack>
            </VStack>
          </Box>
        )}

        {/* FAQ List */}
        <VStack
          spacing={0}
          align="stretch"
          bg="white"
          borderRadius="lg"
          border="1px solid"
          borderColor="gray.200"
          overflow="hidden"
        >
          {filteredFaqs.length === 0 && (
            <Text fontSize="sm" color="gray.400" p={4} textAlign="center">
              No FAQs added
            </Text>
          )}
          {filteredFaqs.map((faq) => (
            <Box
              key={faq.id}
              px={4}
              py={3}
              borderBottom="1px solid"
              borderColor="gray.100"
              _last={{ borderBottom: "none" }}
            >
              {editingFaqId === faq.id ? (
                <VStack spacing={3} align="stretch">
                  <Select
                    size="sm"
                    value={editFaq.departmentId}
                    onChange={(e) =>
                      setEditFaq({ ...editFaq, departmentId: e.target.value })
                    }
                  >
                    <option value="">General</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </Select>
                  <Input
                    size="sm"
                    placeholder="Question"
                    value={editFaq.question}
                    onChange={(e) =>
                      setEditFaq({ ...editFaq, question: e.target.value })
                    }
                  />
                  <Textarea
                    size="sm"
                    placeholder="Answer"
                    rows={3}
                    value={editFaq.answer}
                    onChange={(e) =>
                      setEditFaq({ ...editFaq, answer: e.target.value })
                    }
                  />
                  <HStack justify="flex-end">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setEditingFaqId(null)}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      colorScheme="blue"
                      onClick={saveEditFaq}
                      isLoading={updateFaqMut.isPending}
                    >
                      Save
                    </Button>
                  </HStack>
                </VStack>
              ) : (
                <Flex justify="space-between" align="start">
                  <Box flex={1} mr={4}>
                    <HStack spacing={2} mb={1}>
                      <Icon as={FiBook} boxSize={3} color="gray.400" />
                      <Text fontSize="sm" fontWeight="500" color="gray.700">
                        {faq.question}
                      </Text>
                    </HStack>
                    <Text fontSize="xs" color="gray.500" pl={5}>
                      {faq.answer}
                    </Text>
                    <Badge fontSize="10px" mt={2} ml={5} colorScheme="gray">
                      {getDeptName(faq.departmentId)}
                    </Badge>
                  </Box>
                  <HStack spacing={1}>
                    <IconButton
                      aria-label="Edit"
                      icon={<Icon as={FiEdit2} />}
                      size="xs"
                      variant="ghost"
                      color="gray.400"
                      _hover={{ color: "blue.500" }}
                      onClick={() => startEditFaq(faq)}
                    />
                    <IconButton
                      aria-label="Remove"
                      icon={<Icon as={FiTrash2} />}
                      size="xs"
                      variant="ghost"
                      color="gray.400"
                      _hover={{ color: "red.500" }}
                      onClick={() => removeFaq(faq.id)}
                    />
                  </HStack>
                </Flex>
              )}
            </Box>
          ))}
        </VStack>
      </Box>
    </Box>
  );
}
