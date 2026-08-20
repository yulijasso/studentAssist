/**
 * Manual location input with fields for city, state (US dropdown), and country.
 *
 * Formats the location as "City, State, Country" and geocodes via Nominatim
 * on submit to get coordinates.
 */
"use client";

import { useState, useEffect, useRef } from "react";
import {
  Box,
  Text,
  HStack,
  Input,
  Select,
  FormControl,
  FormLabel,
  Spinner,
} from "@chakra-ui/react";
import { FiMapPin, FiX, FiAlertCircle } from "react-icons/fi";

const US_STATES = [
  "Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado",
  "Connecticut", "Delaware", "Florida", "Georgia", "Hawaii", "Idaho",
  "Illinois", "Indiana", "Iowa", "Kansas", "Kentucky", "Louisiana",
  "Maine", "Maryland", "Massachusetts", "Michigan", "Minnesota",
  "Mississippi", "Missouri", "Montana", "Nebraska", "Nevada",
  "New Hampshire", "New Jersey", "New Mexico", "New York",
  "North Carolina", "North Dakota", "Ohio", "Oklahoma", "Oregon",
  "Pennsylvania", "Rhode Island", "South Carolina", "South Dakota",
  "Tennessee", "Texas", "Utah", "Vermont", "Virginia", "Washington",
  "West Virginia", "Wisconsin", "Wyoming",
];

interface LocationAutocompleteProps {
  /** Current latitude, or null if unset. */
  latitude: number | null;
  /** Current longitude, or null if unset. */
  longitude: number | null;
  /** Current location display name. */
  locationName?: string;
  /** Called on change: coordinates when the location geocodes, or null when it
   *  is not yet verified / not a real place (so it is never placed on the map). */
  onSelect: (lat: number | null, lng: number | null, displayName: string) => void;
}

/**
 * Geocodes a location string via Nominatim.
 *
 * @param query - Location string to geocode.
 * @returns Coordinates or null if not found.
 */
async function geocode(query: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`,
      { headers: { "User-Agent": "CampusAssist/1.0" } },
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (data.length === 0) return null;
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  } catch {
    return null;
  }
}

/**
 * Renders manual location fields: city, state (US dropdown), and country.
 *
 * @param props.latitude - Current latitude.
 * @param props.longitude - Current longitude.
 * @param props.locationName - Display name for current location.
 * @param props.onSelect - Callback with (lat, lng, displayName) on change.
 */
export default function LocationAutocomplete({
  latitude,
  longitude,
  locationName,
  onSelect,
}: LocationAutocompleteProps) {
  // Parse existing locationName into parts
  const parts = (locationName ?? "").split(", ").map((s) => s.trim());
  const [address, setAddress] = useState(parts[0] || "");
  const [city, setCity] = useState(parts[1] || "");
  const [state, setState] = useState(parts[2] || "");
  const [country, setCountry] = useState(parts[3] || "United States");
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Skip the first effect run so mounting the form doesn't wipe a saved location.
  const firstRun = useRef(true);

  const isUS = country === "United States" || country === "USA" || country === "US";
  const hasSelection = latitude != null && longitude != null && latitude !== 0 && locationName;

  /**
   * On edit: report the location name immediately (so the form registers the
   * change) but clear coordinates, then geocode. A location is only placed on the
   * map once it geocodes to real coordinates; if it can't be found, coordinates
   * stay cleared and the user is told it is not a valid location — no guessing.
   */
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    if (!city.trim()) {
      setError(null);
      return;
    }

    const locationParts = [address.trim(), city.trim(), state.trim(), country.trim()].filter(Boolean);
    const displayName = locationParts.join(", ");

    // Unverified until geocoded — report the name, clear coordinates.
    onSelect(null, null, displayName);
    setError(null);

    const timer = setTimeout(async () => {
      setIsGeocoding(true);
      const coords = await geocode(displayName);
      setIsGeocoding(false);
      if (coords) {
        onSelect(coords.lat, coords.lng, displayName);
        setError(null);
      } else {
        // Not a real place: don't guess, don't map it — tell the user.
        onSelect(null, null, displayName);
        setError("That doesn't look like a valid location, so it won't be shown on the map. Check the spelling or enter a real place.");
      }
    }, 600);

    return () => clearTimeout(timer);
  }, [address, city, state, country]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Clears the current selection. */
  function clearSelection() {
    setAddress("");
    setCity("");
    setState("");
    setCountry("United States");
    setError(null);
    onSelect(null, null, "");
  }

  return (
    <Box>
      <Text fontSize="sm" color="gray.600" fontWeight="500" mb={3}>
        Location
      </Text>

      {/* Current location display */}
      {hasSelection && (
        <HStack
          mb={3}
          px={3}
          py={2}
          bg="blue.50"
          borderRadius="md"
          border="1px solid"
          borderColor="blue.200"
        >
          <FiMapPin size={14} color="#3182ce" />
          <Text fontSize="xs" color="blue.700" fontWeight="500" flex={1}>
            {locationName}
          </Text>
          {latitude !== 0 && (
            <Text fontSize="xs" color="blue.500" mr={1}>
              {latitude!.toFixed(4)}, {longitude!.toFixed(4)}
            </Text>
          )}
          {isGeocoding && <Spinner size="xs" color="blue.400" />}
          <Box
            as="button"
            onClick={clearSelection}
            color="blue.400"
            _hover={{ color: "blue.600" }}
            cursor="pointer"
          >
            <FiX size={12} />
          </Box>
        </HStack>
      )}

      {/* Fields */}
      <FormControl mb={3}>
        <FormLabel fontSize="xs" color="gray.500">
          Address
        </FormLabel>
        <Input
          size="sm"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="e.g. 415 W University Dr"
        />
      </FormControl>

      <FormControl mb={3}>
        <FormLabel fontSize="xs" color="gray.500">
          City
        </FormLabel>
        <Input
          size="sm"
          value={city}
          onChange={(e) => setCity(e.target.value)}
          placeholder="e.g. Edinburg"
        />
      </FormControl>

      <HStack spacing={3} mb={3} align="flex-end">
        <FormControl flex={1}>
          <FormLabel fontSize="xs" color="gray.500">
            {isUS ? "State" : "State / Province"}
          </FormLabel>
          {isUS ? (
            <Select
              size="sm"
              value={state}
              onChange={(e) => setState(e.target.value)}
              placeholder="Select state"
            >
              {US_STATES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          ) : (
            <Input
              size="sm"
              value={state}
              onChange={(e) => setState(e.target.value)}
              placeholder="e.g. Ontario"
            />
          )}
        </FormControl>

        <FormControl flex={1}>
          <FormLabel fontSize="xs" color="gray.500">
            Country
          </FormLabel>
          <Input
            size="sm"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            placeholder="e.g. United States"
          />
        </FormControl>
      </HStack>

      {isGeocoding && (
        <HStack spacing={2} mt={1}>
          <Spinner size="xs" color="gray.400" />
          <Text fontSize="10px" color="gray.400">
            Checking location...
          </Text>
        </HStack>
      )}

      {error && !isGeocoding && (
        <HStack spacing={2} mt={1} align="center">
          <FiAlertCircle size={13} color="#e53e3e" />
          <Text fontSize="11px" color="red.500" fontWeight="500">
            {error}
          </Text>
        </HStack>
      )}
    </Box>
  );
}
