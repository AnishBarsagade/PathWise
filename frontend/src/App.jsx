import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar";
import Sidebar from "./components/Sidebar";
import Dashboard from "./pages/Dashboard";
import RouteOptimizer from "./pages/RouteOptimizer";
import AHP from "./pages/AHP";
import Results from "./pages/Results";


const App = () => {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-100">
        <Navbar />

        <div className="flex">
          <Sidebar />

          <main className="flex-1 p-8">
            <Routes>
              <Route path="/" element={<Dashboard />} />

              <Route path="/route-optimizer" element={<RouteOptimizer />} />
              <Route path="/ahp" element={<AHP/>} />

              <Route path="/results" element={<Results/>} />
            </Routes>
          </main>
        </div>
      </div>
    </BrowserRouter>
  );
};

export default App;
