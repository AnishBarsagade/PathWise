import React from "react";

const factors = [
  {
    name: "Distance",
    key: "distance",
    weight: 0.3004,
    description: "Total distance travelled by the vehicle.",
  },
  {
    name: "Travel Time",
    key: "travel_time",
    weight: 0.2691,
    description: "Estimated time required to complete the route.",
  },
  {
    name: "Traffic",
    key: "traffic",
    weight: 0.1706,
    description: "Traffic conditions affecting route efficiency.",
  },
  {
    name: "Fuel Cost",
    key: "fuel_cost",
    weight: 0.1195,
    description: "Estimated fuel consumption and operating cost.",
  },
  {
    name: "Weather",
    key: "weather",
    weight: 0.0744,
    description: "Weather conditions affecting route performance.",
  },
  {
    name: "Road Condition",
    key: "road_condition",
    weight: 0.0661,
    description: "Road quality and conditions along the route.",
  },
];

const CostFunction = () => {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-cyan-400/20 bg-cyan-400/10">
            <span className="text-lg font-bold text-cyan-300">Σ</span>
          </div>

          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white">
              Multi-Factor Cost Function
            </h1>

            <p className="mt-1 text-sm text-white/50">
              Unified cost model used to evaluate and optimize delivery routes.
            </p>
          </div>
        </div>
      </div>

      {/* Formula */}
      <section className="rounded-2xl border border-cyan-400/10 bg-white/[0.025] p-6 shadow-xl shadow-black/10">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-white">
            Optimization Formula
          </h2>

          <p className="mt-1 text-sm text-white/50">
            Each route is evaluated using a weighted combination of multiple
            operational factors.
          </p>
        </div>

        <div className="overflow-x-auto rounded-xl border border-white/10 bg-black/20 p-5">
          <div className="min-w-[700px] text-center">
            <p className="text-sm uppercase tracking-wider text-white/40">
              Multi-Factor Cost
            </p>

            <p className="mt-4 text-xl font-semibold leading-relaxed text-cyan-300">
              Cost = Σ (Weightᵢ × Normalized Factorᵢ)
            </p>

            <p className="mt-4 text-xs text-white/40">
              Lower combined cost indicates a more efficient route.
            </p>
          </div>
        </div>
      </section>

      {/* AHP Weights */}
      <section>
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-white">
            AHP-Derived Factor Weights
          </h2>

          <p className="mt-1 text-sm text-white/50">
            The Analytic Hierarchy Process determines the relative importance of
            each optimization factor.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {factors.map((factor) => (
            <div
              key={factor.key}
              className="rounded-2xl border border-white/10 bg-white/[0.025] p-5 transition hover:border-cyan-400/20 hover:bg-white/[0.04]"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-semibold text-white">{factor.name}</h3>

                  <p className="mt-1 text-xs text-white/40">
                    {factor.description}
                  </p>
                </div>

                <span className="rounded-lg border border-cyan-400/20 bg-cyan-400/10 px-2.5 py-1 text-sm font-semibold text-cyan-300">
                  {(factor.weight * 100).toFixed(2)}%
                </span>
              </div>

              {/* Weight bar */}
              <div className="mt-5">
                <div className="h-2 overflow-hidden rounded-full bg-white/5">
                  <div
                    className="h-full rounded-full bg-cyan-400"
                    style={{
                      width: `${factor.weight * 100}%`,
                    }}
                  />
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between text-xs">
                <span className="text-white/30">AHP Weight</span>

                <span className="font-mono text-white/60">
                  {factor.weight.toFixed(4)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Weight Summary */}
      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
          <p className="text-xs uppercase tracking-wider text-white/40">
            Primary Factor
          </p>

          <p className="mt-2 text-xl font-semibold text-white">Distance</p>

          <p className="mt-1 text-sm text-cyan-300">30.04% weight</p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
          <p className="text-xs uppercase tracking-wider text-white/40">
            Secondary Factor
          </p>

          <p className="mt-2 text-xl font-semibold text-white">Travel Time</p>

          <p className="mt-1 text-sm text-cyan-300">26.91% weight</p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
          <p className="text-xs uppercase tracking-wider text-white/40">
            Total Weight
          </p>

          <p className="mt-2 text-xl font-semibold text-white">100%</p>

          <p className="mt-1 text-sm text-emerald-300">All factors included</p>
        </div>
      </section>

      {/* How it works */}
      <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-6">
        <h2 className="text-lg font-semibold text-white">
          How the Cost Function Works
        </h2>

        <div className="mt-6 grid gap-5 md:grid-cols-4">
          <div>
            <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-400/10 text-sm font-bold text-cyan-300">
              1
            </div>

            <h3 className="font-medium text-white">Collect Factors</h3>

            <p className="mt-1 text-sm leading-relaxed text-white/45">
              Route information such as distance, time, traffic, fuel, weather
              and road condition is collected.
            </p>
          </div>

          <div>
            <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-400/10 text-sm font-bold text-cyan-300">
              2
            </div>

            <h3 className="font-medium text-white">Normalize</h3>

            <p className="mt-1 text-sm leading-relaxed text-white/45">
              Different measurements are converted into comparable normalized
              values.
            </p>
          </div>

          <div>
            <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-400/10 text-sm font-bold text-cyan-300">
              3
            </div>

            <h3 className="font-medium text-white">Apply AHP Weights</h3>

            <p className="mt-1 text-sm leading-relaxed text-white/45">
              Each normalized factor is multiplied by its AHP-derived importance
              weight.
            </p>
          </div>

          <div>
            <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-400/10 text-sm font-bold text-cyan-300">
              4
            </div>

            <h3 className="font-medium text-white">Calculate Cost</h3>

            <p className="mt-1 text-sm leading-relaxed text-white/45">
              The weighted factors are combined into a single route cost used
              during optimization.
            </p>
          </div>
        </div>
      </section>

      {/* Integration note */}
      <div className="rounded-2xl border border-amber-400/10 bg-amber-400/[0.04] p-5">
        <div className="flex gap-3">
          <span className="text-amber-300">ⓘ</span>

          <div>
            <h3 className="text-sm font-semibold text-amber-200">
              Optimization Integration
            </h3>

            <p className="mt-1 text-sm leading-relaxed text-amber-200/60">
              These weights are generated through AHP and used by the backend's
              multi-factor cost calculation before the optimized routes are
              passed to the vehicle routing module.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CostFunction;
