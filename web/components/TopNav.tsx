"use client";

/**
 * Horizontal top navigation bar — the app-wide primary nav.
 *
 * Replaces the former dark left sidebars. Light, sticky, with a brand mark on
 * the left, horizontally-scrolling nav pills in the middle, and a right slot
 * for the user menu / contextual actions. Used by both the tech-admin and
 * per-institution dashboard layouts.
 */
import { Box, Flex, Text, Icon, HStack, Image, Link as ChakraLink } from "@chakra-ui/react";
import NextLink from "next/link";
import type { IconType } from "react-icons";
import { FiChevronRight } from "react-icons/fi";

export type NavItem = {
  label: string;
  href: string;
  icon?: IconType;
  active?: boolean;
  badge?: number;
};

/** Default accent (UTRGV amber) when a tenant hasn't set a brand color. */
const DEFAULT_ACCENT = "#EEB111";

/** Parses a #hex (3 or 6 digit) into RGB, or null if invalid. */
function parseHex(hex?: string | null): { r: number; g: number; b: number } | null {
  if (!hex) return null;
  const c = hex.trim().replace(/^#/, "");
  const full = c.length === 3 ? c.split("").map((x) => x + x).join("") : c;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null;
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
}

/** Returns a readable text color (dark ink or white) for a given background hex. */
function readableOn(hex: string): string {
  const rgb = parseHex(hex);
  if (!rgb) return "#171714";
  const lum = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
  return lum > 0.6 ? "#171714" : "#FFFFFF";
}

/** Returns the color as an rgba() string at the given alpha (for soft tints). */
function tint(hex: string, alpha: number): string {
  const rgb = parseHex(hex);
  if (!rgb) return `rgba(238, 177, 17, ${alpha})`;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

/** Small pulsing count pill for nav items with pending actions. */
function NavBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <Flex
      minW="18px"
      h="18px"
      px={1.5}
      ml={1}
      bg="#E53E3E"
      borderRadius="full"
      align="center"
      justify="center"
      boxShadow="0 0 0 2px white"
    >
      <Text fontSize="10px" fontWeight="700" color="white" lineHeight={1}>
        {count > 9 ? "9+" : count}
      </Text>
    </Flex>
  );
}

export function TopNav({
  brand,
  items,
  right,
}: {
  brand: { label: string; href: string; sub?: string; markColor?: string | null };
  items: NavItem[];
  right?: React.ReactNode;
}) {
  // Tenant brand color drives the accent (hat + active pills); falls back to amber.
  const accent = parseHex(brand.markColor) ? (brand.markColor as string) : DEFAULT_ACCENT;
  const accentText = readableOn(accent);

  return (
    <Box
      as="header"
      position="sticky"
      top={0}
      zIndex={20}
      bg="rgba(255,255,255,0.85)"
      backdropFilter="saturate(180%) blur(8px)"
      borderBottom="1px solid"
      borderColor="ink.100"
      boxShadow="nav"
    >
      <Flex
        align="center"
        gap={4}
        h="60px"
        maxW="1400px"
        mx="auto"
        px={{ base: 4, md: 6 }}
      >
        {/* Brand */}
        <ChakraLink
          as={NextLink}
          href={brand.href}
          _hover={{ textDecoration: "none" }}
          flexShrink={0}
        >
          <HStack spacing={2.5} align="center">
            <Image
              src="/cap.png"
              alt="Campus Assist"
              boxSize={8}
              borderRadius="lg"
              objectFit="cover"
              flexShrink={0}
            />
            <Box lineHeight={1}>
              <Text fontSize="15px" fontWeight="800" color="ink.900" letterSpacing="-0.02em">
                Campus Assist
              </Text>
              {brand.sub && (
                <Text fontSize="11px" color="ink.500" mt={0.5} fontWeight="500">
                  {brand.sub}
                </Text>
              )}
            </Box>
          </HStack>
        </ChakraLink>

        <Box w="1px" h="24px" bg="ink.100" flexShrink={0} display={{ base: "none", md: "block" }} />

        {/* Nav pills */}
        <HStack
          spacing={1}
          flex={1}
          overflowX="auto"
          py={1}
          sx={{
            "&::-webkit-scrollbar": { display: "none" },
            scrollbarWidth: "none",
          }}
        >
          {items.map((item) => (
            <ChakraLink
              as={NextLink}
              key={item.href}
              href={item.href}
              display="flex"
              alignItems="center"
              gap={2}
              px={3}
              py={2}
              borderRadius="full"
              fontSize="sm"
              fontWeight={item.active ? "600" : "500"}
              whiteSpace="nowrap"
              flexShrink={0}
              bg={item.active ? accent : "transparent"}
              color={item.active ? accentText : "ink.500"}
              _hover={{
                textDecoration: "none",
                bg: item.active ? accent : tint(accent, 0.12),
                color: item.active ? accentText : "ink.900",
              }}
              transition="all 0.15s"
            >
              {item.icon && <Icon as={item.icon} boxSize={4} />}
              {item.label}
              {item.badge ? <NavBadge count={item.badge} /> : null}
            </ChakraLink>
          ))}
        </HStack>

        {/* Right slot */}
        {right && (
          <HStack spacing={2} flexShrink={0}>
            {right}
          </HStack>
        )}
      </Flex>
    </Box>
  );
}

/** Small ghost link for the right slot (e.g. cross-dashboard links). */
export function TopNavLink({
  href,
  icon,
  children,
}: {
  href: string;
  icon?: IconType;
  children: React.ReactNode;
}) {
  return (
    <ChakraLink
      as={NextLink}
      href={href}
      display="flex"
      alignItems="center"
      gap={1.5}
      px={3}
      py={2}
      borderRadius="full"
      fontSize="xs"
      fontWeight="600"
      color="ink.500"
      whiteSpace="nowrap"
      _hover={{ textDecoration: "none", bg: "ink.50", color: "ink.900" }}
      transition="all 0.15s"
    >
      {icon && <Icon as={icon} boxSize={3.5} />}
      {children}
      <Icon as={FiChevronRight} boxSize={3} opacity={0.5} />
    </ChakraLink>
  );
}
