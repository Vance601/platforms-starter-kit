import type { Metadata } from "next";
import LegalDocument from "@/components/legal-document";
import { readLegalFile } from "@/lib/legal-copy";

export const metadata: Metadata = {
  title: "Refund, Return & Warranty Policy",
  description: "Refund, return, core-charge, cancellation, and warranty terms for purchases recorded through Battery City.",
  alternates: { canonical: "https://www.battery-city.com/returns" },
};

export default function ReturnsPage() {
  return <LegalDocument markdown={readLegalFile("refund-return-and-warranty-policy.md")} />;
}
