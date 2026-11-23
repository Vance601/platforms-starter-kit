import type { Metadata } from "next";
import LegalDocument from "@/components/legal-document";
import { readLegalFile } from "@/lib/legal-copy";

export const metadata: Metadata = {
  title: "About Us",
  description: "Battery City is a software platform for battery shops and fleets, operated by Dugger's Holding Company LLC.",
  alternates: { canonical: "https://www.battery-city.com/about" },
};

export default function AboutPage() {
  return <LegalDocument markdown={readLegalFile("about-us.md")} />;
}
