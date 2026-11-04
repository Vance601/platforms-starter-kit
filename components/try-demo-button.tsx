"use client";
import { useState } from "react";
import DemoLeadForm from "@/components/demo-lead-form";

// Same flow as the landing page: lead form, then POST /api/public/demo.
export default function TryDemoButton({ className = "" }: { className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={className}>
      <button type="button" onClick={() => setOpen(true)}
        className="w-full rounded-lg border border-blue-500 px-4 py-3 font-medium text-blue-300 hover:bg-blue-500/10">
        Try the demo
      </button>
      {open && <DemoLeadForm onClose={() => setOpen(false)} />}
    </div>
  );
}
