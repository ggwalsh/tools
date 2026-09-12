import { create } from "zustand";
import { persist } from "zustand/middleware";

export const COLUMNS = ["blocked", "clearing", "ready", "done"] as const;
export type Column = (typeof COLUMNS)[number];

export const TEMPLATES = ["material", "inspection", "equipment", "labor", "access"] as const;
export type Template = (typeof TEMPLATES)[number];

export const COLUMN_LABEL: Record<Column, string> = {
  blocked: "Blocked",
  clearing: "Clearing",
  ready: "Ready",
  done: "Done today",
};

export const TEMPLATE_LABEL: Record<Template, string> = {
  material: "Material",
  inspection: "Inspection",
  equipment: "Equipment",
  labor: "Labor",
  access: "Access",
};

export type Constraint = {
  id: string;
  title: string;
  template: Template;
  owner: string;
  eta: string;
  waiting: string;
  zone: string;
  photo?: string;
  column: Column;
  createdAt: number;
  movedAt: number;
};

export type Activity = {
  id: string;
  at: number;
  text: string;
};

type Store = {
  cards: Constraint[];
  webhook: string;
  activity: Activity[];
  lastPing: string | null;
  add: (c: Omit<Constraint, "id" | "createdAt" | "movedAt">) => void;
  update: (id: string, p: Partial<Constraint>) => void;
  remove: (id: string) => void;
  move: (id: string, column: Column) => void;
  setWebhook: (webhook: string) => void;
  clearPing: () => void;
  loadSample: () => void;
  clearDone: () => void;
};

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

function pingText(c: Constraint) {
  const wait = c.waiting.trim() ? ` Waiting: ${c.waiting}.` : "";
  const zone = c.zone.trim() ? ` ${c.zone}.` : "";
  return `READY — ${c.title}.${zone} Owner ${c.owner || "unassigned"}.${wait}`;
}

const SAMPLE: Constraint[] = [
  {
    id: "c1",
    template: "material",
    title: '6× 48" CORE panels short for Gate B close-up',
    owner: "Maya Chen",
    eta: "14:30",
    waiting: "Containment crew A",
    zone: "Gate B / west pier",
    column: "blocked",
    createdAt: Date.now() - 5 * 3600_000,
    movedAt: Date.now() - 5 * 3600_000,
  },
  {
    id: "c2",
    template: "labor",
    title: "Night crew short two — need a pair from day shift",
    owner: "Geoff Walsh",
    eta: "18:00",
    waiting: "On-call supervisor",
    zone: "Whole site",
    column: "blocked",
    createdAt: Date.now() - 4 * 3600_000,
    movedAt: Date.now() - 4 * 3600_000,
  },
  {
    id: "c3",
    template: "inspection",
    title: "Fire-watch sign-off before the anteroom skins",
    owner: "City inspector",
    eta: "15:00",
    waiting: "Night shift",
    zone: "Anteroom",
    column: "clearing",
    createdAt: Date.now() - 3 * 3600_000,
    movedAt: Date.now() - 90 * 60_000,
  },
  {
    id: "c4",
    template: "equipment",
    title: "Scissor lift #4 dead battery — swap from rental",
    owner: "United Rentals desk",
    eta: "12:45",
    waiting: "Install pair 2",
    zone: "Dock 3",
    column: "clearing",
    createdAt: Date.now() - 2 * 3600_000,
    movedAt: Date.now() - 40 * 60_000,
  },
  {
    id: "c5",
    template: "access",
    title: "Dock 3 cleared — electrical is off the bay",
    owner: "GC coordinator",
    eta: "11:00",
    waiting: "Delivery driver",
    zone: "Dock 3",
    column: "ready",
    createdAt: Date.now() - 6 * 3600_000,
    movedAt: Date.now() - 20 * 60_000,
  },
  {
    id: "c6",
    template: "material",
    title: "Morning PPE tote restocked at the trailer",
    owner: "Stores",
    eta: "07:40",
    waiting: "",
    zone: "Laydown",
    column: "done",
    createdAt: Date.now() - 8 * 3600_000,
    movedAt: Date.now() - 6 * 3600_000,
  },
];

export const useBoard = create<Store>()(
  persist(
    (set, get) => ({
      cards: SAMPLE,
      webhook: "",
      activity: [
        {
          id: "a0",
          at: Date.now() - 20 * 60_000,
          text: pingText(SAMPLE[4]),
        },
      ],
      lastPing: null,
      add: (c) =>
        set((s) => ({
          cards: [
            {
              ...c,
              id: uid(),
              createdAt: Date.now(),
              movedAt: Date.now(),
            },
            ...s.cards,
          ],
        })),
      update: (id, p) =>
        set((s) => ({
          cards: s.cards.map((c) => (c.id === id ? { ...c, ...p } : c)),
        })),
      remove: (id) => set((s) => ({ cards: s.cards.filter((c) => c.id !== id) })),
      move: (id, column) => {
        const card = get().cards.find((c) => c.id === id);
        if (!card || card.column === column) return;
        const next = { ...card, column, movedAt: Date.now() };
        const ping = column === "ready" ? pingText(next) : null;
        set((s) => ({
          cards: s.cards.map((c) => (c.id === id ? next : c)),
          lastPing: ping ?? s.lastPing,
          activity: ping
            ? [{ id: uid(), at: Date.now(), text: ping }, ...s.activity].slice(0, 20)
            : s.activity,
        }));
        if (ping && get().webhook.trim()) {
          void fetch(get().webhook.trim(), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: ping, card: next }),
          }).catch(() => undefined);
        }
      },
      setWebhook: (webhook) => set({ webhook }),
      clearPing: () => set({ lastPing: null }),
      loadSample: () => set({ cards: SAMPLE.map((c) => ({ ...c })), lastPing: null }),
      clearDone: () => set((s) => ({ cards: s.cards.filter((c) => c.column !== "done") })),
    }),
    {
      name: "gw-board",
      partialize: (s) => ({ cards: s.cards, webhook: s.webhook, activity: s.activity }),
    },
  ),
);
