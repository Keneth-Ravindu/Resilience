import { useEffect, useState } from "react";
import api from "../../api/client";

export default function AdminDashboard() {
  const [users, setUsers] = useState([]);
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

  const totalUsers = users.length;
  const totalMentors = users.filter((u) => u.role === "mentor").length;
  const totalAdmins = users.filter((u) => u.role === "admin").length;

  return (
    <div className="fade-in">
      <div className="dashboard-head">
        <div>
          <h2 className="page-title">Admin Dashboard</h2>
          <p className="page-subtitle">
            Manage user roles and supervise platform access.
          </p>
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

      <section className="glass-card">
        {message ? <p className="success-text">{message}</p> : null}
        {error ? <p className="error-text">{error}</p> : null}

        {loading ? (
          <p>Loading users...</p>
        ) : users.length === 0 ? (
          <p>No users found.</p>
        ) : (
          <div className="simple-list">
            {users.map((user) => {
              const isLoading = actionLoadingId === user.id;

              return (
                <div className="simple-list-item" key={user.id}>
                  <div>
                    <strong>{user.display_name || user.name}</strong>
                    <p>{user.email}</p>
                    <p className="feed-meta">
                      Role: <span className="role-badge">{user.role}</span>
                    </p>
                  </div>

                  <div className="quick-actions">
                    {user.role !== "mentor" ? (
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        disabled={isLoading}
                        onClick={() => updateRole(user.id, "mentor")}
                      >
                        {isLoading ? "Updating..." : "Promote to Mentor"}
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        disabled={isLoading}
                        onClick={() => updateRole(user.id, "user")}
                      >
                        {isLoading ? "Updating..." : "Demote to User"}
                      </button>
                    )}

                    {user.role !== "admin" ? (
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        disabled={isLoading}
                        onClick={() => updateRole(user.id, "admin")}
                      >
                        Make Admin
                      </button>
                    ) : null}
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