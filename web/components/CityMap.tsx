/**
 * Interactive map component showing pinned city locations with dark/light toggle.
 *
 * Uses Leaflet with CartoDB tiles. Cities get custom SVG markers
 * color-coded by status (green = active, red = inactive) with glowing
 * pulse animations for cities with recent activity.
 */
"use client";

import { useEffect, useState } from "react";
import { Box, Flex, Text, HStack, IconButton, Icon } from "@chakra-ui/react";
import { FiSun, FiMoon } from "react-icons/fi";

interface City {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  conversationCount: number;
  location?: string | null;
  latitude: number | null;
  longitude: number | null;
}

interface CityMapProps {
  /** List of cities to display on the map. */
  cities: City[];
  /** Map container height. Defaults to "450px". */
  height?: string;
}

/**
 * Creates an SVG marker icon with a glowing dot effect.
 *
 * @param L - Leaflet module.
 * @param color - Hex color for the marker.
 * @param isActive - Whether to show pulse animation.
 * @returns A Leaflet DivIcon.
 */
function createCityIcon(L: typeof import("leaflet"), color: string, isActive: boolean) {
  return L.divIcon({
    className: "",
    iconSize: [28, 40],
    iconAnchor: [14, 40],
    popupAnchor: [0, -40],
    html: `
      <svg width="28" height="40" viewBox="0 0 28 40" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M14 0C6.268 0 0 6.268 0 14c0 10.5 14 26 14 26s14-15.5 14-26C28 6.268 21.732 0 14 0z" fill="${color}" />
        <circle cx="14" cy="14" r="6" fill="#fff" />
      </svg>
    `,
  });
}

/** Dark theme tile URL. */
const DARK_TILES = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
/** Light theme tile URL. */
const LIGHT_TILES = "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";

/**
 * Injects global CSS for map animations and popup styling.
 *
 * @param theme - "dark" or "light".
 */
function injectMapStyles(theme: "dark" | "light") {
  const id = "citymap-styles";
  const existing = document.getElementById(id);
  if (existing) existing.remove();

  const isDark = theme === "dark";
  const bg = isDark ? "#1a202c" : "#ffffff";
  const border = isDark ? "#2d3748" : "#e2e8f0";
  const text = isDark ? "#e2e8f0" : "#1a202c";
  const muted = isDark ? "#718096" : "#a0aec0";
  const zoomBg = isDark ? "#1a202c" : "#ffffff";
  const zoomText = isDark ? "#a0aec0" : "#4a5568";
  const zoomHoverBg = isDark ? "#2d3748" : "#f7fafc";
  const attrBg = isDark ? "rgba(26,32,44,0.8)" : "rgba(255,255,255,0.8)";
  const attrText = isDark ? "#4a5568" : "#a0aec0";

  const style = document.createElement("style");
  style.id = id;
  style.textContent = `
    @keyframes cityPulse {
      0% { transform: translate(-50%, -50%) scale(0.8); opacity: 1; }
      100% { transform: translate(-50%, -50%) scale(2.2); opacity: 0; }
    }
    .leaflet-popup-content-wrapper {
      background: ${bg} !important;
      color: ${text} !important;
      border-radius: 10px !important;
      box-shadow: 0 8px 32px rgba(0,0,0,${isDark ? "0.5" : "0.15"}) !important;
      border: 1px solid ${border} !important;
      padding: 0 !important;
    }
    .leaflet-popup-content {
      margin: 0 !important;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif !important;
    }
    .leaflet-popup-tip {
      background: ${bg} !important;
      border: 1px solid ${border} !important;
      box-shadow: none !important;
    }
    .leaflet-popup-close-button {
      color: ${muted} !important;
      font-size: 18px !important;
      top: 6px !important;
      right: 8px !important;
    }
    .leaflet-popup-close-button:hover {
      color: ${text} !important;
    }
    .leaflet-control-zoom a {
      background: ${zoomBg} !important;
      color: ${zoomText} !important;
      border-color: ${border} !important;
    }
    .leaflet-control-zoom a:hover {
      background: ${zoomHoverBg} !important;
      color: ${text} !important;
    }
    .leaflet-control-attribution {
      background: ${attrBg} !important;
      color: ${attrText} !important;
      font-size: 10px !important;
    }
    .leaflet-control-attribution a {
      color: ${attrText} !important;
    }
  `;
  document.head.appendChild(style);
}

/**
 * Renders a Leaflet map with dark tiles and custom markers for each city.
 *
 * @param props.cities - Array of city objects with optional lat/lng.
 * @param props.height - CSS height for the map container.
 */
export default function CityMap({ cities, height = "450px" }: CityMapProps) {
  const [theme, setTheme] = useState<"dark" | "light">("light");
  const [MapComponents, setMapComponents] = useState<{
    MapContainer: typeof import("react-leaflet").MapContainer;
    TileLayer: typeof import("react-leaflet").TileLayer;
    Marker: typeof import("react-leaflet").Marker;
    Popup: typeof import("react-leaflet").Popup;
    L: typeof import("leaflet");
  } | null>(null);

  useEffect(() => {
    (async () => {
      const rl = await import("react-leaflet");
      const L = await import("leaflet");
      await import("leaflet/dist/leaflet.css");
      injectMapStyles(theme);

      setMapComponents({
        MapContainer: rl.MapContainer,
        TileLayer: rl.TileLayer,
        Marker: rl.Marker,
        Popup: rl.Popup,
        L,
      });
    })();
  }, []);

  useEffect(() => {
    injectMapStyles(theme);
  }, [theme]);

  const citiesWithCoords = cities.filter(
    (c) => c.latitude != null && c.longitude != null,
  );
  const totalConversations = cities.reduce((s, c) => s + c.conversationCount, 0);
  const activeCities = cities.filter((c) => c.isActive).length;

  const defaultCenter: [number, number] = [39.8283, -98.5795];

  const center: [number, number] =
    citiesWithCoords.length > 0
      ? [
          citiesWithCoords.reduce((sum, c) => sum + c.latitude!, 0) /
            citiesWithCoords.length,
          citiesWithCoords.reduce((sum, c) => sum + c.longitude!, 0) /
            citiesWithCoords.length,
        ]
      : defaultCenter;

  if (!MapComponents) {
    return (
      <Box
        h={height}
        bg={theme === "dark" ? "gray.900" : "gray.100"}
        borderRadius="xl"
        display="flex"
        alignItems="center"
        justifyContent="center"
        color="gray.500"
        fontSize="sm"
      >
        Loading map...
      </Box>
    );
  }

  const { MapContainer, TileLayer, Marker, Popup, L } = MapComponents;

  return (
    <Box borderRadius="xl" overflow="hidden" border="1px solid" borderColor={theme === "dark" ? "gray.700" : "gray.200"} bg={theme === "dark" ? "gray.900" : "white"}>
      {/* Stats bar */}
      <Flex
        px={5}
        py={3}
        bg={theme === "dark" ? "gray.900" : "gray.50"}
        borderBottom="1px solid"
        borderColor={theme === "dark" ? "gray.700" : "gray.200"}
        justify="space-between"
        align="center"
      >
        <HStack spacing={4}>
          <HStack
            spacing={1.5}
            bg={theme === "dark" ? "gray.800" : "white"}
            border="1px solid"
            borderColor={theme === "dark" ? "gray.700" : "gray.200"}
            borderRadius="full"
            px={3}
            py={1}
          >
            <Box w="7px" h="7px" borderRadius="full" bg="green.400" />
            <Text fontSize="11px" fontWeight="600" color={theme === "dark" ? "white" : "gray.800"}>{activeCities}</Text>
            <Text fontSize="11px" color={theme === "dark" ? "gray.500" : "gray.500"}>Active</Text>
          </HStack>
          <HStack
            spacing={1.5}
            bg={theme === "dark" ? "gray.800" : "white"}
            border="1px solid"
            borderColor={theme === "dark" ? "gray.700" : "gray.200"}
            borderRadius="full"
            px={3}
            py={1}
          >
            <Box w="7px" h="7px" borderRadius="full" bg="red.400" />
            <Text fontSize="11px" fontWeight="600" color={theme === "dark" ? "white" : "gray.800"}>{cities.length - activeCities}</Text>
            <Text fontSize="11px" color={theme === "dark" ? "gray.500" : "gray.500"}>Inactive</Text>
          </HStack>
          <HStack
            spacing={1.5}
            bg={theme === "dark" ? "gray.800" : "white"}
            border="1px solid"
            borderColor={theme === "dark" ? "gray.700" : "gray.200"}
            borderRadius="full"
            px={3}
            py={1}
          >
            <Text fontSize="11px" fontWeight="600" color={theme === "dark" ? "white" : "gray.800"}>{totalConversations}</Text>
            <Text fontSize="11px" color={theme === "dark" ? "gray.500" : "gray.500"}>Conversations</Text>
          </HStack>
        </HStack>
        <HStack spacing={3}>
          <IconButton
            aria-label="Toggle map theme"
            size="xs"
            variant="ghost"
            color={theme === "dark" ? "gray.400" : "gray.600"}
            _hover={{ bg: theme === "dark" ? "gray.700" : "gray.200" }}
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            <Icon as={theme === "dark" ? FiSun : FiMoon} />
          </IconButton>
        </HStack>
      </Flex>

      {/* Map */}
      <Box h={height}>
        <MapContainer
          center={center}
          zoom={citiesWithCoords.length > 0 ? 5 : 4}
          style={{ height: "100%", width: "100%", background: theme === "dark" ? "#0f1116" : "#f7fafc" }}
          scrollWheelZoom={true}
          zoomControl={true}
        >
          <TileLayer
            key={theme}
            attribution='&copy; <a href="https://carto.com/">CARTO</a>'
            url={theme === "dark" ? DARK_TILES : LIGHT_TILES}
          />
          {citiesWithCoords.map((city) => {
            const color = city.isActive ? "#48bb78" : "#fc8181";
            const icon = createCityIcon(L, color, city.isActive);

            return (
              <Marker
                key={city.id}
                position={[city.latitude!, city.longitude!]}
                icon={icon}
              >
                <Popup>
                  <div style={{ padding: "14px 16px", minWidth: "180px" }}>
                    <div style={{
                      fontSize: "14px",
                      fontWeight: "700",
                      color: "#f7fafc",
                      marginBottom: "8px",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                    }}>
                      <span style={{
                        width: "8px",
                        height: "8px",
                        borderRadius: "50%",
                        background: color,
                        display: "inline-block",
                        boxShadow: `0 0 6px ${color}`,
                        flexShrink: 0,
                      }} />
                      {city.name}
                    </div>
                    {city.location && (
                      <div style={{
                        fontSize: "11px",
                        color: "#90cdf4",
                        marginBottom: "8px",
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                      }}>
                        <span style={{ fontSize: "10px" }}>📍</span> {city.location}
                      </div>
                    )}
                    <div style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: "11px",
                      color: "#a0aec0",
                      marginBottom: "4px",
                    }}>
                      <span>Status</span>
                      <span style={{
                        color: city.isActive ? "#68d391" : "#feb2b2",
                        fontWeight: "600",
                      }}>
                        {city.isActive ? "Active" : "Inactive"}
                      </span>
                    </div>
                    <div style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: "11px",
                      color: "#a0aec0",
                      marginBottom: "4px",
                    }}>
                      <span>Conversations</span>
                      <span style={{ color: "#e2e8f0", fontWeight: "600" }}>
                        {city.conversationCount}
                      </span>
                    </div>
                    <div style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: "11px",
                      color: "#a0aec0",
                    }}>
                      <span>Slug</span>
                      <span style={{
                        color: "#90cdf4",
                        fontFamily: "monospace",
                        fontSize: "10px",
                      }}>
                        {city.slug}
                      </span>
                    </div>
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>
      </Box>
    </Box>
  );
}
