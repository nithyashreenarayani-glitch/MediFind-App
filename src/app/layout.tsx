import type { Metadata } from "next";
import { Providers } from "@/components/auth/providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "MediFind — Find medicine nearby",
  description: "Search nearby pharmacies and check medicine availability. Inventory is provided by participating pharmacies.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><Providers>{children}</Providers></body></html>;
}
