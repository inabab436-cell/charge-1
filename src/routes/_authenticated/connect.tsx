import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { getIntegration, saveIntegration, probeBosta, syncBosta, runMatching } from "@/lib/app.functions";
import { toast } from "sonner";
import { CheckCircle2, XCircle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/connect")({
  head: () => ({
    meta: [
      { title: "ربط بوسطة — تسوية" },
      { name: "description", content: "اربط حسابك في بوسطة عشان نسحب الشحنات تلقائيًا." },
      { property: "og:title", content: "ربط بوسطة — تسوية" },
      { property: "og:description", content: "اربط حسابك في بوسطة عشان نسحب الشحنات تلقائيًا." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Connect,
});

function Connect() {
  const qc = useQueryClient();
  const load = useServerFn(getIntegration);
  const save = useServerFn(saveIntegration);
  const probe = useServerFn(probeBosta);
  const sync = useServerFn(syncBosta);
  const match = useServerFn(runMatching);

  const [apiKey, setApiKey] = useState("");
  const { data, isLoading } = useQuery({ queryKey: ["integration"], queryFn: () => load({}) });

  const saveMut = useMutation({
    mutationFn: () => save({ data: { apiKey } }),
    onSuccess: async () => {
      setApiKey("");
      toast.success("تم حفظ المفتاح. بنختبر الاتصال...");
      await probeMut.mutateAsync();
      qc.invalidateQueries({ queryKey: ["integration"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "حصلت مشكلة"),
  });

  const probeMut = useMutation({
    mutationFn: () => probe({}),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["integration"] });
      toast[r.authOk ? "success" : "error"](
        r.authOk ? "الاتصال ببوسطة شغّال." : "المفتاح مرفوض من بوسطة.",
      );
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "حصلت مشكلة"),
  });

  const syncMut = useMutation({
    mutationFn: async () => {
      const s = await sync({});
      const m = await match({});
      return { ...s, ...m };
    },
    onSuccess: (r) => {
      toast.success(
        `جبنا ${r.synced} شحنة، ربطنا ${r.autoMatched} تلقائيًا و${r.suggested} محتاجة تأكيدك.`,
      );
      qc.invalidateQueries();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "حصلت مشكلة"),
  });

  const caps = (data?.capabilities ?? null) as Record<string, unknown> | null;

  return (
    <AppShell title="ربط بوسطة">
      <div className="max-w-2xl space-y-6">
        <div className="rounded-2xl border border-border bg-card p-5">
          <h2 className="mb-1 text-lg font-bold text-card-foreground">مفتاح الـ API</h2>
          <p className="mb-4 text-sm text-muted-foreground">
            من لوحة بوسطة: الإعدادات ← مفاتيح الـ API. بنخزّنه على الخادم فقط ومش بيظهر تاني.
          </p>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">جاري التحميل...</p>
          ) : (
            <>
              {data?.api_key && (
                <p className="mb-3 text-sm text-muted-foreground">
                  المفتاح المحفوظ: <span className="font-mono">{data.api_key}</span>
                  {data.last_sync_at ? (
                    <> · آخر سحب: {new Date(data.last_sync_at).toLocaleString("ar-EG")}</>
                  ) : null}
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                <input
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={data?.api_key ? "مفتاح جديد (اختياري)" : "الصق المفتاح هنا"}
                  className="min-w-60 flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
                <button
                  onClick={() => saveMut.mutate()}
                  disabled={apiKey.trim().length < 10 || saveMut.isPending}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
                >
                  {saveMut.isPending ? "جاري الحفظ..." : "حفظ واختبار"}
                </button>
              </div>
            </>
          )}
        </div>

        {data?.api_key && (
          <div className="rounded-2xl border border-border bg-card p-5">
            <h2 className="mb-1 text-lg font-bold text-card-foreground">قدرات حسابك في بوسطة</h2>
            <p className="mb-4 text-sm text-muted-foreground">
              بنختبر فعليًا إيه البيانات اللي بوسطة بترجعها لحسابك، عشان نعرف نعتمد على السحب
              التلقائي ولا محتاجين ملفات.
            </p>
            <div className="mb-4 flex flex-wrap gap-2">
              <button
                onClick={() => probeMut.mutate()}
                disabled={probeMut.isPending}
                className="rounded-lg border border-border px-4 py-2 text-sm font-semibold hover:bg-secondary disabled:opacity-60"
              >
                {probeMut.isPending ? "جاري الفحص..." : "افحص من جديد"}
              </button>
              <button
                onClick={() => syncMut.mutate()}
                disabled={syncMut.isPending}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
              >
                {syncMut.isPending ? "جاري السحب..." : "اسحب الشحنات دلوقتي"}
              </button>
            </div>
            {caps ? (
              <ul className="space-y-2 text-sm">
                {[
                  ["authOk", "الاتصال والمصادقة"],
                  ["hasDeliveries", "قائمة الشحنات"],
                  ["hasCollectedAmount", "المبلغ المحصّل فعليًا"],
                  ["hasFees", "الرسوم المخصومة"],
                  ["hasReference", "الرقم المرجعي للأوردر"],
                  ["hasPayouts", "بيانات التحويلات البنكية"],
                ].map(([key, label]) => {
                  const ok = Boolean(caps[key as string]);
                  return (
                    <li key={key as string} className="flex items-center gap-2">
                      {ok ? (
                        <CheckCircle2 className="size-4 text-emerald-600" />
                      ) : (
                        <XCircle className="size-4 text-muted-foreground" />
                      )}
                      <span className={ok ? "text-foreground" : "text-muted-foreground"}>
                        {label as string}
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">لسه مفيش فحص. اضغط "افحص من جديد".</p>
            )}
            {caps && !caps["hasPayouts"] && (
              <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
                بوسطة مش بترجع التحويلات البنكية على حسابك، فارفع كشف التحويلات من صفحة الاستيراد
                عشان نكمّل المقارنة.
              </p>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}
