import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, Coins, Scale, Sparkles } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "تسوية — اعرف فلوس أوردراتك من بوسطة بالظبط" },
      {
        name: "description",
        content:
          "نظام بسيط ودقيق يقارن المطلوب تحصيله بالمحصّل بالمحوّل فعليًا، ويكشف أي نقص أو خصم في فلوس الشحن.",
      },
      { property: "og:title", content: "تسوية — اعرف فلوس أوردراتك من بوسطة بالظبط" },
      {
        property: "og:description",
        content: "قارن المطلوب بالمحصّل بالمحوّل، واكشف النقص قبل ما يضيع.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-5 py-5">
        <div className="flex items-center gap-2">
          <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground font-bold">
            ت
          </span>
          <span className="text-lg font-bold text-foreground">تسوية</span>
        </div>
        <Link
          to="/auth"
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
        >
          ابدأ الآن
        </Link>
      </header>

      <section className="mx-auto max-w-3xl px-5 pb-10 pt-10 text-center">
        <p className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground">
          <Sparkles className="size-3.5" />
          متصل بشركة الشحن بوسطة
        </p>
        <h1 className="text-3xl font-bold leading-tight text-foreground sm:text-4xl">
          فلوس أوردراتك… وصلت ولا لسه؟ وكاملة ولا ناقصة؟
        </h1>
        <p className="mt-4 text-base leading-relaxed text-muted-foreground">
          بنقارن لكل أوردر ثلاث أرقام: المطلوب تحصيله، اللي بوسطة حصّلته، واللي وصل فعلًا في التحويل.
          أي فرق بيظهر قدامك بسببه، من غير ما تفتح إكسل ولا تراجع يدوي.
        </p>
        <Link
          to="/auth"
          className="mt-7 inline-block rounded-xl bg-primary px-6 py-3 text-base font-semibold text-primary-foreground hover:bg-primary/90"
        >
          جرّب على أوردراتك
        </Link>
      </section>

      <section className="mx-auto grid max-w-5xl gap-4 px-5 pb-16 sm:grid-cols-3">
        {[
          {
            icon: Coins,
            title: "مطابقة تلقائية",
            body: "نربط كل شحنة بالأوردر الصح برقم التتبع أو الرقم المرجعي، وما نسألك غير في الحالات الغامضة.",
          },
          {
            icon: Scale,
            title: "حساب الرسوم",
            body: "من جدول أسعارك بنحسب الصافي المتوقع، فأي خصم زيادة بيبان برقمه.",
          },
          {
            icon: CheckCircle2,
            title: "مصدر واحد للحقيقة",
            body: "أوردراتك من ملف أو من شوبيفاي، وشحناتك من بوسطة، في مكان واحد.",
          },
        ].map((f) => (
          <div key={f.title} className="rounded-2xl border border-border bg-card p-5">
            <f.icon className="mb-3 size-6 text-primary" />
            <h3 className="mb-1.5 font-bold text-card-foreground">{f.title}</h3>
            <p className="text-sm leading-relaxed text-muted-foreground">{f.body}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
