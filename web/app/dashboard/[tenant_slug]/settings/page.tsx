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
  Flex,
  Switch,
  FormControl,
  Image,
  FormLabel,
  Spinner,
  Select,
} from "@chakra-ui/react";
import {
  FiEye,
  FiEyeOff,
  FiCopy,
  FiMessageCircle,
  FiSend,
} from "react-icons/fi";
import { trpc } from "@/lib/trpc";
import { useTenant } from "@/lib/use-tenant";

export default function SettingsPage() {
  const { tenantId, slug } = useTenant();

  // Fetch settings
  const settingsQuery = trpc.settings.get.useQuery(
    { tenantId: tenantId! },
    { enabled: !!tenantId },
  );

  const utils = trpc.useUtils();
  const updateMut = trpc.settings.update.useMutation({
    onSuccess: () => utils.settings.get.invalidate(),
  });

  const apiKey = settingsQuery.data?.apiKey ?? "";
  const settings = settingsQuery.data?.widgetSettings ?? {
    cityName: "",
    assistantName: "",
    primaryColor: "#1a56db",
    welcomeMessage: "Hi! Ask me anything about admissions, academics, or campus services.",
    logoUrl: "",
    autoOpen: false,
    position: "bottom-right",
  };

  const [showKey, setShowKey] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(apiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const updateSettings = (patch: Record<string, unknown>) => {
    if (!tenantId) return;
    updateMut.mutate({
      tenantId,
      widgetSettings: patch as Parameters<typeof updateMut.mutate>[0]["widgetSettings"],
    });
  };

  const appUrl = process.env.NEXT_PUBLIC_API_URL ?? '';
  const wsUrl = appUrl.replace(/^http/, 'ws');
  const embedSnippet = `<script src="${appUrl}/static/widget.js"
  data-tenant="${slug}"
  data-api-url="${appUrl}"
  data-ws-url="${wsUrl}"
  async></script>`;

  if (!tenantId) {
    return (
      <Flex minH="200px" align="center" justify="center">
        <Spinner color="blue.500" />
      </Flex>
    );
  }

  return (
    <Box p={8} maxW="100%">
      <Box mb={6}>
        <Heading size="md" color="gray.800">
          Settings
        </Heading>
        <Text fontSize="sm" color="gray.500" mt={1}>
          Branding, widget configuration, and API key management
        </Text>
      </Box>

      <VStack spacing={6} align="stretch">
        {/* API Key */}
        <Box bg="white" border="1px solid" borderColor="gray.200" borderRadius="lg" p={5}>
          <Text fontWeight="600" fontSize="sm" color="gray.700" mb={4}>
            API Key
          </Text>
          <HStack>
            <Input
              size="sm"
              value={showKey ? apiKey : "ca_live_" + "\u2022".repeat(20)}
              readOnly
              fontFamily="mono"
              fontSize="xs"
              bg="gray.50"
            />
            <IconBtn
              icon={showKey ? FiEyeOff : FiEye}
              label="Toggle"
              onClick={() => setShowKey(!showKey)}
            />
            <IconBtn icon={FiCopy} label="Copy" onClick={handleCopy} />
          </HStack>
          {copied && (
            <Text fontSize="xs" color="green.500" mt={1}>
              Copied to clipboard
            </Text>
          )}
          <Text fontSize="xs" color="gray.400" mt={2}>
            Use this key to authenticate widget and API requests.
          </Text>
        </Box>

        {/* Branding */}
        <Box bg="white" border="1px solid" borderColor="gray.200" borderRadius="lg" p={5}>
          <Text fontWeight="600" fontSize="sm" color="gray.700" mb={4}>
            Branding
          </Text>
          <VStack spacing={3} align="stretch">
            <Field
              label="Institution Name"
              value={settings.cityName ?? ""}
              onChange={(v) => updateSettings({ cityName: v })}
              placeholder="e.g. UTRGV"
            />
            <Field
              label="Assistant Name"
              value={settings.assistantName ?? ""}
              onChange={(v) => updateSettings({ assistantName: v })}
              placeholder={`e.g. ${settings.cityName ? settings.cityName + " Campus Assist" : "Campus Assist"}`}
            />
            <Field
              label="Primary Color"
              value={settings.primaryColor ?? "#1a56db"}
              onChange={(v) => updateSettings({ primaryColor: v })}
              type="color"
            />
            <Field
              label="Welcome Message"
              value={settings.welcomeMessage ?? ""}
              onChange={(v) => updateSettings({ welcomeMessage: v })}
              placeholder="e.g. Hi! Ask me anything about admissions, academics, or campus services."
            />
            <Field
              label="Logo URL"
              value={settings.logoUrl ?? ""}
              onChange={(v) => updateSettings({ logoUrl: v })}
              placeholder="https://..."
            />
          </VStack>
        </Box>

        {/* Widget Config */}
        <Box bg="white" border="1px solid" borderColor="gray.200" borderRadius="lg" p={5}>
          <Text fontWeight="600" fontSize="sm" color="gray.700" mb={4}>
            Widget Configuration
          </Text>
          <VStack spacing={4} align="stretch">
            <FormControl display="flex" alignItems="center" justifyContent="space-between">
              <FormLabel fontSize="sm" color="gray.600" mb={0}>
                Auto-open widget
              </FormLabel>
              <Switch
                size="sm"
                isChecked={settings.autoOpen ?? false}
                onChange={() => updateSettings({ autoOpen: !settings.autoOpen })}
              />
            </FormControl>
            <FormControl>
              <FormLabel fontSize="sm" color="gray.600" mb={1}>
                Widget Position
              </FormLabel>
              <Select
                size="sm"
                value={settings.position ?? "bottom-right"}
                onChange={(e) => updateSettings({ position: e.target.value })}
              >
                <option value="bottom-right">Bottom Right</option>
                <option value="bottom-left">Bottom Left</option>
                <option value="top-right">Top Right</option>
                <option value="top-left">Top Left</option>
              </Select>
            </FormControl>
          </VStack>
        </Box>

        {/* Live Widget Preview */}
        <Box bg="white" border="1px solid" borderColor="gray.200" borderRadius="lg" p={5}>
          <Text fontWeight="600" fontSize="sm" color="gray.700" mb={4}>
            Live Widget Preview
          </Text>
          <Flex justify="center">
            <Box
              w="300px"
              h="400px"
              borderRadius="xl"
              border="1px solid"
              borderColor="gray.200"
              boxShadow="lg"
              overflow="hidden"
              display="flex"
              flexDirection="column"
              bg="white"
            >
              <Flex
                bg={settings.primaryColor || "#1a56db"}
                color="white"
                px={4}
                py={3}
                align="center"
                justify="space-between"
              >
                <HStack spacing={2}>
                  {settings.logoUrl && (
                    <Image
                      src={settings.logoUrl}
                      alt="Logo"
                      boxSize="24px"
                      borderRadius="md"
                      objectFit="contain"
                      bg="whiteAlpha.200"
                    />
                  )}
                  <Box>
                    <Text fontWeight="600" fontSize="13px">
                      {settings.cityName || "UTRGV Campus Assist"}
                    </Text>
                    <Text fontSize="10px" opacity={0.8}>
                      {settings.cityName ? `Ask about ${settings.cityName} services` : 'How can I help you today?'}
                    </Text>
                  </Box>
                </HStack>
                <Text fontSize="14px" opacity={0.6} cursor="pointer" lineHeight="1">
                  &#x2715;
                </Text>
              </Flex>

              <VStack
                flex={1}
                bg="gray.50"
                px={3}
                py={3}
                spacing={2}
                align="stretch"
                overflow="hidden"
              >
                <Flex justify="center" py={4}>
                  <VStack spacing={1} color="gray.400">
                    <Icon as={FiMessageCircle} boxSize={6} />
                    <Text fontSize="11px" textAlign="center" maxW="200px">
                      {settings.welcomeMessage || "Hi! Ask me anything about admissions, academics, or campus services."}
                    </Text>
                  </VStack>
                </Flex>

                <Flex justify="flex-end">
                  <Box
                    bg={settings.primaryColor || "#1a56db"}
                    color="white"
                    px={3}
                    py={1.5}
                    borderRadius="lg"
                    fontSize="12px"
                    maxW="80%"
                  >
                    How do I contact financial aid?
                  </Box>
                </Flex>

                <Flex justify="flex-start">
                  <Box maxW="80%">
                    <Box
                      bg="white"
                      px={3}
                      py={1.5}
                      borderRadius="lg"
                      fontSize="12px"
                      color="gray.700"
                      border="1px solid"
                      borderColor="gray.200"
                    >
                      Financial Aid contact options, office hours, and service links can be shown here.
                    </Box>
                  </Box>
                </Flex>
              </VStack>

              <HStack px={3} py={2} borderTop="1px solid" borderColor="gray.200" bg="white">
                <Box
                  flex={1}
                  bg="gray.50"
                  borderRadius="full"
                  px={3}
                  py={1.5}
                  fontSize="11px"
                  color="gray.400"
                >
                  Type your question...
                </Box>
                <Flex
                  w="28px"
                  h="28px"
                  bg={settings.primaryColor || "#1a56db"}
                  borderRadius="full"
                  align="center"
                  justify="center"
                  flexShrink={0}
                >
                  <Icon as={FiSend} boxSize={3} color="white" />
                </Flex>
              </HStack>
            </Box>
          </Flex>
        </Box>

        {/* Embed Code */}
        <Box bg="white" border="1px solid" borderColor="gray.200" borderRadius="lg" p={5}>
          <Text fontWeight="600" fontSize="sm" color="gray.700" mb={2}>
            Embed Code
          </Text>
          <Text fontSize="xs" color="gray.400" mb={3}>
            Add this snippet to your website to deploy the UTRGV Campus Assist widget.
          </Text>
          <Box
            bg="gray.900"
            borderRadius="md"
            p={4}
            fontFamily="mono"
            fontSize="xs"
            color="green.300"
            overflowX="auto"
            whiteSpace="pre"
          >
            {embedSnippet}
          </Box>
          <Button
            size="xs"
            variant="ghost"
            mt={2}
            leftIcon={<Icon as={FiCopy} />}
            onClick={() => navigator.clipboard.writeText(embedSnippet)}
          >
            Copy snippet
          </Button>
        </Box>
      </VStack>
    </Box>
  );
}

function IconBtn({
  icon,
  label,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  onClick: () => void;
}) {
  return (
    <Button size="sm" variant="ghost" onClick={onClick} aria-label={label}>
      <Icon as={icon} />
    </Button>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <HStack>
      <Text fontSize="sm" color="gray.600" w="140px" flexShrink={0}>
        {label}
      </Text>
      {type === "color" ? (
        <HStack flex={1}>
          <Input
            size="sm"
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            w="40px"
            h="32px"
            p={0}
            border="none"
            cursor="pointer"
          />
          <Input
            size="sm"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            fontFamily="mono"
            fontSize="xs"
          />
        </HStack>
      ) : (
        <Input
          size="sm"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
        />
      )}
    </HStack>
  );
}
