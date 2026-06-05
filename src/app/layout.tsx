import type { Metadata, Viewport } from "next";
import { LanguageProvider } from "@/components/language-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Car Wash Booking | New October City",
  description:
    "Book an overnight car wash in New October City, Giza. Available from 12 AM to 5 AM.",
  keywords: ["car wash", "booking", "New October City", "Giza", "mobile car wash"],
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/favicon.svg"
  },
  openGraph: {
    title: "Car Wash Booking",
    description: "Book your car wash from 12 AM to 5 AM in supported New October City areas.",
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
        <LanguageProvider>{children}</LanguageProvider>
      </body>
    </html>
  );
}
