"use client";

import { useMemo, useRef, useState } from "react";
import { Check, Info } from "lucide-react";

import { formatBaht } from "../format";

import { ActionDrawer } from "./ActionDrawer";
import { ActionsView } from "./ActionsView";
import { AppSidebar } from "./AppSidebar";
import { AppTopbar } from "./AppTopbar";
import { CustomersView } from "./CustomersView";
import { GrowthView } from "./GrowthView";
import { InboxView } from "./InboxView";
import { MobileMoreSheet } from "./MobileMoreSheet";
import { MoneyView } from "./MoneyView";
import { OrdersView } from "./OrdersView";
import { StockView } from "./StockView";
import { TodayView } from "./TodayView";
import type {
  Campaign, ChannelSyncRow, Conversation, DashboardMetrics, InventoryItem, Order, Payout,
  RecommendationPanel, ShopAction, ToastTone, View,
} from "../types";

export function AppShell({
  orders,
  inventory,
  actions: actionItems,
  conversations,
  campaigns,
  payouts,
  actionImpactTotal,
  metrics,
  recommendations,
  signedInAs,
  shopName,
  role,
  channelSync,
}: {
  orders: Order[];
  inventory: InventoryItem[];
  actions: ShopAction[];
  conversations: Conversation[];
  campaigns: Campaign[];
  payouts: Payout[];
  actionImpactTotal: string;
  metrics: DashboardMetrics;
  recommendations: Record<string, RecommendationPanel>;
  signedInAs: string;
  shopName: string;
  role: "owner" | "staff";
  channelSync: ChannelSyncRow[];
}) {
  const [view, setView] = useState<View>("today");
  // belt and braces: the finance data is already absent for staff, but do not route there either
  const canSeeFinance = role === "owner";
  const [period, setPeriod] = useState("วันนี้");
  const [selectedAction, setSelectedAction] = useState<ShopAction | null>(null);
  const [resolvedIds, setResolvedIds] = useState<number[]>([]);
  const [toast, setToast] = useState<{ message: string; tone: ToastTone } | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);
  const [query, setQuery] = useState("");
  const [actionFilter, setActionFilter] = useState("ทั้งหมด");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const activeActions = actionItems.filter((item) => !resolvedIds.includes(item.id));
  // spec Q3: a live sum, not the literal ฿22,990 it used to be
  const impactTotal = activeActions.some((a) => a.impactSatang !== undefined)
    ? formatBaht(activeActions.reduce((sum, a) => sum + (a.impactSatang ?? 0), 0))
    : actionImpactTotal;
  const visibleActions = actionFilter === "ทั้งหมด"
    ? activeActions
    : activeActions.filter((item) => item.label === actionFilter);
  const visibleOrders = useMemo(() => orders.filter((order) => {
    const value = query.trim().toLowerCase();
    return !value || `${order.id} ${order.customer} ${order.channel}`.toLowerCase().includes(value);
  }), [orders, query]);

  function notify(message: string, tone: ToastTone = "success") {
    setToast({ message, tone });
    window.clearTimeout(toastTimer.current);
    // demo notices carry more to read than a short success confirmation
    toastTimer.current = window.setTimeout(() => setToast(null), tone === "demo" ? 3600 : 2400);
  }

  async function resolveAction(action: ShopAction) {
    // spec D4: persist first, and only claim success once the backend confirms it
    try {
      const response = await fetch(`/api/actions/${action.id}/resolve`, { method: "POST" });
      if (!response.ok) {
        notify("บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง", "demo");
        return;
      }
    } catch {
      notify("เชื่อมต่อไม่ได้ จึงยังไม่ได้บันทึก", "demo");
      return;
    }
    setResolvedIds((current) => [...current, action.id]);
    setSelectedAction(null);
    notify("บันทึกแล้ว — ย้ายรายการไปที่เสร็จสิ้น");
  }

  function changeView(nextView: View) {
    setView(nextView);
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <main className="app-shell">
      <AppSidebar
        view={view}
        activeCount={activeActions.length}
        mobileMenuOpen={mobileMenuOpen}
        signedInAs={signedInAs}
        shopName={shopName}
        canSeeFinance={canSeeFinance}
        onChangeView={changeView}
        onToggleMobileMenu={() => setMobileMenuOpen((current) => !current)}
        notify={notify}
      />

      <section className="content">
        <AppTopbar
          view={view}
          period={period}
          activeCount={activeActions.length}
          onChangePeriod={setPeriod}
          onOpenActions={() => changeView("actions")}
          notify={notify}
        />

        <div className="page-body">
          {view === "today" && <TodayView period={period} signedInAs={signedInAs} actions={activeActions.slice(0, 3)} metrics={metrics} payouts={payouts} canSeeFinance={canSeeFinance} onOpenAction={setSelectedAction} onViewActions={() => changeView("actions")} onNavigate={changeView} notify={notify} />}
          {view === "actions" && (
            <ActionsView
              actions={visibleActions}
              activeCount={activeActions.length}
              filter={actionFilter}
              setFilter={setActionFilter}
              onOpenAction={setSelectedAction}
              impactTotal={impactTotal}
              notify={notify}
            />
          )}
          {view === "orders" && <OrdersView query={query} setQuery={setQuery} orders={visibleOrders} tiles={metrics.tiles.orders ?? []} notify={notify} />}
          {view === "inbox" && <InboxView conversations={conversations} tiles={metrics.tiles.inbox ?? []} notify={notify} />}
          {view === "stock" && <StockView inventory={inventory} metrics={metrics} channelSync={channelSync} recommendation={recommendations.stock} notify={notify} />}
          {view === "growth" && <GrowthView campaigns={campaigns} metrics={metrics} recommendation={recommendations.growth} notify={notify} />}
          {view === "customers" && <CustomersView metrics={metrics} recommendation={recommendations.customers} notify={notify} />}
          {view === "money" && canSeeFinance && <MoneyView payouts={payouts} metrics={metrics} notify={notify} />}
        </div>
      </section>

      {mobileMenuOpen && <MobileMoreSheet view={view} canSeeFinance={canSeeFinance} onChangeView={changeView} onClose={() => setMobileMenuOpen(false)} />}
      {selectedAction && <ActionDrawer action={selectedAction} onClose={() => setSelectedAction(null)} onResolve={() => { void resolveAction(selectedAction); }} notify={notify} />}
      {toast && (
        <div className={`toast ${toast.tone}`} role="status">
          <span>{toast.tone === "demo" ? <Info size={13} strokeWidth={2.6} /> : <Check size={14} strokeWidth={2.4} />}</span>
          {toast.message}
        </div>
      )}
    </main>
  );
}
