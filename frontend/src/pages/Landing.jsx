import React, { useLayoutEffect, useRef } from "react";
import { Link } from "react-router-dom";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const Landing = () => {
  const pageRef = useRef(null);
  const heroRef = useRef(null);
  const routeRef = useRef(null);

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      // -----------------------------
      // HERO ANIMATION
      // -----------------------------
      const heroTimeline = gsap.timeline();

      heroTimeline
        .from(".hero-badge", {
          opacity: 0,
          y: 20,
          duration: 0.7,
          ease: "power3.out",
        })
        .from(".hero-title", {
          opacity: 0,
          y: 50,
          duration: 1,
          ease: "power4.out",
        })
        .from(".hero-description", {
          opacity: 0,
          y: 30,
          duration: 0.7,
          ease: "power3.out",
        })
        .from(".hero-buttons", {
          opacity: 0,
          y: 25,
          duration: 0.6,
          ease: "power3.out",
        })
        .from(
          ".hero-visual",
          {
            opacity: 0,
            x: 80,
            duration: 1,
            ease: "power3.out",
          },
          "-=0.7",
        );

      // -----------------------------
      // FLOATING HERO VISUAL
      // -----------------------------
      gsap.to(".floating-card", {
        y: -12,
        duration: 2.5,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
      });

      // -----------------------------
      // ROUTE NODE PULSE
      // -----------------------------
      gsap.to(".route-node", {
        scale: 1.25,
        opacity: 0.55,
        duration: 1.2,
        repeat: -1,
        yoyo: true,
        stagger: 0.25,
        ease: "sine.inOut",
      });

      // -----------------------------
      // SCROLL REVEALS
      // -----------------------------
      gsap.utils.toArray(".reveal").forEach((element) => {
        gsap.from(element, {
          opacity: 0,
          y: 60,
          duration: 0.9,
          ease: "power3.out",
          scrollTrigger: {
            trigger: element,
            start: "top 85%",
            once: true,
          },
        });
      });

      // -----------------------------
      // PIPELINE ANIMATION
      // -----------------------------
      gsap.utils.toArray(".pipeline-card").forEach((card, index) => {
        gsap.from(card, {
          opacity: 0,
          y: 50,
          duration: 0.7,
          delay: index * 0.08,
          ease: "power3.out",
          scrollTrigger: {
            trigger: ".pipeline-container",
            start: "top 80%",
            once: true,
          },
        });
      });

      // -----------------------------
      // AHP WEIGHT BARS
      // -----------------------------
      gsap.utils.toArray(".weight-bar").forEach((bar) => {
        const width = bar.dataset.width;

        gsap.fromTo(
          bar,
          { width: "0%" },
          {
            width,
            duration: 1.2,
            ease: "power3.out",
            scrollTrigger: {
              trigger: bar,
              start: "top 90%",
              once: true,
            },
          },
        );
      });

      // -----------------------------
      // ROUTE DRAWING
      // -----------------------------
      gsap.from(".route-line", {
        strokeDashoffset: 1000,
        duration: 2,
        ease: "power2.out",
        scrollTrigger: {
          trigger: ".route-section",
          start: "top 75%",
          once: true,
        },
      });

      // -----------------------------
      // DYNAMIC REROUTING
      // -----------------------------
      gsap.to(".reroute-dot", {
        x: 180,
        duration: 2,
        repeat: -1,
        yoyo: true,
        ease: "power1.inOut",
      });

      gsap.to(".reroute-alert", {
        opacity: 0.5,
        scale: 1.05,
        duration: 1,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
      });
    }, pageRef);

    return () => ctx.revert();
  }, []);

  return (
    <div
      ref={pageRef}
      className="min-h-screen overflow-hidden bg-[#050816] text-white"
    >
      {/* =====================================================
          NAVBAR
      ===================================================== */}
      <nav className="fixed left-0 right-0 top-0 z-50 border-b border-white/10 bg-[#050816]/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <Link to="/" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-400/30 bg-cyan-400/10">
              <span className="text-lg font-bold text-cyan-300">P</span>
            </div>

            <div>
              <h1 className="text-xl font-bold tracking-tight">PathWise</h1>
              <p className="text-[10px] uppercase tracking-[0.3em] text-gray-500">
                Intelligent Routing
              </p>
            </div>
          </Link>

          <div className="hidden items-center gap-8 text-sm text-gray-400 md:flex">
            <a href="#technology" className="transition hover:text-white">
              Technology
            </a>

            <a href="#architecture" className="transition hover:text-white">
              Architecture
            </a>

            <a href="#optimization" className="transition hover:text-white">
              Optimization
            </a>

            <a href="#rerouting" className="transition hover:text-white">
              Dynamic Rerouting
            </a>
          </div>

          <Link
            to="/dashboard"
            className="rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-5 py-2.5 text-sm font-medium text-cyan-300 transition hover:border-cyan-300 hover:bg-cyan-400/20"
          >
            Open Dashboard
          </Link>
        </div>
      </nav>

      {/* =====================================================
          HERO
      ===================================================== */}
      <section
        ref={heroRef}
        className="relative flex min-h-screen items-center px-6 pb-20 pt-32"
      >
        {/* Background glow */}
        <div className="pointer-events-none absolute left-1/4 top-1/4 h-96 w-96 rounded-full bg-cyan-500/10 blur-[120px]" />
        <div className="pointer-events-none absolute right-0 top-1/3 h-96 w-96 rounded-full bg-blue-500/10 blur-[120px]" />

        <div className="mx-auto grid max-w-7xl items-center gap-16 lg:grid-cols-2">
          {/* Hero content */}
          <div>
            <div className="hero-badge mb-7 inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/5 px-4 py-2 text-xs font-medium uppercase tracking-[0.2em] text-cyan-300">
              <span className="h-2 w-2 rounded-full bg-cyan-300" />
              Multi-Factor Route Optimization
            </div>

            <h1 className="hero-title max-w-4xl text-5xl font-bold leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl">
              Smarter routes.
              <br />
              <span className="bg-linear-to-r from-cyan-300 via-blue-400 to-purple-400 bg-clip-text text-transparent">
                Better decisions.
              </span>
            </h1>

            <p className="hero-description mt-7 max-w-xl text-lg leading-8 text-gray-400">
              PathWise combines intelligent pathfinding, multi-factor
              decision-making and vehicle routing to create optimized delivery
              routes that adapt to changing road conditions.
            </p>

            <div className="hero-buttons mt-9 flex flex-wrap gap-4">
              <Link
                to="/dashboard"
                className="rounded-xl bg-cyan-400 px-6 py-3.5 font-semibold text-[#041016] transition hover:-translate-y-1 hover:bg-cyan-300"
              >
                Explore Dashboard →
              </Link>

              <a
                href="#architecture"
                className="rounded-xl border border-white/10 bg-white/3 px-6 py-3.5 font-semibold text-white transition hover:-translate-y-1 hover:bg-white/[0.07]"
              >
                How It Works
              </a>
            </div>

            <div className="mt-10 flex flex-wrap gap-8 text-sm text-gray-500">
              <div>
                <span className="block text-xl font-semibold text-white">
                  A*
                </span>
                Route Generation
              </div>

              <div>
                <span className="block text-xl font-semibold text-white">
                  AHP
                </span>
                Decision Weights
              </div>

              <div>
                <span className="block text-xl font-semibold text-white">
                  VRP
                </span>
                Fleet Optimization
              </div>
            </div>
          </div>

          {/* Hero visual */}
          <div className="hero-visual relative">
            <div className="floating-card relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.035] p-5 shadow-2xl shadow-cyan-950/30 backdrop-blur-xl">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-gray-500">
                    Live Route Model
                  </p>
                  <h3 className="mt-1 font-semibold">Delivery Network</h3>
                </div>

                <div className="flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-xs text-emerald-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
                  Optimized
                </div>
              </div>

              <div className="relative h-105 overflow-hidden rounded-2xl border border-white/10 bg-[#080d20]">
                {/* Grid */}
                <div
                  className="absolute inset-0 opacity-20"
                  style={{
                    backgroundImage:
                      "linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)",
                    backgroundSize: "40px 40px",
                  }}
                />

                {/* Route SVG */}
                <svg
                  className="absolute inset-0 h-full w-full"
                  viewBox="0 0 500 420"
                  fill="none"
                >
                  <path
                    d="M70 330 C120 290, 110 180, 175 210 S250 320, 300 250 S360 110, 430 80"
                    stroke="rgba(255,255,255,0.12)"
                    strokeWidth="12"
                    strokeLinecap="round"
                  />

                  <path
                    className="route-line"
                    d="M70 330 C120 290, 110 180, 175 210 S250 320, 300 250 S360 110, 430 80"
                    stroke="#67e8f9"
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeDasharray="1000"
                    strokeDashoffset="0"
                  />

                  <circle
                    className="route-node"
                    cx="70"
                    cy="330"
                    r="8"
                    fill="#67e8f9"
                  />

                  <circle
                    className="route-node"
                    cx="175"
                    cy="210"
                    r="8"
                    fill="#67e8f9"
                  />

                  <circle
                    className="route-node"
                    cx="300"
                    cy="250"
                    r="8"
                    fill="#67e8f9"
                  />

                  <circle
                    className="route-node"
                    cx="430"
                    cy="80"
                    r="8"
                    fill="#67e8f9"
                  />
                </svg>

                {/* Labels */}
                <div className="absolute bottom-8 left-8 rounded-xl border border-white/10 bg-black/40 px-4 py-3 backdrop-blur-md">
                  <p className="text-[10px] uppercase tracking-wider text-gray-500">
                    Depot
                  </p>
                  <p className="font-medium">DEPOT</p>
                </div>

                <div className="absolute left-[32%] top-[39%] rounded-xl border border-cyan-400/20 bg-cyan-400/10 px-3 py-2 text-xs text-cyan-200 backdrop-blur-md">
                  D003
                </div>

                <div className="absolute right-8 top-8 rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-xs text-emerald-300 backdrop-blur-md">
                  D008 ✓
                </div>

                <div className="absolute bottom-6 right-6 rounded-xl border border-white/10 bg-black/50 p-4 backdrop-blur-md">
                  <p className="text-[10px] uppercase tracking-wider text-gray-500">
                    Route Cost
                  </p>
                  <p className="mt-1 text-lg font-semibold">0.665</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================
          TECHNOLOGY
      ===================================================== */}
      <section id="technology" className="border-t border-white/5 px-6 py-28">
        <div className="mx-auto max-w-7xl">
          <div className="reveal max-w-3xl">
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.3em] text-cyan-300">
              Why PathWise
            </p>

            <h2 className="text-4xl font-bold tracking-tight sm:text-5xl">
              Delivery optimization is more than finding the shortest road.
            </h2>

            <p className="mt-6 text-lg leading-8 text-gray-400">
              Real-world delivery decisions depend on distance, travel time,
              traffic, fuel cost, weather and road conditions. PathWise brings
              these factors together into a single optimization workflow.
            </p>
          </div>

          <div className="mt-16 grid gap-5 md:grid-cols-3">
            <div className="reveal rounded-3xl border border-white/10 bg-white/2.5 p-7">
              <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-400/10 text-xl text-cyan-300">
                01
              </div>

              <h3 className="text-xl font-semibold">Intelligent Pathfinding</h3>

              <p className="mt-3 leading-7 text-gray-400">
                A* generates efficient paths between delivery locations while
                considering the underlying road network.
              </p>
            </div>

            <div className="reveal rounded-3xl border border-white/10 bg-white/2.5 p-7">
              <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-400/10 text-xl text-blue-300">
                02
              </div>

              <h3 className="text-xl font-semibold">Multi-Factor Decisions</h3>

              <p className="mt-3 leading-7 text-gray-400">
                AHP converts multiple operational factors into meaningful
                weights for a multi-factor route cost.
              </p>
            </div>

            <div className="reveal rounded-3xl border border-white/10 bg-white/2.5 p-7">
              <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-purple-400/10 text-xl text-purple-300">
                03
              </div>

              <h3 className="text-xl font-semibold">Fleet Optimization</h3>

              <p className="mt-3 leading-7 text-gray-400">
                OR-Tools solves the vehicle routing problem while respecting
                vehicle capacity and delivery requirements.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================
          ARCHITECTURE
      ===================================================== */}
      <section id="architecture" className="border-t border-white/5 px-6 py-28">
        <div className="mx-auto max-w-7xl">
          <div className="reveal text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-300">
              PathWise Architecture
            </p>

            <h2 className="mt-4 text-4xl font-bold sm:text-5xl">
              From raw delivery data to optimized routes.
            </h2>

            <p className="mx-auto mt-5 max-w-2xl text-gray-400">
              Every stage contributes to the final route decision.
            </p>
          </div>

          <div className="pipeline-container mt-16 grid gap-4 md:grid-cols-2 lg:grid-cols-6">
            {[
              {
                number: "01",
                title: "Preprocessing",
                description: "Prepare delivery and vehicle data.",
              },
              {
                number: "02",
                title: "A*",
                description: "Generate efficient paths.",
              },
              {
                number: "03",
                title: "AHP",
                description: "Calculate factor weights.",
              },
              {
                number: "04",
                title: "Multi-Factor Cost",
                description: "Combine route criteria.",
              },
              {
                number: "05",
                title: "OR-Tools VRP",
                description: "Optimize fleet routes.",
              },
              {
                number: "06",
                title: "Dynamic Rerouting",
                description: "Adapt to changing conditions.",
              },
            ].map((item) => (
              <div
                key={item.number}
                className="pipeline-card rounded-2xl border border-white/10 bg-white/2.5 p-5"
              >
                <span className="text-xs font-semibold text-cyan-300">
                  {item.number}
                </span>

                <h3 className="mt-4 font-semibold">{item.title}</h3>

                <p className="mt-2 text-sm leading-6 text-gray-500">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* =====================================================
          AHP
      ===================================================== */}
      <section id="optimization" className="border-t border-white/5 px-6 py-28">
        <div className="mx-auto grid max-w-7xl gap-16 lg:grid-cols-2">
          <div className="reveal">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-300">
              AHP Decision Model
            </p>

            <h2 className="mt-4 text-4xl font-bold sm:text-5xl">
              Every route factor has a role.
            </h2>

            <p className="mt-6 text-lg leading-8 text-gray-400">
              PathWise uses the Analytic Hierarchy Process to determine the
              relative importance of the factors used by the multi-factor cost
              function.
            </p>

            <Link
              to="/ahp"
              className="mt-8 inline-flex rounded-xl border border-cyan-400/20 bg-cyan-400/10 px-5 py-3 text-sm font-semibold text-cyan-300 transition hover:bg-cyan-400/20"
            >
              Explore AHP Analysis →
            </Link>
          </div>

          <div className="reveal space-y-5">
            {[
              ["Distance", "30.04%", "30.04"],
              ["Travel Time", "26.91%", "26.91"],
              ["Traffic", "17.06%", "17.06"],
              ["Fuel Cost", "11.95%", "11.95"],
              ["Weather", "7.44%", "7.44"],
              ["Road Condition", "6.61%", "6.61"],
            ].map(([name, value, width]) => (
              <div key={name}>
                <div className="mb-2 flex justify-between text-sm">
                  <span className="text-gray-300">{name}</span>
                  <span className="font-medium text-cyan-300">{value}</span>
                </div>

                <div className="h-2 overflow-hidden rounded-full bg-white/5">
                  <div
                    className="weight-bar h-full rounded-full bg-cyan-300"
                    data-width={`${width}%`}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* =====================================================
          VEHICLE ROUTING
      ===================================================== */}
      <section className="route-section border-t border-white/5 px-6 py-28">
        <div className="mx-auto grid max-w-7xl items-center gap-16 lg:grid-cols-2">
          <div className="reveal">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-300">
              Vehicle Routing
            </p>

            <h2 className="mt-4 text-4xl font-bold sm:text-5xl">
              Turn individual routes into a fleet-wide plan.
            </h2>

            <p className="mt-6 text-lg leading-8 text-gray-400">
              Once route costs are calculated, the vehicle routing stage assigns
              deliveries to vehicles while respecting their available capacity.
            </p>

            <div className="mt-8 grid grid-cols-2 gap-4">
              <div className="rounded-2xl border border-white/10 bg-white/2.5 p-5">
                <p className="text-xs uppercase tracking-wider text-gray-500">
                  Vehicles
                </p>
                <p className="mt-2 text-3xl font-bold">5</p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/2.5 p-5">
                <p className="text-xs uppercase tracking-wider text-gray-500">
                  Deliveries
                </p>
                <p className="mt-2 text-3xl font-bold">12</p>
              </div>
            </div>

            <Link
              to="/route-optimizer"
              className="mt-8 inline-flex rounded-xl bg-white px-5 py-3 font-semibold text-[#050816] transition hover:-translate-y-1"
            >
              Open Route Optimizer →
            </Link>
          </div>

          <div className="reveal rounded-3xl border border-white/10 bg-white/2.5 p-6">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wider text-gray-500">
                  Optimized Fleet
                </p>
                <h3 className="mt-1 font-semibold">Vehicle Allocation</h3>
              </div>

              <span className="rounded-full bg-emerald-400/10 px-3 py-1 text-xs text-emerald-300">
                Valid
              </span>
            </div>

            <div className="space-y-3">
              {[
                ["V001", "Unused", "0 / 600"],
                ["V002", "Unused", "0 / 600"],
                ["V003", "Unused", "0 / 600"],
                ["V004", "D003 → D010 → D008 → D001", "430 / 600"],
                ["V005", "D009 → D012 → D011 → D007", "790 / 800"],
              ].map(([vehicle, route, load]) => (
                <div
                  key={vehicle}
                  className="rounded-2xl border border-white/10 bg-black/20 p-4"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <span className="text-sm font-semibold">{vehicle}</span>

                      <p className="mt-1 text-xs text-gray-500">{route}</p>
                    </div>

                    <span className="whitespace-nowrap text-xs text-gray-400">
                      {load}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================
          DYNAMIC REROUTING
      ===================================================== */}
      <section id="rerouting" className="border-t border-white/5 px-6 py-28">
        <div className="mx-auto max-w-7xl">
          <div className="reveal mx-auto max-w-3xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-300">
              Dynamic Rerouting
            </p>

            <h2 className="mt-4 text-4xl font-bold sm:text-5xl">
              Routes can adapt when reality changes.
            </h2>

            <p className="mt-6 text-lg leading-8 text-gray-400">
              A route that was optimal earlier may no longer be optimal after
              traffic, weather or road conditions change. Dynamic rerouting
              provides the foundation for adapting the route during operation.
            </p>
          </div>

          <div className="reveal mt-16 overflow-hidden rounded-3xl border border-white/10 bg-white/2.5 p-6">
            <div className="relative h-72 overflow-hidden rounded-2xl bg-[#080d20]">
              <div
                className="absolute inset-0 opacity-20"
                style={{
                  backgroundImage:
                    "linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)",
                  backgroundSize: "40px 40px",
                }}
              />

              <svg
                className="absolute inset-0 h-full w-full"
                viewBox="0 0 800 300"
                fill="none"
              >
                <path
                  d="M80 220 C200 220, 180 90, 330 100 S480 240, 700 70"
                  stroke="rgba(255,255,255,0.12)"
                  strokeWidth="8"
                  strokeLinecap="round"
                />

                <path
                  d="M80 220 C200 220, 180 90, 330 100 S480 240, 700 70"
                  stroke="#67e8f9"
                  strokeWidth="3"
                  strokeDasharray="10 10"
                />

                <path
                  d="M330 100 C450 100, 500 180, 700 220"
                  stroke="#a78bfa"
                  strokeWidth="3"
                  strokeDasharray="8 8"
                />

                <circle
                  className="reroute-dot"
                  cx="80"
                  cy="220"
                  r="7"
                  fill="#67e8f9"
                />

                <circle cx="330" cy="100" r="8" fill="#f59e0b" />

                <circle cx="700" cy="70" r="7" fill="#67e8f9" />

                <circle cx="700" cy="220" r="7" fill="#a78bfa" />
              </svg>

              <div className="reroute-alert absolute left-[38%] top-[25%] rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 backdrop-blur-md">
                <p className="text-xs font-semibold text-amber-300">
                  Traffic detected
                </p>
                <p className="mt-1 text-[10px] text-gray-400">
                  Route adjustment required
                </p>
              </div>

              <div className="absolute bottom-5 left-5 rounded-xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-3 backdrop-blur-md">
                <p className="text-[10px] uppercase tracking-wider text-gray-500">
                  Original
                </p>
                <p className="text-sm text-cyan-300">Route A</p>
              </div>

              <div className="absolute bottom-5 right-5 rounded-xl border border-purple-400/20 bg-purple-400/10 px-4 py-3 backdrop-blur-md">
                <p className="text-[10px] uppercase tracking-wider text-gray-500">
                  Updated
                </p>
                <p className="text-sm text-purple-300">Route B</p>
              </div>
            </div>
          </div>

          <div className="mt-8 text-center">
            <Link
              to="/dynamic-rerouting"
              className="inline-flex rounded-xl border border-cyan-400/20 bg-cyan-400/10 px-6 py-3 font-semibold text-cyan-300 transition hover:bg-cyan-400/20"
            >
              Explore Dynamic Rerouting →
            </Link>
          </div>
        </div>
      </section>

      {/* =====================================================
          FINAL CTA
      ===================================================== */}
      <section className="border-t border-white/5 px-6 py-32">
        <div className="mx-auto max-w-5xl text-center">
          <div className="reveal">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-300">
              PathWise
            </p>

            <h2 className="mt-5 text-5xl font-bold tracking-tight sm:text-6xl">
              Build routes that make sense.
            </h2>

            <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-gray-400">
              Explore the PathWise optimization workflow and see how
              multi-factor route planning can transform delivery operations.
            </p>

            <div className="mt-9 flex flex-wrap justify-center gap-4">
              <Link
                to="/dashboard"
                className="rounded-xl bg-cyan-400 px-7 py-3.5 font-semibold text-[#041016] transition hover:-translate-y-1 hover:bg-cyan-300"
              >
                Launch PathWise →
              </Link>

              <Link
                to="/results"
                className="rounded-xl border border-white/10 bg-white/3 px-7 py-3.5 font-semibold transition hover:-translate-y-1 hover:bg-white/[0.07]"
              >
                View Results
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================
          FOOTER
      ===================================================== */}
      <footer className="border-t border-white/5 px-6 py-10">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-5 text-sm text-gray-500 md:flex-row md:items-center">
          <div>
            <span className="font-semibold text-gray-300">PathWise</span> —
            Multi-Factor Delivery Route Optimization
          </div>

          <div className="flex gap-6">
            <Link to="/dashboard" className="transition hover:text-white">
              Dashboard
            </Link>

            <Link to="/ahp" className="transition hover:text-white">
              AHP
            </Link>

            <Link to="/results" className="transition hover:text-white">
              Results
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
