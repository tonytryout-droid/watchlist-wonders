import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";

export function AppLayout() {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      {/* Main scrollable content area — pages render inside here */}
      <div className="flex-1 min-w-0 overflow-y-auto" id="main-scroll-container">
        <Outlet />
      </div>
    </div>
  );
}
