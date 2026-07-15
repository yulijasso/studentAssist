/**
 * Click-to-place map component for picking a city's location.
 *
 * Renders a dark-themed Leaflet map where the user can click to place
 * or move a pin. The selected coordinates are reported via onChange callback.
 */
"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { Box, Text, HStack } from "@chakra-ui/react";

interface LocationPickerProps {
  /** Current latitude, or null if unset. */
  latitude: number | null;
  /** Current longitude, or null if unset. */
  longitude: number | null;
  /** Called when the user clicks the map or drags the pin. */
  onChange: (lat: number, lng: number) => void;
  /** Map height. Defaults to "280px". */
  height?: string;
}

/**
 * Injects dark-themed styles for the location picker map.
 */
function injectPickerStyles() {
  const id = "picker-map-styles";
  if (document.getElementById(id)) return;
  const style = document.createElement("style");
  style.id = id;
  style.textContent = `
    .leaflet-container.picker-map {
      cursor: crosshair !important;
    }
    .picker-map .leaflet-control-zoom a {
      background: #1a202c !important;
      color: #a0aec0 !important;
      border-color: #2d3748 !important;
    }
    .picker-map .leaflet-control-zoom a:hover {
      background: #2d3748 !important;
      color: #e2e8f0 !important;
    }
    .picker-map .leaflet-control-attribution {
      background: rgba(26, 32, 44, 0.8) !important;
      color: #4a5568 !important;
      font-size: 10px !important;
    }
    .picker-map .leaflet-control-attribution a {
      color: #4a5568 !important;
    }
  `;
  document.head.appendChild(style);
}

/**
 * Renders a clickable dark map for selecting a location.
 *
 * @param props.latitude - Current latitude.
 * @param props.longitude - Current longitude.
 * @param props.onChange - Callback with new (lat, lng) on click or drag.
 * @param props.height - CSS height for the map.
 */
export default function LocationPicker({
  latitude,
  longitude,
  onChange,
  height = "280px",
}: LocationPickerProps) {
  const [loaded, setLoaded] = useState(false);
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMap = useRef<import("leaflet").Map | null>(null);
  const markerRef = useRef<import("leaflet").Marker | null>(null);
  const LRef = useRef<typeof import("leaflet") | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Initialize map once
  useEffect(() => {
    if (!mapRef.current) return;

    (async () => {
      const L = await import("leaflet");
      await import("leaflet/dist/leaflet.css");
      injectPickerStyles();
      LRef.current = L;

      const center: [number, number] =
        latitude != null && longitude != null
          ? [latitude, longitude]
          : [39.8283, -98.5795];

      const zoom = latitude != null ? 12 : 4;

      const map = L.map(mapRef.current!, {
        center,
        zoom,
        scrollWheelZoom: true,
        zoomControl: true,
      });

      map.getContainer().classList.add("picker-map");

      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
        attribution: '&copy; <a href="https://carto.com/">CARTO</a>',
      }).addTo(map);

      // Custom pin icon
      const pinIcon = L.divIcon({
        className: "",
        iconSize: [36, 36],
        iconAnchor: [18, 36],
        html: `
          <div style="position: relative; width: 36px; height: 36px;">
            <svg viewBox="0 0 24 36" width="36" height="36" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 24 12 24s12-15 12-24C24 5.4 18.6 0 12 0z" fill="#4299e1" stroke="#fff" stroke-width="1.5"/>
              <circle cx="12" cy="12" r="5" fill="#fff"/>
            </svg>
            <div style="
              position: absolute;
              bottom: -4px;
              left: 50%;
              transform: translateX(-50%);
              width: 12px;
              height: 4px;
              background: rgba(0,0,0,0.3);
              border-radius: 50%;
              filter: blur(2px);
            "></div>
          </div>
        `,
      });

      // Place initial marker if coordinates exist
      if (latitude != null && longitude != null) {
        const marker = L.marker([latitude, longitude], {
          icon: pinIcon,
          draggable: true,
        }).addTo(map);

        marker.on("dragend", () => {
          const pos = marker.getLatLng();
          onChangeRef.current(
            Math.round(pos.lat * 10000000) / 10000000,
            Math.round(pos.lng * 10000000) / 10000000,
          );
        });

        markerRef.current = marker;
      }

      // Click to place/move pin
      map.on("click", (e: import("leaflet").LeafletMouseEvent) => {
        const { lat, lng } = e.latlng;
        const roundedLat = Math.round(lat * 10000000) / 10000000;
        const roundedLng = Math.round(lng * 10000000) / 10000000;

        if (markerRef.current) {
          markerRef.current.setLatLng([roundedLat, roundedLng]);
        } else {
          const marker = L.marker([roundedLat, roundedLng], {
            icon: pinIcon,
            draggable: true,
          }).addTo(map);

          marker.on("dragend", () => {
            const pos = marker.getLatLng();
            onChangeRef.current(
              Math.round(pos.lat * 10000000) / 10000000,
              Math.round(pos.lng * 10000000) / 10000000,
            );
          });

          markerRef.current = marker;
        }

        onChangeRef.current(roundedLat, roundedLng);
      });

      leafletMap.current = map;
      setLoaded(true);
    })();

    return () => {
      if (leafletMap.current) {
        leafletMap.current.remove();
        leafletMap.current = null;
        markerRef.current = null;
      }
    };
  // Only run once on mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Box>
      <HStack justify="space-between" mb={2}>
        <Text fontSize="sm" color="gray.600" fontWeight="500">
          Location
        </Text>
        <Text fontSize="xs" color="gray.400">
          Click map to place pin, drag to adjust
        </Text>
      </HStack>
      <Box
        ref={mapRef}
        h={height}
        borderRadius="lg"
        overflow="hidden"
        border="1px solid"
        borderColor="gray.300"
        bg="gray.900"
      />
      {latitude != null && longitude != null && (
        <Text fontSize="xs" color="gray.400" mt={1} textAlign="right">
          {latitude.toFixed(4)}, {longitude.toFixed(4)}
        </Text>
      )}
    </Box>
  );
}
