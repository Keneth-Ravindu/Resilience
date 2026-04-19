import { Route, Routes } from "react-router-dom";

import Landing from "../pages/system/Landing";
import RequireAuth from "../auth/RequireAuth";
import RequireRole from "../auth/RequireRole";
import AppLayout from "../layouts/AppLayout";

import Login from "../pages/system/Login";
import Register from "../pages/system/Register";
import NotAuthorized from "../pages/system/NotAuthorized";
import NotFound from "../pages/system/NotFound";

import UserDashboard from "../pages/user/UserDashboard";
import AnalyticsOverview from "../pages/user/AnalyticsOverview";
import Settings from "../pages/user/Settings";
import PublicProfile from "../pages/user/PublicProfile";
import UserSearch from "../pages/user/UserSearch";

import MentorDashboard from "../pages/mentor/MentorDashboard";
import Requests from "../pages/mentor/Requests";
import Mentees from "../pages/mentor/Mentees";
import MenteeAnalytics from "../pages/mentor/MenteeAnalytics";

import AdminDashboard from "../pages/admin/AdminDashboard";

import Feed from "../pages/user/Feed";
import CreatePost from "../pages/user/CreatePost";
import Journals from "../pages/user/Journals";
import CreateJournal from "../pages/user/CreateJournal";

import MyProfile from "../pages/user/MyProfile";
import FriendRequests from "../pages/user/FriendRequests";
import Chat from "../pages/user/Chat";
import PostDetails from "../pages/user/PostDetails";

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/not-authorized" element={<NotAuthorized />} />

      <Route element={<RequireAuth />}>
        <Route element={<AppLayout />}>
          <Route element={<RequireRole allow={["user", "mentor", "admin"]} />}>
            <Route path="/app/profile/:userId" element={<PublicProfile />} />
            <Route path="/app/search" element={<UserSearch />} />
            <Route path="/app/chat" element={<Chat />} />
          </Route>

          <Route element={<RequireRole allow={["user"]} />}>
            <Route path="/app" element={<UserDashboard />} />
            <Route path="/app/feed" element={<Feed />} />
            <Route path="/app/me" element={<MyProfile />} />
            <Route path="/app/posts/new" element={<CreatePost />} />
            <Route path="/app/journals" element={<Journals />} />
            <Route path="/app/journals/new" element={<CreateJournal />} />
            <Route path="/app/analytics" element={<AnalyticsOverview />} />
            <Route path="/app/settings" element={<Settings />} />
            <Route path="/app/friend-requests" element={<FriendRequests />} />
            <Route path="/app/post/:postId" element={<PostDetails />} />
          </Route>

          <Route element={<RequireRole allow={["mentor"]} />}>
            <Route path="/mentor" element={<MentorDashboard />} />
            <Route path="/mentor/requests" element={<Requests />} />
            <Route path="/mentor/mentees" element={<Mentees />} />
            <Route
              path="/mentor/mentees/:menteeId/analytics"
              element={<MenteeAnalytics />}
            />
          </Route>

          <Route element={<RequireRole allow={["admin"]} />}>
            <Route path="/admin" element={<AdminDashboard />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}