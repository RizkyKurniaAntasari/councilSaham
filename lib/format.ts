export function fmtNumber(v: number | null | undefined, digits = 2): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  return new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(v);
}

export function fmtInt(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  return new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(v);
}

export function fmtIDR(v: number | null | undefined, digits = 0): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  return "Rp " + new Intl.NumberFormat("id-ID", { maximumFractionDigits: digits }).format(v);
}

export function fmtCompact(v: number | null | undefined, prefix = "Rp "): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  const abs = Math.abs(v);
  const units: [number, string][] = [
    [1e12, " T"],
    [1e9, " M"],
    [1e6, " jt"],
    [1e3, " rb"],
  ];
  for (const [div, suffix] of units) {
    if (abs >= div) {
      return prefix + (v / div).toFixed(2).replace(".", ",") + suffix;
    }
  }
  return prefix + v.toFixed(0);
}

export function fmtPct(v: number | null | undefined, digits = 2): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  return `${v >= 0 ? "+" : ""}${v.toFixed(digits).replace(".", ",")}%`;
}

export function fmtPctPlain(v: number | null | undefined, digits = 1): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  return `${v.toFixed(digits).replace(".", ",")}%`;
}

export function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  if (!Number.isFinite(diff)) return "—";
  const m = Math.round(diff / 60000);
  if (m < 1) return "baru saja";
  if (m < 60) return `${m} menit lalu`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} jam lalu`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d} hari lalu`;
  const mo = Math.round(d / 30);
  if (mo < 12) return `${mo} bulan lalu`;
  return `${Math.round(mo / 12)} tahun lalu`;
}

export function fmtDate(ts: number): string {
  if (!Number.isFinite(ts)) return "—";
  return new Date(ts).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function fmtDateTime(ts: number): string {
  if (!Number.isFinite(ts)) return "—";
  return new Date(ts).toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
