"use client";

import { useState } from "react";
import { CircleCheck, RefreshCw, Send, ShoppingCart, Sparkles } from "lucide-react";

import { EmptyState } from "./EmptyState";
import type { Conversation, MetricTile, Notify } from "../types";

export function InboxView({ conversations, tiles, notify }: { conversations: Conversation[]; tiles: MetricTile[]; notify: Notify }) {
  const [channelFilter, setChannelFilter] = useState("ทั้งหมด");
  // `conversations[0]` was safe while this was a module constant; it comes from a query now
  const [selectedConversationId, setSelectedConversationId] = useState<number | null>(conversations[0]?.id ?? null);
  const [replyText, setReplyText] = useState("");
  const [sentReplies, setSentReplies] = useState<{ conversationId: number; text: string; time: string }[]>([]);
  const channelFilters = ["ทั้งหมด", "TikTok", "Shopee", "LINE"];
  const filteredConversations = channelFilter === "ทั้งหมด" ? conversations : conversations.filter((item) => item.channel === channelFilter);
  const selectedConversation =
    conversations.find((item) => item.id === selectedConversationId) ?? filteredConversations[0] ?? conversations[0] ?? null;

  function changeChannelFilter(nextFilter: string) {
    setChannelFilter(nextFilter);
    const nextConversation = nextFilter === "ทั้งหมด" ? conversations[0] : conversations.find((item) => item.channel === nextFilter);
    if (nextConversation) setSelectedConversationId(nextConversation.id);
  }

  async function sendReply() {
    if (!selectedConversation) return;
    const message = replyText.trim();
    if (!message) {
      notify("พิมพ์ข้อความก่อนส่งตอบลูกค้า");
      return;
    }
    // spec D4: the message is stored before the UI says anything happened
    try {
      const response = await fetch(`/api/conversations/${selectedConversation.id}/messages`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ body: message }),
      });
      if (!response.ok) {
        notify("ส่งไม่สำเร็จ ข้อความยังไม่ถูกบันทึก", "demo");
        return;
      }
    } catch {
      notify("เชื่อมต่อไม่ได้ ข้อความยังไม่ถูกบันทึก", "demo");
      return;
    }
    setSentReplies((current) => [...current, { conversationId: selectedConversation.id, text: message, time: "ตอนนี้" }]);
    setReplyText("");
    notify(`บันทึกข้อความถึง ${selectedConversation.name} แล้ว`);
  }

  if (!selectedConversation) {
    return <EmptyState title="ยังไม่มีข้อความลูกค้า" detail="เมื่อเชื่อมต่อช่องทางแชตแล้ว ข้อความจะแสดงที่นี่" />;
  }

  return (
    <>
      <section className="compact-metrics inbox-metrics">
        {tiles.map((tile) => (
          <article key={tile.key}><p>{tile.label}</p><h3 className={tile.trend === "warning" ? "text-warning" : undefined}>{tile.value}</h3><small className={tile.trend === "up" ? "up" : tile.trend === "down" ? "down" : undefined}>{tile.note}</small></article>
        ))}
      </section>

      <section className="panel inbox-shell">
        <aside className="conversation-sidebar">
          <header><div><p>กล่องข้อความรวม</p><h3>ลูกค้าที่รอคุณอยู่</h3></div><button onClick={() => notify("ตัวอย่าง — ยังไม่ได้เชื่อมต่อช่องทางแชต จึงไม่มีข้อความใหม่", "demo")} aria-label="อัปเดตข้อความ"><RefreshCw size={17} /></button></header>
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
          <header><div><span className={`channel-logo ${selectedConversation.channel.toLowerCase()}`}>{selectedConversation.channel[0]}</span><div><h3>{selectedConversation.name}</h3><p>{selectedConversation.channel} · ตอบกลับเร็ว</p></div></div><button className="secondary-button" onClick={() => notify(`ตัวอย่าง — หน้ารายละเอียดออเดอร์ ${selectedConversation.order} ยังไม่เปิดใช้งาน`, "demo")}>{selectedConversation.order}</button></header>
          <div className="conversation-context"><span><ShoppingCart size={16} />{selectedConversation.topic}</span><span><CircleCheck size={16} />ลูกค้าเดิม · 3 ออเดอร์</span></div>
          <div className="message-thread">
            <div className="message-date">วันนี้</div>
            {selectedConversation.messages.map((message, index) => <div className={`message-bubble ${message.from}`} key={`${selectedConversation.id}-${index}`}><p>{message.text}</p><span>{message.time}</span></div>)}
            {sentReplies.filter((message) => message.conversationId === selectedConversation.id).map((message, index) => <div className="message-bubble shop" key={`reply-${selectedConversation.id}-${index}`}><p>{message.text}</p><span>{message.time}</span></div>)}
          </div>
          <div className="smart-replies"><span><Sparkles size={15} />คำตอบแนะนำ</span><div><button onClick={() => setReplyText("ได้เลยค่ะ ทางร้านจัดส่งวันนี้ คาดว่าจะถึงภายในวันศุกร์นะคะ")}>แจ้งวันจัดส่ง</button><button onClick={() => setReplyText("ได้ค่ะ เดี๋ยวทางร้านตรวจสอบและแก้ไขให้ก่อนจัดส่งนะคะ")}>ยืนยันการแก้ไข</button></div></div>
          <form className="reply-box" onSubmit={(event) => { event.preventDefault(); void sendReply(); }}><input value={replyText} onChange={(event) => setReplyText(event.target.value)} placeholder="พิมพ์ข้อความตอบลูกค้า…" aria-label="ข้อความตอบลูกค้า" /><button type="submit" aria-label="ส่งข้อความ"><Send size={18} /></button></form>
        </article>
      </section>
    </>
  );
}
