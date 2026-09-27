// Bosta API client (server-only).
// Auth: `Authorization: <apiKey>` (no "Bearer" prefix), base https://app.bosta.co/api/v2

const DEFAULT_BASE = "https://app.bosta.co/api/v2";

type Json = Record<string, any>;

async function call(
  apiKey: string,
  base: string,
  path: string,
  init?: { method?: string; body?: Json },
): Promise<{ ok: boolean; status: number; body: any }> {
  const res = await fetch(base + path, {
    method: init?.method ?? "GET",
    headers: {
      Authorization: apiKey,
      "Content-Type": "application/json",
    },
    body: init?.body ? JSON.stringify(init.body) : undefined,
  });
  const text = await res.text();
  let body: any = text;
  try {
    body = JSON.parse(text);
  } catch {
    /* keep raw text */
  }
  return { ok: res.ok, status: res.status, body };
}

function pickList(body: any): Json[] {
  const candidates = [
    body?.data?.deliveries,
    body?.data?.list,
    body?.data?.docs,
    body?.deliveries,
    body?.data,
    body?.list,
  ];
  for (const c of candidates) if (Array.isArray(c)) return c;
  return [];
}

function deepFindKey(obj: any, matcher: (k: string) => boolean, depth = 4): string | null {
  if (!obj || typeof obj !== "object" || depth < 0) return null;
  for (const [k, v] of Object.entries(obj)) {
    if (matcher(k.toLowerCase())) return k;
    const nested = deepFindKey(v, matcher, depth - 1);
    if (nested) return `${k}.${nested}`;
  }
  return null;
}

export type BostaCapabilityReport = {
  checkedAt: string;
  authOk: boolean;
  authStatus: number;
  sampleCount: number;
  fields: {
    trackingNumber: string | null;
    businessReference: string | null;
    codAmount: string | null;
    collectedAmount: string | null;
    fees: string | null;
    payoutRef: string | null;
    deliveredAt: string | null;
    status: string | null;
    phone: string | null;
  };
  endpoints: { path: string; status: number; ok: boolean }[];
  notes: string[];
};

export async function probeBostaCapabilities(
  apiKey: string,
  baseUrl?: string,
): Promise<BostaCapabilityReport> {
  const base = baseUrl || DEFAULT_BASE;
  const endpoints: { path: string; status: number; ok: boolean }[] = [];
  const notes: string[] = [];

  const search = await call(apiKey, base, "/deliveries/search", {
    method: "POST",
    body: { limit: 20, page: 1 },
  });
  endpoints.push({ path: "POST /deliveries/search", status: search.status, ok: search.ok });

  const list = pickList(search.body);
  const sample = list[0] ?? null;

  const find = (re: RegExp) => (sample ? deepFindKey(sample, (k) => re.test(k)) : null);

  const fields = {
    trackingNumber: find(/^trackingnumber$|tracking/),
    businessReference: find(/businessreference|^reference$/),
    codAmount: find(/^cod$|codamount|cashondelivery/),
    collectedAmount: find(/collectedamount|amountcollected|collected/),
    fees: find(/fee|deduct|commission/),
    payoutRef: find(/payout|settlement|transfer|invoice/),
    deliveredAt: find(/deliveredat|dropoffdate|updatedat/),
    status: find(/^state$|^status$|statecode/),
    phone: find(/phone/),
  };

  for (const path of ["/cities", "/business/invoices", "/payouts"]) {
    try {
      const r = await call(apiKey, base, path);
      endpoints.push({ path: `GET ${path}`, status: r.status, ok: r.ok });
    } catch {
      endpoints.push({ path: `GET ${path}`, status: 0, ok: false });
    }
  }

  if (!search.ok) notes.push("المفتاح مرفوض أو الصلاحيات غير كافية لقراءة الشحنات.");
  if (search.ok && !list.length) notes.push("الاتصال نجح لكن لا توجد شحنات في الحساب للفحص.");
  if (!fields.collectedAmount) notes.push("لم نجد حقل المبلغ المحصّل — نعتمد على مبلغ التحصيل المطلوب.");
  if (!fields.payoutRef)
    notes.push("لا توجد بيانات تحويلات بنكية في الشحنة — استخدم رفع كشف التسويات من بوسطة.");
  if (!fields.fees) notes.push("لا توجد رسوم لكل شحنة — نحسبها من جدول الأسعار.");

  return {
    checkedAt: new Date().toISOString(),
    authOk: search.ok,
    authStatus: search.status,
    sampleCount: list.length,
    fields,
    endpoints,
    notes,
  };
}

function getPath(obj: any, path: string | null): any {
  if (!path) return undefined;
  return path.split(".").reduce((acc, k) => (acc == null ? undefined : acc[k]), obj);
}

export type BostaDelivery = {
  trackingNumber: string;
  reference: string | null;
  customerName: string | null;
  phone: string | null;
  cod: number;
  collected: number | null;
  fees: number | null;
  status: string | null;
  isDelivered: boolean;
  isReturned: boolean;
  deliveredAt: string | null;
  zone: string | null;
  raw: Json;
};

const money = (v: any): number => {
  if (v == null) return 0;
  const n = typeof v === "number" ? v : Number.parseFloat(String(v).replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
};

export async function fetchBostaDeliveries(
  apiKey: string,
  baseUrl?: string,
): Promise<BostaDelivery[]> {
  const base = baseUrl || DEFAULT_BASE;
  const out: BostaDelivery[] = [];
  for (let page = 1; page <= 10; page++) {
    const res = await call(apiKey, base, "/deliveries/search", {
      method: "POST",
      body: { limit: 100, page },
    });
    if (!res.ok) {
      if (page === 1) throw new Error(`بوسطة رفضت الطلب [${res.status}]: ${JSON.stringify(res.body)}`);
      break;
    }
    const list = pickList(res.body);
    if (!list.length) break;
    for (const d of list) {
      const trackingNumber = String(d.trackingNumber ?? d.tracking_number ?? "").trim();
      if (!trackingNumber) continue;
      const stateValue = d.state?.value ?? d.state ?? d.status ?? null;
      const state = typeof stateValue === "string" ? stateValue : JSON.stringify(stateValue ?? "");
      const lower = state.toLowerCase();
      const collectedRaw =
        getPath(d, deepFindKey(d, (k) => /collectedamount|amountcollected/.test(k))) ?? null;
      const feesRaw = getPath(d, deepFindKey(d, (k) => /^fee$|fees|deduct/.test(k))) ?? null;
      out.push({
        trackingNumber,
        reference: d.businessReference ?? d.reference ?? null,
        customerName:
          [d.receiver?.firstName, d.receiver?.lastName].filter(Boolean).join(" ") ||
          d.receiver?.fullName ||
          null,
        phone: d.receiver?.phone ?? d.receiver?.secondPhone ?? null,
        cod: money(d.cod ?? d.codAmount ?? 0),
        collected: collectedRaw == null ? null : money(collectedRaw),
        fees: feesRaw == null ? null : money(feesRaw),
        status: state || null,
        isDelivered: /delivered|completed/.test(lower),
        isReturned: /return|cancel|exception/.test(lower),
        deliveredAt: d.updatedAt ? String(d.updatedAt).slice(0, 10) : null,
        zone: d.dropOffAddress?.zone?.name ?? d.dropOffAddress?.city?.name ?? null,
        raw: d,
      });
    }
    if (list.length < 100) break;
  }
  return out;
}
