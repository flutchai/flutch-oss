import { Outlet } from "@tanstack/react-router";
import { BottomNav } from "./BottomNav";

export function MobileLayout() {
  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background">
      <main className="flex-1 overflow-y-auto pb-16">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}
