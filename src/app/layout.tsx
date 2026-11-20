import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";

const geist = localFont({
  src: "./fonts/Geist-Latin.woff2",
  variable: "--font-pulse",
  display: "swap",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "Pulse - AI RSS Reader",
  description: "A calm, intelligent RSS reader",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f5f6f8",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={geist.variable}>
      <body>{children}</body>
    </html>
  );
}
