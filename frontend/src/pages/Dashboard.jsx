import React from "react";
import { Link } from "react-router-dom";

const stats = [
  {
    label: "Deliveries",
    value: "12",
    description: "Active delivery points",
  },
  {
    label: "Vehicles",
    value: "5",
    description: "Available vehicles",
  },
  {
    label: "Routes",
    value: "2",
    description: "Optimized routes",
  },
  {
    label: "Total Load",
    value: "1,220",
    description: "Total delivery load",
  },
];

const pipeline = [
  {
    number: "01",
    title: "Preprocessing",
    description: "Validate and prepare delivery and vehicle data.",
    status: "Completed",
  },
  {
    number: "02",
    title: "A* Route Generation",
    description: "Generate efficient paths between delivery locations.",
    status: "Completed",
  },
  {
    number: "03",
    title: "AHP Analysis",
    description: "Calculate weights for route optimization factors.",
    status: "Completed",
  },
  {
    number: "04",
    title: "Multi-Factor Cost",
    description: "Combine distance, traffic, weather and other factors.",
    status: "Completed",
  },
  {
    number: "05",
    title: "OR-Tools VRP",
    description: "Optimize vehicle assignments and delivery routes.",
    status: "Completed",
  },
  {
    number: "06",
    title: "Dynamic Rerouting",
    description: "Adapt routes when real-world conditions change.",
    status: "Next",
  },
];

const Dashboard = () => {
  return (
    <div className="min-h-screen bg-[#050816] text-white">
      {/* =====================================================
          HERO
      ===================================================== */}

      <section className="relative mb-8 overflow-hidden rounded-3xl border border-white/10 bg-white/[0.025] px-8 py-12 shadow-2xl shadow-black/20">
        {/* Glow */}
        <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-cyan-400/10 blur-3xl" />

        <div className="absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-blue-500/10 blur-3xl" />

        {/* Grid */}
        <div className="absolute inset-0 opacity-[0.025]">
          <div
            className="h-full w-full"
            style={{
              backgroundImage:
                "linear-gradient(#ffffff 1px, transparent 1px), linear-gradient(90deg, #ffffff 1px, transparent 1px)",
              backgroundSize: "40px 40px",
            }}
          />
        </div>

        <div className="relative max-w-4xl">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/5 px-4 py-2 text-sm text-cyan-300">
            <span className="h-2 w-2 animate-pulse rounded-full bg-cyan-300" />
            PathWise Optimization Engine
          </div>

          <h1 className="text-4xl font-bold tracking-tight text-white md:text-5xl">
            Multi-Factor Route
            <span className="block text-cyan-300">Optimization</span>
          </h1>

          <p className="mt-5 max-w-2xl text-lg leading-8 text-gray-400">
            Optimize delivery routes using A*, AHP, multi-factor cost modeling
            and OR-Tools — with dynamic rerouting for changing road conditions.
          </p>

          <div className="mt-8 flex flex-wrap gap-4">
            <Link
              to="/route-optimizer"
              className="rounded-xl bg-cyan-400 px-6 py-3 font-semibold text-[#041016] transition duration-300 hover:-translate-y-1 hover:bg-cyan-300 hover:shadow-lg hover:shadow-cyan-400/20"
            >
              Open Route Optimizer
            </Link>

            <Link
              to="/results"
              className="rounded-xl border border-white/10 bg-white/[0.04] px-6 py-3 font-semibold text-gray-300 transition duration-300 hover:-translate-y-1 hover:border-cyan-400/20 hover:bg-cyan-400/[0.05] hover:text-white"
            >
              View Results
            </Link>
          </div>
        </div>
      </section>

      {/* =====================================================
          STATISTICS
      ===================================================== */}

      <section className="mb-8">
        <div className="mb-5">
          <p className="text-xs uppercase tracking-[0.2em] text-gray-600">
            System Overview
          </p>

          <h2 className="mt-2 text-2xl font-bold text-white">
            Optimization Overview
          </h2>

          <p className="mt-1 text-gray-500">
            Current delivery and vehicle statistics.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map((stat, index) => (
            <div
              key={stat.label}
              className="group rounded-2xl border border-white/10 bg-white/[0.025] p-6 transition-all duration-300 hover:-translate-y-1 hover:border-cyan-400/20 hover:bg-cyan-400/[0.02]"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-500">
                  {stat.label}
                </p>

                <span className="text-xs text-gray-700">
                  {String(index + 1).padStart(2, "0")}
                </span>
              </div>

              <p className="mt-3 text-4xl font-bold tracking-tight text-white">
                {stat.value}
              </p>

              <p className="mt-2 text-sm text-gray-600">{stat.description}</p>

              <div className="mt-5 h-1 overflow-hidden rounded-full bg-white/[0.05]">
                <div className="h-full w-3/4 rounded-full bg-cyan-400 transition-all duration-700 group-hover:w-full" />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* =====================================================
          PIPELINE
      ===================================================== */}

      <section className="mb-8">
        <div className="mb-6">
          <p className="text-xs uppercase tracking-[0.2em] text-gray-600">
            Processing Architecture
          </p>

          <h2 className="mt-2 text-2xl font-bold text-white">
            Optimization Pipeline
          </h2>

          <p className="mt-1 text-gray-500">
            The complete PathWise route optimization workflow.
          </p>
        </div>

        <div className="space-y-4">
          {pipeline.map((step, index) => (
            <div
              key={step.number}
              className="group relative rounded-2xl border border-white/10 bg-white/[0.025] p-6 transition-all duration-300 hover:-translate-y-1 hover:border-cyan-400/20 hover:bg-cyan-400/[0.02]"
            >
              <div className="flex flex-col gap-5 md:flex-row md:items-center">
                {/* Number */}
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-cyan-400/10 bg-cyan-400/[0.05] font-mono text-sm font-bold text-cyan-300 transition duration-300 group-hover:bg-cyan-400/10">
                  {step.number}
                </div>

                {/* Content */}
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-3">
                    <h3 className="text-lg font-semibold text-white">
                      {step.title}
                    </h3>

                    <span
                      className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                        step.status === "Completed"
                          ? "border-emerald-400/20 bg-emerald-400/[0.05] text-emerald-300"
                          : "border-cyan-400/20 bg-cyan-400/[0.05] text-cyan-300"
                      }`}
                    >
                      {step.status}
                    </span>
                  </div>

                  <p className="mt-1 text-sm leading-6 text-gray-500">
                    {step.description}
                  </p>
                </div>

                {/* Arrow */}
                {index < pipeline.length - 1 && (
                  <div className="hidden text-gray-700 md:block">→</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* =====================================================
          AHP + COST FUNCTION
      ===================================================== */}

      <section className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* AHP */}
        <Link
          to="/ahp"
          className="group rounded-2xl border border-white/10 bg-white/[0.025] p-7 transition-all duration-300 hover:-translate-y-1 hover:border-cyan-400/20 hover:bg-cyan-400/[0.02]"
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">
                Decision Model
              </p>

              <h3 className="mt-2 text-2xl font-bold text-white">
                AHP Analysis
              </h3>
            </div>

            <span className="text-2xl text-gray-600 transition-transform duration-300 group-hover:translate-x-2 group-hover:text-cyan-300">
              →
            </span>
          </div>

          <p className="mt-4 leading-7 text-gray-500">
            Calculate the relative importance of distance, travel time, traffic,
            fuel cost, weather and road condition.
          </p>

          <div className="mt-6 flex flex-wrap gap-2">
            {["Distance", "Traffic", "Weather", "Fuel"].map((item) => (
              <span
                key={item}
                className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-medium text-gray-500"
              >
                {item}
              </span>
            ))}
          </div>
        </Link>

        {/* Cost Function */}
        <Link
          to="/cost-function"
          className="group rounded-2xl border border-white/10 bg-white/[0.025] p-7 transition-all duration-300 hover:-translate-y-1 hover:border-cyan-400/20 hover:bg-cyan-400/[0.02]"
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">
                Optimization Model
              </p>

              <h3 className="mt-2 text-2xl font-bold text-white">
                Multi-Factor Cost
              </h3>
            </div>

            <span className="text-2xl text-gray-600 transition-transform duration-300 group-hover:translate-x-2 group-hover:text-cyan-300">
              →
            </span>
          </div>

          <p className="mt-4 leading-7 text-gray-500">
            Combine multiple real-world route factors into a unified cost used
            by the vehicle routing optimizer.
          </p>

          <div className="mt-6">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Optimization factors</span>

              <span className="font-semibold text-white">6</span>
            </div>

            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/[0.05]">
              <div className="h-full w-full rounded-full bg-cyan-400" />
            </div>
          </div>
        </Link>
      </section>

      {/* =====================================================
          DYNAMIC REROUTING
      ===================================================== */}

      <section className="rounded-2xl border border-cyan-400/15 bg-cyan-400/[0.035] p-7">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">
              Next Optimization Layer
            </p>

            <h2 className="mt-2 text-2xl font-bold text-white">
              Dynamic Rerouting
            </h2>

            <p className="mt-2 max-w-2xl text-gray-500">
              Recalculate affected delivery routes when traffic, weather or road
              conditions change during execution.
            </p>
          </div>

          <Link
            to="/dynamic-rerouting"
            className="shrink-0 rounded-xl bg-cyan-400 px-6 py-3 text-center font-semibold text-[#041016] transition duration-300 hover:-translate-y-1 hover:bg-cyan-300 hover:shadow-lg hover:shadow-cyan-400/20"
          >
            Explore Rerouting
          </Link>
        </div>
      </section>
    </div>
  );
};

export default Dashboard;
