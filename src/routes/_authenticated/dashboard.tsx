import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/AppShell";
import { getOverview } from "@/lib/app.functions";
import { formatEGP } from "@/lib/reconcile";
import { StatusBadge } from "@/components/StatusBadge";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "اللوحة — تسوية" },
      { name: "description", content: "ملخص فلوس الشحن: وصل، منتظر، وناقص." },
      { property: "og:title", content: "اللوحة — تسوية" },
      { property: "og:description", content: "ملخص فلوس الشحن: وصل، منتظر، وناقص." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

function Card({
  title,
  value,
  hint,
  tone = "default",
  to,
}: {
  title: string;
  value: string;
  hint?: string;
  tone?: "default" | "good" | "bad" | "wait";
  to?: { to: string; search?: Record<string, string> };
}) {
  const tones = {
    default: "border-border",
    good: "border-emerald-200 bg-emerald-50/60",
    bad: "border-red-200 bg-red-50/60",
    wait: "border-sky-200 bg-sky-50/60",
  } as const;
  const body = (
    <div className={`rounded-2xl border bg-card p-4 ${tones[tone]}`}>
      <p className="text-sm text-muted-foreground">{title}</p>
      <p className="mt-1.5 text-2xl font-bold text-card-foreground">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
  if (!to) return body;
  return (
    <Link to={to.to} search={to.search as never} className="block transition-transform hover:-translate-y-0.5">
      {body}
    </Link>
  );
}

function Dashboard() {
  const fn = useServerFn(getOverview);
  const { data, isLoading } = useQuery({ queryKey: ["overview"], queryFn: () => fn({}) });

  return (
    <AppShell title="اللوحة">
      {isLoading || !data ? (
        <p className="text-sm text-muted-foreground">جاري الحساب...</p>
      ) : data.counts.total === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center">
          <p className="mb-2 font-semibold text-card-foreground">لسه مفيش أوردرات</p>
          <p className="mb-5 text-sm text-muted-foreground">
            ارفع ملف أوردراتك وكشف بوسطة، والنظام هيطابق ويحسب لوحده.
          </p>
          <Link
            to="/import"
            className="inline-block rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
          >
            ابدأ بالاستيراد
          </Link>
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Card
              title="وصل فعليًا"
              value={formatEGP(data.totals.receivedValue)}
              hint={`${data.counts.paid_ok} أوردر مضبوط`}
              tone="good"
              to={{ to: "/orders", search: { status: "paid_ok" } }}
            />
            <Card
              title="لسه منتظر"
              value={formatEGP(data.totals.waitingValue)}
              hint={`${data.counts.awaiting_payout} محصّل + ${data.counts.in_transit} في الطريق`}
              tone="wait"
              to={{ to: "/orders", search: { status: "awaiting_payout" } }}
            />
            <Card
              title="ناقص"
              value={formatEGP(Math.abs(data.totals.shortfall))}
              hint={`${data.counts.paid_short} أوردر وصل ناقص`}
              tone="bad"
              to={{ to: "/orders", search: { status: "paid_short" } }}
            />
            <Card
              title="محتاج انتباهك"
              value={`${data.counts.unmatched + data.counts.orphanShipments}`}
              hint="أوردرات أو شحنات بدون مطابقة"
              to={{ to: "/review" }}
            />
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <Card title="إجمالي محصّل" value={formatEGP(data.totals.collectedValue)} />
            <Card title="مرتجعات" value={`${data.counts.returned}`} />
            <Card title="إجمالي الأوردرات" value={`${data.counts.total}`} />
          </div>

          {data.recentShort.length > 0 && (
            <div className="mt-8">
              <h2 className="mb-3 text-lg font-bold text-foreground">آخر الفروق</h2>
              <div className="overflow-x-auto rounded-2xl border border-border bg-card">
                <table className="w-full text-right text-sm">
                  <thead className="bg-secondary text-muted-foreground">
                    <tr>
                      <th className="p-3 font-medium">الأوردر</th>
                      <th className="p-3 font-medium">المتوقع</th>
                      <th className="p-3 font-medium">اللي وصل</th>
                      <th className="p-3 font-medium">الفرق</th>
                      <th className="p-3 font-medium">الحالة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recentShort.map((r) => (
                      <tr key={r.id} className="border-t border-border">
                        <td className="p-3 font-medium">{r.order_ref}</td>
                        <td className="p-3">{formatEGP(r.expectedNet)}</td>
                        <td className="p-3">{formatEGP(r.paid ?? 0)}</td>
                        <td className="p-3 font-semibold text-red-700">{formatEGP(r.diff)}</td>
                        <td className="p-3">
                          <StatusBadge status={r.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </AppShell>
  );
}
