import { useCallback, useEffect, useMemo, useState, type DragEvent } from "react";
import type { OnBrand } from "../shared/brand";
import {
  CSV_COLUMNS,
  DEFAULT_OPTIONS,
  packFile,
  parseCsv,
  summarize,
  toCsv,
  type Flag,
  type Service,
  type StockInput,
  type StockOptions,
} from "./pack";
import { StatusPill } from "../shared/status-pill";
import { cn } from "../shared/cn";


const SAMPLE = "/sample-stock.csv";

const FLAG_TONE: Record<Flag, "ok" | "watch" | "bad"> = {
  high: "bad",
  excess: "watch",
  review: "watch",
  ok: "ok",
};

const FLAG_LABEL: Record<Flag, string> = {
  high: "HIGH",
  excess: "EXCESS",
  review: "REVIEW",
  ok: "OK",
};

export function StockApp({ onBrand, homeHref = "./" }: { onBrand?: OnBrand; homeHref?: string }) {
  const setBrand = onBrand ?? (() => {});
  const [opt, setOpt] = useState<StockOptions>(DEFAULT_OPTIONS);
  const [inputs, setInputs] = useState<StockInput[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Flag | "all">("all");
  const [q, setQ] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);

  useEffect(() => {
    setBrand("think");
    return () => setBrand("idle");
  }, [setBrand]);

  const rows = useMemo(() => packFile(inputs, opt), [inputs, opt]);
  const stats = useMemo(() => summarize(rows), [rows]);

  useEffect(() => {
    if (rows.length) setBrand("done");
  }, [rows, setBrand]);

  const run = useCallback((text: string, name: string) => {
    try {
      setInputs(parseCsv(text));
      setFileName(name);
      setError(null);
      setFilter("all");
    } catch (e) {
      setInputs([]);
      setError(e instanceof Error ? e.message : "Could not read that file.");
    }
  }, []);
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter !== "all" && r.flag !== filter) return false;
      if (!needle) return true;
      return r.sku.toLowerCase().includes(needle) || r.name.toLowerCase().includes(needle);
    });
  }, [rows, filter, q]);

  async function fromFile(file: File) {
    run(await file.text(), file.name);
  }

  async function loadSample() {
    const res = await fetch(SAMPLE);
    run(await res.text(), "sample-stock.csv");
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDrag(false);
    const file = e.dataTransfer.files[0];
    if (file) void fromFile(file);
  }

  function exportCsv() {
    const blob = new Blob([toCsv(shown.length ? shown : rows)], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "stock-min.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <main className="mx-auto max-w-6xl px-5 py-10 sm:py-14">
      <p className="font-mono text-xs tracking-widest text-accent uppercase">
        <a href={homeHref} className="hover:text-fg">
          My tools
        </a>
        {" · 03 · Stock"}
        <a href="https://github.com/ggwalsh/tools/tree/main/src/stock" className="ml-3 text-silver hover:text-fg" target="_blank" rel="noreferrer">
          GitHub
        </a>
      </p>
      <h1 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">
        Drop a SKU export. Get min, max, and safety stock a counter can run.
      </h1>
      <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted sm:text-base">
        Same rules that kept a Calgary branch under 60 days of inventory: zero and
        sporadic movers get little or nothing. Active SKUs get a min (lead-time
        demand plus safety stock), a max at the cover cap, and a buy-up-to-max
        only when they are under min. A carton only lands if the demand can eat it.
      </p>

      <div className="mt-8 flex flex-wrap items-center gap-2">
        <label className="inline-flex min-h-11 cursor-pointer items-center rounded-full bg-amaranth px-5 text-sm font-medium text-fg hover:bg-accent">
          Upload CSV
          <input
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void fromFile(f);
              e.target.value = "";
            }}
          />
        </label>
        <button
          type="button"
          onClick={() => void loadSample()}
          className="inline-flex min-h-11 items-center rounded-full border border-line px-5 text-sm text-silver hover:text-fg"
        >
          Load sample
        </button>
        <a
          href="/stock-template.csv"
          download="stock-template.csv"
          className="inline-flex min-h-11 items-center rounded-full border border-line px-5 text-sm text-silver hover:text-fg"
        >
          Empty template
        </a>
        {rows.length > 0 && (
          <button
            type="button"
            onClick={exportCsv}
            className="inline-flex min-h-11 items-center rounded-full border border-line px-5 text-sm text-silver hover:text-fg"
          >
            Export
          </button>
        )}
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={onDrop}
        className={cn(
          "mt-6 rounded-lg border border-dashed px-5 py-8 text-sm text-muted",
          drag ? "border-amaranth bg-surface text-fg" : "border-line",
        )}
      >
        Drop a CSV here, or start from the empty template. First row must be
        headers. Excel works if you save as CSV.
        {fileName && <span className="mt-2 block font-mono text-xs text-silver">{fileName}</span>}
      </div>

      <div className="mt-4 overflow-x-auto rounded-lg border border-line">
        <table className="w-full min-w-[36rem] text-left text-sm">
          <thead className="bg-surface font-mono text-xs tracking-wide text-muted uppercase">
            <tr>
              <Th>Column</Th>
              <Th>Need</Th>
              <Th>What it is</Th>
              <Th>Also accepts</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {CSV_COLUMNS.map((c) => (
              <tr key={c.key}>
                <td className="px-3 py-2 font-mono text-xs text-fg">{c.key}</td>
                <td className="px-3 py-2 text-xs text-silver">{c.need ? "Required" : "Optional"}</td>
                <td className="px-3 py-2 text-xs text-muted">{c.about}</td>
                <td className="px-3 py-2 font-mono text-xs text-muted">{c.aliases}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {error && <p className="mt-4 text-sm text-accent">{error}</p>}

      <div className="mt-8 flex flex-wrap gap-3">
        <label className="flex items-center gap-2 text-xs text-muted">
          Service
          <select
            value={opt.service}
            onChange={(e) => setOpt((o) => ({ ...o, service: Number(e.target.value) as Service }))}
            className="min-h-11 rounded-sm border border-line bg-ink px-3 text-sm text-fg"
          >
            <option value={90}>90%</option>
            <option value={95}>95%</option>
            <option value={99}>99%</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-xs text-muted">
          Max cover (days)
          <input
            type="number"
            min={14}
            max={180}
            value={opt.maxDays}
            onChange={(e) => setOpt((o) => ({ ...o, maxDays: Number(e.target.value) || 60 }))}
            className="min-h-11 w-24 rounded-sm border border-line bg-ink px-3 text-sm text-fg tabular-nums"
          />
        </label>
      </div>

      {rows.length > 0 && (
        <>
          <dl className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-5">
            <Stat label="SKUs" value={stats.skus} />
            <Stat label="HIGH" value={stats.high} hot={stats.high > 0} />
            <Stat label="EXCESS" value={stats.excess} />
            <Stat label="REVIEW" value={stats.review} />
            <Stat label="Buy units" value={stats.buy} />
          </dl>

          <div className="mt-6 flex flex-wrap items-center gap-2">
            {(["all", "high", "excess", "review", "ok"] as const).map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => setFilter(id)}
                className={cn(
                  "min-h-9 rounded-full px-3 text-xs uppercase tracking-wide",
                  filter === id ? "bg-amaranth text-fg" : "border border-line text-silver hover:text-fg",
                )}
              >
                {id === "all" ? "All" : FLAG_LABEL[id]}
              </button>
            ))}
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Find a SKU"
              className="min-h-11 min-w-40 flex-1 rounded-sm border border-line bg-ink px-3 text-sm text-fg sm:max-w-xs"
            />
          </div>

          <div className="mt-4 overflow-x-auto rounded-lg border border-line">
            <table className="w-full min-w-[64rem] text-left text-sm">
              <thead className="bg-surface font-mono text-xs tracking-wide text-muted uppercase">
                <tr>
                  <Th>Part</Th>
                  <Th>Tier</Th>
                  <Th>Flag</Th>
                  <Th className="text-right">On hand</Th>
                  <Th className="text-right">12m</Th>
                  <Th className="text-right">Cover</Th>
                  <Th className="text-right">Safety</Th>
                  <Th className="text-right">Min</Th>
                  <Th className="text-right">Max</Th>
                  <Th className="text-right">Buy</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {shown.map((r) => (
                  <tr key={r.sku} className="bg-ink">
                    <td className="px-3 py-3">
                      <p className="font-medium text-fg">{r.sku}</p>
                      <p className="text-xs text-muted">{r.name}</p>
                      {r.note && <p className="mt-1 text-xs text-silver">{r.note}</p>}
                    </td>
                    <td className="px-3 py-3 font-mono text-xs uppercase text-silver">{r.tier}</td>
                    <td className="px-3 py-3">
                      <StatusPill status={FLAG_LABEL[r.flag]} tone={FLAG_TONE[r.flag]} />
                    </td>
                    <TdNum>{fmt(r.onHand)}</TdNum>
                    <TdNum>{fmt(r.demand12)}</TdNum>
                    <TdNum>{r.daysCover == null ? "—" : `${Math.round(r.daysCover)}d`}</TdNum>
                    <TdNum>{fmt(r.safety)}</TdNum>
                    <TdNum>{fmt(r.min)}</TdNum>
                    <TdNum>{fmt(r.max)}</TdNum>
                    <TdNum>{r.orderQty ? fmt(r.orderQty) : "—"}</TdNum>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 font-mono text-xs text-muted">
            {shown.length} of {rows.length} · dead stock {fmt(stats.dead)} units
          </p>
        </>
      )}
    </main>
  );
}

function Stat({ label, value, hot }: { label: string; value: number; hot?: boolean }) {
  return (
    <div className="rounded-lg border border-line bg-surface px-4 py-3">
      <dt className="font-mono text-xs tracking-wide text-muted uppercase">{label}</dt>
      <dd className={cn("mt-1 text-2xl font-semibold tabular-nums", hot && "text-accent")}>{fmt(value)}</dd>
    </div>
  );
}

function Th({ children, className }: { children: string; className?: string }) {
  return <th className={cn("px-3 py-2 font-medium", className)}>{children}</th>;
}

function TdNum({ children }: { children: string }) {
  return <td className="px-3 py-3 text-right tabular-nums text-fg">{children}</td>;
}

function fmt(n: number) {
  return new Intl.NumberFormat("en-CA").format(n);
}
