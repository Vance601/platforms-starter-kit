export const LEGAL_LINKS = [
  { href: "/about", label: "About" },
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
  { href: "/returns", label: "Returns & Warranty" },
] as const;

export default function SiteFooter({ variant = "dark" }: { variant?: "dark" | "light" }) {
  const dark = variant === "dark";
  return (
    <footer
      style={{
        borderTop: dark ? "1px solid #334155" : "1px solid #e5e7eb",
        padding: "22px 28px 28px",
        background: dark ? "transparent" : "#fff",
      }}
    >
      <nav
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "10px 22px",
          justifyContent: "center",
          fontSize: 13,
        }}
      >
        {LEGAL_LINKS.map((l) => (
          <a
            key={l.href}
            href={l.href}
            style={{ color: dark ? "#94a3b8" : "#4b5563", textDecoration: "none" }}
          >
            {l.label}
          </a>
        ))}
      </nav>
      <p
        style={{
          margin: "14px 0 0",
          textAlign: "center",
          fontSize: 12,
          color: dark ? "#64748b" : "#9ca3af",
        }}
      >
        Dugger&apos;s Holding Company LLC, d/b/a Battery City
      </p>
    </footer>
  );
}
