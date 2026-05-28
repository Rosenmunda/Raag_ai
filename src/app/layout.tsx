import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import { ClerkProvider } from "@clerk/nextjs";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { ThemeProvider } from "@/components/theme-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Kasaरत AI - By Raag",
  authors: [{ name: "Raag" }],
  description: "A modern fitness AI platform to get jacked for free.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en" suppressHydrationWarning>
        <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <Navbar />

            {/* BACKGROUND WITH MODERN BLURRED GRADIENT */}
            <div className="fixed inset-0 -z-1 overflow-hidden bg-background">
              {/* Gradient Orbs */}
              <div className="absolute -top-[10%] -left-[10%] w-[50%] h-[50%] rounded-full bg-[#106EBE]/20 blur-[120px] mix-blend-screen pointer-events-none"></div>
              <div className="absolute top-[40%] -right-[10%] w-[40%] h-[60%] rounded-full bg-[#0FFCBE]/10 blur-[120px] mix-blend-screen pointer-events-none"></div>
              
              {/* Grid Lines */}
              <div className="absolute inset-0 bg-[linear-gradient(var(--cyber-grid-color)_1px,transparent_1px),linear-gradient(90deg,var(--cyber-grid-color)_1px,transparent_1px)] bg-[size:30px_30px] opacity-50"></div>
            </div>

            <main className="pt-24 flex-grow">{children}</main>
            <Footer />
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
