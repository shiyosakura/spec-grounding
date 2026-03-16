import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-8">
      <h1 className="text-4xl font-bold text-gray-800">Salon Reservation System</h1>
      <p className="text-gray-500 text-lg">Welcome! Choose an option below.</p>
      <div className="grid grid-cols-2 gap-6 mt-4">
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-gray-700">Customer</h2>
          <Link href="/menu" className="block px-6 py-3 bg-white rounded-lg shadow hover:shadow-md transition border text-center">
            Browse Menus
          </Link>
          <Link href="/reserve" className="block px-6 py-3 bg-white rounded-lg shadow hover:shadow-md transition border text-center">
            Make a Reservation
          </Link>
          <Link href="/mypage" className="block px-6 py-3 bg-white rounded-lg shadow hover:shadow-md transition border text-center">
            My Page
          </Link>
        </div>
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-blue-700">Admin</h2>
          <Link href="/calendar" className="block px-6 py-3 bg-white rounded-lg shadow hover:shadow-md transition border text-center">
            Reservation Calendar
          </Link>
          <Link href="/menu-management" className="block px-6 py-3 bg-white rounded-lg shadow hover:shadow-md transition border text-center">
            Menu Management
          </Link>
          <Link href="/staff-management" className="block px-6 py-3 bg-white rounded-lg shadow hover:shadow-md transition border text-center">
            Staff Management
          </Link>
        </div>
      </div>
    </div>
  );
}
