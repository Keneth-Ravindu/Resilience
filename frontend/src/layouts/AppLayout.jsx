import { Outlet } from "react-router-dom";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";

export default function AppLayout() {
    return (
        <div className="app-shell fade-in">
        <Navbar />
        <div className="app-body">
            <Sidebar />
            <main className="page-content">
            <Outlet />
            </main>
        </div>
        </div>
    );
}