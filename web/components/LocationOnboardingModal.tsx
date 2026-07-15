/**
 * Location onboarding modal shown to new tenants that haven't set a location yet.
 *
 * Displays a friendly prompt with the LocationAutocomplete component so the
 * user can search for and select their organization's city/location on first login.
 */
"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Text,
  Box,
  useToast,
} from "@chakra-ui/react";
import { FiMapPin } from "react-icons/fi";
import { trpc } from "@/lib/trpc";

const LocationAutocomplete = dynamic(
  () => import("@/components/LocationAutocomplete"),
  { ssr: false },
);

interface LocationOnboardingModalProps {
  /** Whether the modal is visible. */
  isOpen: boolean;
  /** Tenant UUID to update. */
  tenantId: string;
  /** Organization name shown in the modal header. */
  orgName: string;
  /** Called after location is saved successfully. */
  onComplete: (location: string) => void;
}

/**
 * Renders a modal prompting the user to set their organization's location.
 *
 * @param props.isOpen - Whether the modal is open.
 * @param props.tenantId - Tenant UUID to update with location.
 * @param props.orgName - Displayed in the header.
 * @param props.onComplete - Callback after save.
 */
export default function LocationOnboardingModal({
  isOpen,
  tenantId,
  orgName,
  onComplete,
}: LocationOnboardingModalProps) {
  const [location, setLocation] = useState("");
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const toast = useToast();

  const setLocationMut = trpc.tenants.setLocation.useMutation({
    onSuccess: () => {
      toast({
        title: "Location saved",
        description: "Your organization has been placed on the map.",
        status: "success",
        duration: 3000,
      });
      onComplete(location);
    },
    onError: (err) => {
      toast({
        title: "Failed to save location",
        description: err.message,
        status: "error",
        duration: 5000,
      });
    },
  });

  /**
   * Saves the selected location to the tenant record.
   */
  function handleSave() {
    if (!lat || !lng || !location) return;
    setLocationMut.mutate({
      id: tenantId,
      location,
      latitude: lat,
      longitude: lng,
    });
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {}}
      size="md"
      closeOnOverlayClick={false}
      closeOnEsc={false}
      isCentered
    >
      <ModalOverlay bg="blackAlpha.700" />
      <ModalContent>
        <ModalHeader pb={1}>
          <Box display="flex" alignItems="center" gap={2}>
            <Box
              p={2}
              bg="blue.50"
              borderRadius="lg"
              color="blue.500"
              display="flex"
              alignItems="center"
              justifyContent="center"
            >
              <FiMapPin size={20} />
            </Box>
            <Box>
              <Text fontSize="md" fontWeight="700">
                Set your location
              </Text>
              <Text fontSize="xs" color="gray.500" fontWeight="400">
                {orgName}
              </Text>
            </Box>
          </Box>
        </ModalHeader>
        <ModalBody>
          <Text fontSize="sm" color="gray.600" mb={4}>
            Help us place your organization on the map. Search for your city or
            address below.
          </Text>
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
        </ModalBody>
        <ModalFooter>
          <Button
            colorScheme="blue"
            size="sm"
            isLoading={setLocationMut.isPending}
            isDisabled={!lat || !lng || !location}
            onClick={handleSave}
          >
            Save Location
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
