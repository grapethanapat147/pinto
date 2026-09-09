import { redirect } from "next/navigation";

import { AppShell } from "./components/AppShell";
import { DataUnavailable } from "./components/DataUnavailable";
import { getSession } from "./session";
import {
  listActions,
  listCampaigns,
  listConversations,
  listDashboardMetrics,
  listInventory,
  listOrders,
  listPayouts,
  listRecommendations,
  openActionImpactTotal,
} from "../db/queries";

type DashboardData = Awaited<ReturnType<typeof loadDashboard>>;

/**
 * Loading is kept out of the component body so the failure is a value to branch on
 * rather than a try/catch wrapped around JSX.
 */
async function loadDashboard() {
  try {
    // Reading the session can fail the same way any other query can — a database outage
    // must reach DataUnavailable, not throw past it. `redirect()` signals by throwing, so
    // the anonymous case is returned as a value and acted on outside this try.
    const session = await getSession();
    if (!session) return { state: "anonymous" as const };

    const [orders, inventory, actions, conversations, campaigns, payouts, actionImpactTotal, metrics, recommendations] =
      await Promise.all([
        listOrders(session),
        listInventory(session),
        listActions(session),
        listConversations(session),
        listCampaigns(session),
        listPayouts(session),
        openActionImpactTotal(session),
        listDashboardMetrics(session),
        listRecommendations(session),
      ]);
    return {
      state: "ok" as const,
      signedInAs: session.displayName,
      orders,
      inventory,
      actions,
      conversations,
      campaigns,
      payouts,
      actionImpactTotal,
      metrics,
      recommendations,
    };
  } catch (error) {
    return { state: "error" as const, error: error instanceof Error ? error.message : undefined };
  }
}

/**
 * Server component: reads D1 once per request and hands plain data to the client shell
 * (spec D3). Reading here rather than fetching on mount keeps the dashboard's whole
 * value — open it and see today at a glance — free of a loading flash.
 *
 * A failed read renders `DataUnavailable`. It deliberately does not fall back to the
 * fixtures: showing stale demo numbers as though they were live is the failure PIN-0001
 * removed from the buttons, and it would be worse here.
 */
export default async function Page() {
  const data: DashboardData = await loadDashboard();

  if (data.state === "error") return <DataUnavailable detail={data.error} />;
  if (data.state === "anonymous") redirect("/login");

  return (
    <AppShell
      orders={data.orders}
      inventory={data.inventory}
      actions={data.actions}
      conversations={data.conversations}
      campaigns={data.campaigns}
      payouts={data.payouts}
      actionImpactTotal={data.actionImpactTotal}
      metrics={data.metrics}
      recommendations={data.recommendations}
      signedInAs={data.signedInAs}
    />
  );
}
