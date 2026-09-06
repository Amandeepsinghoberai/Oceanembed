import type { Metadata } from "next";
import { Space_Grotesk, Bricolage_Grotesque, Public_Sans } from "next/font/google";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-space-grotesk",
});

const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: ["500", "700"],
  variable: "--font-bricolage",
});

const publicSans = Public_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-public-sans",
});

export const metadata: Metadata = {
  title: "OceanEmbed",
  description:
    "OceanEmbed reconstructs the full ocean temperature profile from surface signals alone.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${spaceGrotesk.variable} ${bricolage.variable} ${publicSans.variable}`}>
      <body>{children}</body>
    </html>
  );
}
