import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/AppShell";
import { listReview, resolveSuggestion, runMatching } from "@/lib/app.functions";
import { formatEGP } from "@/lib/reconcile";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/review")({
  head: () => ({
    meta: [
      { title: "يحتاج انتباهك — تسوية" },
      { name: "description", content: "أكّد المطابقات الغامضة بضغطة واحدة." },
      { property: "og:title", content: "يحتاج انتباهك — تسوية" },
      { property: "og:description", content: "أكّد المطابقات الغامضة بضغطة واحدة." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Review,
});

const METHOD_LABEL: Record<string, string> = {
  tracking: "رقم التتبع",
  reference: "الرقم المرجعي",
  phone_amount: "الموبايل + المبلغ",
  phone_only: "الموبايل فقط",
};

function Review() {
  const qc = useQueryClient();
  const list = useServerFn(listReview);
  const resolve = useServerFn(resolveSuggestion);
  const match = useServerFn(runMatching);

  const { data, isLoading } = useQuery({ queryKey: ["review"], queryFn: () => list({}) });

  const resolveMut = useMutation({
    mutationFn: (v: { suggestionId: string; action: "accept" | "reject" }) => resolve({ data: v }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["review"] });
      qc.invalidateQueries({ queryKey: ["overview"] });
      qc.invalidateQueries({ queryKey: ["orders"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "حصلت مشكلة"),
  });

  const matchMut = useMutation({
    mutationFn: () => match({}),
    onSuccess: (r) => {
      toast.success(`تم ربط ${r.matched} شحنة، و${r.suggested} محتاجة تأكيدك.`);
      qc.invalidateQueries();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "حصلت مشكلة"),
  });

  return (
    <AppShell title="يحتاج انتباهك">
      <div className="mb-5 flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          دي الحالات اللي النظام مش متأكد منها 100%. تأكيدك بيخلّيه يتعلّم.
        </p>
        <button
          onClick={() => matchMut.mutate()}
          disabled={matchMut.isPending}
          className="shrink-0 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
        >
          {matchMut.isPending ? "جاري المطابقة..." : "إعادة المطابقة"}
        </button>
      </div>

      {isLoading || !data ? (
        <p className="text-sm text-muted-foreground">جاري التحميل...</p>
      ) : (
        <>
          <section className="mb-8">
            <h2 className="mb-3 text-lg font-bold text-foreground">
              مطابقات محتاجة تأكيد ({data.suggestions.length})
            </h2>
            {data.suggestions.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground">
                مفيش حاجة محتاجة تأكيد. كله متطابق.
              </p>
            ) : (
              <div className="space-y-3">
                {data.suggestions.map((s) => (
                  <div
                    key={s.id}
                    className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-card p-4"
                  >
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <p className="text-xs text-muted-foreground">الشحنة</p>
                        <p className="font-semibold">{s.tracking_number}</p>
                        <p className="text-xs text-muted-foreground">
                          {s.shipment_name ?? "—"} · {s.shipment_phone ?? "—"} ·{" "}
                          {formatEGP(s.shipment_cod)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">الأوردر المقترح</p>
                        <p className="font-semibold">{s.order_ref}</p>
                        <p className="text-xs text-muted-foreground">
                          {s.order_name ?? "—"} · {s.order_phone ?? "—"} · {formatEGP(s.order_cod)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-accent px-2.5 py-1 text-xs font-semibold text-accent-foreground">
                        {METHOD_LABEL[s.method] ?? s.method} · {Math.round(s.score * 100)}%
                      </span>
                      <button
                        onClick={() => resolveMut.mutate({ suggestionId: s.id, action: "accept" })}
                        disabled={resolveMut.isPending}
                        className="rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
                      >
                        صح، اربطهم
                      </button>
                      <button
                        onClick={() => resolveMut.mutate({ suggestionId: s.id, action: "reject" })}
                        disabled={resolveMut.isPending}
                        className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground hover:bg-secondary disabled:opacity-60"
                      >
                        مش صح
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section>
            <h2 className="mb-3 text-lg font-bold text-foreground">
              شحنات بدون أوردر ({data.orphanShipments.length})
            </h2>
            {data.orphanShipments.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground">
                كل الشحنات مربوطة بأوردراتها.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-border bg-card">
                <table className="w-full text-right text-sm">
                  <thead className="bg-secondary text-muted-foreground">
                    <tr>
                      <th className="p-3 font-medium">رقم التتبع</th>
                      <th className="p-3 font-medium">العميل</th>
                      <th className="p-3 font-medium">الموبايل</th>
                      <th className="p-3 font-medium">المبلغ</th>
                      <th className="p-3 font-medium">الحالة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.orphanShipments.map((s) => (
                      <tr key={s.id} className="border-t border-border">
                        <td className="p-3 font-medium">{s.tracking_number}</td>
                        <td className="p-3">{s.customer_name ?? "—"}</td>
                        <td className="p-3">{s.phone ?? "—"}</td>
                        <td className="p-3">{formatEGP(s.cod_amount)}</td>
                        <td className="p-3 text-muted-foreground">{s.state ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </AppShell>
  );
}
