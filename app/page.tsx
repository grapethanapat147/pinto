"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  BadgeDollarSign,
  Bell,
  Boxes,
  CalendarDays,
  Check,
  CircleCheck,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Clock3,
  Crown,
  Ellipsis,
  Home as HomeIcon,
  Inbox,
  LayoutGrid,
  Megaphone,
  MessageCircle,
  PackageCheck,
  PackageOpen,
  Plus,
  RefreshCw,
  Repeat2,
  Search,
  Send,
  ShoppingCart,
  Sparkles,
  Store,
  Truck,
  TrendingUp,
  UsersRound,
  WalletCards,
  X,
  type LucideIcon,
} from "lucide-react";

type View = "today" | "actions" | "orders" | "inbox" | "stock" | "customers" | "growth" | "money";
type ActionTone = "danger" | "warning" | "success";

type ShopAction = {
  id: number;
  tone: ActionTone;
  label: string;
  title: string;
  detail: string;
  impact: string;
  channel: string;
  source: string;
  insight: string;
  recommendation: string;
};

type InventoryItem = {
  sku: string;
  name: string;
  category: string;
  stock: number;
  reserved: number;
  daysLeft: number;
  sync: string;
  status: "พร้อมขาย" | "ใกล้หมด" | "หมดสต๊อก";
};

type Conversation = {
  id: number;
  name: string;
  channel: string;
  preview: string;
  time: string;
  unread: number;
  order: string;
  topic: string;
  messages: { from: "customer" | "shop"; text: string; time: string }[];
};

const navItems: { id: View; label: string; icon: LucideIcon }[] = [
  { id: "today", label: "วันนี้", icon: HomeIcon },
  { id: "actions", label: "สิ่งที่ต้องทำ", icon: Sparkles },
  { id: "orders", label: "ออเดอร์", icon: PackageCheck },
  { id: "inbox", label: "ข้อความลูกค้า", icon: Inbox },
  { id: "stock", label: "สินค้าและสต๊อก", icon: Boxes },
  { id: "customers", label: "ลูกค้า", icon: UsersRound },
  { id: "growth", label: "การเติบโต", icon: TrendingUp },
  { id: "money", label: "การเงิน", icon: WalletCards },
];

const actionItems: ShopAction[] = [
  {
    id: 1,
    tone: "danger",
    label: "ควรจัดการวันนี้",
    title: "แคมเปญ TikTok ใช้งบสูงกว่าปกติ",
    detail: "ค่าโฆษณาเพิ่ม 28% แต่ยอดขายลดลงต่อเนื่อง 4 ชั่วโมง",
    impact: "เสี่ยงเสีย ฿3,240",
    channel: "TikTok Ads",
    source: "อัปเดต 10:38 น.",
    insight: "ค่าใช้จ่ายต่อออเดอร์เพิ่มจาก ฿82 เป็น ฿126 ขณะที่ Conversion ลดลง 19%",
    recommendation: "ลดงบแคมเปญ Home Refresh ลง 20% และตรวจ Creative ชุดที่ 3 อีกครั้งใน 2 ชั่วโมง",
  },
  {
    id: 2,
    tone: "warning",
    label: "ตรวจสอบออเดอร์",
    title: "พบ 8 ออเดอร์ยกเลิกผิดปกติ",
    detail: "มาจากลูกค้า 3 รายที่เคยยกเลิกซ้ำในช่วง 30 วันที่ผ่านมา",
    impact: "มูลค่า ฿6,890",
    channel: "TikTok Shop",
    source: "อัปเดต 10:31 น.",
    insight: "ทั้ง 8 ออเดอร์ใช้ที่อยู่จัดส่งซ้ำและเลือกสินค้ามูลค่าสูงกว่าค่าเฉลี่ยร้าน 2.4 เท่า",
    recommendation: "พักการแพ็กออเดอร์ชั่วคราว และให้ทีมโทรยืนยันก่อนส่งสินค้า",
  },
  {
    id: 3,
    tone: "success",
    label: "โอกาสเพิ่มกำไร",
    title: "สินค้าขายดีควรเพิ่มสต๊อก",
    detail: "แจกันเซรามิกสีครีมมีแนวโน้มหมดภายใน 3 วัน",
    impact: "โอกาส ฿12,400",
    channel: "Shopee + TikTok",
    source: "อัปเดต 10:24 น.",
    insight: "ยอดขายเฉลี่ยเพิ่ม 34% หลังคลิปรีวิวล่าสุด และมีสินค้าเหลือเพียง 42 ชิ้น",
    recommendation: "สั่งเพิ่มอย่างน้อย 90 ชิ้น เพื่อรองรับยอดขาย 7 วันข้างหน้า",
  },
  {
    id: 4,
    tone: "warning",
    label: "ตรวจค่าขนส่ง",
    title: "น้ำหนักเรียกเก็บไม่ตรง 4 พัสดุ",
    detail: "น้ำหนักจากขนส่งสูงกว่าน้ำหนักสินค้าในระบบมากกว่า 1 กก.",
    impact: "ขอคืนได้ ฿460",
    channel: "Shopee",
    source: "อัปเดต 09:56 น.",
    insight: "ระบบพบส่วนต่างรวม 5.8 กก. พร้อมรูปน้ำหนักก่อนส่งครบทุกออเดอร์",
    recommendation: "ตรวจหลักฐานที่เตรียมไว้ แล้วส่งคำขอโต้แย้งทั้ง 4 รายการ",
  },
];

const orders = [
  { id: "TT-10842", customer: "พรทิพย์ ส.", channel: "TikTok", total: "฿1,890", status: "รอแพ็ก", time: "10:36" },
  { id: "SP-48219", customer: "Nicha Home", channel: "Shopee", total: "฿780", status: "พร้อมส่ง", time: "10:28" },
  { id: "TT-10841", customer: "ชนิดา ก.", channel: "TikTok", total: "฿2,450", status: "ตรวจสอบ", time: "10:17" },
  { id: "LN-39204", customer: "บ้านใบไม้", channel: "LINE", total: "฿1,120", status: "ชำระแล้ว", time: "09:54" },
  { id: "SP-48218", customer: "Mook M.", channel: "Shopee", total: "฿640", status: "จัดส่งแล้ว", time: "09:41" },
  { id: "TT-10840", customer: "Krit Home", channel: "TikTok", total: "฿3,260", status: "รอแพ็ก", time: "09:33" },
];

const campaigns = [
  { name: "Home Refresh", channel: "TikTok", spend: "฿6,420", revenue: "฿20,180", roas: "3.14", health: "ควรตรวจ" },
  { name: "Ceramic Set", channel: "TikTok", spend: "฿4,280", revenue: "฿19,910", roas: "4.65", health: "ดี" },
  { name: "Shopee Payday", channel: "Shopee", spend: "฿3,960", revenue: "฿15,120", roas: "3.82", health: "ดี" },
  { name: "Retarget 30D", channel: "Meta", spend: "฿2,140", revenue: "฿6,240", roas: "2.92", health: "เฝ้าดู" },
];

const payouts = [
  { platform: "TikTok Shop", date: "26 ส.ค.", orders: "142 ออเดอร์", amount: "฿38,740", status: "กำลังประมวลผล" },
  { platform: "Shopee", date: "27 ส.ค.", orders: "96 ออเดอร์", amount: "฿24,180", status: "ยืนยันแล้ว" },
  { platform: "LINE MyShop", date: "28 ส.ค.", orders: "31 ออเดอร์", amount: "฿10,370", status: "รอยืนยัน" },
];

const inventory: InventoryItem[] = [
  { sku: "ML-CV-018", name: "แจกันเซรามิกสีครีม", category: "Home Living", stock: 42, reserved: 18, daysLeft: 3, sync: "ครบ 3 ช่องทาง", status: "ใกล้หมด" },
  { sku: "ML-CL-006", name: "โคมไฟ Cloud", category: "Lighting", stock: 0, reserved: 7, daysLeft: 0, sync: "TikTok รออัปเดต", status: "หมดสต๊อก" },
  { sku: "ML-AG-024", name: "ชุดแก้ว Amber 4 ใบ", category: "Dining", stock: 86, reserved: 12, daysLeft: 14, sync: "ครบ 3 ช่องทาง", status: "พร้อมขาย" },
  { sku: "ML-LN-012", name: "ผ้าปูโต๊ะ Linen Sand", category: "Dining", stock: 19, reserved: 6, daysLeft: 4, sync: "ครบ 3 ช่องทาง", status: "ใกล้หมด" },
  { sku: "ML-TR-031", name: "ถาดไม้โค้ง Natural", category: "Home Living", stock: 112, reserved: 9, daysLeft: 21, sync: "ครบ 3 ช่องทาง", status: "พร้อมขาย" },
];

const conversations: Conversation[] = [
  { id: 1, name: "คุณปริม", channel: "TikTok", preview: "ถ้าสั่งวันนี้จะส่งทันวันศุกร์ไหมคะ", time: "10:41", unread: 2, order: "TT-10842", topic: "สอบถามการจัดส่ง", messages: [
    { from: "customer", text: "สวัสดีค่ะ สนใจแจกันสีครีม 2 ใบ", time: "10:39" },
    { from: "customer", text: "ถ้าสั่งวันนี้จะส่งทันวันศุกร์ไหมคะ", time: "10:41" },
  ] },
  { id: 2, name: "Nicha Home", channel: "Shopee", preview: "ได้รับสินค้าแล้ว สวยมากค่ะ", time: "10:28", unread: 1, order: "SP-48219", topic: "รีวิวหลังการขาย", messages: [
    { from: "shop", text: "พัสดุถึงแล้วหรือยังคะ หากมีปัญหาแจ้งเราได้เลยนะคะ", time: "เมื่อวาน" },
    { from: "customer", text: "ได้รับสินค้าแล้ว สวยมากค่ะ", time: "10:28" },
  ] },
  { id: 3, name: "ชนิดา ก.", channel: "TikTok", preview: "ขอเปลี่ยนที่อยู่ก่อนส่งได้ไหม", time: "10:17", unread: 3, order: "TT-10841", topic: "แก้ไขออเดอร์", messages: [
    { from: "customer", text: "ขอเปลี่ยนที่อยู่ก่อนส่งได้ไหมคะ พอดีพิมพ์บ้านเลขที่ผิด", time: "10:17" },
  ] },
  { id: 4, name: "บ้านใบไม้", channel: "LINE", preview: "ต้องการใบกำกับภาษีค่ะ", time: "09:54", unread: 1, order: "LN-39204", topic: "เอกสารการเงิน", messages: [
    { from: "customer", text: "รบกวนออกใบกำกับภาษีในนามบริษัทได้ไหมคะ", time: "09:54" },
  ] },
];

const viewTitles: Record<View, { kicker: string; title: string }> = {
  today: { kicker: "หน้าหลัก", title: "ภาพรวมร้าน" },
  actions: { kicker: "Action Center", title: "เรื่องที่รอการตัดสินใจ" },
  orders: { kicker: "284 ออเดอร์วันนี้", title: "ออเดอร์ทุกช่องทาง" },
  inbox: { kicker: "12 ข้อความรอตอบ", title: "กล่องข้อความลูกค้า" },
  stock: { kicker: "สินค้า 186 รายการ", title: "สินค้าและสต๊อก" },
  growth: { kicker: "การตลาดและยอดขาย", title: "เติบโตแบบมีกำไร" },
  customers: { kicker: "ลูกค้า 3,842 คน", title: "เข้าใจและดูแลลูกค้า" },
  money: { kicker: "ข้อมูลการเงินล่าสุด", title: "เงินเข้า เงินออก และกำไรจริง" },
};

function StatusPill({ children, tone = "neutral" }: { children: React.ReactNode; tone?: string }) {
  return <span className={`status-pill ${tone}`}>{children}</span>;
}

function ActionToneIcon({ tone, size = 17 }: { tone: ActionTone; size?: number }) {
  const Icon = tone === "danger" ? AlertTriangle : tone === "warning" ? CircleAlert : TrendingUp;
  return <Icon size={size} strokeWidth={1.9} aria-hidden="true" />;
}

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
      <aside className="sidebar">
        <button className="brand" onClick={() => changeView("today")} aria-label="กลับหน้าวันนี้">
          <span><Store size={19} strokeWidth={2.2} /></span><span className="brand-copy"><strong>pinto</strong><small>Commerce Center</small></span>
        </button>
        <small className="nav-label">เมนูหลัก</small>
        <nav aria-label="เมนูหลัก">
          {navItems.slice(0, 4).map((item) => {
            const Icon = item.icon;
            return (
            <button
              className={`nav-item ${view === item.id ? "active" : ""}`}
              key={item.id}
              onClick={() => changeView(item.id)}
              aria-current={view === item.id ? "page" : undefined}
            >
              <span><Icon size={18} strokeWidth={1.8} /></span><em>{item.label}</em>
              {item.id === "actions" && activeActions.length > 0 && <b>{activeActions.length}</b>}
              {item.id === "inbox" && <b>7</b>}
            </button>
            );
          })}
        </nav>
        <small className="nav-label secondary-label">จัดการร้าน</small>
        <nav aria-label="เมนูจัดการร้าน">
          {navItems.slice(4).map((item) => {
            const Icon = item.icon;
            return (
            <button
              className={`nav-item ${view === item.id ? "active" : ""}`}
              key={item.id}
              onClick={() => changeView(item.id)}
              aria-current={view === item.id ? "page" : undefined}
            >
              <span><Icon size={18} strokeWidth={1.8} /></span><em>{item.label}</em>
            </button>
            );
          })}
        </nav>
        <button className={`mobile-more-button ${mobileMenuOpen ? "active" : ""}`} onClick={() => setMobileMenuOpen((current) => !current)} aria-label="เปิดเมนูเพิ่มเติม" aria-expanded={mobileMenuOpen}>
          <span><LayoutGrid size={21} /></span><em>เพิ่มเติม</em>
        </button>
        <div className="sidebar-lower">
          <div className="upgrade-card"><span><Sparkles size={16} strokeWidth={1.9} /></span><strong>ปลดล็อกข้อมูลเชิงลึก</strong><small>เชื่อมต้นทุนให้ครบ เพื่อเห็นกำไรที่แม่นยำขึ้น</small><button onClick={() => notify("เปิดหน้าตั้งค่าการเชื่อมต่อ")}>จัดการการเชื่อมต่อ</button></div>
          <div className="store-card">
            <div className="store-avatar">ML</div>
            <div><strong>ร้าน Mali Living</strong><small>เชื่อมต่อแล้ว 3 ช่องทาง</small></div>
            <button aria-label="เปิดเมนูร้าน"><Ellipsis size={18} /></button>
          </div>
        </div>
      </aside>

      <section className="content">
        <header className="topbar">
          <div>
            <div className="kicker-row"><p>{viewTitles[view].kicker}</p><StatusPill tone="demo">ข้อมูลจำลอง</StatusPill></div>
            <h1><HomeIcon className="home-mark" size={18} strokeWidth={1.9} />{viewTitles[view].title}</h1>
          </div>
          <div className="top-actions">
            {view === "today" && (
              <div className="period-tabs" aria-label="เลือกช่วงเวลา">
                {["วันนี้", "7 วัน", "30 วัน"].map((item) => (
                  <button key={item} className={period === item ? "active" : ""} onClick={() => { setPeriod(item); notify(`เปลี่ยนมุมมองเป็น ${item}`); }}>{item}</button>
                ))}
              </div>
            )}
            <button className="icon-button notification-button" aria-label="ดูการแจ้งเตือน" onClick={() => changeView("actions")}>
              <Bell size={18} strokeWidth={1.8} />{activeActions.length > 0 && <i />}
            </button>
            <button className="profile" aria-label="เปิดโปรไฟล์">ม</button>
          </div>
        </header>

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

      {mobileMenuOpen && (
        <div className="mobile-more-backdrop" onMouseDown={(event) => { if (event.currentTarget === event.target) setMobileMenuOpen(false); }}>
          <section className="mobile-more-sheet" role="dialog" aria-modal="true" aria-label="เมนูเพิ่มเติม">
            <header><div><p>เมนูเพิ่มเติม</p><strong>จัดการร้านได้ครบจากที่เดียว</strong></div><button onClick={() => setMobileMenuOpen(false)} aria-label="ปิดเมนู"><X size={20} /></button></header>
            <div>{navItems.slice(3).map((item) => {
              const Icon = item.icon;
              return <button key={item.id} className={view === item.id ? "active" : ""} onClick={() => changeView(item.id)}><span><Icon size={21} /></span><div><strong>{item.label}</strong><small>{viewTitles[item.id].kicker}</small></div><ArrowRight size={17} /></button>;
            })}</div>
          </section>
        </div>
      )}
      {selectedAction && <ActionDrawer action={selectedAction} onClose={() => setSelectedAction(null)} onResolve={() => resolveAction(selectedAction)} notify={notify} />}
      {toast && <div className="toast" role="status"><span><Check size={14} strokeWidth={2.4} /></span>{toast}</div>}
    </main>
  );
}

function TodayView({ period, actions, onOpenAction, onViewActions, onNavigate, notify }: { period: string; actions: ShopAction[]; onOpenAction: (action: ShopAction) => void; onViewActions: () => void; onNavigate: (view: View) => void; notify: (message: string) => void }) {
  const periodData: Record<string, { profit: string; sales: string; ads: string; orders: string; change: string }> = {
    "วันนี้": { profit: "฿48,720", sales: "฿126,840", ads: "฿18,460", orders: "284", change: "12.4%" },
    "7 วัน": { profit: "฿286,940", sales: "฿782,560", ads: "฿109,280", orders: "1,842", change: "8.7%" },
    "30 วัน": { profit: "฿1,184,320", sales: "฿3,246,780", ads: "฿456,190", orders: "7,639", change: "16.2%" },
  };
  const data = periodData[period];
  const bars = [42, 76, 58, 88, 64, 82];
  const costs = [28, 44, 38, 52, 35, 46];
  const months = ["มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค."];
  const [selectedDay, setSelectedDay] = useState(25);
  const calendarDays = Array.from({ length: 31 }, (_, index) => index + 1);

  return (
    <>
      <section className="welcome-row">
        <div><h2>ยินดีต้อนรับกลับ คุณมะลิ!</h2><p>ดูสุขภาพร้านและจัดการเรื่องสำคัญได้จากที่เดียว</p></div>
        <button className="primary-button add-cost-button icon-text-button" onClick={() => notify("เปิดหน้าจัดการต้นทุนสินค้า")}><Plus size={17} />เพิ่มข้อมูลต้นทุน</button>
      </section>

      <div className="today-layout">
        <div className="today-main">
          <section className="overview-grid">
            <article className="panel sales-overview-card">
              <div className="sales-card-head">
                <div><p>กำไร{period === "วันนี้" ? "วันนี้" : ` ${period}`}</p><h2>{data.profit} <StatusPill tone="good">↑ {data.change}</StatusPill></h2></div>
                <span>อัปเดตล่าสุด 10:42 น.</span>
              </div>
              <div className="sales-legend"><span><i className="profit-key" />กำไร</span><span><i className="cost-key" />ต้นทุนรวม</span></div>
              <div className="paired-chart" aria-label="กราฟเปรียบเทียบกำไรและต้นทุน 6 เดือน">
                {bars.map((bar, index) => (
                  <div className="paired-chart-group" key={months[index]}>
                    <div><i style={{ height: `${bar}%` }} /><b style={{ height: `${costs[index]}%` }} /></div>
                    <span>{months[index]}</span>
                  </div>
                ))}
              </div>
            </article>

            <div className="snapshot-stack" aria-label="ตัวเลขสำคัญ">
              <article className="snapshot-card"><span className="snapshot-icon"><BadgeDollarSign size={20} /></span><div><p>ยอดขายรวม</p><h3>{data.sales}</h3><small className="up">● 8.2% จากช่วงก่อน</small></div></article>
              <article className="snapshot-card"><span className="snapshot-icon"><PackageCheck size={20} /></span><div><p>ออเดอร์ทั้งหมด</p><h3>{data.orders}</h3><small className="up">● เพิ่มขึ้น 16 รายการ</small></div></article>
              <article className="snapshot-card"><span className="snapshot-icon"><Clock3 size={20} /></span><div><p>เงินรอโอน</p><h3>฿73,290</h3><small className="warning-text">● ภายใน 2–3 วัน</small></div></article>
            </div>
          </section>

          <section className="panel quick-work-panel">
            <div className="panel-heading"><div><p>งานร้านวันนี้</p><h3>ไปต่อได้ทันที ไม่ต้องไล่หาทีละเมนู</h3></div><small className="freshness">อัปเดตอัตโนมัติ</small></div>
            <div className="quick-work-grid">
              <button onClick={() => onNavigate("orders")}><span className="quick-work-icon orange"><PackageOpen size={20} /></span><div><strong>แพ็กออเดอร์</strong><small>47 รายการรอแพ็ก</small></div><ArrowRight size={17} /></button>
              <button onClick={() => onNavigate("inbox")}><span className="quick-work-icon blue"><MessageCircle size={20} /></span><div><strong>ตอบลูกค้า</strong><small>12 ข้อความรอตอบ</small></div><ArrowRight size={17} /></button>
              <button onClick={() => onNavigate("stock")}><span className="quick-work-icon amber"><Boxes size={20} /></span><div><strong>เติมสต๊อก</strong><small>6 รายการใกล้หมด</small></div><ArrowRight size={17} /></button>
              <button onClick={() => onNavigate("growth")}><span className="quick-work-icon green"><Megaphone size={20} /></span><div><strong>ดูแคมเปญ</strong><small>2 รายการควรปรับงบ</small></div><ArrowRight size={17} /></button>
            </div>
          </section>

          <section className="panel compact-action-panel">
            <div className="panel-heading"><div><p>Action Center</p><h3>เรื่องสำคัญที่ควรจัดการ</h3></div><button className="quiet-button icon-text-button" onClick={onViewActions}>ดูทั้งหมด <ArrowRight size={15} /></button></div>
            {actions.length > 0 ? <div className="compact-action-list">{actions.map((action) => (
              <button key={action.id} onClick={() => onOpenAction(action)}>
                <span className={`action-symbol ${action.tone}`}><ActionToneIcon tone={action.tone} /></span>
                <div><strong>{action.title}</strong><small>{action.channel} · {action.detail}</small></div>
                <b>{action.impact}</b><i><ArrowRight size={16} /></i>
              </button>
            ))}</div> : <EmptyState title="จัดการครบแล้ว เก่งมาก!" detail="ตอนนี้ไม่มีเรื่องเร่งด่วนสำหรับร้านของคุณ" />}
          </section>

          <section className="panel channel-panel">
            <div className="panel-heading"><div><p>ช่องทางการขาย</p><h3>แต่ละช่องทางทำกำไรแค่ไหน</h3></div><small className="freshness">ข้อมูลล่าสุด 10:42 น.</small></div>
            <div className="channel-table table-scroll">
              <div className="table-row table-head"><span>ช่องทาง</span><span>ยอดขาย</span><span>ออเดอร์</span><span>กำไร</span><span>อัตรากำไร</span></div>
              <div className="table-row"><span><i className="channel-logo tiktok">T</i>TikTok Shop</span><span>฿68,420</span><span>142</span><strong>฿24,930</strong><StatusPill tone="good">36.4%</StatusPill></div>
              <div className="table-row"><span><i className="channel-logo shopee">S</i>Shopee</span><span>฿42,180</span><span>96</span><strong>฿16,740</strong><StatusPill tone="good">39.7%</StatusPill></div>
              <div className="table-row"><span><i className="channel-logo line">L</i>LINE MyShop</span><span>฿16,240</span><span>46</span><strong>฿7,050</strong><StatusPill tone="good">43.4%</StatusPill></div>
            </div>
          </section>
        </div>

        <aside className="right-rail">
          <section className="panel calendar-panel">
            <div className="calendar-head"><button aria-label="เดือนก่อนหน้า"><ChevronLeft size={19} /></button><strong>สิงหาคม 2569</strong><button aria-label="เดือนถัดไป"><ChevronRight size={19} /></button></div>
            <div className="weekdays">{["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"].map((day) => <span key={day}>{day}</span>)}</div>
            <div className="calendar-grid">
              {calendarDays.map((day) => <button key={day} className={`${selectedDay === day ? "selected" : ""} ${[22, 26, 28].includes(day) ? "has-event" : ""}`} onClick={() => setSelectedDay(day)}>{day}</button>)}
            </div>
            <button className="calendar-cta icon-text-button" onClick={() => notify(`เปิดกำหนดการวันที่ ${selectedDay} สิงหาคม`)}><CalendarDays size={16} />ดูวันที่ {selectedDay} สิงหาคม</button>
          </section>

          <section className="payout-schedule">
            <div className="rail-heading"><h3>เงินที่กำลังจะเข้า</h3><button className="icon-text-button" onClick={() => notify("เปิดกำหนดการรับเงินทั้งหมด")}>ดูทั้งหมด <ArrowRight size={14} /></button></div>
            <article><i className="channel-logo tiktok">T</i><div><strong>TikTok Shop</strong><span>พรุ่งนี้ · 142 ออเดอร์</span></div><b>฿38,740</b></article>
            <article><i className="channel-logo shopee">S</i><div><strong>Shopee</strong><span>27 ส.ค. · 96 ออเดอร์</span></div><b>฿24,180</b></article>
            <article><i className="channel-logo line">L</i><div><strong>LINE MyShop</strong><span>28 ส.ค. · 31 ออเดอร์</span></div><b>฿10,370</b></article>
          </section>
        </aside>
      </div>
    </>
  );
}

function ActionCard({ action, onOpen }: { action: ShopAction; onOpen: () => void }) {
  return (
    <article className={`action-card ${action.tone}`}>
      <div className="action-top"><span>{action.label}</span><small>{action.channel}</small></div>
      <h3>{action.title}</h3>
      <p>{action.detail}</p>
      <footer><strong>{action.impact}</strong><button className="icon-text-button" onClick={onOpen}>ดูรายละเอียด <ArrowRight size={15} /></button></footer>
    </article>
  );
}

function ActionsView({ actions, activeCount, filter, setFilter, onOpenAction }: { actions: ShopAction[]; activeCount: number; filter: string; setFilter: (value: string) => void; onOpenAction: (action: ShopAction) => void }) {
  const filters = ["ทั้งหมด", "ควรจัดการวันนี้", "ตรวจสอบออเดอร์", "โอกาสเพิ่มกำไร"];
  return (
    <>
      <section className="action-hero panel">
        <div><span className="spark dark"><Sparkles size={20} /></span><div><p>สรุปโดย Pinto</p><h2>{activeCount > 0 ? `มี ${activeCount} เรื่องที่ช่วยปกป้องกำไรได้วันนี้` : "วันนี้ไม่มีเรื่องเร่งด่วนแล้ว"}</h2><small>หากจัดการครบ คาดว่าจะรักษาหรือเพิ่มกำไรได้สูงสุด ฿22,990</small></div></div>
        <div className="impact-total"><span>ผลกระทบรวม</span><strong>฿22,990</strong></div>
      </section>
      <div className="toolbar-row">
        <div className="filter-chips">
          {filters.map((item) => <button key={item} className={filter === item ? "active" : ""} onClick={() => setFilter(item)}>{item}</button>)}
        </div>
        <button className="secondary-button">เสร็จสิ้นแล้ว</button>
      </div>
      {actions.length > 0 ? <div className="action-list">{actions.map((action) => (
        <button className={`action-list-item ${action.tone}`} key={action.id} onClick={() => onOpenAction(action)}>
          <i><ActionToneIcon tone={action.tone} size={19} /></i>
          <div><div className="action-list-meta"><StatusPill tone={action.tone}>{action.label}</StatusPill><span>{action.channel}</span><span>{action.source}</span></div><h3>{action.title}</h3><p>{action.detail}</p></div>
          <strong>{action.impact}</strong><span className="row-arrow"><ArrowRight size={17} /></span>
        </button>
      ))}</div> : <EmptyState title="ไม่พบรายการในหมวดนี้" detail="ลองเลือกตัวกรองอื่น หรือกลับมาตรวจอีกครั้งภายหลัง" />}
    </>
  );
}

function OrdersView({ query, setQuery, orders: visibleOrders, notify }: { query: string; setQuery: (value: string) => void; orders: typeof orders; notify: (message: string) => void }) {
  const [orderFilter, setOrderFilter] = useState("ทั้งหมด");
  const orderFilters = ["ทั้งหมด", "รอแพ็ก", "พร้อมส่ง", "ตรวจสอบ", "จัดส่งแล้ว"];
  const filteredOrders = orderFilter === "ทั้งหมด" ? visibleOrders : visibleOrders.filter((order) => order.status === orderFilter);
  return (
    <>
      <section className="order-metrics compact-metrics">
        <article><p>ออเดอร์ใหม่</p><h3>284</h3><small className="up">↑ 6.0% จากเมื่อวาน</small></article>
        <article><p>รอแพ็ก</p><h3>47</h3><small>ควรเสร็จก่อน 14:00 น.</small></article>
        <article><p>ต้องตรวจสอบ</p><h3 className="text-warning">8</h3><small>มีความเสี่ยงผิดปกติ</small></article>
        <article><p>จัดส่งสำเร็จ</p><h3>229</h3><small className="up">อัตราสำเร็จ 97.2%</small></article>
      </section>
      <section className="panel data-panel">
        <div className="data-toolbar">
          <div className="search-box"><span><Search size={18} /></span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ค้นหาออเดอร์หรือลูกค้า" aria-label="ค้นหาออเดอร์" /></div>
          <div><button className="secondary-button icon-text-button" onClick={() => notify("เตรียมใบปะหน้า 47 รายการแล้ว")}><Truck size={16} />พิมพ์ใบปะหน้า</button><button className="primary-button icon-text-button" onClick={() => notify("นำเข้าข้อมูลตัวอย่างเรียบร้อย")}><Plus size={16} />เพิ่มออเดอร์</button></div>
        </div>
        <div className="order-filter-row" aria-label="กรองสถานะออเดอร์">{orderFilters.map((item) => <button key={item} className={orderFilter === item ? "active" : ""} onClick={() => setOrderFilter(item)}>{item}</button>)}</div>
        <div className="orders-table table-scroll">
          <div className="order-row order-head"><span>ออเดอร์</span><span>ลูกค้า</span><span>ช่องทาง</span><span>ยอดรวม</span><span>สถานะ</span><span>เวลา</span></div>
          {filteredOrders.map((order) => (
            <button className="order-row" key={order.id} onClick={() => notify(`เปิดออเดอร์ ${order.id}`)}>
              <strong>{order.id}</strong><span>{order.customer}</span><span><i className={`channel-logo ${order.channel.toLowerCase()}`}>{order.channel[0]}</i>{order.channel}</span><strong>{order.total}</strong><StatusPill tone={order.status === "ตรวจสอบ" ? "danger" : order.status === "จัดส่งแล้ว" ? "good" : "neutral"}>{order.status}</StatusPill><span>{order.time}</span>
            </button>
          ))}
        </div>
        {filteredOrders.length === 0 && <EmptyState title="ไม่พบออเดอร์" detail="ลองเปลี่ยนคำค้นหาหรือเลือกสถานะอื่น" />}
      </section>
    </>
  );
}

function StockView({ notify }: { notify: (message: string) => void }) {
  const [stockFilter, setStockFilter] = useState("ทั้งหมด");
  const stockFilters = ["ทั้งหมด", "ใกล้หมด", "หมดสต๊อก", "พร้อมขาย"];
  const visibleInventory = stockFilter === "ทั้งหมด" ? inventory : inventory.filter((item) => item.status === stockFilter);

  return (
    <>
      <section className="compact-metrics stock-metrics">
        <article><p>สินค้าพร้อมขาย</p><h3>178</h3><small className="up">95.7% ของสินค้าทั้งหมด</small></article>
        <article><p>สินค้าใกล้หมด</p><h3 className="text-warning">6</h3><small>ควรสั่งเพิ่มภายในวันนี้</small></article>
        <article><p>สินค้าหมดสต๊อก</p><h3 className="text-warning">2</h3><small>กระทบยอดขาย 3 ช่องทาง</small></article>
        <article><p>มูลค่าสต๊อก</p><h3>฿386,420</h3><small className="up">หมุนเวียนเฉลี่ย 18 วัน</small></article>
      </section>

      <section className="stock-layout">
        <article className="panel data-panel stock-panel">
          <div className="panel-heading stock-heading"><div><p>สต๊อกทุกช่องทาง</p><h3>รู้จำนวนจริงก่อนรับออเดอร์เพิ่ม</h3></div><button className="primary-button icon-text-button" onClick={() => notify("สร้างรายการสั่งซื้อสินค้าไว้แล้ว")}><ShoppingCart size={16} />สร้างใบสั่งซื้อ</button></div>
          <div className="order-filter-row" aria-label="กรองสถานะสต๊อก">{stockFilters.map((item) => <button key={item} className={stockFilter === item ? "active" : ""} onClick={() => setStockFilter(item)}>{item}</button>)}</div>
          <div className="stock-table table-scroll">
            <div className="stock-row stock-head"><span>สินค้า</span><span>คงเหลือ</span><span>จองแล้ว</span><span>ขายได้อีก</span><span>ซิงก์ช่องทาง</span><span>สถานะ</span></div>
            {visibleInventory.map((item) => (
              <button className="stock-row" key={item.sku} onClick={() => notify(`เปิดรายละเอียด ${item.name}`)}>
                <span><strong>{item.name}</strong><small>{item.sku} · {item.category}</small></span>
                <strong>{item.stock}</strong><span>{item.reserved}</span><span>{item.daysLeft > 0 ? `${item.daysLeft} วัน` : "—"}</span><span>{item.sync}</span>
                <StatusPill tone={item.status === "พร้อมขาย" ? "good" : item.status === "ใกล้หมด" ? "warning" : "danger"}>{item.status}</StatusPill>
              </button>
            ))}
          </div>
        </article>

        <aside className="panel stock-insight">
          <span className="spark dark"><Sparkles size={20} /></span><p>Pinto แนะนำ</p><h3>สั่งเพิ่ม 3 รายการก่อนเที่ยงวันนี้</h3><p>หากสั่งตามยอดแนะนำ ร้านจะมีสินค้าเพียงพอสำหรับยอดขายประมาณ 14 วัน โดยใช้เงินเพิ่มไม่เกิน ฿24,600</p>
          <div className="restock-list">
            <div><span>แจกันเซรามิกสีครีม</span><strong>+90 ชิ้น</strong></div>
            <div><span>โคมไฟ Cloud</span><strong>+45 ชิ้น</strong></div>
            <div><span>ผ้าปูโต๊ะ Linen Sand</span><strong>+60 ชิ้น</strong></div>
          </div>
          <button className="primary-button wide" onClick={() => notify("เพิ่มสินค้าทั้ง 3 รายการในใบสั่งซื้อแล้ว")}>เพิ่มทั้งหมดในใบสั่งซื้อ</button>
        </aside>
      </section>

      <section className="channel-sync-grid" aria-label="สถานะการเชื่อมต่อสต๊อก">
        <article><i className="channel-logo tiktok">T</i><div><strong>TikTok Shop</strong><span>ซิงก์ล่าสุด 1 นาทีที่แล้ว</span></div><StatusPill tone="good">ปกติ</StatusPill></article>
        <article><i className="channel-logo shopee">S</i><div><strong>Shopee</strong><span>ซิงก์ล่าสุด 2 นาทีที่แล้ว</span></div><StatusPill tone="good">ปกติ</StatusPill></article>
        <article><i className="channel-logo line">L</i><div><strong>LINE MyShop</strong><span>ซิงก์ล่าสุด 4 นาทีที่แล้ว</span></div><StatusPill tone="good">ปกติ</StatusPill></article>
      </section>
    </>
  );
}

function InboxView({ notify }: { notify: (message: string) => void }) {
  const [channelFilter, setChannelFilter] = useState("ทั้งหมด");
  const [selectedConversationId, setSelectedConversationId] = useState(conversations[0].id);
  const [replyText, setReplyText] = useState("");
  const [sentReplies, setSentReplies] = useState<{ conversationId: number; text: string; time: string }[]>([]);
  const channelFilters = ["ทั้งหมด", "TikTok", "Shopee", "LINE"];
  const filteredConversations = channelFilter === "ทั้งหมด" ? conversations : conversations.filter((item) => item.channel === channelFilter);
  const selectedConversation = conversations.find((item) => item.id === selectedConversationId) ?? filteredConversations[0] ?? conversations[0];

  function changeChannelFilter(nextFilter: string) {
    setChannelFilter(nextFilter);
    const nextConversation = nextFilter === "ทั้งหมด" ? conversations[0] : conversations.find((item) => item.channel === nextFilter);
    if (nextConversation) setSelectedConversationId(nextConversation.id);
  }

  function sendReply() {
    const message = replyText.trim();
    if (!message) {
      notify("พิมพ์ข้อความก่อนส่งตอบลูกค้า");
      return;
    }
    setSentReplies((current) => [...current, { conversationId: selectedConversation.id, text: message, time: "ตอนนี้" }]);
    setReplyText("");
    notify(`ส่งข้อความถึง ${selectedConversation.name} แล้ว`);
  }

  return (
    <>
      <section className="compact-metrics inbox-metrics">
        <article><p>ข้อความวันนี้</p><h3>36</h3><small className="up">ครบทุกช่องทาง</small></article>
        <article><p>รอตอบ</p><h3 className="text-warning">12</h3><small>3 ข้อความเกี่ยวกับออเดอร์</small></article>
        <article><p>เวลาตอบเฉลี่ย</p><h3>4 นาที</h3><small className="up">เร็วขึ้น 38%</small></article>
        <article><p>ปิดการขายจากแชต</p><h3>฿18,420</h3><small className="up">21 ออเดอร์วันนี้</small></article>
      </section>

      <section className="panel inbox-shell">
        <aside className="conversation-sidebar">
          <header><div><p>กล่องข้อความรวม</p><h3>ลูกค้าที่รอคุณอยู่</h3></div><button onClick={() => notify("อัปเดตข้อความล่าสุดแล้ว")} aria-label="อัปเดตข้อความ"><RefreshCw size={17} /></button></header>
          <div className="inbox-channel-filter">{channelFilters.map((item) => <button key={item} className={channelFilter === item ? "active" : ""} onClick={() => changeChannelFilter(item)}>{item}</button>)}</div>
          <div className="conversation-list">{filteredConversations.map((conversation) => (
            <button key={conversation.id} className={selectedConversation.id === conversation.id ? "active" : ""} onClick={() => setSelectedConversationId(conversation.id)}>
              <span className={`channel-logo ${conversation.channel.toLowerCase()}`}>{conversation.channel[0]}</span>
              <div><strong>{conversation.name}</strong><small>{conversation.preview}</small><em>{conversation.topic}</em></div>
              <span className="conversation-meta"><small>{conversation.time}</small>{conversation.unread > 0 && <b>{conversation.unread}</b>}</span>
            </button>
          ))}</div>
        </aside>

        <article className="conversation-detail">
          <header><div><span className={`channel-logo ${selectedConversation.channel.toLowerCase()}`}>{selectedConversation.channel[0]}</span><div><h3>{selectedConversation.name}</h3><p>{selectedConversation.channel} · ตอบกลับเร็ว</p></div></div><button className="secondary-button" onClick={() => notify(`เปิดออเดอร์ ${selectedConversation.order}`)}>{selectedConversation.order}</button></header>
          <div className="conversation-context"><span><ShoppingCart size={16} />{selectedConversation.topic}</span><span><CircleCheck size={16} />ลูกค้าเดิม · 3 ออเดอร์</span></div>
          <div className="message-thread">
            <div className="message-date">วันนี้</div>
            {selectedConversation.messages.map((message, index) => <div className={`message-bubble ${message.from}`} key={`${selectedConversation.id}-${index}`}><p>{message.text}</p><span>{message.time}</span></div>)}
            {sentReplies.filter((message) => message.conversationId === selectedConversation.id).map((message, index) => <div className="message-bubble shop" key={`reply-${selectedConversation.id}-${index}`}><p>{message.text}</p><span>{message.time}</span></div>)}
          </div>
          <div className="smart-replies"><span><Sparkles size={15} />คำตอบแนะนำ</span><div><button onClick={() => setReplyText("ได้เลยค่ะ ทางร้านจัดส่งวันนี้ คาดว่าจะถึงภายในวันศุกร์นะคะ")}>แจ้งวันจัดส่ง</button><button onClick={() => setReplyText("ได้ค่ะ เดี๋ยวทางร้านตรวจสอบและแก้ไขให้ก่อนจัดส่งนะคะ")}>ยืนยันการแก้ไข</button></div></div>
          <form className="reply-box" onSubmit={(event) => { event.preventDefault(); sendReply(); }}><input value={replyText} onChange={(event) => setReplyText(event.target.value)} placeholder="พิมพ์ข้อความตอบลูกค้า…" aria-label="ข้อความตอบลูกค้า" /><button type="submit" aria-label="ส่งข้อความ"><Send size={18} /></button></form>
        </article>
      </section>
    </>
  );
}

function GrowthView({ notify }: { notify: (message: string) => void }) {
  return (
    <>
      <section className="compact-metrics growth-metrics">
        <article><p>ยอดขายจากโฆษณา</p><h3>฿61,450</h3><small className="up">↑ 11.6%</small></article>
        <article><p>ค่าโฆษณา</p><h3>฿18,460</h3><small className="down">↑ 4.1%</small></article>
        <article><p>ROAS รวม</p><h3>3.84</h3><small className="up">สูงกว่าเป้า 0.34</small></article>
        <article><p>กำไรจาก Ads</p><h3>฿21,720</h3><small className="up">Margin 35.3%</small></article>
      </section>
      <section className="growth-layout">
        <article className="panel data-panel campaign-panel">
          <div className="panel-heading"><div><p>แคมเปญโฆษณา</p><h3>ผลลัพธ์ตามกำไร ไม่ใช่แค่ยอดขาย</h3></div><button className="secondary-button icon-text-button" onClick={() => notify("อัปเดตข้อมูลแคมเปญแล้ว")}><RefreshCw size={15} />อัปเดต</button></div>
          <div className="campaign-table table-scroll">
            <div className="campaign-row campaign-head"><span>แคมเปญ</span><span>ใช้ไป</span><span>ยอดขาย</span><span>ROAS</span><span>สุขภาพ</span></div>
            {campaigns.map((campaign) => <button className="campaign-row" key={campaign.name} onClick={() => notify(`เลือกแคมเปญ ${campaign.name}`)}><span><strong>{campaign.name}</strong><small>{campaign.channel}</small></span><span>{campaign.spend}</span><span>{campaign.revenue}</span><strong>{campaign.roas}</strong><StatusPill tone={campaign.health === "ดี" ? "good" : campaign.health === "ควรตรวจ" ? "danger" : "warning"}>{campaign.health}</StatusPill></button>)}
          </div>
        </article>
        <aside className="panel ai-panel">
          <span className="spark dark"><Sparkles size={20} /></span><p>Pinto แนะนำ</p><h3>โยกงบ ฿1,200 ไปที่ Ceramic Set</h3><p>แคมเปญนี้สร้างกำไรต่อบาทสูงกว่า Home Refresh 41% ในช่วง 3 วันที่ผ่านมา</p><div className="estimate-box"><span>กำไรที่อาจเพิ่ม</span><strong>+ ฿2,080 / วัน</strong></div><button className="primary-button wide" onClick={() => notify("บันทึกคำแนะนำไว้แล้ว")}>ดูแผนการปรับงบ</button><button className="quiet-button wide">ไว้ทีหลัง</button>
        </aside>
      </section>
      <section className="panel product-panel">
        <div className="panel-heading"><div><p>สินค้าที่กำลังมาแรง</p><h3>โอกาสเติบโตในสัปดาห์นี้</h3></div><button className="quiet-button icon-text-button">ดูสินค้าทั้งหมด <ArrowRight size={15} /></button></div>
        <div className="product-grid"><Product name="แจกันเซรามิกสีครีม" metric="ขายเพิ่ม 34%" profit="กำไร ฿8,420" color="cream" /><Product name="ชุดแก้ว Amber 4 ใบ" metric="ขายเพิ่ม 21%" profit="กำไร ฿6,190" color="amber" /><Product name="โคมไฟ Cloud" metric="ขายเพิ่ม 18%" profit="กำไร ฿4,870" color="blue" /></div>
      </section>
    </>
  );
}

function Product({ name, metric, profit, color }: { name: string; metric: string; profit: string; color: string }) {
  return <article className="product-item"><div className={`product-visual ${color}`}><i /></div><div><h4>{name}</h4><span className="up">↑ {metric}</span><small>{profit}</small></div></article>;
}

function CustomersView({ notify }: { notify: (message: string) => void }) {
  return (
    <>
      <section className="customer-segments">
        <article className="segment-card best"><div><span><Crown size={19} /></span><p>ลูกค้าคนสำคัญ</p></div><h3>286 คน</h3><small>สร้าง 42% ของรายได้ทั้งหมด</small><button className="icon-text-button" onClick={() => notify("เปิดรายชื่อลูกค้าคนสำคัญ")}>ดูรายชื่อ <ArrowRight size={15} /></button></article>
        <article className="segment-card repeat"><div><span><Repeat2 size={19} /></span><p>ลูกค้าซื้อซ้ำ</p></div><h3>1,148 คน</h3><small>อัตราซื้อซ้ำ 29.8%</small><button className="icon-text-button" onClick={() => notify("เปิดกลุ่มลูกค้าซื้อซ้ำ")}>ดูรายชื่อ <ArrowRight size={15} /></button></article>
        <article className="segment-card sleeping"><div><span><Clock3 size={19} /></span><p>กำลังจะหายไป</p></div><h3>194 คน</h3><small>ไม่ได้ซื้อสินค้านานกว่า 60 วัน</small><button className="icon-text-button" onClick={() => notify("เปิดกลุ่มลูกค้าที่ควรดูแล")}>ดูแลกลุ่มนี้ <ArrowRight size={15} /></button></article>
      </section>
      <section className="customer-layout">
        <article className="panel region-panel">
          <div className="panel-heading"><div><p>พื้นที่ยอดนิยม</p><h3>ลูกค้าของคุณอยู่ที่ไหน</h3></div><button className="quiet-button">ดูทั้งหมด</button></div>
          <div className="region-list"><Region name="กรุงเทพมหานคร" value="32%" width={100} /><Region name="ชลบุรี" value="12%" width={38} /><Region name="เชียงใหม่" value="9%" width={28} /><Region name="นครราชสีมา" value="7%" width={22} /><Region name="ขอนแก่น" value="6%" width={19} /></div>
        </article>
        <article className="panel customer-insight">
          <span className="spark dark"><Sparkles size={20} /></span><p>โอกาสดูแลลูกค้า</p><h3>ลูกค้า 82 คนพร้อมกลับมาซื้อซ้ำ</h3><p>กลุ่มนี้เคยซื้อ Home Living มากกว่า 2 ครั้ง และมีแนวโน้มตอบรับคูปองส่งฟรีสูง</p><div className="customer-value"><span>มูลค่าที่คาดการณ์</span><strong>฿46,700</strong></div><button className="primary-button wide" onClick={() => notify("สร้างกลุ่มลูกค้าไว้แล้ว")}>สร้างกลุ่มลูกค้า</button>
        </article>
      </section>
    </>
  );
}

function Region({ name, value, width }: { name: string; value: string; width: number }) {
  return <div><span>{name}</span><div><i style={{ width: `${width}%` }} /></div><strong>{value}</strong></div>;
}

function MoneyView({ notify }: { notify: (message: string) => void }) {
  return (
    <>
      <section className="money-hero">
        <article><p>กำไรโดยประมาณวันนี้</p><h2>฿48,720</h2><StatusPill tone="good">↑ 12.4%</StatusPill><small>รวมข้อมูลครบ 98.6%</small></article>
        <article><p>เงินพร้อมถอน</p><h2>฿24,680</h2><button className="primary-button" onClick={() => notify("นี่เป็นตัวอย่าง จึงยังไม่มีการถอนเงินจริง")}>ดูรายละเอียด</button></article>
        <article><p>เงินรอโอน</p><h2>฿73,290</h2><div className="mini-payout"><span>TikTok 53%</span><span>Shopee 33%</span><span>LINE 14%</span></div></article>
      </section>
      <section className="money-layout">
        <article className="panel waterfall-panel">
          <div className="panel-heading"><div><p>เส้นทางกำไรวันนี้</p><h3>ทุกบาทหายไปไหนบ้าง</h3></div><StatusPill tone="verified">ข้อมูล 98.6%</StatusPill></div>
          <div className="waterfall">
            <div className="waterfall-column"><i className="wf-sales" /><strong>฿126.8k</strong><span>ยอดขาย</span></div>
            <div className="waterfall-column"><i className="wf-cost" /><strong>−฿42.7k</strong><span>ต้นทุน</span></div>
            <div className="waterfall-column"><i className="wf-ads" /><strong>−฿18.5k</strong><span>โฆษณา</span></div>
            <div className="waterfall-column"><i className="wf-fees" /><strong>−฿17.0k</strong><span>ค่าธรรมเนียม</span></div>
            <div className="waterfall-column"><i className="wf-profit" /><strong>฿48.7k</strong><span>กำไร</span></div>
          </div>
        </article>
        <article className="panel money-note"><span className="spark dark"><Check size={20} /></span><p>ตรวจสอบข้อมูลแล้ว</p><h3>ตัวเลขใกล้ครบทั้งหมด</h3><p>มีเพียง 4 ออเดอร์ที่รอค่าขนส่งจริง ระบบจะปรับกำไรให้อัตโนมัติเมื่อข้อมูลเข้ามา</p><button className="quiet-button wide icon-text-button" onClick={() => notify("เปิดรายการที่รอตรวจสอบ")}>ดู 4 รายการ <ArrowRight size={15} /></button></article>
      </section>
      <section className="panel payout-panel">
        <div className="panel-heading"><div><p>กำหนดการรับเงิน</p><h3>เงินที่แพลตฟอร์มกำลังจะโอน</h3></div><button className="secondary-button">ดาวน์โหลดรายงาน</button></div>
        <div className="payout-table table-scroll">
          <div className="payout-row payout-head"><span>แพลตฟอร์ม</span><span>วันที่คาดว่าจะเข้า</span><span>รายการ</span><span>สถานะ</span><span>ยอดสุทธิ</span></div>
          {payouts.map((payout) => <div className="payout-row" key={payout.platform}><strong>{payout.platform}</strong><span>{payout.date}</span><span>{payout.orders}</span><StatusPill tone={payout.status === "ยืนยันแล้ว" ? "good" : "neutral"}>{payout.status}</StatusPill><strong>{payout.amount}</strong></div>)}
        </div>
      </section>
    </>
  );
}

function ActionDrawer({ action, onClose, onResolve, notify }: { action: ShopAction; onClose: () => void; onResolve: () => void; notify: (message: string) => void }) {
  return (
    <div className="drawer-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}>
      <aside className="action-drawer" role="dialog" aria-modal="true" aria-label={action.title}>
        <header><div><StatusPill tone={action.tone}>{action.label}</StatusPill><span>{action.source}</span></div><button onClick={onClose} aria-label="ปิดรายละเอียด"><X size={20} /></button></header>
        <div className={`drawer-icon ${action.tone}`}><ActionToneIcon tone={action.tone} size={23} /></div>
        <h2>{action.title}</h2><p className="drawer-detail">{action.detail}</p>
        <div className="impact-box"><span>ผลกระทบที่ประเมิน</span><strong>{action.impact}</strong><small>{action.channel}</small></div>
        <section><p className="drawer-label">สิ่งที่ Pinto พบ</p><p>{action.insight}</p></section>
        <section className="recommendation-box"><p className="drawer-label"><Sparkles size={16} />คำแนะนำ</p><p>{action.recommendation}</p></section>
        <div className="confidence"><span>ความมั่นใจของคำแนะนำ</span><div><i /></div><strong>92%</strong></div>
        <footer><button className="primary-button wide" onClick={onResolve}>อนุมัติและทำเครื่องหมายว่าเสร็จ</button><button className="secondary-button wide" onClick={() => { onClose(); notify("เก็บรายการไว้จัดการภายหลัง"); }}>ไว้ทีหลัง</button><small>ตัวอย่างนี้จะไม่เปลี่ยนแปลงข้อมูลบนแพลตฟอร์มจริง</small></footer>
      </aside>
    </div>
  );
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return <div className="empty-state"><span><Check size={20} /></span><h3>{title}</h3><p>{detail}</p></div>;
}
