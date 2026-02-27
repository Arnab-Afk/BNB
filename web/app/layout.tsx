import type { Metadata } from "next";
import { Manrope, Press_Start_2P } from "next/font/google";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  weight: ["300", "400", "500", "700"],
});

const pressStart = Press_Start_2P({
  variable: "--font-pixel",
  subsets: ["latin"],
  weight: "400",
});

export const metadata: Metadata = {
  title: "Ghost : Full-Stack Privacy Suite for BNB Chain",
  description: "Enterprise-grade anonymity meets the efficiency of BNB Chain.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${manrope.variable} ${pressStart.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
