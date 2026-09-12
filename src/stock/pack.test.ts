import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  packFile,
  packSku,
  parseCsv,
  summarize,
  type StockInput,
} from "./pack.ts";

const base: StockInput = {
  sku: "A",
  name: "Widget",
  onHand: 0,
  demand12: 365,
  demandPrior: 365,
  leadDays: 9,
  moq: 0,
  currentMin: 0,
};

describe("parseCsv", () => {
  it("maps Epicor-style headers and quoted names", () => {
    const csv = [
      "PartNum,PartDescription,OnHandQty,Demand12M,DemandPrior12M,LeadTimeDays,MinOrderQty,CurrentMin",
      'HEPA-1620,"16x20 HEPA, boxed",140,620,540,14,12,80',
    ].join("\n");
    const rows = parseCsv(csv);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].sku, "HEPA-1620");
    assert.equal(rows[0].name, "16x20 HEPA, boxed");
    assert.equal(rows[0].onHand, 140);
    assert.equal(rows[0].demand12, 620);
    assert.equal(rows[0].leadDays, 14);
  });

  it("accepts friendly aliases", () => {
    const csv = "sku,on_hand,demand\nX,4,12\n";
    const rows = parseCsv(csv);
    assert.equal(rows[0].sku, "X");
    assert.equal(rows[0].onHand, 4);
    assert.equal(rows[0].demand12, 12);
  });
});

describe("packSku", () => {
  it("sets zero-demand SKUs to 0 and flags leftover stock as excess", () => {
    const r = packSku({ ...base, demand12: 2, onHand: 14 });
    assert.equal(r.tier, "zero");
    assert.equal(r.min, 0);
    assert.equal(r.max, 0);
    assert.equal(r.safety, 0);
    assert.equal(r.flag, "excess");
    assert.equal(r.orderQty, 0);
  });

  it("gives low movers token stock", () => {
    const r = packSku({ ...base, demand12: 20, onHand: 0 });
    assert.equal(r.tier, "low");
    assert.equal(r.min, 1);
    assert.equal(r.max, 1);
    assert.equal(r.safety, 0);
    assert.equal(r.flag, "high");
    assert.equal(r.orderQty, 1);
  });

  it("sizes active SKUs as lead-time demand plus safety stock, capped at max days", () => {
    // ADD = 1, lead 9, z 1.65, cv 0.4 → SS = 1.98, cycle = 9 → 11
    const r = packSku(base);
    assert.equal(r.tier, "active");
    assert.equal(r.safety, 2);
    assert.equal(r.min, 11);
    assert.equal(r.max, 60);
    assert.equal(r.flag, "high");
    assert.equal(r.orderQty, 60);
  });

  it("does not force MOQ when a full carton would blow the 60-day cap", () => {
    const r = packSku({
      ...base,
      demand12: 40,
      demandPrior: 40,
      leadDays: 14,
      onHand: 0,
      moq: 50,
    });
    assert.equal(r.tier, "active");
    assert.ok(r.orderQty < 50);
    assert.ok(r.orderQty >= 1);
  });

  it("orders up to max when stock is below min, and boxes to MOQ if it still fits", () => {
    const r = packSku({ ...base, onHand: 0, moq: 24 });
    assert.equal(r.orderQty, 60);
  });

  it("flags a demand spike as review when stock is otherwise fine", () => {
    const r = packSku({
      ...base,
      onHand: 20,
      demand12: 365,
      demandPrior: 180,
    });
    assert.equal(r.flag, "review");
  });
});

describe("packFile", () => {
  it("sorts HIGH before EXCESS before REVIEW", () => {
    const rows = packFile([
      { ...base, sku: "OK", onHand: 12, demand12: 365, demandPrior: 365, leadDays: 9 },
      { ...base, sku: "DEAD", onHand: 8, demand12: 0, demandPrior: 0 },
      { ...base, sku: "OUT", onHand: 0, demand12: 365, demandPrior: 365, leadDays: 9 },
    ]);
    assert.deepEqual(
      rows.map((r) => r.sku),
      ["OUT", "DEAD", "OK"],
    );
    const s = summarize(rows);
    assert.equal(s.high, 1);
    assert.equal(s.excess, 1);
    assert.equal(s.dead, 8);
  });
});

