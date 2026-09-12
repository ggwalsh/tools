export type Service = 90 | 95 | 99;
export type Tier = "zero" | "low" | "active";
export type Flag = "high" | "excess" | "review" | "ok";

export type StockInput = {
  sku: string;
  name: string;
  onHand: number;
  demand12: number;
  demandPrior: number;
  leadDays: number;
  moq: number;
  currentMin: number;
};

export type StockOptions = {
  service: Service;
  maxDays: number;
  cv: number;
};

export type StockRow = StockInput & {
  tier: Tier;
  add: number;
  growth: number | null;
  safety: number;
  min: number;
  max: number;
  daysCover: number | null;
  recDays: number | null;
  gap: number;
  orderQty: number;
  flag: Flag;
  note: string;
};

export const ZERO_MAX = 5;
export const LOW_MAX = 30;
export const TOKEN = 1;
export const DEFAULT_CV = 0.4;
export const DEFAULT_MAX_DAYS = 60;
export const DEFAULT_LEAD = 14;
export const Z: Record<Service, number> = { 90: 1.28, 95: 1.65, 99: 2.33 };

const YEAR = 365;

export const DEFAULT_OPTIONS: StockOptions = {
  service: 95,
  maxDays: DEFAULT_MAX_DAYS,
  cv: DEFAULT_CV,
};

export const CSV_COLUMNS: { key: string; need: boolean; about: string; aliases: string }[] = [
  { key: "PartNum", need: true, about: "SKU / part number", aliases: "Part, SKU, Item" },
  { key: "PartDescription", need: false, about: "Name on the counter", aliases: "Description, Name" },
  { key: "OnHandQty", need: false, about: "Units on the shelf now", aliases: "OnHand, QOH" },
  { key: "Demand12M", need: true, about: "Units sold in the last 12 months", aliases: "Demand, Sold12, LTM" },
  { key: "DemandPrior12M", need: false, about: "Units sold the year before (for YoY)", aliases: "Prior, PY" },
  { key: "LeadTimeDays", need: false, about: "Supplier lead time in days. Blank uses 14.", aliases: "LeadTime, LT" },
  { key: "MinOrderQty", need: false, about: "Carton / MOQ. Only applied if demand can eat it.", aliases: "MOQ, MinQty" },
  { key: "CurrentMin", need: false, about: "What the system min is today (for comparison)", aliases: "Min, ROP" },
];

export const TEMPLATE_CSV = `${CSV_COLUMNS.map((c) => c.key).join(",")}\n`;

function num(v: string | undefined): number {
  if (!v) return 0;
  const n = Number(String(v).replace(/[$,]/g, "").trim());
  return Number.isFinite(n) ? n : 0;
}

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n));
}

function roundQty(n: number) {
  if (n <= 0) return 0;
  return Math.max(1, Math.round(n));
}

export function parseCsv(text: string): StockInput[] {
  const rows = splitCsv(text.replace(/^\uFEFF/, ""));
  if (rows.length < 2) return [];
  const head = rows[0].map((h) => h.trim().toLowerCase().replace(/[\s_-]+/g, ""));
  const idx = (names: string[]) => {
    for (const n of names) {
      const i = head.indexOf(n);
      if (i >= 0) return i;
    }
    return -1;
  };
  const c = {
    sku: idx(["partnum", "part", "sku", "item", "itemcode"]),
    name: idx(["partdescription", "description", "desc", "name", "partdesc"]),
    onHand: idx(["onhandqty", "onhand", "qtyonhand", "qoh", "quantityonhand"]),
    demand12: idx(["demand12m", "demand", "sold12", "units12", "ltm", "sales12m", "qty12"]),
    demandPrior: idx(["demandprior12m", "prior", "demandprior", "py", "prior12", "soldprior"]),
    lead: idx(["leadtimedays", "leadtime", "lead", "lt", "leadtimeday"]),
    moq: idx(["minorderqty", "moq", "minqty", "minimumorderqty"]),
    min: idx(["currentmin", "min", "reorder", "rop", "safetystock", "minimum"]),
  };
  if (c.sku < 0 || c.demand12 < 0) {
    throw new Error("Need a Part / SKU column and a 12-month demand column.");
  }
  const out: StockInput[] = [];
  for (const row of rows.slice(1)) {
    if (!row.some((cell) => cell.trim())) continue;
    const sku = (row[c.sku] ?? "").trim();
    if (!sku) continue;
    out.push({
      sku,
      name: c.name >= 0 ? (row[c.name] ?? "").trim() : "",
      onHand: c.onHand >= 0 ? num(row[c.onHand]) : 0,
      demand12: num(row[c.demand12]),
      demandPrior: c.demandPrior >= 0 ? num(row[c.demandPrior]) : 0,
      leadDays: c.lead >= 0 ? num(row[c.lead]) : 0,
      moq: c.moq >= 0 ? num(row[c.moq]) : 0,
      currentMin: c.min >= 0 ? num(row[c.min]) : 0,
    });
  }
  return out;
}

function splitCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else q = false;
      } else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (ch !== "\r") cell += ch;
  }
  if (cell.length || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

export function packSku(row: StockInput, opt: StockOptions = DEFAULT_OPTIONS): StockRow {
  const add = row.demand12 / YEAR;
  const growth = row.demandPrior > 0 ? row.demand12 / row.demandPrior - 1 : null;
  const buf = growth != null ? clamp(growth, 0, 0.5) : 0;
  const eff = add * (1 + buf);

  let tier: Tier;
  let safety = 0;
  let min = 0;
  let max = 0;
  if (row.demand12 <= ZERO_MAX) {
    tier = "zero";
  } else if (row.demand12 <= LOW_MAX) {
    tier = "low";
    min = TOKEN;
    max = TOKEN;
  } else {
    tier = "active";
    const lead = row.leadDays > 0 ? row.leadDays : DEFAULT_LEAD;
    const ssRaw = Z[opt.service] * opt.cv * eff * Math.sqrt(lead);
    safety = ssRaw >= 0.5 ? roundQty(ssRaw) : 0;
    const rop = eff * lead + ssRaw;
    const cap = eff * opt.maxDays;
    max = roundQty(cap);
    min = roundQty(Math.min(rop, cap));
    if (min > max) min = max;
  }

  const daysCover = add > 0 ? row.onHand / add : row.onHand > 0 ? Infinity : 0;
  const recDays = add > 0 && min > 0 ? min / add : min === 0 ? 0 : null;
  const gap = min - row.onHand;

  let orderQty = 0;
  if (row.onHand < min) {
    const need = Math.max(max - row.onHand, min - row.onHand, 0);
    orderQty = roundQty(need);
    if (tier === "active" && row.moq > 0 && add > 0) {
      const packs = Math.ceil(orderQty / row.moq);
      const boxed = packs * Math.round(row.moq);
      const days = (row.onHand + boxed) / add;
      if (days <= opt.maxDays * 1.15) orderQty = boxed;
    }
  }

  const { flag, note } = flagRow(tier, row, min, max, daysCover, growth, opt.maxDays);

  return {
    ...row,
    tier,
    add,
    growth,
    safety,
    min,
    max,
    daysCover: Number.isFinite(daysCover) ? daysCover : null,
    recDays,
    gap,
    orderQty,
    flag,
    note,
  };
}

function flagRow(
  tier: Tier,
  row: StockInput,
  min: number,
  max: number,
  daysCover: number,
  growth: number | null,
  maxDays: number,
): { flag: Flag; note: string } {
  if (tier === "zero" && row.onHand > 0) {
    return { flag: "excess", note: "No demand in 12 months — dead stock." };
  }
  if (min > 0 && row.onHand < min * 0.5) {
    return { flag: "high", note: "On hand is under half the recommended min." };
  }
  const excessDays = Math.max(maxDays * 1.5, 90);
  if (daysCover > excessDays) {
    return { flag: "excess", note: `More than ${Math.round(excessDays)} days of cover.` };
  }
  if (max > 0 && row.onHand > max) {
    return { flag: "excess", note: `Above the ${maxDays}-day max.` };
  }
  if (growth != null && growth > 0.5) {
    return { flag: "review", note: "Demand jumped more than 50% year on year." };
  }
  if (growth != null && growth < -0.4) {
    return { flag: "review", note: "Demand dropped more than 40% year on year." };
  }
  if (tier === "active" && row.leadDays <= 0) {
    return { flag: "review", note: "No lead time on file — used 14 days." };
  }
  if (tier === "low" && row.onHand > TOKEN * 3) {
    return { flag: "review", note: "Sporadic mover carrying more than token stock." };
  }
  return { flag: "ok", note: "" };
}

export function packFile(rows: StockInput[], opt: StockOptions = DEFAULT_OPTIONS): StockRow[] {
  const rank: Record<Flag, number> = { high: 0, excess: 1, review: 2, ok: 3 };
  return rows
    .map((r) => packSku(r, opt))
    .sort((a, b) => rank[a.flag] - rank[b.flag] || b.gap - a.gap || a.sku.localeCompare(b.sku));
}

export function summarize(rows: StockRow[]) {
  return {
    skus: rows.length,
    high: rows.filter((r) => r.flag === "high").length,
    excess: rows.filter((r) => r.flag === "excess").length,
    review: rows.filter((r) => r.flag === "review").length,
    buy: rows.reduce((n, r) => n + r.orderQty, 0),
    dead: rows.filter((r) => r.tier === "zero" && r.onHand > 0).reduce((n, r) => n + r.onHand, 0),
  };
}

export function toCsv(rows: StockRow[]): string {
  const head = [
    "PartNum",
    "PartDescription",
    "Tier",
    "Flag",
    "OnHandQty",
    "Demand12M",
    "YoY",
    "LeadTimeDays",
    "DaysCover",
    "SafetyStock",
    "Min",
    "Max",
    "OrderQty",
    "MOQ",
    "CurrentMin",
    "Note",
  ];
  const body = rows.map((r) =>
    [
      r.sku,
      r.name,
      r.tier,
      r.flag,
      r.onHand,
      r.demand12,
      r.growth == null ? "" : (r.growth * 100).toFixed(0) + "%",
      r.leadDays,
      r.daysCover == null ? "" : r.daysCover.toFixed(0),
      r.safety,
      r.min,
      r.max,
      r.orderQty,
      r.moq,
      r.currentMin,
      r.note,
    ]
      .map(csvCell)
      .join(","),
  );
  return [head.join(","), ...body].join("\n");
}

function csvCell(v: string | number) {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
