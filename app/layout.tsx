import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "TrcSwap",
  description: "SunSwap TRON swap frontend"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-zinc-50">{children}</body>
    </html>
  );
}
