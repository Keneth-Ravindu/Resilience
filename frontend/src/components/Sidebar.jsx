import { NavLink } from "react-router-dom";
import { useAuth } from "../auth/useAuth";

export default function Sidebar() {
  const { role } = useAuth();

  return (
    <aside className="sidebar">
      <div className="sidebar-section">
        <p className="sidebar-label">Navigation</p>

      {role === "user" && (
        <>
          <NavLink className="nav-link" to="/app" end>
            Dashboard
          </NavLink>

          <NavLink className="nav-link" to="/app/feed">
            Feed
          </NavLink>
            
          <NavLink className="nav-link" to="/app/chat">
            Messages
          </NavLink>

          <NavLink className="nav-link" to="/app/me">
            My Profile
          </NavLink>

          <NavLink className="nav-link" to="/app/posts/new">
            Create Post
          </NavLink>

          <NavLink className="nav-link" to="/app/journals" end>
            Journals
          </NavLink>

          <NavLink className="nav-link" to="/app/journals/new">
            Create Journal
          </NavLink>

          <NavLink className="nav-link" to="/app/analytics">
            Analytics
          </NavLink>

          <NavLink className="nav-link" to="/app/search">
            Search
          </NavLink>

          <NavLink className="nav-link" to="/app/friend-requests">
            Friend Requests
          </NavLink>

          <NavLink className="nav-link" to="/app/settings">
            Settings
          </NavLink>
        </>
      )}

        {role === "mentor" && (
          <>
            <NavLink className="nav-link" to="/mentor" end>
              Mentor Dashboard
            </NavLink>

            <NavLink className="nav-link" to="/mentor/requests">
              Requests
            </NavLink>

            <NavLink className="nav-link" to="/mentor/mentees">
              Mentees
            </NavLink>

            <NavLink className="nav-link" to="/app/chat">
              Messages
            </NavLink>
          </>
        )}

        {role === "admin" && (
          <>
            <NavLink className="nav-link" to="/admin" end>
              Admin Dashboard
            </NavLink>
          </>
        )}
      </div>
    </aside>
  );
}