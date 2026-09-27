import * as XLSX from "xlsx";

export type SheetData = {
  headers: string[];
  rows: Record<string, string>[];
};

export async function parseSheetFile(file: File): Promise<SheetData> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: "array", cellDates: false, raw: false });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) return { headers: [], rows: [] };
  const sheet = wb.Sheets[sheetName]!;
  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    raw: false,
  });
  const headers = Object.keys(json[0] ?? {}).filter((h) => h.trim() !== "");
  const rows = json.map((r) => {
    const out: Record<string, string> = {};
    for (const h of headers) out[h] = String(r[h] ?? "").trim();
    return out;
  });
  return { headers, rows };
}

export type ImportKind = "orders" | "shipments" | "payouts";

export const FIELDS: Record<ImportKind, { key: string; label: string; required?: boolean }[]> = {
  orders: [
    { key: "order_ref", label: "رقم الأوردر", required: true },
    { key: "customer_name", label: "اسم العميل" },
    { key: "phone", label: "رقم الموبايل" },
    { key: "cod_amount", label: "المبلغ المطلوب تحصيله", required: true },
    { key: "zone", label: "المنطقة" },
    { key: "tracking_number", label: "رقم التتبع" },
    { key: "order_date", label: "تاريخ الأوردر" },
  ],
  shipments: [
    { key: "tracking_number", label: "رقم التتبع", required: true },
    { key: "reference", label: "رقم الأوردر المرجعي" },
    { key: "customer_name", label: "اسم العميل" },
    { key: "phone", label: "رقم الموبايل" },
    { key: "cod_amount", label: "مبلغ التحصيل المطلوب" },
    { key: "collected_amount", label: "المبلغ المحصّل فعلًا" },
    { key: "fees_amount", label: "الرسوم" },
    { key: "status", label: "حالة الشحنة" },
    { key: "delivered_at", label: "تاريخ التسليم" },
    { key: "zone", label: "المنطقة" },
  ],
  payouts: [
    { key: "payout_ref", label: "رقم التحويل", required: true },
    { key: "payout_date", label: "تاريخ التحويل" },
    { key: "tracking_number", label: "رقم التتبع", required: true },
    { key: "amount", label: "المبلغ المحوّل للشحنة", required: true },
    { key: "fees", label: "الرسوم المخصومة" },
  ],
};

const KEYWORDS: Record<string, string[]> = {
  order_ref: ["order id", "order number", "order no", "order", "reference", "رقم الاوردر", "رقم الأوردر", "رقم الطلب", "الطلب"],
  payout_ref: ["payout", "transfer", "settlement", "batch", "رقم التحويل", "التسوية", "تحويل"],
  payout_date: ["payout date", "transfer date", "settlement date", "تاريخ التحويل", "تاريخ التسوية"],
  customer_name: ["customer", "name", "consignee", "receiver", "اسم", "العميل", "المستلم"],
  phone: ["phone", "mobile", "tel", "موبايل", "تليفون", "هاتف", "رقم العميل"],
  cod_amount: ["cod", "cash on delivery", "amount to collect", "order value", "total", "المبلغ", "قيمة", "التحصيل", "الاجمالي", "الإجمالي"],
  collected_amount: ["collected", "collected amount", "cod collected", "received", "المحصل", "المحصّل", "تم تحصيل"],
  fees_amount: ["fee", "fees", "charge", "deduction", "رسوم", "خصم", "عمولة"],
  fees: ["fee", "fees", "charge", "deduction", "رسوم", "خصم", "عمولة"],
  amount: ["amount", "net", "paid", "transferred", "المبلغ", "صافي", "المحول", "المحوّل"],
  zone: ["zone", "city", "area", "governorate", "المنطقة", "المحافظة", "المدينة"],
  tracking_number: ["tracking", "awb", "waybill", "bosta", "tracking number", "رقم التتبع", "البوليصة", "رقم الشحنة", "التتبع"],
  reference: ["reference", "ref", "business reference", "order id", "المرجع", "رقم الاوردر", "رقم الأوردر"],
  status: ["status", "state", "الحالة", "حالة"],
  delivered_at: ["delivered", "delivery date", "تاريخ التسليم", "تاريخ التوصيل"],
  order_date: ["date", "created", "order date", "تاريخ"],
};

function score(header: string, key: string): number {
  const h = header.trim().toLowerCase();
  const words = KEYWORDS[key] ?? [];
  let best = 0;
  for (const w of words) {
    const ww = w.toLowerCase();
    if (h === ww) best = Math.max(best, 100);
    else if (h.includes(ww)) best = Math.max(best, 60 + ww.length);
  }
  return best;
}

export function guessMapping(headers: string[], kind: ImportKind): Record<string, string> {
  const map: Record<string, string> = {};
  const used = new Set<string>();
  const fields = FIELDS[kind];
  // Assign most confident pairs first.
  const pairs: { field: string; header: string; s: number }[] = [];
  for (const f of fields) {
    for (const h of headers) pairs.push({ field: f.key, header: h, s: score(h, f.key) });
  }
  pairs.sort((a, b) => b.s - a.s);
  for (const p of pairs) {
    if (p.s <= 0) continue;
    if (map[p.field] || used.has(p.header)) continue;
    map[p.field] = p.header;
    used.add(p.header);
  }
  return map;
}

export function applyMapping(
  rows: Record<string, string>[],
  mapping: Record<string, string>,
): Record<string, string>[] {
  return rows.map((row) => {
    const out: Record<string, string> = {};
    for (const [field, header] of Object.entries(mapping)) {
      if (!header) continue;
      out[field] = row[header] ?? "";
    }
    return out;
  });
}
