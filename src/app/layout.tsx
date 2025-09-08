import type { Metadata } from "next";
import { Lato } from "next/font/google";
import "./globals.css";

const lato = Lato({
  variable: "--font-lato",
  subsets: ["latin"],
  weight: ["300", "400", "700", "900"],
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NODE_ENV === "production"
      ? "https://flappy-bot.vercel.app"
      : "http://localhost:3000"
  ),
  title: "Flappy Bot",
  description:
    "A Metabase themed Flappy Bird game featuring blue bar charts and Metabot character",
  icons: {
    icon: "/icon.svg",
  },
  openGraph: {
    title: "Flappy Bot - Metabase Game",
    description:
      "Play Flappy Bot! Navigate Metabot through blue bar charts in this fun Flappy Bird style game.",
    type: "website",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "Flappy Bot - Metabase Game",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Flappy Bot - Flappy Bird Game",
    description:
      "Play Flappy Bot! Navigate Metabot through blue bar charts in this fun Flappy Bird style game.",
    images: ["/og.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${lato.variable} antialiased`}>{children}</body>
    </html>
  );
}
