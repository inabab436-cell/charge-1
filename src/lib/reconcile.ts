// Pure reconciliation logic shared by server functions and UI.
// All money values are integers in piasters (قرش) to avoid rounding errors.

export type OrderStatus =
  | "unmatched"
  | "in_transit"
  | "returned"
  | "awaiting_payout"
  | "paid_ok"
  | "paid_short"
  | "paid_over";

export const STATUS_LABEL: Record<OrderStatus, string> = {
  unmatched: "غير مطابَق",
  in_transit: "في الطريق",
  returned: "مرتجع",
  awaiting_payout: "محصّل ولسه ما وصلش",
  paid_ok: "وصلت مضبوطة",
  paid_short: "وصلت ناقصة",
  paid_over: "وصلت زيادة",
};

export function normalizePhone(value: string | null | undefined): string | null {
  if (!value) return null;
  const digits = String(value).replace(/\D/g, "");
  if (digits.length < 7) return null;
  return digits.slice(-10);
}

export function normalizeRef(value: string | null | undefined): string | null {
  if (!value) return null;
  const v = String(value).trim().replace(/^#/, "").toLowerCase();
  return v.length ? v : null;
}

export function toPiasters(value: unknown): number {
  if (value === null || value === undefined || value === "") return 0;
  const raw = String(value)
    .replace(/[^\d.,-]/g, "")
    .replace(/,/g, "");
  const n = Number.parseFloat(raw);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

export function formatEGP(piasters: number | null | undefined): string {
  const v = (piasters ?? 0) / 100;
  return (
    v.toLocaleString("ar-EG", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }) + " ج.م"
  );
}

export type PricingRule = {
  zone: string;
  shipping_fee: number;
  cod_fee_percent: number;
  cod_fee_fixed: number;
  return_fee: number;
};

export function pickRule(rules: PricingRule[], zone: string | null | undefined): PricingRule {
  const z = (zone ?? "").trim().toLowerCase();
  const found = rules.find((r) => r.zone.trim().toLowerCase() === z && z !== "");
  const fallback = rules.find((r) => r.zone === "default");
  return (
    found ??
    fallback ?? {
      zone: "default",
      shipping_fee: 0,
      cod_fee_percent: 0,
      cod_fee_fixed: 0,
      return_fee: 0,
    }
  );
}

export function expectedFees(codAmount: number, rule: PricingRule, returned: boolean): number {
  if (returned) return Math.round(rule.return_fee);
  const pct = Math.round((codAmount * Number(rule.cod_fee_percent)) / 100);
  return Math.round(rule.shipping_fee + pct + rule.cod_fee_fixed);
}

export type ReconcileInput = {
  codAmount: number;
  zone: string | null;
  shipment: {
    collected_amount: number | null;
    is_delivered: boolean;
    is_returned: boolean;
  } | null;
  paidAmount: number | null; // sum of payout items, null when no payout yet
  rules: PricingRule[];
  tolerance: number;
};

export type ReconcileResult = {
  status: OrderStatus;
  expectedFees: number;
  expectedNet: number;
  collected: number | null;
  paid: number | null;
  diff: number; // paid - expectedNet (0 when not paid yet)
  collectionGap: number; // codAmount - collected (0 when unknown)
};

export function reconcile(input: ReconcileInput): ReconcileResult {
  const { codAmount, zone, shipment, paidAmount, rules, tolerance } = input;
  const rule = pickRule(rules, zone);
  const returned = shipment?.is_returned ?? false;
  const fees = expectedFees(codAmount, rule, returned);
  const collected = shipment?.collected_amount ?? null;
  const base = returned ? 0 : (collected ?? codAmount);
  const expectedNet = base - fees;
  const collectionGap = collected === null || returned ? 0 : codAmount - collected;

  let status: OrderStatus;
  if (!shipment) status = "unmatched";
  else if (paidAmount !== null) {
    const diff = paidAmount - expectedNet;
    if (Math.abs(diff) <= tolerance) status = "paid_ok";
    else if (diff < 0) status = "paid_short";
    else status = "paid_over";
  } else if (returned) status = "returned";
  else if (shipment.is_delivered) status = "awaiting_payout";
  else status = "in_transit";

  return {
    status,
    expectedFees: fees,
    expectedNet,
    collected,
    paid: paidAmount,
    diff: paidAmount === null ? 0 : paidAmount - expectedNet,
    collectionGap,
  };
}
