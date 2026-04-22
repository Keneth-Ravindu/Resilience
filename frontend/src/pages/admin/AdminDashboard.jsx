import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api/client";

export default function AdminDashboard() {
  const [users, setUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function loadUsers() {
    try {
      setLoading(true);
      setError("");

      const res = await api.get("/users");
      setUsers(res.data || []);
    } catch {
      setError("Failed to load users.");
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsers();
  }, []);

  async function updateRole(userId, role) {
    try {
      setActionLoadingId(userId);
      setError("");
      setMessage("");

      const res = await api.patch(`/users/${userId}/role`, { role });

      setUsers((prev) =>
        prev.map((user) => (user.id === userId ? res.data : user))
      );

      setMessage(`User role updated to ${role}.`);
    } catch (err) {
      const detail = err?.response?.data?.detail;
      setError(typeof detail === "string" ? detail : "Failed to update role.");
    } finally {
      setActionLoadingId(null);
    }
  }

  function getRoleBadgeClass(role) {
    if (role === "admin") return "admin-role-pill";
    if (role === "mentor") return "mentor-role-pill";
    return "user-role-pill";
  }

  const filteredUsers = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    if (!term) return users;

    return users.filter((user) => {
      const displayName = (user.display_name || "").toLowerCase();
      const name = (user.name || "").toLowerCase();
      const email = (user.email || "").toLowerCase();
      const role = (user.role || "").toLowerCase();

      return (
        displayName.includes(term) ||
        name.includes(term) ||
        email.includes(term) ||
        role.includes(term)
      );
    });
  }, [users, searchTerm]);

  const totalUsers = users.length;
  const totalMentors = users.filter((u) => u.role === "mentor").length;
  const totalAdmins = users.filter((u) => u.role === "admin").length;

  return (
    <div className="fade-in">
      <div className="dashboard-head">
        <div>
          <h2 className="page-title">Admin Dashboard</h2>
          <p className="page-subtitle">
            Manage user roles, inspect accounts, and supervise platform access.
          </p>
        </div>

        <div className="quick-actions">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={loadUsers}
            disabled={loading}
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      <div className="stats-grid">
        <section className="glass-card stat-card">
          <p className="stat-label">Total Users</p>
          <h3 className="stat-value">{totalUsers}</h3>
          <p className="stat-text">Registered accounts in the system.</p>
        </section>

        <section className="glass-card stat-card">
          <p className="stat-label">Mentors</p>
          <h3 className="stat-value">{totalMentors}</h3>
          <p className="stat-text">Users currently assigned mentor access.</p>
        </section>

        <section className="glass-card stat-card">
          <p className="stat-label">Admins</p>
          <h3 className="stat-value">{totalAdmins}</h3>
          <p className="stat-text">Administrative accounts with elevated control.</p>
        </section>
      </div>

      <section className="glass-card admin-user-card">
  <div className="page-head-with-actions admin-header">
    <div>
      <h3 className="section-title">User Management</h3>
      <p className="feed-meta">
        Search, manage roles, and monitor platform users.
      </p>
    </div>
  </div>

  <div className="field admin-search">
    <input
      type="text"
      placeholder="Search users, mentors, admins..."
      value={searchTerm}
      onChange={(e) => setSearchTerm(e.target.value)}
    />
  </div>

  {message && <p className="success-text">{message}</p>}
  {error && <p className="error-text">{error}</p>}

  {loading ? (
    <p className="feed-meta">Loading users...</p>
  ) : filteredUsers.length === 0 ? (
    <p className="feed-meta">No users found.</p>
  ) : (
    <div className="admin-user-grid">
      {filteredUsers.map((user) => {
        const isLoading = actionLoadingId === user.id;
        const displayName = user.display_name || user.name;

        return (
          <div className="admin-user-card-item" key={user.id}>
            <div className="admin-user-top">
              <div>
                <h4>{displayName}</h4>
                <p className="feed-meta">{user.email}</p>
              </div>

              <span className={`admin-role-chip ${getRoleBadgeClass(user.role)}`}>
                {user.role}
              </span>
            </div>

            <div className="admin-user-tags">
              {user.age_range && <span className="tag-pill">{user.age_range}</span>}
              {user.fitness_level && <span className="tag-pill">{user.fitness_level}</span>}
            </div>

            <div className="admin-user-actions">
              <Link
                to={`/app/profile/${user.id}`}
                className="btn btn-outline btn-sm"
              >
                View
              </Link>

              {user.role !== "mentor" ? (
                <button
                  className="btn btn-primary btn-sm"
                  disabled={isLoading}
                  onClick={() => updateRole(user.id, "mentor")}
                >
                  {isLoading ? "..." : "Mentor"}
                </button>
              ) : (
                <button
                  className="btn btn-outline btn-sm"
                  disabled={isLoading}
                  onClick={() => updateRole(user.id, "user")}
                >
                  {isLoading ? "..." : "User"}
                </button>
              )}

              {user.role !== "admin" && (
                <button
                  className="btn btn-secondary btn-sm"
                  disabled={isLoading}
                  onClick={() => updateRole(user.id, "admin")}
                >
                  {isLoading ? "..." : "Admin"}
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  )}
</section>
    </div>
  );
}