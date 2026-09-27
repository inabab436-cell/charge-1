import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { getPricing, savePricing } from "@/lib/app.functions";
import { toast } from "sonner";
import { Trash2, Plus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/pricing")({
  head: () => ({
    meta: [
      { title: "جدول الأسعار — تسوية" },
      { name: "description", content: "رسوم الشحن والتحصيل لكل منطقة، عشان نحسب الصافي المتوقع." },
      { property: "og:title", content: "جدول الأسعار — تسوية" },
      {
        property: "og:description",
        content: "رسوم الشحن والتحصيل لكل منطقة، عشان نحسب الصافي المتوقع.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Pricing,
});

type RuleForm = {
  zone: string;
  shipping_fee: string;
  cod_fee_percent: string;
  cod_fee_fixed: string;
  return_fee: string;
};

const EMPTY: RuleForm = {
  zone: "",
  shipping_fee: "0",
  cod_fee_percent: "0",
  cod_fee_fixed: "0",
  return_fee: "0",
};

const toEGP = (p: number) => (p / 100).toString();
const toP = (v: string) => Math.round((Number(v) || 0) * 100);

function Pricing() {
  const qc = useQueryClient();
  const load = useServerFn(getPricing);
  const save = useServerFn(savePricing);
  const { data, isLoading } = useQuery({ queryKey: ["pricing"], queryFn: () => load({}) });

  const [rules, setRules] = useState<RuleForm[]>([]);
  const [tolerance, setTolerance] = useState("1");

  useEffect(() => {
    if (!data) return;
    setRules(
      data.rules.length
        ? data.rules.map((r) => ({
            zone: r.zone,
            shipping_fee: toEGP(r.shipping_fee),
            cod_fee_percent: String(r.cod_fee_percent),
            cod_fee_fixed: toEGP(r.cod_fee_fixed),
            return_fee: toEGP(r.return_fee),
          }))
        : [{ ...EMPTY, zone: "default" }],
    );
    setTolerance(toEGP(data.tolerance));
  }, [data]);

  const mut = useMutation({
    mutationFn: () =>
      save({
        data: {
          tolerance: toP(tolerance),
          rules: rules
            .filter((r) => r.zone.trim())
            .map((r) => ({
              zone: r.zone.trim(),
              shipping_fee: toP(r.shipping_fee),
              cod_fee_percent: Number(r.cod_fee_percent) || 0,
              cod_fee_fixed: toP(r.cod_fee_fixed),
              return_fee: toP(r.return_fee),
            })),
        },
      }),
    onSuccess: () => {
      toast.success("تم الحفظ. هنستخدمه في حساب الصافي المتوقع.");
      qc.invalidateQueries();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "حصلت مشكلة"),
  });

  function update(i: number, key: keyof RuleForm, value: string) {
    setRules((rs) => rs.map((r, idx) => (idx === i ? { ...r, [key]: value } : r)));
  }

  const input =
    "w-full rounded-lg border border-input bg-background px-2.5 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";

  return (
    <AppShell title="جدول الأسعار">
      <p className="mb-5 max-w-2xl text-sm text-muted-foreground">
        اكتب رسوم بوسطة زي ما هي متفق عليها معاك. المنطقة اسمها <b>default</b> بتنطبق على أي منطقة
        مش مكتوبة هنا. كل المبالغ بالجنيه.
      </p>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">جاري التحميل...</p>
      ) : (
        <>
          <div className="overflow-x-auto rounded-2xl border border-border bg-card">
            <table className="w-full min-w-[720px] text-right text-sm">
              <thead className="bg-secondary text-muted-foreground">
                <tr>
                  <th className="p-3 font-medium">المنطقة</th>
                  <th className="p-3 font-medium">رسوم الشحن</th>
                  <th className="p-3 font-medium">نسبة التحصيل %</th>
                  <th className="p-3 font-medium">رسوم تحصيل ثابتة</th>
                  <th className="p-3 font-medium">رسوم المرتجع</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody>
                {rules.map((r, i) => (
                  <tr key={i} className="border-t border-border">
                    <td className="p-2">
                      <input
                        className={input}
                        value={r.zone}
                        onChange={(e) => update(i, "zone", e.target.value)}
                        placeholder="القاهرة"
                      />
                    </td>
                    <td className="p-2">
                      <input
                        className={input}
                        type="number"
                        step="0.01"
                        value={r.shipping_fee}
                        onChange={(e) => update(i, "shipping_fee", e.target.value)}
                      />
                    </td>
                    <td className="p-2">
                      <input
                        className={input}
                        type="number"
                        step="0.1"
                        value={r.cod_fee_percent}
                        onChange={(e) => update(i, "cod_fee_percent", e.target.value)}
                      />
                    </td>
                    <td className="p-2">
                      <input
                        className={input}
                        type="number"
                        step="0.01"
                        value={r.cod_fee_fixed}
                        onChange={(e) => update(i, "cod_fee_fixed", e.target.value)}
                      />
                    </td>
                    <td className="p-2">
                      <input
                        className={input}
                        type="number"
                        step="0.01"
                        value={r.return_fee}
                        onChange={(e) => update(i, "return_fee", e.target.value)}
                      />
                    </td>
                    <td className="p-2">
                      <button
                        onClick={() => setRules((rs) => rs.filter((_, idx) => idx !== i))}
                        className="rounded-lg p-2 text-muted-foreground hover:bg-secondary hover:text-destructive"
                        aria-label="حذف"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button
            onClick={() => setRules((rs) => [...rs, { ...EMPTY }])}
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground hover:bg-secondary"
          >
            <Plus className="size-4" /> منطقة جديدة
          </button>

          <div className="mt-8 max-w-md rounded-2xl border border-border bg-card p-5">
            <label className="mb-1.5 block text-sm font-semibold text-card-foreground">
              فرق مسموح به (جنيه)
            </label>
            <p className="mb-3 text-xs text-muted-foreground">
              أي فرق أقل من ده بنعتبره تقريب ومش مشكلة.
            </p>
            <input
              className={input}
              type="number"
              step="0.01"
              value={tolerance}
              onChange={(e) => setTolerance(e.target.value)}
            />
          </div>

          <button
            onClick={() => mut.mutate()}
            disabled={mut.isPending}
            className="mt-6 rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            {mut.isPending ? "جاري الحفظ..." : "حفظ"}
          </button>
        </>
      )}
    </AppShell>
  );
}
