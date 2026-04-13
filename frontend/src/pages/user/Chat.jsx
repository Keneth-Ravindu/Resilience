import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import api from "../../api/client";
import BlockedContentModal from "../../components/BlockedContentModal";
import RewriteAssistBox from "../../components/RewriteAssistBox";

const API_BASE_URL = "http://127.0.0.1:8000";

function resolveMediaUrl(url) {
  if (!url) return null;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return `${API_BASE_URL}${url}`;
}

function getDisplayName(user) {
  if (!user) return "Unknown User";
  return user.display_name || user.name || `User #${user.id}`;
}

function formatMessageTime(dateValue) {
  if (!dateValue) return "";
  return new Date(dateValue).toLocaleString();
}

function ChatAvatar({ user }) {
  if (user?.profile_picture_url) {
    return (
      <img
        src={resolveMediaUrl(user.profile_picture_url)}
        alt={getDisplayName(user)}
        className="feed-avatar feed-avatar-sm"
      />
    );
  }

  return (
    <div className="feed-avatar feed-avatar-sm feed-avatar-fallback">
      {getDisplayName(user).charAt(0).toUpperCase()}
    </div>
  );
}

function ConversationList({
  conversations,
  activeConversationId,
  onSelectConversation,
  loading,
}) {
  return (
    <section className="glass-card">
      <div className="section-head">
        <h3>Chats</h3>
      </div>

      {loading ? (
        <p>Loading conversations...</p>
      ) : conversations.length === 0 ? (
        <p>No conversations yet.</p>
      ) : (
        <div className="simple-list">
          {conversations.map((conversation) => {
            const isActive = activeConversationId === conversation.id;

            return (
              <button
                key={conversation.id}
                type="button"
                className={`simple-list-item conversation-list-item ${
                  isActive ? "conversation-list-item-active" : ""
                }`}
                onClick={() => onSelectConversation(conversation)}
              >
                <div className="conversation-list-item-inner">
                  <ChatAvatar user={conversation.other_user} />
                  <div>
                    <strong>{getDisplayName(conversation.other_user)}</strong>
                    <p className="feed-meta">
                      {conversation.other_user?.role || "user"}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}

function MessageBubble({ message, isOwn }) {
  return (
    <div className={`chat-message-row ${isOwn ? "chat-message-row-own" : ""}`}>
      <div
        className={`chat-message-bubble ${
          isOwn ? "chat-message-bubble-own" : ""
        }`}
      >
        <p>{message.content}</p>
        <span className="feed-meta">{formatMessageTime(message.created_at)}</span>
      </div>
    </div>
  );
}

export default function Chat() {
  const [searchParams] = useSearchParams();
  const threadEndRef = useRef(null);

  const targetUserId = searchParams.get("userId");

  const [currentUserId, setCurrentUserId] = useState(null);

  const [conversations, setConversations] = useState([]);
  const [conversationsLoading, setConversationsLoading] = useState(true);

  const [friends, setFriends] = useState([]);
  const [friendsLoading, setFriendsLoading] = useState(true);

  const [activeConversation, setActiveConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(false);

  const [content, setContent] = useState("");
  const [finalContent, setFinalContent] = useState("");
  const [sending, setSending] = useState(false);

  const [error, setError] = useState("");
  const [sendError, setSendError] = useState("");

  const [moderationResult, setModerationResult] = useState(null);
  const [blockedModalOpen, setBlockedModalOpen] = useState(false);

  async function loadCurrentUser() {
    try {
      const res = await api.get("/users/me");
      setCurrentUserId(res.data?.id || null);
    } catch {
      setCurrentUserId(null);
    }
  }

  async function loadFriends() {
    try {
      setFriendsLoading(true);

      const res = await api.get("/friend-requests/friends");
      setFriends(res.data || []);
    } catch {
      setFriends([]);
    } finally {
      setFriendsLoading(false);
    }
  }

  async function loadConversations(preferredConversationId = null) {
    try {
      setConversationsLoading(true);
      setError("");

      const res = await api.get("/chat/conversations");
      const data = res.data || [];
      setConversations(data);

      if (preferredConversationId) {
        const matched = data.find((item) => item.id === preferredConversationId);
        if (matched) {
          setActiveConversation(matched);
          return;
        }
      }

      setActiveConversation((prev) => {
        if (prev?.id) {
          const existing = data.find((item) => item.id === prev.id);
          if (existing) return existing;
        }

        return data.length > 0 ? data[0] : null;
      });
    } catch (err) {
      const detail = err?.response?.data?.detail;
      setError(
        typeof detail === "string"
          ? detail
          : "Failed to load conversations."
      );
      setConversations([]);
    } finally {
      setConversationsLoading(false);
    }
  }

  async function loadMessages(conversationId) {
    if (!conversationId) return;

    try {
      setMessagesLoading(true);
      setSendError("");

      const res = await api.get(`/chat/conversations/${conversationId}/messages`);
      setMessages(res.data || []);
    } catch (err) {
      const detail = err?.response?.data?.detail;
      setSendError(
        typeof detail === "string" ? detail : "Failed to load messages."
      );
      setMessages([]);
    } finally {
      setMessagesLoading(false);
    }
  }

  async function startConversationWithUser(otherUserId) {
    if (!otherUserId) return;

    try {
      setError("");

      const res = await api.post(`/chat/start/${otherUserId}`);
      const conversation = res.data || null;

      if (!conversation) {
        setError("Could not start chat.");
        return;
      }

      setActiveConversation(conversation);
      await loadConversations(conversation.id);
      await loadMessages(conversation.id);
    } catch (err) {
      const detail = err?.response?.data?.detail;
      setError(
        typeof detail === "string"
          ? detail
          : "Could not start chat. Chat is only allowed with accepted friends or accepted mentor/mentee connections."
      );
    }
  }

  useEffect(() => {
    loadCurrentUser();
    loadConversations();
    loadFriends();
  }, []);

  useEffect(() => {
    if (targetUserId) {
      startConversationWithUser(targetUserId);
    }
  }, [targetUserId]);

  useEffect(() => {
    if (!activeConversation?.id) return;

    loadMessages(activeConversation.id);

    const intervalId = setInterval(() => {
      loadMessages(activeConversation.id);
    }, 4000);

    return () => clearInterval(intervalId);
  }, [activeConversation?.id]);

  useEffect(() => {
    const intervalId = setInterval(() => {
      loadConversations(activeConversation?.id || null);
    }, 5000);

    return () => clearInterval(intervalId);
  }, [activeConversation?.id]);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function handleUseRewrite(rewriteText) {
    if (!rewriteText) return;

    setContent(rewriteText);
    setFinalContent(rewriteText);
    setModerationResult(null);
    setBlockedModalOpen(false);
    setSendError("");
  }

  async function handleSendMessage(e) {
    e.preventDefault();

    if (!activeConversation?.id) {
      setSendError("Select a conversation first.");
      return;
    }

    const contentToSend = (finalContent || content).trim();

    if (!contentToSend) {
      setSendError("Message content is required.");
      return;
    }

    try {
      setSending(true);
      setSendError("");
      setModerationResult(null);

      const res = await api.post(
        `/chat/conversations/${activeConversation.id}/messages`,
        {
          content: contentToSend,
        }
      );

      if (res.data?.blocked) {
        const detail = res.data?.detail || {};

        setModerationResult(detail);
        setBlockedModalOpen(true);
        return;
      }

      setContent("");
      setFinalContent("");
      setModerationResult(null);
      setBlockedModalOpen(false);

      await loadMessages(activeConversation.id);
      await loadConversations(activeConversation.id);
    } catch (err) {
      const detail = err?.response?.data?.detail;
      setSendError(
        typeof detail === "string" ? detail : "Failed to send message."
      );
    } finally {
      setSending(false);
    }
  }

  const activeTitle = useMemo(() => {
    if (!activeConversation?.other_user) return "Chat";
    return getDisplayName(activeConversation.other_user);
  }, [activeConversation]);

  const availableFriendsForNewChat = useMemo(() => {
    const existingConversationUserIds = new Set(
      conversations
        .map((conversation) => conversation.other_user?.id)
        .filter(Boolean)
    );

    return friends.filter((friend) => !existingConversationUserIds.has(friend.id));
  }, [friends, conversations]);

  return (
    <div className="fade-in">
      <div className="dashboard-head">
        <div>
          <h2 className="page-title">Messages</h2>
          <p className="page-subtitle">
            Chat with accepted friends and accepted mentor connections.
          </p>
        </div>
      </div>

      {error ? <p className="error-text">{error}</p> : null}

      <div className="chat-page-grid">
        <aside className="chat-sidebar-column">
          <section className="glass-card">
            <div className="section-head">
              <h3>Start Chat</h3>
            </div>

            {friendsLoading ? (
              <p>Loading friends...</p>
            ) : availableFriendsForNewChat.length === 0 ? (
              <p>No new friends available to start a chat.</p>
            ) : (
              <div className="simple-list">
                {availableFriendsForNewChat.map((friend) => (
                  <button
                    key={friend.id}
                    type="button"
                    className="simple-list-item conversation-list-item"
                    onClick={() => startConversationWithUser(friend.id)}
                  >
                    <div className="conversation-list-item-inner">
                      <ChatAvatar user={friend} />
                      <div>
                        <strong>{getDisplayName(friend)}</strong>
                        <p className="feed-meta">{friend.role || "user"}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>

          <ConversationList
            conversations={conversations}
            activeConversationId={activeConversation?.id}
            onSelectConversation={setActiveConversation}
            loading={conversationsLoading}
          />
        </aside>

        <section className="chat-main-column">
          <section className="glass-card">
            <div className="profile-content-card-head">
              <div>
                <h3 className="profile-content-title">{activeTitle}</h3>
                {activeConversation?.other_user ? (
                  <p className="feed-subtitle">
                    {activeConversation.other_user?.role || "user"}
                  </p>
                ) : (
                  <p className="feed-subtitle">Select a conversation to begin.</p>
                )}
              </div>
            </div>

            {!activeConversation ? (
              <p>No active conversation selected.</p>
            ) : messagesLoading ? (
              <p>Loading messages...</p>
            ) : (
              <div className="chat-thread">
                {messages.length === 0 ? (
                  <p className="feed-meta">No messages yet. Start the conversation.</p>
                ) : (
                  messages.map((message) => (
                    <MessageBubble
                      key={message.id}
                      message={message}
                      isOwn={message.sender_id === currentUserId}
                    />
                  ))
                )}
                <div ref={threadEndRef} />
              </div>
            )}

            {activeConversation ? (
              <form onSubmit={handleSendMessage} className="form-stack chat-composer">
                <div className="field">
                  <label>Original Message</label>
                  <textarea
                    rows="3"
                    placeholder="Write your message..."
                    value={content}
                    onChange={(e) => {
                      setContent(e.target.value);
                      setModerationResult(null);
                      setSendError("");
                    }}
                  />
                </div>

                <RewriteAssistBox
                  text={content}
                  onUseRewrite={handleUseRewrite}
                  label="Chat AI Rewrite"
                  compact
                  autoTrigger={moderationResult?.is_toxic}
                />

                <div className="field">
                  <label>Manual / Final Version</label>
                  <textarea
                    rows="3"
                    placeholder="Use the AI suggestion here or refine your final version..."
                    value={finalContent}
                    onChange={(e) => {
                      setFinalContent(e.target.value);
                      setModerationResult(null);
                      setSendError("");
                    }}
                  />
                </div>

                <div className="quick-actions">
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={sending}
                  >
                    {sending ? "Sending..." : "Send Message"}
                  </button>
                </div>

                {sendError ? <p className="error-text">{sendError}</p> : null}
              </form>
            ) : null}
          </section>
        </section>
      </div>

      <div className="profile-back-link-wrap">
        <Link to="/app/feed" className="feed-author-link">
          Back to Feed
        </Link>
      </div>

      <BlockedContentModal
        open={blockedModalOpen}
        onClose={() => setBlockedModalOpen(false)}
        title="Message Blocked"
        message={moderationResult?.message}
        toxicityLabel={moderationResult?.toxicity_label}
        primaryEmotion={moderationResult?.primary_emotion}
      />
    </div>
  );
}