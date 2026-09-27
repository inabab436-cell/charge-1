import { STATUS_LABEL, type OrderStatus } from "@/lib/reconcile";

const STYLE: Record<OrderStatus, string> = {
  paid_ok: "bg-emerald-100 text-emerald-800",
  paid_short: "bg-red-100 text-red-800",
  paid_over: "bg-amber-100 text-amber-900",
  awaiting_payout: "bg-sky-100 text-sky-800",
  in_transit: "bg-slate-100 text-slate-700",
  returned: "bg-orange-100 text-orange-800",
  unmatched: "bg-fuchsia-100 text-fuchsia-800",
};

export function StatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${STYLE[status]}`}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}
