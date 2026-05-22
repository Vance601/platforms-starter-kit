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

  // Load the driver list for the name picker.
  useEffect(() => {
    fetch("/api/auth-driver/list")
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          setDrivers(data.drivers);
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
          <h1 style={{ fontSize: 22, marginBottom: 4 }}>Driver Login</h1>
          <p style={{ color: "#94a3b8", marginBottom: 20, fontSize: 14 }}>
            Tap your name
          </p>
          {error && (
            <div style={{ color: "#f87171", marginBottom: 12 }}>{error}</div>
          )}
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
