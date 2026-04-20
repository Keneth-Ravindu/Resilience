import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import api from "../api/client";
import logo from "../assets/logo.png";

const API_BASE_URL = "http://127.0.0.1:8000";

function resolveMediaUrl(url) {
  if (!url) return null;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return `${API_BASE_URL}${url}`;
}

function getDisplayName(user) {
  if (!user) return "User";
  return user.display_name || user.name || `User #${user.id}`;
}

function getNotificationText(notification) {
  const actorName =
    notification.triggered_by_user?.display_name ||
    notification.triggered_by_user?.name ||
    `User ${notification.triggered_by_user_id}`;

  if (notification.type === "message") {
    return `${actorName} sent you a message`;
  }

  if (notification.type === "like") {
    return `${actorName} liked your post`;
  }

  if (notification.type === "comment") {
    return `${actorName} commented on your post`;
  }

  if (notification.type === "workout") {
    return `${actorName} shared a workout`;
  }

  return `${actorName} interacted with your content`;
}

function formatNotificationTime(dateValue) {
  if (!dateValue) return "";
  return new Date(dateValue).toLocaleString();
}

export default function Navbar() {
  const { role, logout } = useAuth();
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [friendStates, setFriendStates] = useState({});
  const [actionLoadingId, setActionLoadingId] = useState(null);

  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notificationLoading, setNotificationLoading] = useState(false);

  const searchBoxRef = useRef(null);
  const notificationBoxRef = useRef(null);
  const debounceRef = useRef(null);
  const notificationSocketRef = useRef(null);

  async function loadNotifications() {
    try {
      setNotificationLoading(true);
      const res = await api.get("/notifications");
      setNotifications(res.data || []);
    } catch {
      setNotifications([]);
    } finally {
      setNotificationLoading(false);
    }
  }

  async function markAllNotificationsAsRead() {
    try {
      await api.post("/notifications/read-all");
      setNotifications((prev) => prev.map((item) => ({ ...item, is_read: true })));
    } catch (err) {
      console.error("Failed to mark all notifications as read", err);
    }
  }

  async function handleNotificationClick(notification) {
    try {
      await api.post(`/notifications/read/${notification.id}`);

      setNotifications((prev) =>
        prev.map((item) =>
          item.id === notification.id ? { ...item, is_read: true } : item
        )
      );

      setShowNotifications(false);

      if (notification.type === "message") {
        navigate(`/app/chat?userId=${notification.triggered_by_user_id}`);
        return;
      }

      if (notification.type === "comment" || notification.type === "like") {
        navigate(`/app/post/${notification.reference_id}`);
        return;
      }

      if (notification.type === "workout") {
        navigate("/app/feed");
      }
    } catch (err) {
      console.error("Notification click failed", err);
    }
  }

  useEffect(() => {
    let isMounted = true;

    api
      .get("/users/me")
      .then((res) => {
        if (isMounted) setUser(res.data);
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    loadNotifications();
  }, []);

  useEffect(() => {
    if (!user?.id) return;

    const ws = new WebSocket(`ws://127.0.0.1:8000/ws/notifications/${user.id}`);
    notificationSocketRef.current = ws;

    ws.onopen = () => {
      console.log("Notification WebSocket connected");
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        setNotifications((prev) => {
          const alreadyExists = prev.some((item) => item.id === data.id);
          if (alreadyExists) return prev;
          return [data, ...prev];
        });
      } catch (err) {
        console.error("Failed to parse notification payload", err);
      }
    };

    ws.onerror = (err) => {
      console.error("Notification WebSocket error", err);
    };

    ws.onclose = () => {
      console.log("Notification WebSocket disconnected");
      notificationSocketRef.current = null;
    };

    const heartbeat = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send("ping");
      }
    }, 20000);

    return () => {
      clearInterval(heartbeat);
      if (notificationSocketRef.current) {
        notificationSocketRef.current.close();
        notificationSocketRef.current = null;
      }
    };
  }, [user?.id]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (searchBoxRef.current && !searchBoxRef.current.contains(event.target)) {
        setShowDropdown(false);
      }

      if (
        notificationBoxRef.current &&
        !notificationBoxRef.current.contains(event.target)
      ) {
        setShowNotifications(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    const trimmed = query.trim();

    if (!trimmed) {
      setResults([]);
      setSearching(false);
      return;
    }

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      setSearching(true);

      api
        .get(`/users/search?q=${encodeURIComponent(trimmed)}`)
        .then(async (res) => {
          const filtered = (res.data || []).filter((item) => item.id !== user?.id);
          setResults(filtered);
          setShowDropdown(true);

          const statusEntries = await Promise.all(
            filtered.map(async (item) => {
              try {
                const statusRes = await api.get(`/friend-requests/status/${item.id}`);
                return [
                  item.id,
                  {
                    status: statusRes.data?.status || "none",
                    request_id: statusRes.data?.request_id || null,
                  },
                ];
              } catch {
                return [
                  item.id,
                  {
                    status: "none",
                    request_id: null,
                  },
                ];
              }
            })
          );

          setFriendStates(Object.fromEntries(statusEntries));
        })
        .catch(() => {
          setResults([]);
          setShowDropdown(true);
        })
        .finally(() => {
          setSearching(false);
        });
    }, 250);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query, user?.id]);

  async function sendFriendRequest(targetUserId) {
    try {
      setActionLoadingId(targetUserId);

      const res = await api.post(`/friend-requests/${targetUserId}`);

      setFriendStates((prev) => ({
        ...prev,
        [targetUserId]: {
          status: "pending_sent",
          request_id: res.data?.id || prev[targetUserId]?.request_id || null,
        },
      }));
    } catch (err) {
      const detail = err?.response?.data?.detail;

      if (detail === "Request already sent") {
        setFriendStates((prev) => ({
          ...prev,
          [targetUserId]: {
            ...(prev[targetUserId] || {}),
            status: "pending_sent",
          },
        }));
      } else {
        console.error("Failed to send friend request", err);
      }
    } finally {
      setActionLoadingId(null);
    }
  }

  async function acceptFriendRequest(targetUserId, requestId) {
    try {
      setActionLoadingId(targetUserId);

      await api.post(`/friend-requests/${requestId}/accept`);

      setFriendStates((prev) => ({
        ...prev,
        [targetUserId]: {
          status: "friends",
          request_id: requestId,
        },
      }));
    } catch (err) {
      console.error("Failed to accept friend request", err);
    } finally {
      setActionLoadingId(null);
    }
  }

  async function rejectFriendRequest(targetUserId, requestId) {
    try {
      setActionLoadingId(targetUserId);

      await api.post(`/friend-requests/${requestId}/reject`);

      setFriendStates((prev) => ({
        ...prev,
        [targetUserId]: {
          status: "none",
          request_id: null,
        },
      }));
    } catch (err) {
      console.error("Failed to reject friend request", err);
    } finally {
      setActionLoadingId(null);
    }
  }

  const displayName = user?.display_name || user?.name || "User";

  const unreadNotificationCount = useMemo(
    () => notifications.filter((item) => !item.is_read).length,
    [notifications]
  );

  return (
    <header className="topbar">
      <div className="brand-wrap">
        <img src={logo} alt="Resilience Logo" className="navbar-logo" />
        <div>
          <h1 className="brand-title">Resilience</h1>
        </div>
      </div>

      {role === "user" && (
        <div className="navbar-search-wrap" ref={searchBoxRef}>
          <input
            type="text"
            className="navbar-search-input"
            placeholder="Search Users"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setShowDropdown(true);
            }}
            onFocus={() => {
              if (query.trim()) setShowDropdown(true);
            }}
          />

          {showDropdown && query.trim() && (
            <div className="navbar-search-dropdown glass-card">
              {searching ? (
                <p className="navbar-search-empty">Searching...</p>
              ) : results.length === 0 ? (
                <p className="navbar-search-empty">No users found.</p>
              ) : (
                <div className="navbar-search-results">
                  {results.map((result) => {
                    const resultName = getDisplayName(result);
                    const relation = friendStates[result.id] || {
                      status: "none",
                      request_id: null,
                    };
                    const isLoading = actionLoadingId === result.id;

                    return (
                      <div key={result.id} className="navbar-search-result-card">
                        <Link
                          to={`/app/profile/${result.id}`}
                          className="navbar-search-result"
                          onClick={() => {
                            setShowDropdown(false);
                            setQuery("");
                          }}
                        >
                          {result.profile_picture_url ? (
                            <img
                              src={resolveMediaUrl(result.profile_picture_url)}
                              alt={resultName}
                              className="navbar-search-avatar"
                            />
                          ) : (
                            <div className="navbar-search-avatar navbar-search-avatar-fallback">
                              {resultName.charAt(0).toUpperCase()}
                            </div>
                          )}

                          <div className="navbar-search-result-content">
                            <p className="navbar-search-name">{resultName}</p>
                            <p className="navbar-search-status">
                              {result.status_text || "View profile"}
                            </p>
                          </div>
                        </Link>

                        {relation.status === "friends" ? (
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm navbar-request-btn"
                            disabled
                          >
                            Friends
                          </button>
                        ) : relation.status === "pending_sent" ? (
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm navbar-request-btn"
                            disabled
                          >
                            Request Sent
                          </button>
                        ) : relation.status === "pending_received" ? (
                          <div className="quick-actions">
                            <button
                              type="button"
                              className="btn btn-primary btn-sm navbar-request-btn"
                              disabled={isLoading}
                              onClick={() =>
                                acceptFriendRequest(result.id, relation.request_id)
                              }
                            >
                              {isLoading ? "..." : "Accept"}
                            </button>

                            <button
                              type="button"
                              className="btn btn-outline btn-sm navbar-request-btn"
                              disabled={isLoading}
                              onClick={() =>
                                rejectFriendRequest(result.id, relation.request_id)
                              }
                            >
                              Reject
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            className="btn btn-primary btn-sm navbar-request-btn"
                            disabled={isLoading}
                            onClick={() => sendFriendRequest(result.id)}
                          >
                            {isLoading ? "Sending..." : "Add Friend"}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="topbar-actions">
        <div className="navbar-notification-wrap" ref={notificationBoxRef}>
          <button
            type="button"
            className="navbar-notification-btn"
            onClick={() => setShowNotifications((prev) => !prev)}
            aria-label="Notifications"
          >
            <span className="navbar-notification-icon">🔔</span>
            {unreadNotificationCount > 0 ? (
              <span className="navbar-notification-badge">
                {unreadNotificationCount > 9 ? "9+" : unreadNotificationCount}
              </span>
            ) : null}
          </button>

          {showNotifications ? (
            <div className="navbar-notification-dropdown glass-card">
              <div className="navbar-notification-head">
                <h3>Notifications</h3>

                {notifications.length > 0 ? (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={markAllNotificationsAsRead}
                  >
                    Mark all as read
                  </button>
                ) : null}
              </div>

              {notificationLoading ? (
                <p className="navbar-search-empty">Loading notifications...</p>
              ) : notifications.length === 0 ? (
                <p className="navbar-search-empty">No notifications yet.</p>
              ) : (
                <div className="navbar-notification-list">
                  {notifications.map((notification) => (
                    <button
                      key={notification.id}
                      type="button"
                      className={`navbar-notification-item ${
                        notification.is_read ? "" : "navbar-notification-item-unread"
                      }`}
                      onClick={() => handleNotificationClick(notification)}
                    >
                      <div className="navbar-notification-item-top">
                        <span className="navbar-notification-type">
                          {notification.type}
                        </span>
                        {!notification.is_read ? (
                          <span className="navbar-notification-dot" />
                        ) : null}
                      </div>

                      <p className="navbar-notification-text">
                        {getNotificationText(notification)}
                      </p>

                      <p className="navbar-notification-time">
                        {formatNotificationTime(notification.created_at)}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : null}
        </div>

        <div className="navbar-user">
          {user?.profile_picture_url ? (
            <img
              src={resolveMediaUrl(user.profile_picture_url)}
              className="navbar-avatar"
              alt={displayName}
            />
          ) : (
            <div className="navbar-avatar-fallback">
              {displayName.charAt(0).toUpperCase()}
            </div>
          )}

          <span className="navbar-username">{displayName}</span>
        </div>

        <span className="role-badge">{role}</span>

        <button className="btn btn-outline" onClick={logout}>
          Logout
        </button>
      </div>
    </header>
  );
}