"use client";

import { useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import {
  Box,
  VStack,
  HStack,
  Text,
  Badge,
  Flex,
  Icon,
  Alert,
  AlertIcon,
  Link,
  Button,
  Spinner,
} from "@chakra-ui/react";
import { FiFile, FiGlobe } from "react-icons/fi";
import { Conversation, INTENT_LABELS } from "@/lib/types";
import { trpc } from "@/lib/trpc";

interface Props {
  conversation: Conversation | null;
  hideHeader?: boolean;
  tenantId?: string | null;
}

const LANGUAGE_LABELS: Record<string, string> = {
  es: "ES",
  mixed: "ES/EN",
};

export default function ConversationThread({ conversation, hideHeader, tenantId }: Props) {
  // Cache of on-demand translations, keyed by message ID — avoids re-calling
  // the LLM if a staff member toggles a message back and forth.
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const [showTranslated, setShowTranslated] = useState<Record<string, boolean>>({});
  const translateMut = trpc.conversationsAdmin.translateMessage.useMutation();

  const handleTranslate = (messageId: string) => {
    if (translations[messageId]) {
      setShowTranslated((prev) => ({ ...prev, [messageId]: !prev[messageId] }));
      return;
    }
    if (!tenantId) return;
    translateMut.mutate(
      { tenantId, messageId, targetLanguage: "en" },
      {
        onSuccess: (result) => {
          setTranslations((prev) => ({ ...prev, [messageId]: result.translated }));
          setShowTranslated((prev) => ({ ...prev, [messageId]: true }));
        },
      },
    );
  };

  /**
   * Maps message ID → list of department names that were triggered by that message.
   * Used to render routing badges below trigger messages in the thread.
   */
  const triggerMap = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const rd of conversation?.routedDepartments ?? []) {
      if (rd.triggerMessageId) {
        const existing = map.get(rd.triggerMessageId) ?? [];
        map.set(rd.triggerMessageId, [...existing, rd.departmentName]);
      }
    }
    return map;
  }, [conversation?.routedDepartments]);
  if (!conversation) {
    return (
      <Flex flex={1} align="center" justify="center" color="gray.400">
        <Text>Select a conversation to view</Text>
      </Flex>
    );
  }

  return (
    <Box flex={1} display="flex" flexDirection="column" h="100%">
      {!hideHeader && (
        <>
          <Box
            px={6}
            py={4}
            borderBottom="1px solid"
            borderColor="gray.200"
            bg="white"
          >
            <HStack justify="space-between">
              <Box>
                <HStack spacing={2} mb={1}>
                  <Text fontWeight="600" fontSize="md">
                    Session {conversation.sessionId}
                  </Text>
                  <Badge
                    colorScheme={
                      conversation.status === "open"
                        ? "green"
                        : conversation.status === "escalated"
                        ? "red"
                        : "gray"
                    }
                    textTransform="capitalize"
                  >
                    {conversation.status}
                  </Badge>
                </HStack>
                <HStack spacing={3} fontSize="xs" color="gray.500">
                  {conversation.department && (
                    <Text>Dept: {conversation.department}</Text>
                  )}
                  {conversation.intent && (
                    <Text>
                      Intent: {INTENT_LABELS[conversation.intent] || conversation.intent}
                    </Text>
                  )}
                  <Text>
                    Started: {new Date(conversation.startedAt).toLocaleString()}
                  </Text>
                </HStack>
              </Box>
            </HStack>
          </Box>

          {conversation.status === "escalated" && (
            <Alert status="error" variant="left-accent" fontSize="sm">
              <AlertIcon />
              This conversation has been escalated to {conversation.department || "a department"}.
            </Alert>
          )}
        </>
      )}

      <VStack
        spacing={4}
        align="stretch"
        flex={1}
        overflowY="auto"
        px={6}
        py={4}
      >
        {conversation.messages.map((msg) => {
          if (msg.role === "disclaimer") {
            return (
              <Flex key={msg.id} direction="column" align="stretch">
                <Box
                  bg="orange.50"
                  border="1px solid"
                  borderColor="orange.300"
                  borderLeft="3px solid"
                  borderLeftColor="orange.400"
                  borderRadius="md"
                  px={4}
                  py={3}
                >
                  <HStack spacing={2} mb={1}>
                    <Text fontSize="xs" fontWeight="700" color="orange.700">
                      ⚠ Disclaimer shown to user
                    </Text>
                    <Text fontSize="10px" color="orange.500" ml="auto">
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </Text>
                  </HStack>
                  <Text fontSize="sm" color="gray.700" mb={msg.metadata?.disclaimerReason ? 2 : 0}>
                    {msg.content}
                  </Text>
                  {msg.metadata?.disclaimerReason && (
                    <Box bg="orange.100" borderRadius="sm" px={3} py={2}>
                      <Text fontSize="11px" fontWeight="600" color="orange.800" mb={0.5}>
                        Classifier reason (legal evidence):
                      </Text>
                      <Text fontSize="11px" color="orange.700">
                        {msg.metadata.disclaimerReason}
                      </Text>
                    </Box>
                  )}
                </Box>
              </Flex>
            );
          }

          return (
          <Flex
            key={msg.id}
            direction="column"
            align={msg.role === "user" ? "flex-end" : "flex-start"}
          >
            <Box
              maxW="70%"
              bg={msg.role === "user" ? "blue.500" : "white"}
              color={msg.role === "user" ? "white" : "gray.800"}
              px={4}
              py={3}
              borderRadius="lg"
              borderTopRightRadius={msg.role === "user" ? "4px" : "lg"}
              borderTopLeftRadius={msg.role === "assistant" ? "4px" : "lg"}
              boxShadow="sm"
              border={msg.role === "assistant" ? "1px solid" : "none"}
              borderColor="gray.200"
            >
              <Box fontSize="sm" lineHeight="1.6">
                <ReactMarkdown
                  components={{
                    a: ({ href, children }) => (
                      <Link href={href} isExternal color="blue.500" fontWeight="600" textDecoration="underline">
                        {children}
                      </Link>
                    ),
                    strong: ({ children }) => (
                      <Text as="strong" fontWeight="700">{children}</Text>
                    ),
                    p: ({ children }) => (
                      <Text mb={1}>{children}</Text>
                    ),
                  }}
                >
                  {showTranslated[msg.id] && translations[msg.id] ? translations[msg.id] : msg.content}
                </ReactMarkdown>
              </Box>

              {msg.role === "assistant" && (
                <Box mt={2} pt={2} borderTop="1px solid" borderColor="gray.100">
                  <HStack spacing={2} flexWrap="wrap">
                    {msg.intent && (
                      <Badge fontSize="10px" colorScheme="purple" variant="subtle">
                        {INTENT_LABELS[msg.intent] || msg.intent}
                      </Badge>
                    )}
                    {msg.department && (
                      <Badge fontSize="10px" colorScheme="blue" variant="subtle">
                        {msg.department}
                      </Badge>
                    )}
                  </HStack>

                  {msg.webSources && msg.webSources.length > 0 && (
                    <VStack align="start" spacing={0.5} mt={2}>
                      {msg.webSources.map((src, i) => (
                        <Link
                          key={i}
                          href={src.url}
                          isExternal
                          fontSize="11px"
                          color="blue.500"
                          fontWeight="600"
                          textDecoration="underline"
                          display="block"
                        >
                          {src.title || src.url}
                        </Link>
                      ))}
                    </VStack>
                  )}
                  {!msg.webSources && msg.sources && msg.sources.length > 0 && (
                    <VStack align="start" spacing={1} mt={2}>
                      {msg.sources.map((src, i) => (
                        <HStack key={i} spacing={1} fontSize="11px" color="gray.500">
                          <Icon as={FiFile} boxSize={3} />
                          <Text>
                            {src.file}
                            {src.page && `, p.${src.page}`}
                          </Text>
                        </HStack>
                      ))}
                    </VStack>
                  )}
                </Box>
              )}

              <HStack spacing={2} mt={1} justify="flex-end">
                {msg.language && LANGUAGE_LABELS[msg.language] && (
                  <Badge
                    fontSize="9px"
                    colorScheme={msg.role === "user" ? "whiteAlpha" : "purple"}
                    variant="subtle"
                  >
                    {LANGUAGE_LABELS[msg.language]}
                  </Badge>
                )}
                {msg.language && LANGUAGE_LABELS[msg.language] && (
                  <Button
                    size="xs"
                    variant="link"
                    fontSize="9px"
                    color={msg.role === "user" ? "blue.100" : "blue.500"}
                    leftIcon={
                      translateMut.isPending && translateMut.variables?.messageId === msg.id
                        ? <Spinner size="xs" />
                        : <Icon as={FiGlobe} boxSize={2.5} />
                    }
                    isDisabled={translateMut.isPending && translateMut.variables?.messageId === msg.id}
                    onClick={() => handleTranslate(msg.id)}
                  >
                    {showTranslated[msg.id] && translations[msg.id] ? "Show original" : "Translate"}
                  </Button>
                )}
                <Text
                  fontSize="10px"
                  color={msg.role === "user" ? "blue.100" : "gray.400"}
                >
                  {new Date(msg.timestamp).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </Text>
              </HStack>
            </Box>

            {triggerMap.has(msg.id) && (
              <HStack spacing={1} mt={1} flexWrap="wrap">
                {triggerMap.get(msg.id)!.map((deptName) => (
                  <Badge key={deptName} fontSize="9px" colorScheme="blue" variant="subtle">
                    → {deptName}
                  </Badge>
                ))}
              </HStack>
            )}
          </Flex>
          );
        })}
      </VStack>
    </Box>
  );
}
