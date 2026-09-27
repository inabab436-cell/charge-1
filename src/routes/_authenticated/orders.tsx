import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { listOrders } from "@/lib/app.functions";
import { formatEGP, STATUS_LABEL, type OrderStatus } from "@/lib/reconcile";
import { StatusBadge } from "@/components/StatusBadge";

type Search = { status?: string | undefined; q?: string | undefined };

export const Route = createFileRoute("/_authenticated/orders")({
  validateSearch: (search: Record<string, unknown>): Search => ({
    status: typeof search["status"] === "string" ? search["status"] : undefined,
    q: typeof search["q"] === "string" ? search["q"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "الأوردرات — تسوية" },
      { name: "description", content: "كل أوردر وحالته المالية بالتفصيل." },
      { property: "og:title", content: "الأوردرات — تسوية" },
      { property: "og:description", content: "كل أوردر وحالته المالية بالتفصيل." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Orders,
});

const FILTERS: { key: string; label: string }[] = [
  { key: "all", label: "الكل" },
  ...(Object.keys(STATUS_LABEL) as OrderStatus[]).map((k) => ({ key: k, label: STATUS_LABEL[k] })),
];

function Orders() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/orders" });
  const [q, setQ] = useState(search.q ?? "");
  const fn = useServerFn(listOrders);
  const status = search.status ?? "all";

  const { data, isLoading } = useQuery({
    queryKey: ["orders", status, search.q ?? ""],
    queryFn: () => fn({ data: { status, q: search.q ?? "" } }),
  });

  return (
    <AppShell title="الأوردرات">
      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => navigate({ search: (s) => ({ ...s, status: f.key }) })}
            className={`rounded-full px-3 py-1.5 text-sm ${
              status === f.key
                ? "bg-primary text-primary-foreground"
                : "border border-border bg-card text-muted-foreground hover:bg-accent"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          navigate({ search: (s) => ({ ...s, q }) });
        }}
        className="mb-4 flex gap-2"
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="ابحث برقم الأوردر أو الموبايل أو رقم التتبع"
          className="w-full max-w-md rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
        <button className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
          بحث
        </button>
      </form>

      {isLoading || !data ? (
        <p className="text-sm text-muted-foreground">جاري التحميل...</p>
      ) : data.rows.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
          مفيش أوردرات في هذا الفلتر.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card">
          <table className="w-full min-w-[900px] text-right text-sm">
            <thead className="bg-secondary text-muted-foreground">
              <tr>
                <th className="p-3 font-medium">الأوردر</th>
                <th className="p-3 font-medium">العميل</th>
                <th className="p-3 font-medium">المطلوب</th>
                <th className="p-3 font-medium">المحصّل</th>
                <th className="p-3 font-medium">رسوم متوقعة</th>
                <th className="p-3 font-medium">الصافي المتوقع</th>
                <th className="p-3 font-medium">وصل فعليًا</th>
                <th className="p-3 font-medium">الفرق</th>
                <th className="p-3 font-medium">الحالة</th>
                <th className="p-3 font-medium">التحويل</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r) => (
                <tr key={r.id} className="border-t border-border align-top">
                  <td className="p-3">
                    <div className="font-semibold">{r.order_ref}</div>
                    <div className="text-xs text-muted-foreground">{r.tracking_number ?? "—"}</div>
                  </td>
                  <td className="p-3">
                    <div>{r.customer_name ?? "—"}</div>
                    <div className="text-xs text-muted-foreground">{r.phone ?? ""}</div>
                  </td>
                  <td className="p-3">{formatEGP(r.cod_amount)}</td>
                  <td className="p-3">
                    {r.collected === null ? "—" : formatEGP(r.collected)}
                    {r.collectionGap !== 0 && (
                      <div className="text-xs font-semibold text-red-700">
                        فرق تحصيل {formatEGP(r.collectionGap)}
                      </div>
                    )}
                  </td>
                  <td className="p-3 text-muted-foreground">{formatEGP(r.expectedFees)}</td>
                  <td className="p-3 font-medium">{formatEGP(r.expectedNet)}</td>
                  <td className="p-3">{r.paid === null ? "—" : formatEGP(r.paid)}</td>
                  <td
                    className={`p-3 font-semibold ${
                      r.paid === null ? "" : r.diff < 0 ? "text-red-700" : r.diff > 0 ? "text-amber-700" : ""
                    }`}
                  >
                    {r.paid === null ? "—" : formatEGP(r.diff)}
                  </td>
                  <td className="p-3">
                    <StatusBadge status={r.status} />
                  </td>
                  <td className="p-3 text-xs text-muted-foreground">
                    {r.payout_ref ? (
                      <>
                        <div>{r.payout_ref}</div>
                        <div>{r.payout_date ?? ""}</div>
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AppShell>
  );
}
