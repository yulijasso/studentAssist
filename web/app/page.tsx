/**
 * Landing page — handles sign in/up and routes users to the correct dashboard.
 *
 * After Clerk sign-in, calls me.sync which:
 * - Creates user record in DB if new
 * - Auto-provisions tech_admin if email matches ADMIN_EMAIL
 * - Auto-accepts pending invitations
 * - Returns the redirect destination
 */
"use client";

import {
  SignInButton,
  SignUpButton,
  SignedIn,
  SignedOut,
  useAuth,
  useUser,
} from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Box,
  Flex,
  Text,
  VStack,
  Button,
  HStack,
  Icon,
  Spinner,
} from "@chakra-ui/react";
import { FiArrowRight, FiShield, FiClock } from "react-icons/fi";
import { trpc } from "@/lib/trpc";

export default function Home() {
  const { isSignedIn, isLoaded } = useAuth();
  const { user } = useUser();
  const router = useRouter();
  const [synced, setSynced] = useState(false);
  const [waiting, setWaiting] = useState(false);

  const syncMutation = trpc.me.sync.useMutation({
    onSuccess: (result) => {
      setSynced(true);
      if (result.redirect === "/waiting") {
        setWaiting(true);
      } else {
        router.push(result.redirect);
      }
    },
    onError: () => {
      setWaiting(true);
    },
  });

  // Re-check memberships periodically when waiting
  const { data: memberships } = trpc.me.memberships.useQuery(undefined, {
    enabled: isLoaded && !!isSignedIn && waiting,
    refetchInterval: 5000,
  });

  // Sync user after Clerk sign-in
  useEffect(() => {
    if (!isLoaded || !isSignedIn || !user || synced || syncMutation.isPending) return;

    const email = user.primaryEmailAddress?.emailAddress;
    if (!email) return;

    syncMutation.mutate({
      email,
      name: [user.firstName, user.lastName].filter(Boolean).join(" ") || null,
    });
  }, [isLoaded, isSignedIn, user, synced]); // eslint-disable-line react-hooks/exhaustive-deps

  // When waiting, check if memberships appeared (invitation accepted elsewhere)
  useEffect(() => {
    if (!waiting || !memberships || memberships.length === 0) return;

    const techAdmin = memberships.find((m) => m.roleName === "tech_admin");
    if (techAdmin) {
      router.push("/admin");
      return;
    }

    const tenantMembership = memberships.find((m) => m.tenantSlug);
    if (tenantMembership?.tenantSlug) {
      router.push(`/dashboard/${tenantMembership.tenantSlug}/conversations`);
    }
  }, [waiting, memberships, router]);

  if (!isLoaded) {
    return (
      <Flex minH="100vh" bg="gray.50" align="center" justify="center">
        <Spinner color="blue.500" />
      </Flex>
    );
  }

  // Signed in, syncing...
  if (isSignedIn && !waiting) {
    return (
      <Flex minH="100vh" bg="gray.50" align="center" justify="center">
        <VStack spacing={3}>
          <Spinner color="blue.500" />
          <Text fontSize="sm" color="gray.500">
            Setting up your account...
          </Text>
        </VStack>
      </Flex>
    );
  }

  // Signed in but no access — waiting screen
  if (isSignedIn && waiting) {
    return (
      <Flex minH="100vh" bg="gray.50" align="center" justify="center">
        <VStack spacing={6} maxW="420px" textAlign="center" px={6}>
          <VStack spacing={2}>
            <HStack spacing={2}>
              <Icon as={FiShield} boxSize={5} color="blue.500" />
              <Text fontSize="xl" fontWeight="700" color="gray.800">
                Campus Assist
              </Text>
            </HStack>
            <Text fontSize="sm" color="gray.500">
              Welcome, {user?.firstName || "there"}
            </Text>
          </VStack>

          <Box
            bg="white"
            border="1px solid"
            borderColor="gray.200"
            borderRadius="xl"
            p={6}
            w="100%"
          >
            <Flex
              w={12}
              h={12}
              bg="blue.50"
              borderRadius="full"
              align="center"
              justify="center"
              mx="auto"
              mb={4}
            >
              <Icon as={FiClock} boxSize={6} color="blue.500" />
            </Flex>
            <Text fontSize="md" fontWeight="600" color="gray.800" mb={1}>
              Account created successfully
            </Text>
            <Text fontSize="xs" color="gray.500" lineHeight="1.5">
              Your account is not yet associated with any institution.
              A platform administrator must send you an invitation before you can access the dashboard.
            </Text>
            <HStack justify="center" spacing={2} color="gray.400" mt={4}>
              <Spinner size="xs" color="blue.400" />
              <Text fontSize="xs">Waiting for an invitation...</Text>
            </HStack>
          </Box>

          <Text fontSize="xs" color="gray.400">
            Check your email for an invite link from your platform administrator.
          </Text>
        </VStack>
      </Flex>
    );
  }

  // Not signed in — landing page
  return (
    <Flex minH="100vh" bg="gray.50" align="center" justify="center">
      <VStack spacing={8} maxW="400px" textAlign="center" px={6}>
        <VStack spacing={2}>
          <HStack spacing={2}>
            <Icon as={FiShield} boxSize={6} color="blue.500" />
            <Text fontSize="2xl" fontWeight="700" color="gray.800">
              Campus Assist
            </Text>
          </HStack>
          <Text fontSize="sm" color="gray.500" lineHeight="1.6">
            AI-powered university support platform. Each institution manages its own
            office routing, knowledge content, and support conversations.
          </Text>
        </VStack>

        <SignedOut>
          <VStack spacing={3} w="100%">
            <SignInButton mode="modal">
              <Button
                w="100%"
                colorScheme="blue"
                size="md"
                rightIcon={<Icon as={FiArrowRight} />}
              >
                Sign In
              </Button>
            </SignInButton>
            <SignUpButton mode="modal">
              <Button w="100%" variant="outline" size="md">
                Create Account
              </Button>
            </SignUpButton>
          </VStack>
        </SignedOut>

        <Text fontSize="xs" color="gray.400">
          Multi-tenant platform — each institution accesses only their own data
        </Text>
      </VStack>
    </Flex>
  );
}
