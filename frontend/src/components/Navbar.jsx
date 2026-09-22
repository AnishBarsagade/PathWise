import React from "react";
import { Link, useLocation } from "react-router-dom";

const Navbar = () => {
  const location = useLocation();

  const pageNames = {
    "/dashboard": "Dashboard",
    "/route-optimizer": "Route Optimizer",
    "/ahp": "AHP Analysis",
    "/cost-function": "Cost Function",
    "/results": "Results",
    "/dynamic-rerouting": "Dynamic Rerouting",
  };

  const currentPage = pageNames[location.pathname] || "PathWise";

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[#050816]/85 backdrop-blur-xl">
      <div className="flex h-20 items-center justify-between px-6 lg:px-8">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-400/30 bg-cyan-400/10">
            <span className="text-lg font-bold text-cyan-300">P</span>
          </div>

          <div>
            <h1 className="text-lg font-bold tracking-tight text-white">
              PathWise
            </h1>

            <p className="text-[9px] uppercase tracking-[0.3em] text-gray-500">
              Intelligent Routing
            </p>
          </div>
        </Link>

        {/* Current page */}
        <div className="hidden items-center gap-3 md:flex">
          <span className="h-1.5 w-1.5 rounded-full bg-cyan-300" />

          <span className="text-sm text-gray-400">{currentPage}</span>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-4">
          <div className="hidden items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/5 px-3 py-1.5 sm:flex">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />

            <span className="text-xs text-emerald-300">System Online</span>
          </div>

          <Link
            to="/"
            className="rounded-xl border border-white/10 bg-white/3 px-4 py-2 text-sm text-gray-300 transition hover:border-cyan-400/30 hover:bg-cyan-400/10 hover:text-cyan-300"
          >
            Home
          </Link>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
