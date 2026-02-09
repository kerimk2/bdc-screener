import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { TabNav } from "@/components/tab-nav";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "FinTools",
  description: "Financial analysis tools — BDC screener, stock watchlist, and more",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <TabNav />
        {children}
      </body>
    </html>
  );
}
