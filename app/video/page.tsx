import type { Metadata } from "next";
import BrandLogo from "@/components/brand-logo";
import AdVideo from "@/components/ad-video";

export const metadata: Metadata = {
  title: "See Battery City in 60 seconds",
  description:
    "A one-minute look at Battery City: scan to sell, track every battery, and never lose a core or a warranty again.",
};

export default function VideoPage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(180deg,#0f172a,#1e293b)",
        color: "#f8fafc",
      }}
    >
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "20px 28px",
          maxWidth: 1100,
          margin: "0 auto",
        }}
      >
        <a href="/" style={{ fontWeight: 800, fontSize: 20, color: "inherit", textDecoration: "none" }}>
          <BrandLogo size={28} />
        </a>
        <a href="/login" style={{ color: "#cbd5e1", textDecoration: "none", fontWeight: 600 }}>
          Log in
        </a>
      </header>
      <main style={{ maxWidth: 960, margin: "0 auto", padding: "24px 28px 80px" }}>
        <h1 style={{ fontSize: 32, lineHeight: 1.2, fontWeight: 800, margin: "0 0 8px" }}>
          See Battery City in 60 seconds
        </h1>
        <p style={{ color: "#cbd5e1", fontSize: 16, margin: "0 0 24px", maxWidth: 640 }}>
          Scan the battery, scan the VIN, and see every warehouse and truck — then start a free seven-day demo.
        </p>
        <AdVideo />
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 28 }}>
          <a
            href="/"
            style={{
              display: "inline-block",
              padding: "14px 26px",
              borderRadius: 10,
              fontSize: 16,
              fontWeight: 600,
              textDecoration: "none",
              background: "#3b82f6",
              color: "#fff",
            }}
          >
            Try the demo
          </a>
          <a
            href="/"
            style={{
              display: "inline-block",
              padding: "14px 26px",
              borderRadius: 10,
              fontSize: 16,
              fontWeight: 600,
              textDecoration: "none",
              background: "transparent",
              color: "#f8fafc",
              border: "1px solid #475569",
            }}
          >
            Back to Battery City
          </a>
        </div>
      </main>
    </div>
  );
}
