import { useEffect, useRef, useState } from "react";
import {
  createChatConversation,
  fetchChatConversations,
  fetchChatMessages,
  markChatConversationRead,
  sendChatMessage,
  type ChatConversationItem,
  type ChatMessageItem,
} from "../../services/api";
import { MessageSquare, Users, Send, Plus, Hash, User } from "lucide-react";

export function ChatPage() {
  const [conversations, setConversations] = useState<ChatConversationItem[]>([]);
  const [activeConv, setActiveConv] = useState<ChatConversationItem | null>(null);
  const [messages, setMessages] = useState<ChatMessageItem[]>([]);
  const [messageText, setMessageText] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // New Conversation Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newType, setNewType] = useState<"direct" | "group" | "channel">("group");

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const loadConversations = () => {
    fetchChatConversations()
      .then((convs) => {
        setConversations(convs);
        setLoading(false);
        if (!activeConv && convs.length > 0) {
          selectConversation(convs[0]);
        }
      })
      .catch((err) => {
        setError(err.message || "خطا در دریافت گفت‌وگوها");
        setLoading(false);
      });
  };

  const loadMessages = (convId: number) => {
    fetchChatMessages(convId)
      .then((msgs) => {
        setMessages(msgs);
        markChatConversationRead(convId).catch(() => {});
      })
      .catch((err) => {
        setError(err.message || "خطا در دریافت پیام‌ها");
      });
  };

  const selectConversation = (conv: ChatConversationItem) => {
    setActiveConv(conv);
    loadMessages(conv.id);
  };

  useEffect(() => {
    loadConversations();
  }, []);

  // Polling sync every 5 seconds for new messages in active conversation
  useEffect(() => {
    if (!activeConv) return;
    const interval = setInterval(() => {
      loadMessages(activeConv.id);
    }, 5000);
    return () => clearInterval(interval);
  }, [activeConv?.id]);

  useEffect(() => {
    if (typeof messagesEndRef.current?.scrollIntoView === "function") {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeConv || !messageText.trim()) return;
    try {
      const sent = await sendChatMessage(activeConv.id, { content: messageText.trim() });
      setMessages((prev) => [...prev, sent]);
      setMessageText("");
    } catch (err: any) {
      setError(err.message || "خطا در ارسال پیام");
    }
  };

  const handleCreateConversation = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const created = await createChatConversation({
        organization: 1,
        title: newTitle,
        conversation_type: newType,
      });
      setShowCreateModal(false);
      setNewTitle("");
      loadConversations();
      selectConversation(created);
    } catch (err: any) {
      setError(err.message || "خطا در ساخت گفت‌وگو");
    }
  };

  return (
    <div className="card" dir="rtl" style={{ height: "750px", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", borderBottom: "1px solid #e2e8f0", paddingBottom: "0.75rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <MessageSquare size={26} color="#2563eb" />
          <div>
            <h2 style={{ margin: 0, fontSize: "1.4rem" }}>پیام‌رسان و ارتباطات داخلی HSE</h2>
            <p style={{ margin: 0, color: "#64748b", fontSize: "0.85rem" }}>
              هماهنگی سریع تیم‌های عملیاتی، اخطاریه‌های فوری هواشناسی و کانال‌های تخصصی ایمنی
            </p>
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreateModal(true)} style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
          <Plus size={16} /> ایجاد گفت‌وگوی جدید
        </button>
      </div>

      {error && (
        <div style={{ padding: "0.5rem 0.75rem", background: "#fee2e2", color: "#b91c1c", borderRadius: "6px", marginBottom: "0.75rem" }}>
          {error}
        </div>
      )}

      {/* Main Chat Splitter */}
      <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: "1rem", flex: 1, minHeight: 0 }}>
        {/* Conversations Sidebar */}
        <div style={{ borderLeft: "1px solid #e2e8f0", overflowY: "auto", paddingLeft: "0.5rem" }}>
          <h4 style={{ margin: "0 0 0.5rem", fontSize: "0.9rem", color: "#475569" }}>گفت‌وگوها و کانال‌ها</h4>
          {loading ? (
            <div style={{ padding: "1rem", color: "#64748b", textAlign: "center" }}>در حال بارگذاری...</div>
          ) : conversations.length === 0 ? (
            <div style={{ padding: "1rem", color: "#64748b", textAlign: "center" }}>گفت‌وگویی یافت نشد.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
              {conversations.map((c) => (
                <div
                  key={c.id}
                  onClick={() => selectConversation(c)}
                  style={{
                    padding: "0.6rem 0.75rem",
                    borderRadius: "6px",
                    cursor: "pointer",
                    background: activeConv?.id === c.id ? "#eff6ff" : "#f8fafc",
                    border: activeConv?.id === c.id ? "1px solid #93c5fd" : "1px solid transparent",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    {c.conversation_type === "direct" ? <User size={16} color="#64748b" /> : <Hash size={16} color="#2563eb" />}
                    <div>
                      <div style={{ fontWeight: activeConv?.id === c.id ? "bold" : "normal", fontSize: "0.9rem" }}>{c.title}</div>
                      <small style={{ color: "#94a3b8" }}>{c.conversation_type_display || c.conversation_type}</small>
                    </div>
                  </div>
                  {c.unread_count ? (
                    <span style={{ background: "#dc2626", color: "#ffffff", borderRadius: "10px", padding: "0.1rem 0.4rem", fontSize: "0.75rem", fontWeight: "bold" }}>
                      {c.unread_count}
                    </span>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Message Thread */}
        <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
          {activeConv ? (
            <>
              {/* Header */}
              <div style={{ padding: "0.5rem 0.75rem", background: "#f8fafc", borderRadius: "6px", borderBottom: "1px solid #e2e8f0", marginBottom: "0.5rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <Users size={18} color="#2563eb" />
                <span style={{ fontWeight: "bold" }}>{activeConv.title}</span>
                <span style={{ fontSize: "0.8rem", color: "#64748b" }}>({activeConv.conversation_type_display || activeConv.conversation_type})</span>
              </div>

              {/* Messages Scroll Area */}
              <div style={{ flex: 1, overflowY: "auto", padding: "0.5rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {messages.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "3rem", color: "#94a3b8" }}>هنوز پیامی در این گفت‌وگو ارسال نشده است.</div>
                ) : (
                  messages.map((m) => (
                    <div
                      key={m.id}
                      style={{
                        padding: "0.75rem 1rem",
                        borderRadius: "8px",
                        maxWidth: "75%",
                        background: m.is_system ? "#fef3c7" : "#f1f5f9",
                        border: m.is_system ? "1px solid #fde68a" : "1px solid #e2e8f0",
                        alignSelf: "flex-start",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", marginBottom: "0.25rem" }}>
                        <span style={{ fontWeight: "bold", fontSize: "0.85rem", color: m.is_system ? "#92400e" : "#1e40af" }}>
                          {m.sender_name || (m.is_system ? "پیام سیستمی" : "کاربر")}
                        </span>
                        <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>{new Date(m.created_at).toLocaleTimeString("fa-IR")}</span>
                      </div>
                      <div style={{ fontSize: "0.95rem", lineHeight: "1.5" }}>{m.content}</div>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <form onSubmit={handleSendMessage} style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
                <input
                  type="text"
                  className="form-input"
                  placeholder="پیام خود را تایپ کنید..."
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  style={{ flex: 1 }}
                  required
                />
                <button type="submit" className="btn btn-primary" style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
                  <Send size={16} /> ارسال
                </button>
              </form>
            </>
          ) : (
            <div style={{ textAlign: "center", padding: "5rem", color: "#94a3b8" }}>یک گفت‌وگو را از ستون کناری انتخاب کنید.</div>
          )}
        </div>
      </div>

      {/* Modal: New Conversation */}
      {showCreateModal && (
        <div className="modal-overlay" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
          <div className="card" style={{ maxWidth: "450px", width: "90%" }}>
            <h3 style={{ margin: "0 0 1rem" }}>ایجاد گفت‌وگو یا کارگروه جدید</h3>
            <form onSubmit={handleCreateConversation}>
              <div style={{ marginBottom: "1rem" }}>
                <label className="form-label">عنوان گفت‌وگو / نام کارگروه</label>
                <input type="text" className="form-input" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} required />
              </div>
              <div style={{ marginBottom: "1.5rem" }}>
                <label className="form-label">نوع کانال</label>
                <select className="form-input" value={newType} onChange={(e: any) => setNewType(e.target.value)}>
                  <option value="group">گروه تیمی / کارگروه تخصصی (Group)</option>
                  <option value="channel">کانال عمومی اطلاع‌رسانی و اعلام وضعیت اضطراری (Broadcast Channel)</option>
                  <option value="direct">گفت‌وگوی دونفره مستقیم (Direct)</option>
                </select>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>انصراف</button>
                <button type="submit" className="btn btn-primary">ایجاد</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
