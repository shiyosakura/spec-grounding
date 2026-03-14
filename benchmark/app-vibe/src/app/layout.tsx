import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Link from "next/link";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Salon Reservation System",
  description: "Salon reservation system baseline app",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-gray-50 min-h-screen`}
      >
        <nav className="bg-white border-b shadow-sm">
          <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
            <Link href="/" className="text-xl font-bold text-gray-800">
              Salon Reserve
            </Link>
            <div className="flex gap-6 text-sm">
              <div className="flex gap-4">
                <Link href="/menu" className="text-gray-600 hover:text-gray-900">Menu</Link>
                <Link href="/reserve" className="text-gray-600 hover:text-gray-900">Book</Link>
                <Link href="/mypage" className="text-gray-600 hover:text-gray-900">My Page</Link>
              </div>
              <div className="border-l pl-4 flex gap-4">
                <Link href="/calendar" className="text-blue-600 hover:text-blue-800">Admin: Calendar</Link>
                <Link href="/menu-management" className="text-blue-600 hover:text-blue-800">Admin: Menus</Link>
                <Link href="/staff-management" className="text-blue-600 hover:text-blue-800">Admin: Staff</Link>
              </div>
            </div>
          </div>
        </nav>
        <main className="max-w-7xl mx-auto px-4 py-6">
          {children}
        </main>
      </body>
    </html>
  );
}
