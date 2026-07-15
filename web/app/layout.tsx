import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { TRPCReactProvider } from "@/lib/trpc-provider";
import { Providers } from "@/lib/providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Campus Assist Admin Dashboard",
  description: "AI-powered university support chatbot platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <ClerkProvider
          afterSignUpUrl="/"
          afterSignInUrl="/"
          appearance={{
            layout: {
              socialButtonsPlacement: "bottom",
              shimmer: false,
            },
            variables: {
              colorPrimary: "#1a56db",
              colorText: "#1a202c",
              colorTextSecondary: "#718096",
              colorBackground: "#ffffff",
              colorInputBackground: "#f7fafc",
              colorInputText: "#1a202c",
              borderRadius: "0.5rem",
              fontFamily: "inherit",
              fontSize: "14px",
            },
            elements: {
              modalBackdrop: {
                backgroundColor: "rgba(0, 0, 0, 0.4)",
                backdropFilter: "blur(4px)",
              },
              modalContent: {
                borderRadius: "12px",
                boxShadow: "0 20px 60px rgba(0, 0, 0, 0.15)",
                border: "1px solid #e2e8f0",
              },
              card: {
                boxShadow: "none",
                border: "none",
              },
              headerTitle: {
                fontSize: "16px",
                fontWeight: "600",
              },
              headerSubtitle: {
                fontSize: "13px",
                color: "#718096",
              },
              formButtonPrimary: {
                backgroundColor: "#1a56db",
                fontSize: "13px",
                fontWeight: "500",
                borderRadius: "6px",
                textTransform: "none",
                boxShadow: "none",
              },
              formFieldInput: {
                borderRadius: "6px",
                fontSize: "13px",
                border: "1px solid #e2e8f0",
              },
              footerActionLink: {
                fontSize: "13px",
                color: "#1a56db",
              },
              userButtonPopoverCard: {
                borderRadius: "10px",
                boxShadow: "0 10px 40px rgba(0, 0, 0, 0.12)",
                border: "1px solid #e2e8f0",
              },
              organizationSwitcherPopoverCard: {
                borderRadius: "10px",
                boxShadow: "0 10px 40px rgba(0, 0, 0, 0.12)",
                border: "1px solid #e2e8f0",
              },
              profilePage: {
                borderRadius: "10px",
              },
              navbar: {
                borderRight: "1px solid #e2e8f0",
              },
              navbarButton: {
                fontSize: "13px",
                fontWeight: "400",
              },
              membersPageInviteButton: {
                backgroundColor: "#1a56db",
                fontSize: "13px",
                borderRadius: "6px",
                textTransform: "none",
              },
              tableHead: {
                fontSize: "11px",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                color: "#a0aec0",
              },
              badge: {
                fontSize: "11px",
                fontWeight: "500",
                borderRadius: "4px",
              },
              userProfile__dangerSection: {
                display: "none",
              },
              organizationSwitcherTrigger: {
                display: "none",
              },
              organizationListCreateOrganizationActionButton: {
                display: "none",
              },
              organizationProfilePage: {
                display: "none",
              },
            },
          }}
        >
          <Providers>
            <TRPCReactProvider>{children}</TRPCReactProvider>
          </Providers>
        </ClerkProvider>
      </body>
    </html>
  );
}
