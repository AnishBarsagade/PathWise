import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import Navbar from "./components/Navbar";
import Sidebar from "./components/Sidebar";
import ProtectedRoute from "./components/ProtectedRoute";
import { AuthProvider } from "./context/AuthContext";

import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Dashboard from "./pages/Dashboard";
import RouteOptimizer from "./pages/RouteOptimizer";
import AHP from "./pages/AHP";
import CostFunction from "./pages/CostFunction";
import Results from "./pages/Results";
import DynamicRerouting from "./pages/DynamicRerouting";
import Deliveries from './pages/Deliveries';
import Fleet from './pages/Fleet';
import OptimizationHistory from './pages/OptimizationHistory';

const App = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public pages */}
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />

          {/* Protected application */}
          <Route
            path="*"
            element={
              <div className="min-h-screen bg-[#050816] text-white">
                <Navbar />

                <div className="flex">
                  <Sidebar />

                  <main className="min-w-0 flex-1 bg-[#050816] p-6 lg:p-8">
                    <Routes>
                      <Route
                        path="/dashboard"
                        element={
                          <ProtectedRoute>
                            <Dashboard />
                          </ProtectedRoute>
                        }
                      />

                      <Route
                        path="/route-optimizer"
                        element={
                          <ProtectedRoute requiredRole="admin">
                            <RouteOptimizer />
                          </ProtectedRoute>
                        }
                      />
                      <Route path="/deliveries" element={<ProtectedRoute><Deliveries /></ProtectedRoute>} />
                      <Route path="/fleet" element={<ProtectedRoute requiredRole="admin"><Fleet /></ProtectedRoute>} />
                      <Route path="/optimization-history" element={<ProtectedRoute requiredRole="admin"><OptimizationHistory /></ProtectedRoute>} />

                      <Route
                        path="/ahp"
                        element={
                          <ProtectedRoute>
                            <AHP />
                          </ProtectedRoute>
                        }
                      />

                      <Route
                        path="/cost-function"
                        element={
                          <ProtectedRoute>
                            <CostFunction />
                          </ProtectedRoute>
                        }
                      />

                      <Route
                        path="/results"
                        element={
                          <ProtectedRoute>
                            <Results />
                          </ProtectedRoute>
                        }
                      />

                      <Route
                        path="/dynamic-rerouting"
                        element={
                          <ProtectedRoute>
                            <DynamicRerouting />
                          </ProtectedRoute>
                        }
                      />
                    </Routes>
                  </main>
                </div>
              </div>
            }
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;
