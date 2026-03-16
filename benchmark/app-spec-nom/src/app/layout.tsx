import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Salon Reservation System",
  description: "Hair salon reservation system",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className="min-h-screen bg-gray-50 text-gray-900">
        {children}
      </body>
    </html>
  );
}
