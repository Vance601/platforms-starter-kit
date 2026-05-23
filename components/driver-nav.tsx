"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = { href: string; label: string };

const ITEMS: NavItem[] = [
  { href: "/driver/transfer", label: "Truck" },
  { href: "/driver/load", label: "Load" },
  { href: "/driver/sell", label: "Sell" },
  { href: "/driver/cores", label: "Cores" },
];

export default function DriverNav() {
  const pathname = usePathname();

  const barStyle: React.CSSProperties = {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    maxWidth: 480,
    margin: "0 auto 20px auto",
  };

  return (
    <nav style={barStyle}>
      {ITEMS.map((item) => {
        const active = pathname === item.href;
        const linkStyle: React.CSSProperties = {
          flex: "1 1 auto",
          textAlign: "center",
          padding: "10px 12px",
          fontSize: 14,
          fontWeight: 600,
          borderRadius: 10,
          textDecoration: "none",
          border: "1px solid #334155",
          background: active ? "#22c55e" : "#1e293b",
          color: active ? "#0f172a" : "#f8fafc",
        };
        return (
          <Link key={item.href} href={item.href} style={linkStyle}>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
