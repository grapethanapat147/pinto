"use client";

import { useState } from "react";
import { CircleCheck, RefreshCw, Send, ShoppingCart, Sparkles } from "lucide-react";

import { conversations } from "../fixtures/conversations";
import type { Notify } from "../types";

export function InboxView({ notify }: { notify: Notify }) {
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
