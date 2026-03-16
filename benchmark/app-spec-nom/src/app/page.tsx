import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-8 p-8">
      <h1 className="text-3xl font-bold">Salon Reservation System</h1>
      <p className="text-gray-600">Welcome to our salon booking system</p>
      <div className="flex gap-4">
        <Link
          href="/menu"
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          View Menu & Book
        </Link>
        <Link
          href="/admin"
          className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition"
        >
          Admin Panel
        </Link>
      </div>
    </div>
  );
}
