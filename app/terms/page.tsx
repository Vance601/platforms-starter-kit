import type { Metadata } from "next";
import LegalDocument from "@/components/legal-document";
import { readLegalFile } from "@/lib/legal-copy";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Terms of Service for the Battery City platform operated by Dugger's Holding Company LLC.",
  alternates: { canonical: "https://www.battery-city.com/terms" },
};

export default function TermsPage() {
  return <LegalDocument markdown={readLegalFile("terms-of-service.md")} />;
}
