import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Providers } from "@/components/auth/providers";
import "./globals.css";
import "./features.css";

export const metadata: Metadata = {
  title: "MediFind — Find medicine nearby",
  description: "Search nearby pharmacies and check medicine availability. Inventory is provided by participating pharmacies.",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <html lang="en"><body><Providers>{children}</Providers></body></html>;
}
