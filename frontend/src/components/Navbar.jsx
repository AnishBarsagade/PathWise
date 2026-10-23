import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const Navbar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const pageNames = {
    "/dashboard": "Dashboard",
    "/rider": "Rider Operations",
    "/route-optimizer": "Route Optimizer",
    "/deliveries": "Deliveries",
    "/fleet": "Mixed Fleet",
    "/optimization-history": "Optimization History",
    "/ahp": "AHP Analysis",
    "/cost-function": "Cost Function",
    "/results": "Results",
    "/dynamic-rerouting": "Dynamic Rerouting",
  };

  const currentPage = pageNames[location.pathname] || "PathWise";

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

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
          <span className="text-sm text-gray-400">{currentPage}</span>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-3">
          <div className="hidden items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/5 px-3 py-1.5 sm:flex">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />

            <span className="text-xs text-emerald-300">System Online</span>
          </div>

          {user && (
            <div className="hidden items-center gap-2 lg:flex">
              <span className="text-xs text-gray-400">{user.name || user.email}</span>
              <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase ${user.role === 'admin' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'}`}>
                {user.role}
              </span>
            </div>
          )}

          <button
            onClick={handleLogout}
            className="rounded-xl border border-red-400/20 bg-red-400/5 px-4 py-2 text-sm text-gray-300 transition hover:border-red-400/40 hover:bg-red-400/10 hover:text-red-300"
          >
            Logout
          </button>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
