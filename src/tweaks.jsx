/* ============================================================
   GomĐơn — Tweaks panel
   A small, self-contained control surface that lets the user
   live-tune the accent colour, default Orders layout and table
   density. State is persisted in localStorage.

   (The original prototype used the Claude Design "tweaks-panel"
   starter, which carried a postMessage edit contract specific to
   that tool. This is a production-appropriate re-implementation
   of the same user-facing controls.)
   ============================================================ */
import React from "react";
import { Icon } from "./icons.jsx";

const STORE_KEY = "gd_tweaks";

export function useTweaks(defaults) {
  const [state, setState] = React.useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORE_KEY) || "{}");
      return { ...defaults, ...saved };
    } catch {
      return { ...defaults };
    }
  });
  const setTweak = React.useCallback((key, value) => {
    setState((prev) => {
      const next = { ...prev, [key]: value };
      try { localStorage.setItem(STORE_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);
  return [state, setTweak];
}

export function TweaksPanel({ children }) {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="tweaks-fab">
      {open && (
        <div className="tweaks-card">
          <div className="tweaks-head">
            <Icon name="settings" size={16} />
            <b>Tuỳ chỉnh giao diện</b>
            <button className="tweaks-x" onClick={() => setOpen(false)} aria-label="đóng"><Icon name="close" size={16} /></button>
          </div>
          <div className="tweaks-body">{children}</div>
        </div>
      )}
      <button className="tweaks-btn" onClick={() => setOpen((v) => !v)} title="Tuỳ chỉnh giao diện" aria-label="tweaks">
        <Icon name="settings" size={20} />
      </button>
    </div>
  );
}

export function TweakSection({ label }) {
  return <div className="tweak-section">{label}</div>;
}

export function TweakColor({ label, value, options, onChange }) {
  return (
    <div className="tweak-row">
      <span className="tweak-label">{label}</span>
      <div className="tweak-colors">
        {options.map((c) => (
          <button key={c} className={"tweak-swatch" + (value === c ? " active" : "")}
            style={{ background: c }} onClick={() => onChange(c)} aria-label={c}>
            {value === c && <Icon name="check" size={13} stroke={3} />}
          </button>
        ))}
      </div>
    </div>
  );
}

export function TweakRadio({ label, value, options, onChange }) {
  return (
    <div className="tweak-row">
      <span className="tweak-label">{label}</span>
      <div className="tweak-seg">
        {options.map((o) => (
          <button key={o} className={"tweak-seg-item" + (value === o ? " active" : "")} onClick={() => onChange(o)}>
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}
