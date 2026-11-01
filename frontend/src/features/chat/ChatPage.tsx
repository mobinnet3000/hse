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
import { MessageSquare, Users, Send, Plus, Hash, User, X } from "lucide-react";

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
    <div className="card" dir="rtl" style={{ height: "760px", display: "flex", flexDirection: "column", padding: "1.5rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem", borderBottom: "1px solid var(--border-default)", paddingBottom: "1rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.85rem" }}>
          <div style={{ width: "42px", height: "42px", borderRadius: "12px", background: "var(--primary-subtle)", color: "var(--primary)", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid var(--primary-border)" }}>
            <MessageSquare size={22} />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 800 }}>پیام‌رسان و ارتباطات داخلی HSE</h2>
            <p style={{ margin: 0, color: "var(--text-tertiary)", fontSize: "0.825rem", marginTop: "2px" }}>
              هماهنگی سریع تیم‌های عملیاتی، اخطاریه‌های فوری ایمنی و کانال‌های تخصصی کارگاه
            </p>
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreateModal(true)} style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
          <Plus size={16} /> ایجاد گفت‌وگوی جدید
        </button>
      </div>

      {error && (
        <div className="alert alert-danger" style={{ marginBottom: "1rem" }}>
          {error}
        </div>
      )}

      {/* Main Chat Splitter */}
      <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: "1.25rem", flex: 1, minHeight: 0 }}>
        {/* Conversations Sidebar */}
        <div style={{ borderLeft: "1px solid var(--border-default)", overflowY: "auto", paddingLeft: "0.75rem", display: "flex", flexDirection: "column" }}>
          <h4 style={{ margin: "0 0 0.75rem", fontSize: "0.85rem", fontWeight: 700, color: "var(--text-secondary)" }}>
            کانال‌ها و گفت‌وگوهای فعال
          </h4>
          {loading ? (
            <div style={{ padding: "2rem", color: "var(--text-tertiary)", textAlign: "center" }}>در حال بارگذاری...</div>
          ) : conversations.length === 0 ? (
            <div style={{ padding: "2rem", color: "var(--text-tertiary)", textAlign: "center" }}>گفت‌وگویی یافت نشد.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem" }}>
              {conversations.map((c) => {
                const isSelected = activeConv?.id === c.id;
                return (
                  <div
                    key={c.id}
                    onClick={() => selectConversation(c)}
                    style={{
                      padding: "0.75rem 0.85rem",
                      borderRadius: "10px",
                      cursor: "pointer",
                      background: isSelected ? "var(--primary-subtle)" : "var(--bg-subtle)",
                      border: isSelected ? "1px solid var(--primary-border)" : "1px solid var(--border-default)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      transition: "all var(--transition-fast)",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "0.65rem", overflow: "hidden" }}>
                      <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: isSelected ? "var(--primary)" : "var(--bg-muted)", color: isSelected ? "var(--primary-fg)" : "var(--text-secondary)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        {c.conversation_type === "direct" ? <User size={16} /> : <Hash size={16} />}
                      </div>
                      <div style={{ overflow: "hidden" }}>
                        <div style={{ fontWeight: isSelected ? 800 : 600, fontSize: "0.875rem", color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {c.title}
                        </div>
                        <small style={{ color: "var(--text-tertiary)", fontSize: "0.725rem" }}>
                          {c.conversation_type_display || c.conversation_type}
                        </small>
                      </div>
                    </div>
                    {c.unread_count ? (
                      <span className="badge badge-danger" style={{ fontSize: "0.7rem", padding: "0.1rem 0.45rem" }}>
                        {c.unread_count}
                      </span>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Message Thread */}
        <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
          {activeConv ? (
            <>
              {/* Thread Header */}
              <div style={{ padding: "0.75rem 1rem", background: "var(--bg-subtle)", borderRadius: "12px", border: "1px solid var(--border-default)", marginBottom: "0.75rem", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.65rem" }}>
                  <Users size={18} color="var(--primary)" />
                  <span style={{ fontWeight: 800, fontSize: "0.95rem", color: "var(--text-primary)" }}>{activeConv.title}</span>
                  <span style={{ fontSize: "0.75rem", color: "var(--text-tertiary)" }}>({activeConv.conversation_type_display || activeConv.conversation_type})</span>
                </div>
                <span className="badge badge-success">آنلاین</span>
              </div>

              {/* Messages Scroll Area */}
              <div style={{ flex: 1, overflowY: "auto", padding: "0.5rem 0.25rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {messages.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "4rem 1rem", color: "var(--text-tertiary)" }}>
                    هنوز پیامی در این گفت‌وگو ارسال نشده است. اولین پیام را ارسال کنید.
                  </div>
                ) : (
                  messages.map((m) => {
                    const isSys = m.is_system;
                    return (
                      <div
                        key={m.id}
                        style={{
                          padding: "0.85rem 1.15rem",
                          borderRadius: "14px",
                          maxWidth: "75%",
                          background: isSys ? "var(--warning-subtle)" : "var(--bg-surface)",
                          border: isSys ? "1px solid var(--warning-border)" : "1px solid var(--border-default)",
                          boxShadow: "var(--shadow-2xs)",
                          alignSelf: "flex-start",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1.25rem", marginBottom: "0.35rem" }}>
                          <span style={{ fontWeight: 800, fontSize: "0.825rem", color: isSys ? "var(--warning-fg)" : "var(--primary)" }}>
                            {m.sender_name || (isSys ? "اعلان سیستمی HSE" : "همکار")}
                          </span>
                          <span style={{ fontSize: "0.725rem", color: "var(--text-tertiary)" }}>
                            {new Date(m.created_at).toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                        <div style={{ fontSize: "0.9rem", lineHeight: "1.6", color: "var(--text-primary)" }}>
                          {m.content}
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <form onSubmit={handleSendMessage} style={{ display: "flex", gap: "0.65rem", marginTop: "0.75rem", paddingTop: "0.75rem", borderTop: "1px solid var(--border-default)" }}>
                <input
                  type="text"
                  className="form-input"
                  placeholder="پیام خود را به تیم ارسال کنید..."
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  style={{ flex: 1, borderRadius: "12px" }}
                  required
                />
                <button type="submit" className="btn btn-primary" style={{ display: "flex", alignItems: "center", gap: "0.4rem", borderRadius: "12px", padding: "0 1.5rem" }}>
                  <Send size={16} /> ارسال
                </button>
              </form>
            </>
          ) : (
            <div style={{ textAlign: "center", padding: "6rem 1rem", color: "var(--text-tertiary)" }}>
              یک گفت‌وگو را از ستون سمت راست انتخاب کنید.
            </div>
          )}
        </div>
      </div>

      {/* Modal: New Conversation */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-container" style={{ maxWidth: "480px" }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">ایجاد گفت‌وگو یا کارگروه جدید</h3>
              <button type="button" className="modal-close-btn" onClick={() => setShowCreateModal(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreateConversation}>
              <div className="form-group">
                <label className="form-label">عنوان گفت‌وگو / نام کارگروه</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="مثلاً: کمیته بررسی شبه‌حوادث، تیم ایمنی شیفت شب"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">نوع کانال</label>
                <select className="form-select" value={newType} onChange={(e: any) => setNewType(e.target.value)}>
                  <option value="group">گروه تیمی / کارگروه تخصصی (Group)</option>
                  <option value="channel">کانال عمومی اطلاع‌رسانی و اعلام وضعیت اضطراری (Broadcast Channel)</option>
                  <option value="direct">گفت‌وگوی دونفره مستقیم (Direct)</option>
                </select>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>
                  انصراف
                </button>
                <button type="submit" className="btn btn-primary">
                  ایجاد کارگروه
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
