import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { importRows, runMatching } from "@/lib/app.functions";
import { parseSheetFile, guessMapping, applyMapping, FIELDS, type ImportKind } from "@/lib/sheet";
import { toast } from "sonner";
import { UploadCloud } from "lucide-react";

export const Route = createFileRoute("/_authenticated/import")({
  head: () => ({
    meta: [
      { title: "استيراد الملفات — تسوية" },
      { name: "description", content: "ارفع أوردراتك وكشف بوسطة وكشف التحويلات." },
      { property: "og:title", content: "استيراد الملفات — تسوية" },
      { property: "og:description", content: "ارفع أوردراتك وكشف بوسطة وكشف التحويلات." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ImportPage,
});

const KINDS: { key: ImportKind; label: string; hint: string }[] = [
  { key: "orders", label: "أوردراتي", hint: "الأوردرات اللي عندك بالمبلغ المطلوب تحصيله" },
  { key: "shipments", label: "كشف الشحنات من بوسطة", hint: "الشحنات وحالتها والمبلغ المحصّل" },
  { key: "payouts", label: "كشف التحويلات", hint: "الفلوس اللي بوسطة حوّلتها لحسابك" },
];

function ImportPage() {
  const qc = useQueryClient();
  const doImport = useServerFn(importRows);
  const match = useServerFn(runMatching);

  const [kind, setKind] = useState<ImportKind>("orders");
  const [filename, setFilename] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  async function onFile(file: File) {
    try {
      const sheet = await parseSheetFile(file);
      if (!sheet.rows.length) {
        toast.error("الملف فاضي أو مش مقروء.");
        return;
      }
      setFilename(file.name);
      setHeaders(sheet.headers);
      setRows(sheet.rows);
      setMapping(guessMapping(sheet.headers, kind));
    } catch {
      toast.error("مقدرناش نقرأ الملف. جرّب CSV أو Excel.");
    }
  }

  async function submit() {
    const missing = FIELDS[kind]
      .filter((f) => f.required && !mapping[f.key])
      .map((f) => f.label);
    if (missing.length) {
      toast.error("لازم تحدد: " + missing.join("، "));
      return;
    }
    setBusy(true);
    try {
      const mapped = applyMapping(rows, mapping).slice(0, 5000);
      const res = await doImport({ data: { kind, filename, mapping, rows: mapped } });
      const m = await match({});
      toast.success(
        `تم استيراد ${res.imported} سطر. ربطنا ${m.autoMatched} تلقائيًا و${m.suggested} محتاجة تأكيدك.`,
      );
      setHeaders([]);
      setRows([]);
      setFilename("");
      qc.invalidateQueries();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "حصلت مشكلة في الاستيراد");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell title="استيراد">
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        {KINDS.map((k) => (
          <button
            key={k.key}
            onClick={() => {
              setKind(k.key);
              if (headers.length) setMapping(guessMapping(headers, k.key));
            }}
            className={`rounded-2xl border p-4 text-right ${
              kind === k.key ? "border-primary bg-accent" : "border-border bg-card hover:bg-secondary"
            }`}
          >
            <p className="font-bold text-card-foreground">{k.label}</p>
            <p className="mt-1 text-xs text-muted-foreground">{k.hint}</p>
          </button>
        ))}
      </div>

      <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border bg-card p-10 text-center hover:bg-secondary">
        <UploadCloud className="size-8 text-primary" />
        <span className="font-semibold text-card-foreground">
          {filename || "اختر ملف Excel أو CSV"}
        </span>
        <span className="text-xs text-muted-foreground">حتى 5000 سطر في المرة</span>
        <input
          type="file"
          accept=".csv,.xlsx,.xls"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
          }}
        />
      </label>

      {headers.length > 0 && (
        <div className="mt-6 rounded-2xl border border-border bg-card p-5">
          <h2 className="mb-1 text-lg font-bold text-card-foreground">راجع الأعمدة</h2>
          <p className="mb-4 text-sm text-muted-foreground">
            خمّنا الأعمدة من الملف. عدّل أي حاجة غلط قبل ما تكمل. ({rows.length} سطر)
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {FIELDS[kind].map((f) => (
              <div key={f.key}>
                <label className="mb-1 block text-sm font-medium text-card-foreground">
                  {f.label} {f.required ? <span className="text-destructive">*</span> : null}
                </label>
                <select
                  value={mapping[f.key] ?? ""}
                  onChange={(e) =>
                    setMapping((m) => ({ ...m, [f.key]: e.target.value }))
                  }
                  className="w-full rounded-lg border border-input bg-background px-2.5 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">— بدون —</option>
                  {headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
          <button
            onClick={submit}
            disabled={busy}
            className="mt-5 rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            {busy ? "جاري الاستيراد..." : "استورد وطابق"}
          </button>
        </div>
      )}
    </AppShell>
  );
}
