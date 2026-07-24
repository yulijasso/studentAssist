"use client";

import { ChakraProvider, extendTheme, type ThemeConfig } from "@chakra-ui/react";
import { useState, useEffect } from "react";

const config: ThemeConfig = {
  initialColorMode: "light",
  useSystemColorMode: false,
};

/**
 * UTRGV amber/orange brand scale. 500 is the campus accent (#EEB111).
 * Amber is light, so solid brand surfaces pair with dark ink text for contrast.
 */
const brand = {
  50: "#FEF8E6",
  100: "#FCEDBE",
  200: "#F9DF8D",
  300: "#F5D05B",
  400: "#F2C334",
  500: "#EEB111",
  600: "#C6910C",
  700: "#9B7008",
  800: "#6F5005",
  900: "#422F02",
};

/** Neutral ink scale for text and surfaces (slightly warm to match the amber). */
const ink = {
  50: "#F7F7F5",
  100: "#ECECE8",
  200: "#D9D9D2",
  300: "#BEBEB4",
  400: "#9A9A8E",
  500: "#76766B",
  600: "#57574E",
  700: "#3E3E38",
  800: "#292925",
  900: "#171714",
};

const theme = extendTheme({
  config,
  fonts: {
    heading: `'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif`,
    body: `'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif`,
  },
  colors: { brand, ink },
  radii: {
    md: "10px",
    lg: "14px",
    xl: "18px",
    "2xl": "22px",
  },
  shadows: {
    xs: "0 1px 2px rgba(23, 23, 20, 0.05)",
    card: "0 1px 2px rgba(23,23,20,0.04), 0 1px 3px rgba(23,23,20,0.06)",
    cardHover: "0 6px 20px rgba(23,23,20,0.08)",
    nav: "0 1px 0 rgba(23,23,20,0.06)",
    focusBrand: "0 0 0 3px rgba(238, 177, 17, 0.35)",
  },
  styles: {
    global: {
      body: {
        bg: "#FBFAF7",
        color: "ink.800",
        fontFeatureSettings: `'cv02','cv03','cv04','cv11'`,
      },
      "*::selection": {
        bg: "brand.100",
      },
    },
  },
  components: {
    Button: {
      baseStyle: { borderRadius: "full", fontWeight: 600, letterSpacing: "-0.01em" },
      defaultProps: { colorScheme: "brand" },
      variants: {
        // Amber solid needs dark text for legibility; other schemes keep white text.
        solid: (props: { colorScheme?: string }) => {
          const c = props.colorScheme ?? "brand";
          if (c === "brand") {
            return {
              bg: "brand.500",
              color: "ink.900",
              _hover: { bg: "brand.600", _disabled: { bg: "brand.500" } },
              _active: { bg: "brand.700" },
            };
          }
          return {
            bg: `${c}.500`,
            color: "white",
            _hover: { bg: `${c}.600`, _disabled: { bg: `${c}.500` } },
            _active: { bg: `${c}.700` },
          };
        },
        ghost: (props: { colorScheme?: string }) => {
          const c = props.colorScheme ?? "brand";
          if (c === "brand") {
            return { color: "ink.600", _hover: { bg: "brand.50", color: "ink.900" } };
          }
          return { color: `${c}.600`, _hover: { bg: `${c}.50` } };
        },
      },
    },
    Badge: {
      baseStyle: {
        borderRadius: "full",
        textTransform: "none",
        fontWeight: 600,
        px: 2,
        py: 0.5,
        letterSpacing: 0,
      },
    },
    Card: {
      baseStyle: {
        container: {
          borderRadius: "xl",
          boxShadow: "card",
          borderWidth: "1px",
          borderColor: "ink.100",
          bg: "white",
        },
      },
    },
    Table: {
      baseStyle: {
        th: {
          textTransform: "none",
          letterSpacing: "0.01em",
          color: "ink.500",
          fontWeight: 600,
        },
      },
    },
    Input: {
      defaultProps: { focusBorderColor: "brand.500" },
    },
    Select: {
      defaultProps: { focusBorderColor: "brand.500" },
    },
    Modal: {
      baseStyle: {
        dialog: { borderRadius: "2xl" },
      },
    },
  },
});

export function Providers({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) return null;

  return <ChakraProvider theme={theme}>{children}</ChakraProvider>;
}
