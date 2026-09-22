import type { Metadata } from "next";
import { Manrope, Inter, Fraunces } from "next/font/google";
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

// Editorial serif reserved for the anatomy chapter's display type —
// medical-editorial voice (titles, numerals) without touching the
// site-wide Manrope/Inter pairing.
const editorial = Fraunces({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-editorial",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Meridian PT — The Science of Movement",
  description:
    "A modern physiotherapy and rehabilitation practice. Explore the human frame through an interactive 3D anatomy experience.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${editorial.variable}`}>
      <body id="top" className="bg-bg font-body text-ink antialiased">
        <Navbar />
        {children}
      </body>
    </html>
  );
}
