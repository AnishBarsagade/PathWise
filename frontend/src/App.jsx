import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import Navbar from "./components/Navbar";
import Sidebar from "./components/Sidebar";

import Landing from "./pages/Landing";
import Dashboard from "./pages/Dashboard";
import RouteOptimizer from "./pages/RouteOptimizer";
import AHP from "./pages/AHP";
import CostFunction from "./pages/CostFunction";
import Results from "./pages/Results";
import DynamicRerouting from "./pages/DynamicRerouting";

const App = () => {
  return (
    <BrowserRouter>
      <Routes>
        {/* Landing Page */}
        <Route path="/" element={<Landing />} />

        {/* Application */}
        <Route
          path="*"
          element={
            <div className="min-h-screen bg-[#050816] text-white">
              <Navbar />

              <div className="flex">
                <Sidebar />

                <main className="min-w-0 flex-1 bg-[#050816] p-6 lg:p-8">
                  <Routes>
                    <Route path="/dashboard" element={<Dashboard />} />

                    <Route
                      path="/route-optimizer"
                      element={<RouteOptimizer />}
                    />

                    <Route path="/ahp" element={<AHP />} />

                    <Route path="/cost-function" element={<CostFunction />} />

                    <Route path="/results" element={<Results />} />

                    <Route
                      path="/dynamic-rerouting"
                      element={<DynamicRerouting />}
                    />
                  </Routes>
                </main>
              </div>
            </div>
          }
        />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
