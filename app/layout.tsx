import type { Metadata } from "next";
import { Manrope, Inter } from "next/font/google";
import { Navbar } from "@/components/navigation/Navbar";
import "./globals.css";

const display = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "700", "800"],
  variable: "--font-display",
  display: "swap",
});

const body = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Meridian PT — The Science of Movement",
  description:
    "A modern physiotherapy and rehabilitation practice. Explore the human frame through an interactive 3D anatomy experience.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body id="top" className="bg-bg font-body text-ink antialiased">
        <Navbar />
        {children}
      </body>
    </html>
  );
}
