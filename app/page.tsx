import { AppShell } from "./components/AppShell";
import { listInventory, listOrders } from "../db/queries";

/**
 * Server component: reads D1 once per request and hands plain data to the client shell
 * (spec D3). Reading here rather than fetching on mount keeps the dashboard's whole
 * value — open it and see today at a glance — free of a loading flash.
 */
export default async function Page() {
  const [orders, inventory] = await Promise.all([listOrders(), listInventory()]);
  return <AppShell orders={orders} inventory={inventory} />;
}
