"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import "./globals.css";

interface NavItem {
  label: string;
  href: string;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    title: "Order Management",
    items: [
      { label: "Quotation List", href: "/quotations" },
      { label: "Order List", href: "/orders" },
    ],
  },
  {
    title: "Inventory & Shipping",
    items: [
      { label: "Inventory", href: "/inventory" },
      { label: "Shipping Instructions", href: "/shipping" },
      { label: "Receiving", href: "/receiving" },
    ],
  },
  {
    title: "Invoice & Payment",
    items: [
      { label: "Invoice List", href: "/invoices" },
      { label: "Invoice Issuance", href: "/invoices/generate" },
      { label: "Payment Registration", href: "/payments/register" },
      { label: "Payment Reconciliation", href: "/payments/reconcile" },
    ],
  },
  {
    title: "Master Management",
    items: [
      { label: "Products", href: "/master/products" },
      { label: "Customers", href: "/master/customers" },
      { label: "Special Prices", href: "/master/special-prices" },
    ],
  },
];

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <html lang="en">
      <body className="bg-gray-100 text-gray-900 min-h-screen flex">
        {/* Sidebar */}
        <aside className="w-64 bg-gray-800 text-gray-100 flex flex-col flex-shrink-0 min-h-screen">
          {/* App Title */}
          <div className="px-5 py-5 border-b border-gray-700">
            <Link href="/" className="block">
              <h1 className="text-lg font-bold text-white tracking-wide">
                BtoB Sales Management
              </h1>
            </Link>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto py-4">
            {navGroups.map((group) => (
              <div key={group.title} className="mb-4">
                <h2 className="px-5 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  {group.title}
                </h2>
                <ul>
                  {group.items.map((item) => {
                    const isActive =
                      pathname === item.href ||
                      (item.href !== "/" && pathname.startsWith(item.href));
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          className={`block px-5 py-2 text-sm transition-colors ${
                            isActive
                              ? "bg-blue-600 text-white font-medium"
                              : "text-gray-300 hover:bg-gray-700 hover:text-white"
                          }`}
                        >
                          {item.label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </nav>

          {/* Footer */}
          <div className="px-5 py-3 border-t border-gray-700 text-xs text-gray-500">
            Spec-Driven App
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto">
          <div className="p-8">{children}</div>
        </main>
      </body>
    </html>
  );
}
