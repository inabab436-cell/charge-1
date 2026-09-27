import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  normalizePhone,
  normalizeRef,
  toPiasters,
  reconcile,
  type PricingRule,
  type OrderStatus,
} from "@/lib/reconcile";

const rowsSchema = z.object({
  kind: z.enum(["orders", "shipments", "payouts"]),
  filename: z.string().optional(),
  mapping: z.record(z.string(), z.string()).optional(),
  rows: z.array(z.record(z.string(), z.string())).max(5000),
});

function parseDate(v: string | undefined): string | null {
  if (!v) return null;
  const s = v.trim();
  if (!s) return null;
  const iso = /^\d{4}-\d{2}-\d{2}/.exec(s);
  if (iso) return iso[0];
  const dmy = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/.exec(s);
  if (dmy) {
    const [, d, m, y] = dmy;
    return `${y}-${m!.padStart(2, "0")}-${d!.padStart(2, "0")}`;
  }
  const t = Date.parse(s);
  if (!Number.isNaN(t)) return new Date(t).toISOString().slice(0, 10);
  return null;
}

const DELIVERED = ["delivered", "تم التسليم", "completed", "received", "تسليم"];
const RETURNED = ["returned", "مرتجع", "returned to business", "cancelled", "ملغي", "راجع"];

function statusFlags(status: string | undefined) {
  const s = (status ?? "").toLowerCase();
  return {
    is_delivered: DELIVERED.some((k) => s.includes(k)),
    is_returned: RETURNED.some((k) => s.includes(k)),
  };
}

// ---------------------------------------------------------------- import

export const importRows = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => rowsSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { kind, rows, filename, mapping } = data;

    if (kind === "orders") {
      const payload = rows
        .filter((r) => (r["order_ref"] ?? "").trim() !== "")
        .map((r) => ({
          user_id: userId,
          order_ref: r["order_ref"]!.trim(),
          customer_name: r["customer_name"] || null,
          phone: r["phone"] || null,
          phone_norm: normalizePhone(r["phone"]),
          cod_amount: toPiasters(r["cod_amount"]),
          zone: r["zone"] || null,
          tracking_number: (r["tracking_number"] || "").trim() || null,
          order_date: parseDate(r["order_date"]),
          source: "file",
        }));
      if (payload.length) {
        const { error } = await supabase
          .from("orders")
          .upsert(payload, { onConflict: "user_id,order_ref" });
        if (error) throw new Error(error.message);
      }
      await supabase.from("import_batches").insert({
        user_id: userId,
        kind,
        filename: filename ?? null,
        row_count: rows.length,
        inserted_count: payload.length,
        column_map: mapping ?? null,
      });
      return { imported: payload.length };
    }

    if (kind === "shipments") {
      const payload = rows
        .filter((r) => (r["tracking_number"] ?? "").trim() !== "")
        .map((r) => {
          const flags = statusFlags(r["status"]);
          return {
            user_id: userId,
            tracking_number: r["tracking_number"]!.trim(),
            reference: r["reference"] || null,
            customer_name: r["customer_name"] || null,
            phone: r["phone"] || null,
            phone_norm: normalizePhone(r["phone"]),
            cod_amount: toPiasters(r["cod_amount"]),
            collected_amount: r["collected_amount"] ? toPiasters(r["collected_amount"]) : null,
            fees_amount: r["fees_amount"] ? toPiasters(r["fees_amount"]) : null,
            status: r["status"] || null,
            is_delivered: flags.is_delivered,
            is_returned: flags.is_returned,
            delivered_at: parseDate(r["delivered_at"]),
            zone: r["zone"] || null,
            source: "file",
            updated_at: new Date().toISOString(),
          };
        });
      if (payload.length) {
        const { error } = await supabase
          .from("shipments")
          .upsert(payload, { onConflict: "user_id,tracking_number" });
        if (error) throw new Error(error.message);
      }
      await supabase.from("import_batches").insert({
        user_id: userId,
        kind,
        filename: filename ?? null,
        row_count: rows.length,
        inserted_count: payload.length,
        column_map: mapping ?? null,
      });
      return { imported: payload.length };
    }

    // payouts: each row = one shipment inside one transfer
    const groups = new Map<string, { date: string | null; total: number }>();
    for (const r of rows) {
      const ref = (r["payout_ref"] ?? "").trim();
      if (!ref) continue;
      const g = groups.get(ref) ?? { date: parseDate(r["payout_date"]), total: 0 };
      g.total += toPiasters(r["amount"]);
      if (!g.date) g.date = parseDate(r["payout_date"]);
      groups.set(ref, g);
    }
    const payoutRows = [...groups.entries()].map(([ref, g]) => ({
      user_id: userId,
      payout_ref: ref,
      payout_date: g.date,
      total_amount: g.total,
    }));
    if (payoutRows.length) {
      const { error } = await supabase
        .from("payouts")
        .upsert(payoutRows, { onConflict: "user_id,payout_ref" });
      if (error) throw new Error(error.message);
    }
    const { data: payouts } = await supabase
      .from("payouts")
      .select("id,payout_ref")
      .eq("user_id", userId);
    const idByRef = new Map((payouts ?? []).map((p) => [p.payout_ref, p.id]));

    const items = rows
      .filter((r) => (r["payout_ref"] ?? "").trim() && (r["tracking_number"] ?? "").trim())
      .map((r) => ({
        user_id: userId,
        payout_id: idByRef.get(r["payout_ref"]!.trim())!,
        tracking_number: r["tracking_number"]!.trim(),
        amount: toPiasters(r["amount"]),
        fees: toPiasters(r["fees"]),
      }))
      .filter((i) => Boolean(i.payout_id));
    if (items.length) {
      const { error } = await supabase
        .from("payout_items")
        .upsert(items, { onConflict: "user_id,payout_id,tracking_number" });
      if (error) throw new Error(error.message);
    }
    await supabase.from("import_batches").insert({
      user_id: userId,
      kind,
      filename: filename ?? null,
      row_count: rows.length,
      inserted_count: items.length,
      column_map: mapping ?? null,
    });
    return { imported: items.length };
  });

// ---------------------------------------------------------------- matching

export const runMatching = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const [{ data: orders }, { data: shipments }] = await Promise.all([
      supabase
        .from("orders")
        .select("id,order_ref,phone_norm,cod_amount,customer_name,order_date,tracking_number")
        .eq("user_id", userId),
      supabase
        .from("shipments")
        .select("id,tracking_number,reference,phone_norm,cod_amount,customer_name,delivered_at,order_id")
        .eq("user_id", userId),
    ]);

    const allOrders = orders ?? [];
    const allShipments = shipments ?? [];
    const takenOrders = new Set(allShipments.filter((s) => s.order_id).map((s) => s.order_id!));

    const byTracking = new Map<string, string>();
    const byRef = new Map<string, string>();
    for (const o of allOrders) {
      if (o.tracking_number) byTracking.set(o.tracking_number.trim(), o.id);
      const ref = normalizeRef(o.order_ref);
      if (ref) byRef.set(ref, o.id);
    }

    const autoUpdates: { id: string; order_id: string; match_method: string; match_score: number }[] =
      [];
    const suggestions: {
      user_id: string;
      shipment_id: string;
      order_id: string;
      method: string;
      score: number;
    }[] = [];

    for (const s of allShipments) {
      if (s.order_id) continue;
      const tracked = byTracking.get((s.tracking_number ?? "").trim());
      if (tracked && !takenOrders.has(tracked)) {
        autoUpdates.push({ id: s.id, order_id: tracked, match_method: "tracking", match_score: 1 });
        takenOrders.add(tracked);
        continue;
      }
      const ref = normalizeRef(s.reference);
      const byReference = ref ? byRef.get(ref) : undefined;
      if (byReference && !takenOrders.has(byReference)) {
        autoUpdates.push({
          id: s.id,
          order_id: byReference,
          match_method: "reference",
          match_score: 1,
        });
        takenOrders.add(byReference);
        continue;
      }
      if (!s.phone_norm) continue;
      const candidates = allOrders.filter(
        (o) => o.phone_norm && o.phone_norm === s.phone_norm && !takenOrders.has(o.id),
      );
      if (!candidates.length) continue;
      const exact = candidates.filter((o) => Math.abs(o.cod_amount - s.cod_amount) <= 100);
      const pool = exact.length ? exact : candidates;
      for (const o of pool.slice(0, 3)) {
        suggestions.push({
          user_id: userId,
          shipment_id: s.id,
          order_id: o.id,
          method: exact.length ? "phone_amount" : "phone_only",
          score: exact.length ? (pool.length === 1 ? 0.9 : 0.7) : 0.5,
        });
      }
    }

    for (const u of autoUpdates) {
      await supabase
        .from("shipments")
        .update({
          order_id: u.order_id,
          match_method: u.match_method,
          match_score: u.match_score,
          matched_at: new Date().toISOString(),
        })
        .eq("id", u.id)
        .eq("user_id", userId);
    }
    if (suggestions.length) {
      await supabase
        .from("match_suggestions")
        .upsert(suggestions, { onConflict: "user_id,shipment_id,order_id", ignoreDuplicates: true });
    }

    // link payout items to shipments by tracking number
    const { data: items } = await supabase
      .from("payout_items")
      .select("id,tracking_number,shipment_id")
      .eq("user_id", userId)
      .is("shipment_id", null);
    if (items?.length) {
      const shipByTracking = new Map(allShipments.map((s) => [s.tracking_number.trim(), s.id]));
      for (const it of items) {
        const sid = shipByTracking.get(it.tracking_number.trim());
        if (sid) {
          await supabase
            .from("payout_items")
            .update({ shipment_id: sid })
            .eq("id", it.id)
            .eq("user_id", userId);
        }
      }
    }

    return { autoMatched: autoUpdates.length, suggested: suggestions.length };
  });

export const resolveSuggestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), accept: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: sug, error } = await supabase
      .from("match_suggestions")
      .select("id,shipment_id,order_id,method,score")
      .eq("id", data.id)
      .eq("user_id", userId)
      .single();
    if (error || !sug) throw new Error("الاقتراح غير موجود");

    if (data.accept) {
      await supabase
        .from("shipments")
        .update({
          order_id: sug.order_id,
          match_method: "confirmed",
          match_score: 1,
          matched_at: new Date().toISOString(),
        })
        .eq("id", sug.shipment_id)
        .eq("user_id", userId);
      await supabase
        .from("match_suggestions")
        .delete()
        .eq("user_id", userId)
        .eq("shipment_id", sug.shipment_id);
    } else {
      await supabase
        .from("match_suggestions")
        .update({ status: "rejected" })
        .eq("id", sug.id)
        .eq("user_id", userId);
    }
    return { ok: true };
  });

// ---------------------------------------------------------------- reads

type Row = {
  id: string;
  order_ref: string;
  customer_name: string | null;
  phone: string | null;
  cod_amount: number;
  zone: string | null;
  order_date: string | null;
  tracking_number: string | null;
  shipment_status: string | null;
  payout_ref: string | null;
  payout_date: string | null;
  status: OrderStatus;
  expectedFees: number;
  expectedNet: number;
  collected: number | null;
  paid: number | null;
  diff: number;
  collectionGap: number;
};

async function buildRows(supabase: any, userId: string) {
  const [{ data: profile }, { data: rules }, { data: orders }, { data: shipments }, { data: items }, { data: payouts }] =
    await Promise.all([
      supabase.from("profiles").select("cod_tolerance").eq("id", userId).maybeSingle(),
      supabase.from("pricing_rules").select("*").eq("user_id", userId),
      supabase.from("orders").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
      supabase.from("shipments").select("*").eq("user_id", userId),
      supabase.from("payout_items").select("*").eq("user_id", userId),
      supabase.from("payouts").select("*").eq("user_id", userId),
    ]);

  const tolerance = profile?.cod_tolerance ?? 100;
  const pricing: PricingRule[] = (rules ?? []).map((r: any) => ({
    zone: r.zone,
    shipping_fee: r.shipping_fee,
    cod_fee_percent: Number(r.cod_fee_percent),
    cod_fee_fixed: r.cod_fee_fixed,
    return_fee: r.return_fee,
  }));

  const shipmentByOrder = new Map<string, any>();
  const shipmentsById = new Map<string, any>();
  for (const s of shipments ?? []) {
    shipmentsById.set(s.id, s);
    if (s.order_id) shipmentByOrder.set(s.order_id, s);
  }
  const payoutById = new Map((payouts ?? []).map((p: any) => [p.id, p]));
  const paidByShipment = new Map<string, { amount: number; payout: any }>();
  for (const it of items ?? []) {
    if (!it.shipment_id) continue;
    const prev = paidByShipment.get(it.shipment_id);
    paidByShipment.set(it.shipment_id, {
      amount: (prev?.amount ?? 0) + it.amount,
      payout: payoutById.get(it.payout_id),
    });
  }

  const rows: Row[] = (orders ?? []).map((o: any) => {
    const s = shipmentByOrder.get(o.id) ?? null;
    const paidInfo = s ? (paidByShipment.get(s.id) ?? null) : null;
    const r = reconcile({
      codAmount: o.cod_amount,
      zone: o.zone ?? s?.zone ?? null,
      shipment: s
        ? {
            collected_amount: s.collected_amount,
            is_delivered: s.is_delivered,
            is_returned: s.is_returned,
          }
        : null,
      paidAmount: paidInfo ? paidInfo.amount : null,
      rules: pricing,
      tolerance,
    });
    return {
      id: o.id,
      order_ref: o.order_ref,
      customer_name: o.customer_name,
      phone: o.phone,
      cod_amount: o.cod_amount,
      zone: o.zone ?? s?.zone ?? null,
      order_date: o.order_date,
      tracking_number: s?.tracking_number ?? o.tracking_number ?? null,
      shipment_status: s?.status ?? null,
      payout_ref: paidInfo?.payout?.payout_ref ?? null,
      payout_date: paidInfo?.payout?.payout_date ?? null,
      ...r,
    };
  });

  const orphanShipments = (shipments ?? []).filter((s: any) => !s.order_id);
  return { rows, orphanShipments, tolerance };
}

export const getOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { rows, orphanShipments } = await buildRows(context.supabase, context.userId);
    const sum = (f: (r: Row) => number) => rows.reduce((a, r) => a + f(r), 0);
    const by = (s: OrderStatus) => rows.filter((r) => r.status === s);

    const paidRows = rows.filter((r) => r.paid !== null);
    const waiting = [...by("awaiting_payout"), ...by("in_transit")];
    const short = by("paid_short");

    return {
      counts: {
        total: rows.length,
        paid_ok: by("paid_ok").length,
        paid_short: short.length,
        paid_over: by("paid_over").length,
        awaiting_payout: by("awaiting_payout").length,
        in_transit: by("in_transit").length,
        returned: by("returned").length,
        unmatched: by("unmatched").length,
        orphanShipments: orphanShipments.length,
      },
      totals: {
        collectedValue: sum((r) => r.collected ?? 0),
        receivedValue: paidRows.reduce((a, r) => a + (r.paid ?? 0), 0),
        waitingValue: waiting.reduce((a, r) => a + r.expectedNet, 0),
        shortfall: short.reduce((a, r) => a + r.diff, 0),
      },
      recentShort: short.slice(0, 5),
    };
  });

export const listOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ status: z.string().optional(), q: z.string().optional() }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { rows } = await buildRows(context.supabase, context.userId);
    let out = rows;
    if (data.status && data.status !== "all") out = out.filter((r) => r.status === data.status);
    if (data.q) {
      const q = data.q.trim().toLowerCase();
      out = out.filter((r) =>
        [r.order_ref, r.customer_name, r.phone, r.tracking_number]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(q)),
      );
    }
    return { rows: out.slice(0, 500), total: out.length };
  });

export const listReview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: sugs } = await supabase
      .from("match_suggestions")
      .select("id,method,score,shipment_id,order_id")
      .eq("user_id", userId)
      .eq("status", "pending");

    const shipmentIds = [...new Set((sugs ?? []).map((s) => s.shipment_id))];
    const orderIds = [...new Set((sugs ?? []).map((s) => s.order_id))];

    const [{ data: ships }, { data: ords }, { rows, orphanShipments }] = await Promise.all([
      shipmentIds.length
        ? supabase.from("shipments").select("*").in("id", shipmentIds)
        : Promise.resolve({ data: [] as any[] }),
      orderIds.length
        ? supabase.from("orders").select("*").in("id", orderIds)
        : Promise.resolve({ data: [] as any[] }),
      buildRows(supabase, userId),
    ]);

    const shipMap = new Map((ships ?? []).map((s: any) => [s.id, s]));
    const orderMap = new Map((ords ?? []).map((o: any) => [o.id, o]));

    return {
      suggestions: (sugs ?? [])
        .filter((s) => shipMap.has(s.shipment_id) && orderMap.has(s.order_id))
        .map((s) => ({
          id: s.id,
          method: s.method,
          score: Number(s.score),
          shipment: shipMap.get(s.shipment_id),
          order: orderMap.get(s.order_id),
        })),
      unmatchedOrders: rows.filter((r) => r.status === "unmatched").slice(0, 100),
      orphanShipments: (orphanShipments as any[]).slice(0, 100),
      problems: rows.filter((r) => r.status === "paid_short" || r.status === "paid_over").slice(0, 100),
    };
  });

export const listPayouts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [{ data: payouts }, { data: items }, { data: shipments }] = await Promise.all([
      supabase.from("payouts").select("*").eq("user_id", userId).order("payout_date", { ascending: false }),
      supabase.from("payout_items").select("*").eq("user_id", userId),
      supabase.from("shipments").select("id,tracking_number,order_id").eq("user_id", userId),
    ]);
    const shipMap = new Map((shipments ?? []).map((s) => [s.id, s]));
    return {
      payouts: (payouts ?? []).map((p) => {
        const own = (items ?? []).filter((i) => i.payout_id === p.id);
        return {
          ...p,
          itemCount: own.length,
          linked: own.filter((i) => i.shipment_id && shipMap.get(i.shipment_id)?.order_id).length,
          items: own.slice(0, 200),
        };
      }),
    };
  });

// ---------------------------------------------------------------- pricing

export const getPricing = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [{ data: rules }, { data: profile }] = await Promise.all([
      supabase.from("pricing_rules").select("*").eq("user_id", userId).order("zone"),
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
    ]);
    return { rules: rules ?? [], tolerance: profile?.cod_tolerance ?? 100 };
  });

export const savePricing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        tolerance: z.number().int().min(0),
        rules: z.array(
          z.object({
            zone: z.string().min(1),
            shipping_fee: z.number().int().min(0),
            cod_fee_percent: z.number().min(0).max(100),
            cod_fee_fixed: z.number().int().min(0),
            return_fee: z.number().int().min(0),
          }),
        ),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await supabase.from("profiles").upsert({ id: userId, cod_tolerance: data.tolerance });
    const zones = data.rules.map((r) => r.zone);
    const { data: existing } = await supabase
      .from("pricing_rules")
      .select("id,zone")
      .eq("user_id", userId);
    const toDelete = (existing ?? []).filter((e) => !zones.includes(e.zone)).map((e) => e.id);
    if (toDelete.length) await supabase.from("pricing_rules").delete().in("id", toDelete);
    if (data.rules.length) {
      const { error } = await supabase
        .from("pricing_rules")
        .upsert(
          data.rules.map((r) => ({ ...r, user_id: userId })),
          { onConflict: "user_id,zone" },
        );
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

// ---------------------------------------------------------------- Bosta

export const getIntegration = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("integration_settings")
      .select("provider,enabled,last_sync_at,capabilities,api_key")
      .eq("user_id", context.userId)
      .eq("provider", "bosta")
      .maybeSingle();
    if (!data) return null;
    return { ...data, api_key: data.api_key ? "••••" + data.api_key.slice(-4) : null };
  });

export const saveIntegration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ apiKey: z.string().min(10) }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("integration_settings").upsert(
      {
        user_id: context.userId,
        provider: "bosta",
        api_key: data.apiKey.trim(),
        base_url: "https://app.bosta.co/api/v2",
        enabled: true,
      },
      { onConflict: "user_id,provider" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const probeBosta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { probeBostaCapabilities } = await import("@/lib/bosta.server");
    const { data: settings } = await context.supabase
      .from("integration_settings")
      .select("api_key,base_url")
      .eq("user_id", context.userId)
      .eq("provider", "bosta")
      .maybeSingle();
    if (!settings?.api_key) throw new Error("لم يتم حفظ مفتاح بوسطة بعد");
    const report = await probeBostaCapabilities(settings.api_key, settings.base_url ?? undefined);
    await context.supabase
      .from("integration_settings")
      .update({ capabilities: report as any })
      .eq("user_id", context.userId)
      .eq("provider", "bosta");
    return report;
  });

export const syncBosta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { fetchBostaDeliveries } = await import("@/lib/bosta.server");
    const { supabase, userId } = context;
    const { data: settings } = await supabase
      .from("integration_settings")
      .select("api_key,base_url")
      .eq("user_id", userId)
      .eq("provider", "bosta")
      .maybeSingle();
    if (!settings?.api_key) throw new Error("لم يتم حفظ مفتاح بوسطة بعد");

    const deliveries = await fetchBostaDeliveries(settings.api_key, settings.base_url ?? undefined);
    const payload = deliveries.map((d) => ({
      user_id: userId,
      tracking_number: d.trackingNumber,
      reference: d.reference,
      customer_name: d.customerName,
      phone: d.phone,
      phone_norm: normalizePhone(d.phone),
      cod_amount: d.cod,
      collected_amount: d.collected,
      fees_amount: d.fees,
      status: d.status,
      is_delivered: d.isDelivered,
      is_returned: d.isReturned,
      delivered_at: d.deliveredAt,
      zone: d.zone,
      source: "bosta",
      raw: d.raw as any,
      updated_at: new Date().toISOString(),
    }));
    if (payload.length) {
      const { error } = await supabase
        .from("shipments")
        .upsert(payload, { onConflict: "user_id,tracking_number" });
      if (error) throw new Error(error.message);
    }
    await supabase
      .from("integration_settings")
      .update({ last_sync_at: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("provider", "bosta");
    return { synced: payload.length };
  });
