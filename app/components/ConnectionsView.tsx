"use client";

import { Cable, Link2Off, RefreshCw } from "lucide-react";

import { StatusPill } from "./StatusPill";
import type { ChannelConnection, Notify } from "../types";

const KIND_LABEL: Record<ChannelConnection["kind"], string> = {
  marketplace: "ช่องทางขาย",
  chat: "แชทลูกค้า",
  ads: "โฆษณา",
};

/**
 * Which control a channel gets, from the state the database actually holds. There is no
 * "connecting" case because nothing here starts a connection yet — `connectable` is false for
 * every channel until a provider has credentials (PIN-0025).
 */
function action(connection: ChannelConnection) {
  if (connection.state === "disconnected") {
    return { label: "เชื่อมต่อ", icon: Cable };
  }
  if (connection.state === "degraded") {
    return { label: "เชื่อมต่อใหม่", icon: RefreshCw };
  }
  return { label: "ยกเลิกการเชื่อมต่อ", icon: Link2Off };
}

/**
 * The connections screen (PIN-0025). See `.codex/specs/channel-connections.md`.
 *
 * Every button here is **disabled with its reason**, because no marketplace provider has
 * credentials yet. That is the PIN-0014 login-page pattern rather than a placeholder: when
 * `providerStatus()` starts returning configured, the buttons come alive and this file does
 * not change.
 */
export function ConnectionsView({
  connections,
  notify,
}: {
  connections: ChannelConnection[];
  notify: Notify;
}) {
  const groups: ChannelConnection["kind"][] = ["marketplace", "chat", "ads"];

  return (
    <>
      <section className="welcome-row">
        <div>
          <h2>เชื่อมต่อช่องทางขาย</h2>
          <p>ต่อร้านของคุณเข้ากับแต่ละแพลตฟอร์ม เพื่อให้ออเดอร์ สต๊อก และข้อความไหลเข้ามาที่เดียว</p>
        </div>
      </section>

      {groups.map((kind) => {
        const inGroup = connections.filter((connection) => connection.kind === kind);
        if (inGroup.length === 0) return null;

        return (
          <section className="panel connection-panel" key={kind} aria-label={KIND_LABEL[kind]}>
            <div className="panel-heading">
              <div>
                <p>{KIND_LABEL[kind]}</p>
                <h3>{inGroup.length} ช่องทาง</h3>
              </div>
            </div>

            <div className="connection-list">
              {inGroup.map((connection) => {
                const { label, icon: Icon } = action(connection);
                return (
                  <article className="connection-row" key={connection.code}>
                    <i className={`channel-logo ${connection.accent}`} aria-hidden="true">
                      {connection.displayName[0]}
                    </i>

                    <div className="connection-copy">
                      <strong>{connection.displayName}</strong>
                      <small>
                        {connection.detail ||
                          (connection.lastSyncedAt
                            ? `ซิงก์ล่าสุด ${connection.lastSyncedAt}`
                            : "ยังไม่เคยซิงก์")}
                      </small>
                    </div>

                    <StatusPill tone={connection.tone}>{connection.label}</StatusPill>

                    <div className="connection-action">
                      <button
                        className="secondary-button icon-text-button"
                        disabled={!connection.connectable}
                        aria-disabled={!connection.connectable}
                        onClick={() =>
                          notify(`ตัวอย่าง — ${connection.displayName} ยังเชื่อมต่อจริงไม่ได้`, "demo")
                        }
                      >
                        <Icon size={17} strokeWidth={1.9} />
                        {label}
                      </button>
                      {!connection.connectable && (
                        <small className="connection-blocked">{connection.blockedReason}</small>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        );
      })}
    </>
  );
}
