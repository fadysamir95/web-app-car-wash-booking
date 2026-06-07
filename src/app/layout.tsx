import type { Metadata, Viewport } from "next";
import { LanguageProvider } from "@/components/language-provider";
import { PwaRegister } from "@/components/pwa-register";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
  title: {
    default: "VAYAX | Your Car, Our Care",
    template: "%s | VAYAX"
  },
  description:
    "Book trusted mobile car care and car wash services with VAYAX in New October City, Giza. Fast booking, clear tracking, and professional service.",
  applicationName: "VAYAX",
  authors: [{ name: "VAYAX" }],
  creator: "VAYAX",
  publisher: "VAYAX",
  category: "Car care",
  keywords: [
    "VAYAX",
    "car care",
    "car wash",
    "mobile car wash",
    "car wash booking",
    "New October City",
    "Giza",
    "غسيل سيارات",
    "غسيل سيارات 6 أكتوبر",
    "العناية بالسيارات"
  ],
  icons: {
    icon: "/images/vayax-logo-transparent.png",
    shortcut: "/images/vayax-logo-transparent.png",
    apple: "/images/vayax-logo-transparent.png"
  },
  manifest: "/manifest.webmanifest",
  alternates: {
    canonical: "/",
    languages: {
      en: "/",
      ar: "/"
    }
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1
    }
  },
  openGraph: {
    title: "VAYAX | Your Car, Our Care",
    description: "Book trusted mobile car care services in New October City, Giza.",
    url: "/",
    siteName: "VAYAX",
    images: ["/images/vayax-logo-clean.png"],
    locale: "en_EG",
    alternateLocale: ["ar_EG"],
    type: "website"
  },
  twitter: {
    card: "summary_large_image",
    title: "VAYAX | Your Car, Our Care",
    description: "Book trusted mobile car care services in New October City, Giza.",
    images: ["/images/vayax-logo-clean.png"]
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
