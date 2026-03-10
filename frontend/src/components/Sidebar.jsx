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

            <NavLink className="nav-link" to="/app/feed" end>
                Feed
            </NavLink>

            <NavLink className="nav-link" to="/app/posts/new" end>
                Create Post
            </NavLink>

            <NavLink className="nav-link" to="/app/journals" end>
                Journals
            </NavLink>

            <NavLink className="nav-link" to="/app/journals/new" end>
                Create Journal
            </NavLink>

            <NavLink className="nav-link" to="/app/analytics" end>
                Analytics
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