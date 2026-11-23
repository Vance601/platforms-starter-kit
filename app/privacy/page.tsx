import type { Metadata } from "next";
import LegalDocument from "@/components/legal-document";
import { readLegalFile } from "@/lib/legal-copy";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How Battery City collects, uses, and shares information when you use the Battery City platform.",
  alternates: { canonical: "https://www.battery-city.com/privacy" },
};

export default function PrivacyPage() {
  return <LegalDocument markdown={readLegalFile("privacy-policy.md")} />;
}
