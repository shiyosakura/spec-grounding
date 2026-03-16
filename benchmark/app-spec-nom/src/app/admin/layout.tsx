import Link from "next/link";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-gray-800 text-white">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-6">
          <span className="font-bold text-lg">Admin</span>
          <Link href="/admin" className="text-sm hover:text-gray-300 transition">
            Calendar
          </Link>
          <Link href="/admin/menus" className="text-sm hover:text-gray-300 transition">
            Menus
          </Link>
          <Link href="/admin/staff" className="text-sm hover:text-gray-300 transition">
            Staff
          </Link>
          <div className="ml-auto">
            <Link href="/" className="text-sm hover:text-gray-300 transition">
              Back to Site
            </Link>
          </div>
        </div>
      </nav>
      <main className="max-w-6xl mx-auto p-6">{children}</main>
    </div>
  );
}
