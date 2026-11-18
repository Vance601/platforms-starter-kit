import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Print labels | Battery City",
  robots: { index: false, follow: false },
};

export default function PrintLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style>{`
        @media print {
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: #fff !important;
            min-height: 0 !important;
          }
        }
      `}</style>
      {children}
    </>
  );
}
