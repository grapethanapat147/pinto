import { AppShell } from "./components/AppShell";
import {
  listActions,
  listCampaigns,
  listConversations,
  listInventory,
  listOrders,
  listPayouts,
  openActionImpactTotal,
} from "../db/queries";

/**
 * Server component: reads D1 once per request and hands plain data to the client shell
 * (spec D3). Reading here rather than fetching on mount keeps the dashboard's whole
 * value — open it and see today at a glance — free of a loading flash.
 */
export default async function Page() {
  const [orders, inventory, actions, conversations, campaigns, payouts, actionImpactTotal] =
    await Promise.all([
      listOrders(),
      listInventory(),
      listActions(),
      listConversations(),
      listCampaigns(),
      listPayouts(),
      openActionImpactTotal(),
    ]);

  return (
    <AppShell
      orders={orders}
      inventory={inventory}
      actions={actions}
      conversations={conversations}
      campaigns={campaigns}
      payouts={payouts}
      actionImpactTotal={actionImpactTotal}
    />
  );
}
