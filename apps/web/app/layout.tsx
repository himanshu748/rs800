import type { Metadata, Viewport } from "next";
import { Inter, Noto_Sans_Devanagari, Space_Grotesk } from "next/font/google";
import { Providers } from "@/components/Providers";
import "./globals.css";

const space = Space_Grotesk({ variable: "--font-space", subsets: ["latin"], weight: ["500", "700"] });
const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const deva = Noto_Sans_Devanagari({ variable: "--font-deva", subsets: ["devanagari"], weight: ["400", "600", "700"] });

export const metadata: Metadata = {
  title: "₹800: plan your work around the heat",
  description: "An income-aware heat exposure planner for outdoor workers in India.",
};

export const viewport: Viewport = { themeColor: "#111315", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${space.variable} ${inter.variable} ${deva.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
