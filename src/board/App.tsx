import { type FormEvent, useEffect, useMemo, useState } from "react";
import {
  ClipboardCheck,
  DoorOpen,
  Monitor,
  Package,
  Trash2,
  Users,
  Wrench,
  X,
} from "lucide-react";
import type { OnBrand } from "../shared/brand";
import {
  COLUMNS,
  COLUMN_LABEL,
  TEMPLATE_LABEL,
  TEMPLATES,
  useBoard,
  type Column,
  type Constraint,
  type Template,
} from "./store";
import { cn } from "../shared/cn";


const ICONS: Record<Template, typeof Package> = {
  material: Package,
  inspection: ClipboardCheck,
  equipment: Wrench,
  labor: Users,
  access: DoorOpen,
};

export function BoardApp({ onBrand, tv = false, onTv, homeHref = "./" }: { onBrand?: OnBrand; tv?: boolean; onTv?: (on: boolean) => void; homeHref?: string }) {
  const cards = useBoard((s) => s.cards);
  const lastPing = useBoard((s) => s.lastPing);
  const activity = useBoard((s) => s.activity);
  const webhook = useBoard((s) => s.webhook);
  const setWebhook = useBoard((s) => s.setWebhook);
  const add = useBoard((s) => s.add);
  const move = useBoard((s) => s.move);
  const remove = useBoard((s) => s.remove);
  const update = useBoard((s) => s.update);
  const clearPing = useBoard((s) => s.clearPing);
  const loadSample = useBoard((s) => s.loadSample);
  const clearDone = useBoard((s) => s.clearDone);
  const setBrand = onBrand ?? (() => {});
  const [open, setOpen] = useState<Constraint | "new" | null>(null);
  const [clock, setClock] = useState(() => new Date());

  useEffect(() => {
    setBrand("think");
    const t = window.setInterval(() => setClock(new Date()), 30_000);
    return () => {
      setBrand("idle");
      window.clearInterval(t);
    };
  }, [setBrand]);

  const byCol = useMemo(() => {
    const m: Record<Column, Constraint[]> = { blocked: [], clearing: [], ready: [], done: [] };
    for (const c of cards) m[c.column].push(c);
    for (const col of COLUMNS) m[col].sort((a, b) => b.movedAt - a.movedAt);
    return m;
  }, [cards]);

  function onMove(id: string, col: Column) {
    move(id, col);
    if (col === "ready") {
      setBrand("done");
      window.setTimeout(() => setBrand("think"), 1600);
    }
  }

  if (tv) {
    return (
      <div className="min-h-dvh bg-ink px-6 py-5">
        <header className="mb-5 flex items-end justify-between gap-4">
          <div>
            <p className="font-mono text-xs tracking-widest text-accent uppercase">Today · Constraint board</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight">What is blocking work right now</h1>
          </div>
          <p className="font-mono text-2xl tabular-nums text-silver">
            {clock.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </p>
        </header>
        <div className="grid min-h-[calc(100dvh-7rem)] grid-cols-4 gap-4">
          {COLUMNS.map((col) => (
            <section key={col} className="flex flex-col rounded-lg border border-line bg-surface p-4">
              <p className="font-mono text-xs tracking-widest text-accent uppercase">
                {COLUMN_LABEL[col]}
                <span className="ml-2 text-muted">{byCol[col].length}</span>
              </p>
              <ul className="mt-4 flex flex-col gap-3">
                {byCol[col].map((c) => (
                  <TvCard key={c.id} card={c} />
                ))}
              </ul>
            </section>
          ))}
        </div>
        <button
          type="button"
          onClick={() => onTv?.(false)}
          className="fixed right-5 bottom-5 font-mono text-xs tracking-widest text-muted uppercase hover:text-fg"
        >
          Exit TV
        </button>
      </div>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-5 py-10 sm:py-14">
      <p className="font-mono text-xs tracking-widest text-accent uppercase">
        <a href={homeHref} className="hover:text-fg">
          My tools
        </a>
        {" · 02 · Board"}
        <a href="https://github.com/ggwalsh/tools/tree/main/src/board" className="ml-3 text-silver hover:text-fg" target="_blank" rel="noreferrer">
          GitHub
        </a>
      </p>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-5xl">Board</h1>
          <p className="mt-3 max-w-xl text-muted">
            The day is not the Gantt. It is the six things freezing a crew right now.
            Move a card to Ready and the people waiting get a ping.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onTv?.(true)}
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line px-4 text-sm text-silver hover:text-fg"
          >
            <Monitor className="size-4" />
            TV view
          </button>
          <button
            type="button"
            onClick={() => setOpen("new")}
            className="inline-flex min-h-11 items-center rounded-full bg-amaranth px-4 text-sm font-medium text-fg hover:bg-accent"
          >
            New constraint
          </button>
        </div>
      </div>

      {lastPing ? (
        <div className="mt-6 flex flex-col gap-3 rounded-lg border border-amaranth bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-fg">{lastPing}</p>
          <div className="flex flex-wrap gap-2">
            <a
              href={`sms:?body=${encodeURIComponent(lastPing)}`}
              className="inline-flex min-h-11 items-center rounded-full border border-line px-4 text-sm text-silver hover:text-fg"
            >
              SMS
            </a>
            <button
              type="button"
              className="inline-flex min-h-11 items-center rounded-full border border-line px-4 text-sm text-silver hover:text-fg"
              onClick={() => void navigator.clipboard.writeText(lastPing)}
            >
              Copy
            </button>
            <button type="button" onClick={clearPing} className="inline-flex min-h-11 items-center px-3 text-sm text-muted hover:text-fg">
              Dismiss
            </button>
          </div>
        </div>
      ) : null}

      <div className="mt-8 flex snap-x gap-4 overflow-x-auto pb-4 lg:grid lg:grid-cols-4 lg:overflow-visible lg:pb-0">
        {COLUMNS.map((col) => (
          <section
            key={col}
            className="w-[min(84vw,22rem)] shrink-0 snap-start rounded-lg border border-line bg-surface p-4 lg:w-auto"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              const id = e.dataTransfer.getData("text/plain");
              if (id) onMove(id, col);
            }}
          >
            <p className="font-mono text-xs tracking-widest text-accent uppercase">
              {COLUMN_LABEL[col]}
              <span className="ml-2 text-muted">{byCol[col].length}</span>
            </p>
            <ul className="mt-4 flex flex-col gap-3">
              {byCol[col].map((c) => (
                <Card
                  key={c.id}
                  card={c}
                  onOpen={() => setOpen(c)}
                  onMove={(next) => onMove(c.id, next)}
                />
              ))}
              {byCol[col].length === 0 ? (
                <li className="rounded-md border border-dashed border-line px-3 py-8 text-center text-sm text-muted">
                  Empty
                </li>
              ) : null}
            </ul>
          </section>
        ))}
      </div>

      <div className="mt-10 grid gap-8 border-t border-line pt-8 lg:grid-cols-[1fr_280px]">
        <div>
          <p className="font-mono text-xs tracking-widest text-accent uppercase">Ready pings</p>
          <ul className="mt-3 space-y-2">
            {activity.slice(0, 8).map((a) => (
              <li key={a.id} className="text-sm text-muted">
                <span className="mr-2 font-mono text-xs text-silver">
                  {new Date(a.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
                {a.text}
              </li>
            ))}
            {activity.length === 0 ? <li className="text-sm text-muted">Move a card to Ready.</li> : null}
          </ul>
        </div>
        <aside className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-xs text-muted">
            Slack / webhook URL
            <input
              value={webhook}
              onChange={(e) => setWebhook(e.target.value)}
              placeholder="https://hooks.slack.com/…"
              className="min-h-11 rounded-sm border border-line bg-ink px-3 text-sm text-fg"
            />
          </label>
          <p className="text-xs text-muted">POSTs when a card lands on Ready. Leave blank to just copy / SMS.</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={loadSample}
              className="min-h-11 flex-1 rounded-full border border-line text-sm text-silver hover:text-fg"
            >
              Sample day
            </button>
            <button
              type="button"
              onClick={clearDone}
              className="min-h-11 flex-1 rounded-full border border-line text-sm text-muted hover:text-accent"
            >
              Clear done
            </button>
          </div>
        </aside>
      </div>

      {open ? (
        <Editor
          card={open === "new" ? null : open}
          onClose={() => setOpen(null)}
          onSave={(draft) => {
            if (open === "new") add(draft);
            else update(open.id, draft);
            setOpen(null);
          }}
          onDelete={
            open === "new"
              ? undefined
              : () => {
                  remove(open.id);
                  setOpen(null);
                }
          }
        />
      ) : null}
    </main>
  );
}

function Card({
  card,
  onOpen,
  onMove,
}: {
  card: Constraint;
  onOpen: () => void;
  onMove: (c: Column) => void;
}) {
  const Icon = ICONS[card.template];
  return (
    <li
      draggable
      onDragStart={(e) => e.dataTransfer.setData("text/plain", card.id)}
      className="rounded-md border border-line bg-ink p-3"
    >
      <button type="button" onClick={onOpen} className="w-full text-left">
        <p className="flex items-center gap-2 font-mono text-[10px] tracking-widest text-silver uppercase">
          <Icon className="size-3.5 text-accent" />
          {TEMPLATE_LABEL[card.template]}
          {card.eta ? <span className="ml-auto tabular-nums">{card.eta}</span> : null}
        </p>
        <p className="mt-2 text-sm font-medium leading-snug text-fg">{card.title}</p>
        {card.photo ? (
          <img src={card.photo} alt="" className="mt-2 h-24 w-full rounded-sm object-cover" />
        ) : null}
        <p className="mt-2 text-xs text-muted">
          {card.owner || "No owner"}
          {card.zone ? ` · ${card.zone}` : ""}
        </p>
        {card.waiting ? <p className="mt-1 text-xs text-silver">Waiting: {card.waiting}</p> : null}
      </button>
      <div className="mt-3 flex flex-wrap gap-1">
        {COLUMNS.filter((c) => c !== card.column).map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onMove(c)}
            className="rounded-full border border-line px-2 py-1 text-[10px] tracking-wide text-muted uppercase hover:text-fg"
          >
            {COLUMN_LABEL[c]}
          </button>
        ))}
      </div>
    </li>
  );
}

function TvCard({ card }: { card: Constraint }) {
  const Icon = ICONS[card.template];
  return (
    <li className="rounded-md border border-line bg-ink p-4">
      <p className="flex items-center gap-2 font-mono text-xs tracking-widest text-silver uppercase">
        <Icon className="size-4 text-accent" />
        {TEMPLATE_LABEL[card.template]}
        {card.eta ? <span className="ml-auto text-lg tabular-nums text-fg">{card.eta}</span> : null}
      </p>
      <p className="mt-3 text-lg font-medium leading-snug">{card.title}</p>
      <p className="mt-2 text-sm text-muted">
        {card.owner}
        {card.zone ? ` · ${card.zone}` : ""}
      </p>
      {card.waiting ? <p className="mt-1 text-sm text-silver">Waiting: {card.waiting}</p> : null}
    </li>
  );
}

function Editor({
  card,
  onClose,
  onSave,
  onDelete,
}: {
  card: Constraint | null;
  onClose: () => void;
  onSave: (c: Omit<Constraint, "id" | "createdAt" | "movedAt">) => void;
  onDelete?: () => void;
}) {
  const [title, setTitle] = useState(card?.title ?? "");
  const [template, setTemplate] = useState<Template>(card?.template ?? "material");
  const [owner, setOwner] = useState(card?.owner ?? "");
  const [eta, setEta] = useState(card?.eta ?? "");
  const [waiting, setWaiting] = useState(card?.waiting ?? "");
  const [zone, setZone] = useState(card?.zone ?? "");
  const [photo, setPhoto] = useState(card?.photo);
  const [column, setColumn] = useState<Column>(card?.column ?? "blocked");

  async function onFile(file: File | undefined) {
    if (!file) return;
    setPhoto(await compressPhoto(file));
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    onSave({
      title: title.trim(),
      template,
      owner: owner.trim(),
      eta: eta.trim(),
      waiting: waiting.trim(),
      zone: zone.trim(),
      photo,
      column,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/70 sm:items-center">
      <form
        onSubmit={submit}
        className="max-h-[92dvh] w-full max-w-lg overflow-auto rounded-t-lg border border-line bg-surface p-5 sm:rounded-lg"
      >
        <div className="flex items-start justify-between gap-3">
          <p className="font-mono text-xs tracking-widest text-accent uppercase">
            {card ? "Constraint" : "New constraint"}
          </p>
          <button type="button" onClick={onClose} className="min-h-11 min-w-11 text-silver hover:text-fg" aria-label="Close">
            <X className="size-4" />
          </button>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {TEMPLATES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTemplate(t)}
              className={cn(
                "min-h-9 rounded-full px-3 text-xs",
                template === t ? "bg-amaranth text-fg" : "border border-line text-silver hover:text-fg",
              )}
            >
              {TEMPLATE_LABEL[t]}
            </button>
          ))}
        </div>
        <label className="mt-4 flex flex-col gap-1 text-xs text-muted">
          What is blocked
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="min-h-11 rounded-sm border border-line bg-ink px-3 text-sm text-fg"
            placeholder='e.g. 48" panels short for Gate B'
            required
          />
        </label>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-xs text-muted">
            Owner
            <input value={owner} onChange={(e) => setOwner(e.target.value)} className="min-h-11 rounded-sm border border-line bg-ink px-3 text-sm text-fg" />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted">
            ETA
            <input value={eta} onChange={(e) => setEta(e.target.value)} placeholder="14:30" className="min-h-11 rounded-sm border border-line bg-ink px-3 text-sm text-fg" />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted">
            Who is waiting
            <input value={waiting} onChange={(e) => setWaiting(e.target.value)} className="min-h-11 rounded-sm border border-line bg-ink px-3 text-sm text-fg" />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted">
            Crew / zone frozen
            <input value={zone} onChange={(e) => setZone(e.target.value)} className="min-h-11 rounded-sm border border-line bg-ink px-3 text-sm text-fg" />
          </label>
        </div>
        <label className="mt-3 flex flex-col gap-1 text-xs text-muted">
          Photo
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="text-sm text-silver"
            onChange={(e) => void onFile(e.target.files?.[0])}
          />
        </label>
        {photo ? <img src={photo} alt="" className="mt-2 h-32 w-full rounded-sm object-cover" /> : null}
        <div className="mt-4 flex flex-wrap gap-2">
          {COLUMNS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColumn(c)}
              className={cn(
                "min-h-9 rounded-full px-3 text-xs",
                column === c ? "bg-amaranth text-fg" : "border border-line text-silver hover:text-fg",
              )}
            >
              {COLUMN_LABEL[c]}
            </button>
          ))}
        </div>
        <div className="mt-6 flex gap-2">
          <button type="submit" className="min-h-11 flex-1 rounded-full bg-amaranth text-sm font-medium text-fg hover:bg-accent">
            Save
          </button>
          {onDelete ? (
            <button
              type="button"
              onClick={onDelete}
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-line text-muted hover:text-accent"
              aria-label="Delete"
            >
              <Trash2 className="size-4" />
            </button>
          ) : null}
        </div>
      </form>
    </div>
  );
}

function compressPhoto(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, 720 / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("canvas"));
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.7));
    };
    img.onerror = () => reject(new Error("image"));
    img.src = url;
  });
}
