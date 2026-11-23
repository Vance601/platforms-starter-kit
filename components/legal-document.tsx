import BrandLogo from "@/components/brand-logo";
import LegalMarkdown from "@/lib/legal-markdown";
import SiteFooter from "@/components/site-footer";

export default function LegalDocument({ markdown }: { markdown: string }) {
  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", color: "#0f172a", display: "flex", flexDirection: "column" }}>
      <header
        style={{
          background: "#0f172a",
          color: "#f8fafc",
          padding: "16px 28px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <a href="/" style={{ color: "inherit", textDecoration: "none" }}>
          <BrandLogo size={28} />
        </a>
        <a href="/" style={{ color: "#94a3b8", fontSize: 14, textDecoration: "none" }}>
          Home
        </a>
      </header>
      <article
        style={{
          flex: 1,
          maxWidth: 760,
          width: "100%",
          margin: "0 auto",
          padding: "40px 24px 64px",
          fontSize: 16,
        }}
      >
        <LegalMarkdown markdown={markdown} />
      </article>
      <SiteFooter variant="light" />
    </div>
  );
}
