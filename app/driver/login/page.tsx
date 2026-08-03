"use client";

import { useEffect, useState } from "react";

type Driver = { id: string; name: string; company: string };
type Step = "loading" | "pick" | "pin" | "setpin" | "done";

export default function DriverLogin() {
  const [step, setStep] = useState<Step>("loading");
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [selected, setSelected] = useState<Driver | null>(null);
  const [pin, setPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [companySlug, setCompanySlug] = useState("");
  const [codeInput, setCodeInput] = useState("");

  // Load the driver list for the name picker, scoped to one company.
  // The slug comes from ?c= (set by /d/<company>) and is remembered on the
  // device so a bookmarked /driver/login keeps working for that customer.
  function loadDrivers(slug: string) {
    if (!slug) {
      setStep("pick");
      return;
    }
    fetch(`/api/auth-driver/list?company=${encodeURIComponent(slug)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          setDrivers(data.drivers);
          setCompanyName(data.company?.name || "");
          setCompanySlug(data.company?.slug || slug);
          try {
            window.localStorage.setItem("driver_company", data.company?.slug || slug);
          } catch {
            // Private browsing - the slug just won't persist.
          }
          setStep("pick");
        } else {
          setError(data.error || "Could not load drivers");
          setStep("pick");
        }
      })
      .catch(() => {
        setError("Could not load drivers");
        setStep("pick");
      });
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    let slug = (params.get("c") || params.get("company") || "").trim();
    if (!slug) {
      try {
        slug = window.localStorage.getItem("driver_company") || "";
      } catch {
        slug = "";
      }
    }
    if (slug) {
      setCompanySlug(slug);
      loadDrivers(slug);
    } else {
      setStep("pick");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function pickDriver(d: Driver) {
    setSelected(d);
    setPin("");
    setError("");
    setStep("pin");
  }

  function tapDigit(digit: string) {
    if (pin.length < 4) {
      const next = pin + digit;
      setPin(next);
      if (next.length === 4) submitPin(next);
    }
  }

  function tapNewDigit(
    digit: string,
    value: string,
    setter: (v: string) => void
  ) {
    if (value.length < 4) setter(value + digit);
  }

  async function submitPin(fullPin: string) {
    if (!selected) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/auth-driver", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ driverId: selected.id, pin: fullPin }),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error || "Login failed");
        setPin("");
        setBusy(false);
        return;
      }
      if (data.mustChangePin) {
        // First login — force a new PIN before continuing.
        setNewPin("");
        setConfirmPin("");
        setStep("setpin");
        setBusy(false);
        return;
      }
      setStep("done");
      // Logged in. Send them to the transfer page (built next).
      window.location.href = "/driver/transfer";
    } catch {
      setError("Network error — try again");
      setPin("");
      setBusy(false);
    }
  }

  async function submitNewPin() {
    if (!selected) return;
    if (newPin.length !== 4) {
      setError("New PIN must be 4 digits");
      return;
    }
    if (newPin === "0000") {
      setError("Pick a PIN other than 0000");
      return;
    }
    if (newPin !== confirmPin) {
      setError("PINs don't match");
      setConfirmPin("");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/auth-driver/set-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPin }),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error || "Could not set PIN");
        setBusy(false);
        return;
      }
      setStep("done");
      window.location.href = "/driver/transfer";
    } catch {
      setError("Network error — try again");
      setBusy(false);
    }
  }

  // ---------- UI ----------
  const wrap: React.CSSProperties = {
    minHeight: "100vh",
    background: "#0f172a",
    color: "#f8fafc",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "system-ui, sans-serif",
    padding: 24,
  };
  const card: React.CSSProperties = {
    width: "100%",
    maxWidth: 380,
    background: "#1e293b",
    borderRadius: 16,
    padding: 24,
  };

  if (step === "loading") {
    return (
      <div style={wrap}>
        <div>Loading drivers…</div>
      </div>
    );
  }

  if (step === "pick") {
    return (
      <div style={wrap}>
        <div style={card}>
          <h1 style={{ fontSize: 22, marginBottom: 4 }}>
            {companyName ? `${companyName} Drivers` : "Driver Login"}
          </h1>
          <p style={{ color: "#94a3b8", marginBottom: 20, fontSize: 14 }}>
            {companySlug ? "Tap your name" : "Enter your company code to continue"}
          </p>
          {error && (
            <div style={{ color: "#f87171", marginBottom: 12 }}>{error}</div>
          )}

          {/* No company in the URL: ask for the code instead of listing
              every driver on the platform. */}
          {!companySlug ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <input
                value={codeInput}
                onChange={(e) => setCodeInput(e.target.value)}
                placeholder="Company code (e.g. phx)"
                autoCapitalize="none"
                autoCorrect="off"
                style={{
                  padding: "14px 16px",
                  fontSize: 18,
                  borderRadius: 12,
                  border: "1px solid #334155",
                  background: "#0f172a",
                  color: "#f8fafc",
                }}
              />
              <button
                onClick={() => {
                  const slug = codeInput.trim().toLowerCase();
                  if (!slug) return;
                  setError("");
                  setStep("loading");
                  setCompanySlug(slug);
                  loadDrivers(slug);
                }}
                style={{
                  padding: "14px 16px",
                  fontSize: 18,
                  fontWeight: 600,
                  borderRadius: 12,
                  border: "none",
                  background: "#2563eb",
                  color: "#ffffff",
                  cursor: "pointer",
                }}
              >
                Continue
              </button>
              <p style={{ color: "#64748b", fontSize: 12 }}>
                Your dispatcher can give you the direct link so you only do this once.
              </p>
            </div>
          ) : null}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {drivers.map((d) => (
              <button
                key={d.id}
                onClick={() => pickDriver(d)}
                style={{
                  textAlign: "left",
                  padding: "16px 18px",
                  fontSize: 18,
                  borderRadius: 12,
                  border: "1px solid #334155",
                  background: "#0f172a",
                  color: "#f8fafc",
                  cursor: "pointer",
                }}
              >
                {d.name}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (step === "pin") {
    return (
      <div style={wrap}>
        <div style={card}>
          <button
            onClick={() => setStep("pick")}
            style={{
              background: "none",
              border: "none",
              color: "#94a3b8",
              cursor: "pointer",
              marginBottom: 16,
              fontSize: 14,
            }}
          >
            ← Back
          </button>
          <h1 style={{ fontSize: 22, marginBottom: 4 }}>{selected?.name}</h1>
          <p style={{ color: "#94a3b8", marginBottom: 20, fontSize: 14 }}>
            Enter your 4-digit PIN
          </p>
          <PinDots length={pin.length} />
          {error && (
            <div style={{ color: "#f87171", margin: "12px 0" }}>{error}</div>
          )}
          <Keypad onDigit={tapDigit} onBack={() => setPin(pin.slice(0, -1))} disabled={busy} />
        </div>
      </div>
    );
  }

  if (step === "setpin") {
    const settingConfirm = newPin.length === 4;
    return (
      <div style={wrap}>
        <div style={card}>
          <h1 style={{ fontSize: 22, marginBottom: 4 }}>Set Your PIN</h1>
          <p style={{ color: "#94a3b8", marginBottom: 20, fontSize: 14 }}>
            {settingConfirm ? "Re-enter to confirm" : "Choose a new 4-digit PIN"}
          </p>
          <PinDots length={settingConfirm ? confirmPin.length : newPin.length} />
          {error && (
            <div style={{ color: "#f87171", margin: "12px 0" }}>{error}</div>
          )}
          <Keypad
            onDigit={(d) =>
              settingConfirm
                ? tapNewDigit(d, confirmPin, setConfirmPin)
                : tapNewDigit(d, newPin, setNewPin)
            }
            onBack={() =>
              settingConfirm
                ? setConfirmPin(confirmPin.slice(0, -1))
                : setNewPin(newPin.slice(0, -1))
            }
            disabled={busy}
          />
          {settingConfirm && confirmPin.length === 4 && (
            <button
              onClick={submitNewPin}
              disabled={busy}
              style={{
                width: "100%",
                marginTop: 16,
                padding: 16,
                fontSize: 16,
                borderRadius: 12,
                border: "none",
                background: "#22c55e",
                color: "#0f172a",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Save PIN
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={wrap}>
      <div>Signing in…</div>
    </div>
  );
}

function PinDots({ length }: { length: number }) {
  return (
    <div style={{ display: "flex", gap: 14, justifyContent: "center" }}>
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          style={{
            width: 18,
            height: 18,
            borderRadius: "50%",
            background: i < length ? "#22c55e" : "#334155",
          }}
        />
      ))}
    </div>
  );
}

function Keypad({
  onDigit,
  onBack,
  disabled,
}: {
  onDigit: (d: string) => void;
  onBack: () => void;
  disabled: boolean;
}) {
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"];
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gap: 12,
        marginTop: 24,
      }}
    >
      {keys.map((k, i) => {
        if (k === "")
          return <div key={i} />;
        const isBack = k === "⌫";
        return (
          <button
            key={i}
            disabled={disabled}
            onClick={() => (isBack ? onBack() : onDigit(k))}
            style={{
              padding: 20,
              fontSize: 24,
              borderRadius: 12,
              border: "1px solid #334155",
              background: "#0f172a",
              color: "#f8fafc",
              cursor: disabled ? "default" : "pointer",
            }}
          >
            {k}
          </button>
        );
      })}
    </div>
  );
}
