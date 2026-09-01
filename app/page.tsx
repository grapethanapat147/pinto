"use client";

import { useMemo, useState } from "react";
import { Check } from "lucide-react";

import { ActionDrawer } from "./components/ActionDrawer";
import { ActionsView } from "./components/ActionsView";
import { AppSidebar } from "./components/AppSidebar";
import { AppTopbar } from "./components/AppTopbar";
import { CustomersView } from "./components/CustomersView";
import { GrowthView } from "./components/GrowthView";
import { InboxView } from "./components/InboxView";
import { MobileMoreSheet } from "./components/MobileMoreSheet";
import { MoneyView } from "./components/MoneyView";
import { OrdersView } from "./components/OrdersView";
import { StockView } from "./components/StockView";
import { TodayView } from "./components/TodayView";
import { actionItems } from "./fixtures/actions";
import { orders } from "./fixtures/orders";
import type { ShopAction, View } from "./types";

export default function Home() {
  const [view, setView] = useState<View>("today");
  const [period, setPeriod] = useState("วันนี้");
  const [selectedAction, setSelectedAction] = useState<ShopAction | null>(null);
  const [resolvedIds, setResolvedIds] = useState<number[]>([]);
  const [toast, setToast] = useState("");
  const [query, setQuery] = useState("");
  const [actionFilter, setActionFilter] = useState("ทั้งหมด");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const activeActions = actionItems.filter((item) => !resolvedIds.includes(item.id));
  const visibleActions = actionFilter === "ทั้งหมด"
    ? activeActions
    : activeActions.filter((item) => item.label === actionFilter);
  const visibleOrders = useMemo(() => orders.filter((order) => {
    const value = query.trim().toLowerCase();
    return !value || `${order.id} ${order.customer} ${order.channel}`.toLowerCase().includes(value);
  }), [query]);

  function notify(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2400);
  }

  function resolveAction(action: ShopAction) {
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
          {view === "today" && <TodayView period={period} actions={activeActions.slice(0, 3)} onOpenAction={setSelectedAction} onViewActions={() => changeView("actions")} onNavigate={changeView} notify={notify} />}
          {view === "actions" && (
            <ActionsView
              actions={visibleActions}
              activeCount={activeActions.length}
              filter={actionFilter}
              setFilter={setActionFilter}
              onOpenAction={setSelectedAction}
            />
          )}
          {view === "orders" && <OrdersView query={query} setQuery={setQuery} orders={visibleOrders} notify={notify} />}
          {view === "inbox" && <InboxView notify={notify} />}
          {view === "stock" && <StockView notify={notify} />}
          {view === "growth" && <GrowthView notify={notify} />}
          {view === "customers" && <CustomersView notify={notify} />}
          {view === "money" && <MoneyView notify={notify} />}
        </div>
      </section>

      {mobileMenuOpen && <MobileMoreSheet view={view} onChangeView={changeView} onClose={() => setMobileMenuOpen(false)} />}
      {selectedAction && <ActionDrawer action={selectedAction} onClose={() => setSelectedAction(null)} onResolve={() => resolveAction(selectedAction)} notify={notify} />}
      {toast && <div className="toast" role="status"><span><Check size={14} strokeWidth={2.4} /></span>{toast}</div>}
    </main>
  );
}
