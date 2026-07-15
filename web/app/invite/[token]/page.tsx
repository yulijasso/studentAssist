/**
 * Invitation landing page — shows invite details, handles sign-in/up,
 * then accepts the invitation and redirects to the correct dashboard.
 */
"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  SignInButton,
  SignUpButton,
  SignedIn,
  SignedOut,
  useAuth,
  useUser,
  useClerk,
} from "@clerk/nextjs";
import {
  Box,
  Flex,
  VStack,
  Text,
  Button,
  Spinner,
  Icon,
  HStack,
  Badge,
} from "@chakra-ui/react";
import { FiShield, FiCheck, FiX } from "react-icons/fi";

export default function InvitePage() {
  const params = useParams();
  const token = params.token as string;
  const router = useRouter();
  const { isSignedIn, isLoaded, getToken } = useAuth();
  const { user } = useUser();
  const { signOut } = useClerk();

  const [status, setStatus] = useState<"loading" | "ready" | "accepting" | "success" | "error">("loading");
  const [invitation, setInvitation] = useState<{
    roleName: string;
    tenantName: string | null;
    email: string;
  } | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [redirectUrl, setRedirectUrl] = useState("/");

  // Fetch invitation details
  useEffect(() => {
    fetch(`/api/invitations/info?token=${token}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setStatus("error");
          setErrorMsg(data.error);
        } else {
          setInvitation(data);
          setStatus("ready");
        }
      })
      .catch(() => {
        setStatus("ready");
      });
  }, [token]);

  // Check if signed-in email matches invitation email
  const signedInEmail = user?.primaryEmailAddress?.emailAddress?.toLowerCase();
  const inviteEmail = invitation?.email?.toLowerCase();
  const emailMismatch = isSignedIn && invitation && signedInEmail && inviteEmail && signedInEmail !== inviteEmail;

  // Auto-accept when signed in (only if email matches)
  useEffect(() => {
    if (!isLoaded || !isSignedIn || !user || status !== "ready") return;
    if (emailMismatch) return;

    setStatus("accepting");

    (async () => {
      try {
        const jwt = await getToken();

        // First sync the user so their record exists in our DB
        const email = user.primaryEmailAddress?.emailAddress;
        const name = [user.firstName, user.lastName].filter(Boolean).join(" ") || null;

        // Then accept the invitation
        const res = await fetch("/api/invitations/accept", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
          },
          body: JSON.stringify({ token, email, name }),
        });
        const data = await res.json();
        if (data.success) {
          setStatus("success");
          setRedirectUrl(data.redirectUrl || "/");
          setTimeout(() => router.push(data.redirectUrl || "/"), 2000);
        } else {
          setStatus("error");
          setErrorMsg(data.error || "Failed to accept invitation");
        }
      } catch {
        setStatus("error");
        setErrorMsg("Network error");
      }
    })();
  }, [isLoaded, isSignedIn, user, status, token, getToken, router]);

  return (
    <Flex minH="100vh" bg="gray.50" align="center" justify="center">
      <VStack spacing={6} maxW="420px" textAlign="center" px={6}>
        <HStack spacing={2}>
          <Icon as={FiShield} boxSize={5} color="blue.500" />
          <Text fontSize="xl" fontWeight="700" color="gray.800">
            Campus Assist
          </Text>
        </HStack>

        <Box
          bg="white"
          border="1px solid"
          borderColor="gray.200"
          borderRadius="xl"
          p={6}
          w="100%"
        >
          {status === "loading" && <Spinner color="blue.500" />}

          {status === "ready" && (
            <VStack spacing={4}>
              <Text fontSize="md" fontWeight="600" color="gray.800">
                You&apos;ve been invited to Campus Assist
              </Text>
              {invitation && (
                <VStack spacing={1}>
                  {invitation.tenantName && (
                    <Text fontSize="sm" color="gray.600">
                      City: <strong>{invitation.tenantName}</strong>
                    </Text>
                  )}
                  <Text fontSize="sm" color="gray.600">
                    Role: <Badge fontSize="11px">{invitation.roleName}</Badge>
                  </Text>
                </VStack>
              )}

              <SignedOut>
                <Text fontSize="xs" color="gray.500" mb={2}>
                  Sign in or create an account to accept
                </Text>
                <VStack spacing={2} w="100%">
                  <SignInButton mode="modal">
                    <Button colorScheme="blue" size="sm" w="100%">
                      Sign In
                    </Button>
                  </SignInButton>
                  <SignUpButton mode="modal">
                    <Button variant="outline" size="sm" w="100%">
                      Create Account
                    </Button>
                  </SignUpButton>
                </VStack>
              </SignedOut>

              <SignedIn>
                {emailMismatch ? (
                  <VStack spacing={3}>
                    <Text fontSize="xs" color="orange.600">
                      You&apos;re signed in as <strong>{signedInEmail}</strong>, but this
                      invitation was sent to <strong>{inviteEmail}</strong>.
                    </Text>
                    <Button
                      size="sm"
                      colorScheme="blue"
                      w="100%"
                      onClick={() => signOut()}
                    >
                      Sign out &amp; use correct account
                    </Button>
                  </VStack>
                ) : (
                  <>
                    <Spinner color="blue.500" size="sm" />
                    <Text fontSize="xs" color="gray.500">
                      Accepting invitation...
                    </Text>
                  </>
                )}
              </SignedIn>
            </VStack>
          )}

          {status === "accepting" && (
            <VStack spacing={3}>
              <Spinner color="blue.500" />
              <Text fontSize="sm" color="gray.600">
                Accepting invitation...
              </Text>
            </VStack>
          )}

          {status === "success" && (
            <VStack spacing={3}>
              <Flex
                w={10}
                h={10}
                bg="green.50"
                borderRadius="full"
                align="center"
                justify="center"
              >
                <Icon as={FiCheck} boxSize={5} color="green.500" />
              </Flex>
              <Text fontSize="md" fontWeight="600" color="gray.800">
                Welcome aboard!
              </Text>
              <Text fontSize="xs" color="gray.500">
                Redirecting you to the dashboard...
              </Text>
            </VStack>
          )}

          {status === "error" && (
            <VStack spacing={3}>
              <Flex
                w={10}
                h={10}
                bg="red.50"
                borderRadius="full"
                align="center"
                justify="center"
              >
                <Icon as={FiX} boxSize={5} color="red.500" />
              </Flex>
              <Text fontSize="md" fontWeight="600" color="gray.800">
                Invitation Error
              </Text>
              <Text fontSize="xs" color="red.500">
                {errorMsg}
              </Text>
              <Button size="sm" variant="outline" onClick={() => router.push("/")}>
                Go Home
              </Button>
            </VStack>
          )}
        </Box>
      </VStack>
    </Flex>
  );
}
