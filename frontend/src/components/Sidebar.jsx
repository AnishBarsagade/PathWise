import React from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const Sidebar = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const allNavigation = [
    {
      name: "Dashboard",
      path: "/dashboard",
      icon: "⌂",
      adminOnly: false,
    },
    {
      name: "Route Optimizer",
      path: "/route-optimizer",
      icon: "↗",
      adminOnly: true,
    },
    { name: 'Deliveries', path: '/deliveries', icon: '□', adminOnly: false },
    { name: 'Mixed Fleet', path: '/fleet', icon: '▣', adminOnly: true },
    { name: 'Optimization History', path: '/optimization-history', icon: '◷', adminOnly: true },
    {
      name: "AHP Analysis",
      path: "/ahp",
      icon: "◈",
      adminOnly: false,
    },
    {
      name: "Cost Function",
      path: "/cost-function",
      icon: "∑",
      adminOnly: false,
    },
    {
      name: "Results",
      path: "/results",
      icon: "◉",
      adminOnly: false,
    },
    {
      name: "Dynamic Rerouting",
      path: "/dynamic-rerouting",
      icon: "↻",
      adminOnly: false,
    },
  ];

  const navigation = allNavigation.filter((item) => !item.adminOnly || isAdmin);

  return (
    <aside className="hidden min-h-[calc(100vh-5rem)] w-64 shrink-0 border-r border-white/10 bg-[#050816] lg:block">
      <div className="flex h-full flex-col px-4 py-6">
        {/* Navigation heading */}
        <div className="mb-5 px-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-gray-600">
            Workspace
          </p>
        </div>

        {/* Navigation */}
        <nav className="space-y-1.5">
          {navigation.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `group flex items-center gap-3 rounded-xl px-3 py-3 text-sm transition-all duration-200 ${
                  isActive
                    ? "border border-cyan-400/20 bg-cyan-400/10 text-cyan-300 shadow-lg shadow-cyan-950/20"
                    : "border border-transparent text-gray-500 hover:border-white/10 hover:bg-white/4 hover:text-gray-200"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={`flex h-8 w-8 items-center justify-center rounded-lg text-sm ${
                      isActive
                        ? "bg-cyan-400/10 text-cyan-300"
                        : "bg-white/3 text-gray-500 group-hover:text-gray-300"
                    }`}
                  >
                    {item.icon}
                  </span>

                  <span className="flex-1">{item.name}</span>

                  {isActive && (
                    <span className="h-1.5 w-1.5 rounded-full bg-cyan-300" />
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Bottom system card */}
        <div className="mt-auto">
          <div className="rounded-2xl border border-white/10 bg-white/2.5 p-4">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />

              <span className="text-xs font-medium text-gray-300">
                Optimization Engine
              </span>
            </div>

            <p className="mt-3 text-xs leading-5 text-gray-600">
              A* · AHP · Multi-Factor Cost · OR-Tools
            </p>

            <div className="mt-4 h-1 overflow-hidden rounded-full bg-white/5">
              <div className="h-full w-full rounded-full bg-cyan-400/60" />
            </div>

            <p className="mt-2 text-[10px] text-gray-600">
              Systems operational
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
