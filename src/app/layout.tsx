import type { Metadata, Viewport } from "next";
import { LanguageProvider } from "@/components/language-provider";
import { PwaRegister } from "@/components/pwa-register";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
  title: "VAYAX | Book your wash",
  description:
    "Book trusted car care services with VAYAX in New October City, Giza.",
  keywords: ["VAYAX", "car care", "car wash", "booking", "New October City", "Giza", "mobile car service"],
  icons: {
    icon: "/images/vayax-logo-transparent.png",
    shortcut: "/images/vayax-logo-transparent.png",
    apple: "/images/vayax-logo-transparent.png"
  },
  manifest: "/manifest.webmanifest",
  openGraph: {
    title: "VAYAX",
    description: "Your car, our care",
    images: ["/images/vayax-logo-clean.png"],
    type: "website"
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0785e8"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <LanguageProvider>
          {children}
          <PwaRegister />
        </LanguageProvider>
      </body>
    </html>
  );
}
