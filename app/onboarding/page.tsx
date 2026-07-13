"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function OnboardingPage() {
  const router = useRouter();
  const [orgName, setOrgName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [legalEntity, setLegalEntity] = useState("");
  const [locationName, setLocationName] = useState("");
  const [city, setCity] = useState("");
  const [stateVal, setStateVal] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setError(null);
    if (!orgName.trim() || !companyName.trim() || !locationName.trim()) {
      setError("Organization name, company name, and first location are required.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgName: orgName.trim(),
          companyName: companyName.trim(),
          legalEntity: legalEntity.trim(),
          locationName: locationName.trim(),
          city: city.trim(),
          state: stateVal.trim(),
        }),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.error || "Could not create your organization.");
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const label: React.CSSProperties = {
    display: "block",
    fontSize: 12,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    color: "#666",
    marginBottom: 6,
  };
  const input: React.CSSProperties = {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 8,
    border: "1px solid #ddd",
    fontSize: 14,
    marginBottom: 16,
    boxSizing: "border-box",
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f6f7f9", padding: 24 }}>
      <div style={{ background: "#fff", padding: 40, borderRadius: 14, maxWidth: 520, width: "100%", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 6 }}>Set up your organization</h1>
        <p style={{ color: "#666", fontSize: 14, marginBottom: 28 }}>
          This creates your workspace. You can add more companies and locations later.
        </p>

        {error ? (
          <div style={{ background: "#fdecec", border: "1px solid #f5c2c2", color: "#a12", padding: 12, borderRadius: 8, fontSize: 14, marginBottom: 20 }}>
            {error}
          </div>
        ) : null}

        <label style={label}>Organization name</label>
        <input style={input} value={orgName} onChange={(e) => setOrgName(e.target.value)} placeholder="e.g. Acme Battery Group" />

        <label style={label}>First company</label>
        <input style={input} value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="e.g. Acme Phoenix" />

        <label style={label}>Legal entity (optional)</label>
        <input style={input} value={legalEntity} onChange={(e) => setLegalEntity(e.target.value)} placeholder="defaults to the company name" />

        <label style={label}>First location</label>
        <input style={input} value={locationName} onChange={(e) => setLocationName(e.target.value)} placeholder="e.g. Main Warehouse" />

        <div style={{ display: "flex", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <label style={label}>City (optional)</label>
            <input style={input} value={city} onChange={(e) => setCity(e.target.value)} />
          </div>
          <div style={{ width: 120 }}>
            <label style={label}>State</label>
            <input style={input} value={stateVal} onChange={(e) => setStateVal(e.target.value)} placeholder="AZ" />
          </div>
        </div>

        <button
          onClick={handleSubmit}
          disabled={saving}
          style={{
            width: "100%",
            padding: "12px 24px",
            borderRadius: 8,
            border: "none",
            background: saving ? "#9db4d8" : "#2563eb",
            color: "#fff",
            fontSize: 16,
            fontWeight: 600,
            cursor: saving ? "default" : "pointer",
            marginTop: 8,
          }}
        >
          {saving ? "Creating..." : "Create organization"}
        </button>
      </div>
    </div>
  );
}
