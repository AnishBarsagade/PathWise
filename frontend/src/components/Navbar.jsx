import React from "react";

const Navbar = () => {
  return (
    <nav className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6">
      
      <div>
        <h1 className="text-xl font-bold text-gray-800">
          Multi-Factor Route Optimizer
        </h1>
      </div>

      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center">
          <span className="text-sm font-semibold text-gray-600">
            U
          </span>
        </div>

        <span className="text-gray-700 font-medium">
          User
        </span>
      </div>

    </nav>
  );
};

export default Navbar;