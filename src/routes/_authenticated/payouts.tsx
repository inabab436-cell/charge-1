import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/AppShell";
import { listPayouts } from "@/lib/app.functions";
import { formatEGP } from "@/lib/reconcile";

export const Route = createFileRoute("/_authenticated/payouts")({
  head: () => ({
    meta: [
      { title: "التحويلات — تسوية" },
      { name: "description", content: "كل تحويل بنكي وصل، وما يقابله من شحنات." },
      { property: "og:title", content: "التحويلات — تسوية" },
      { property: "og:description", content: "كل تحويل بنكي وصل، وما يقابله من شحنات." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Payouts,
});

function Payouts() {
  const fn = useServerFn(listPayouts);
  const { data, isLoading } = useQuery({ queryKey: ["payouts"], queryFn: () => fn({}) });

  return (
    <AppShell title="التحويلات">
      {isLoading || !data ? (
        <p className="text-sm text-muted-foreground">جاري التحميل...</p>
      ) : data.payouts.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
          لسه مفيش تحويلات. ارفع كشف التحويلات من صفحة الاستيراد.
        </p>
      ) : (
        <div className="space-y-4">
          {data.payouts.map((p) => (
            <div key={p.id} className="rounded-2xl border border-border bg-card p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <div>
                  <p className="text-lg font-bold text-card-foreground">{p.payout_ref}</p>
                  <p className="text-sm text-muted-foreground">{p.payout_date ?? "بدون تاريخ"}</p>
                </div>
                <div className="text-left">
                  <p className="text-2xl font-bold text-primary">{formatEGP(p.total_amount)}</p>
                  <p className="text-sm text-muted-foreground">{p.itemCount} شحنة</p>
                </div>
              </div>
              {p.itemCount - p.linked > 0 && (
                <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  فيه {p.itemCount - p.linked} سطر في التحويل لسه مش مربوط بأوردر عندك.
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
}
