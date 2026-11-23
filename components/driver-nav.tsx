"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

type NavItem = { href: string; label: string };

const DRIVER_ITEMS: NavItem[] = [
  { href: "/driver/transfer", label: "Truck" },
  { href: "/driver/load", label: "Load" },
  { href: "/driver/move", label: "Move" },
  { href: "/driver/sell", label: "Sell" },
  { href: "/driver/cores", label: "Cores" },
  { href: "/driver/pin", label: "PIN" },
];

// Warehouse staff land on Transfer and use it to move stock onto trucks
// without claiming them. Load is omitted because Transfer replaces it.
const WAREHOUSE_ITEMS: NavItem[] = [
  { href: "/driver/transfer", label: "Transfer" },
  { href: "/driver/move", label: "Move" },
  { href: "/driver/sell", label: "Sell" },
  { href: "/driver/cores", label: "Cores" },
  { href: "/driver/pin", label: "PIN" },
];

export default function DriverNav() {
  const pathname = usePathname();
  const [isWarehouse, setIsWarehouse] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch("/api/driver/me", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (alive && d?.success && d.isWarehouse) setIsWarehouse(true);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const items = isWarehouse ? WAREHOUSE_ITEMS : DRIVER_ITEMS;

  const barStyle: React.CSSProperties = {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    maxWidth: 480,
    margin: "0 auto 20px auto",
  };

  return (
    <nav style={barStyle}>
      {items.map((item) => {
        const active = pathname === item.href;
        const isTransfer = item.label === "Transfer";
        const linkStyle: React.CSSProperties = {
          flex: isTransfer ? "1 1 100%" : "1 1 auto",
          textAlign: "center",
          padding: "10px 12px",
          fontSize: 14,
          fontWeight: 600,
          borderRadius: 10,
          textDecoration: "none",
          border: isTransfer && !active ? "1px solid #22c55e" : "1px solid #334155",
          background: active ? "#22c55e" : "#1e293b",
          color: active ? "#0f172a" : "#f8fafc",
        };
        return (
          <Link key={item.href} href={item.href} style={linkStyle}>
            {item.label}
          </Link>
        );
      })}
      <button
        type="button"
        onClick={async () => {
          try {
            await fetch("/api/auth-driver", { method: "DELETE" });
          } catch {
            // Fall through - send them to login regardless.
          }
          window.location.href = "/driver/login";
        }}
        style={{
          flex: "1 1 auto",
          padding: "10px 12px",
          fontSize: 14,
          fontWeight: 600,
          borderRadius: 10,
          border: "1px solid #7f1d1d",
          background: "#1e293b",
          color: "#fca5a5",
          cursor: "pointer",
        }}
      >
        Log out
      </button>
    </nav>
  );
}
