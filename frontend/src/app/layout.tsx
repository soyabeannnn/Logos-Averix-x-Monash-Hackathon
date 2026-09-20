import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import { AppProviders } from "@/components/layout/AppProviders";
import { Sidebar } from "@/components/layout/Sidebar";
import "./globals.css";

const plexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Logos - Shipping Document Verification",
  description: "Check Shipping Instructions against draft Bills of Lading and review discrepancies.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${plexSans.variable} ${plexMono.variable}`}>
      <body className="flex min-h-screen flex-col md:flex-row">
        <a
          href="#main"
          className="absolute -left-[999px] focus:top-2 focus:left-2 focus:z-10 focus:bg-white focus:p-2"
        >
          Skip to content
        </a>
        <AppProviders>
          <Sidebar />
          <main id="main" tabIndex={-1} className="w-full max-w-[1200px] min-w-0 flex-1 px-4 py-5 md:px-9 md:pt-7 md:pb-16">
            {children}
          </main>
        </AppProviders>
      </body>
    </html>
  );
}
