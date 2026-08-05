import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Email Reader AI - Intelligent Email Automation",
  description:
    "AI-powered email automation that classifies, replies, and manages your inbox. Get notified about job offers and important emails via Telegram.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
