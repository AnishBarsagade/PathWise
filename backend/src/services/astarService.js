const { spawn } = require('child_process');
const config = require('../config/env');

// Nagpur delivery network nodes matching algorithms/astar/astar.py
const NAGPUR_NODES = {
  DEPOT: { latitude: 21.1450, longitude: 79.0880, name: "Central Hub (Sitabuldi)" },
  D001:  { latitude: 21.1458, longitude: 79.0882, name: "Dharampeth" },
  D002:  { latitude: 21.1500, longitude: 79.0900, name: "Ramdaspeth" },
  D003:  { latitude: 21.1400, longitude: 79.0800, name: "Dhantoli" },
  D004:  { latitude: 21.1350, longitude: 79.0750, name: "Congress Nagar" },
  D005:  { latitude: 21.1550, longitude: 79.0950, name: "Civil Lines" },
  D006:  { latitude: 21.1600, longitude: 79.1000, name: "Sadar" },
  D007:  { latitude: 21.1300, longitude: 79.0700, name: "Rahate Colony" },
  D008:  { latitude: 21.1250, longitude: 79.0650, name: "Ajni" },
  D009:  { latitude: 21.1650, longitude: 79.1050, name: "Kadbi Chowk" },
  D010:  { latitude: 21.1700, longitude: 79.1100, name: "Mankapur" },
  D011:  { latitude: 21.1200, longitude: 79.0600, name: "Pratap Nagar" },
  D012:  { latitude: 21.1150, longitude: 79.0550, name: "Khamla" },
};

// Base road connectivity edges: [NodeA, NodeB, default_traffic (1-5), road_condition (1-5)]
const DEFAULT_ROAD_EDGES = [
  ["DEPOT", "D001", 2.0, 1.0],
  ["DEPOT", "D002", 2.5, 1.5],
  ["DEPOT", "D003", 2.0, 1.0],
  ["DEPOT", "D005", 3.0, 2.0],
  ["D001", "D002", 1.5, 1.0],
  ["D001", "D005", 2.0, 1.5],
  ["D002", "D003", 1.8, 1.0],
  ["D002", "D006", 2.5, 1.5],
  ["D003", "D004", 1.5, 1.0],
  ["D003", "D007", 2.0, 1.5],
  ["D004", "D007", 1.5, 1.0],
  ["D004", "D008", 2.2, 2.0],
  ["D005", "D006", 2.0, 1.0],
  ["D005", "D009", 2.8, 2.0],
  ["D006", "D009", 2.0, 1.5],
  ["D006", "D010", 3.0, 2.5],
  ["D007", "D008", 1.5, 1.0],
  ["D007", "D011", 2.0, 1.5],
  ["D008", "D011", 1.8, 1.0],
  ["D008", "D012", 2.5, 2.0],
  ["D009", "D010", 2.0, 1.5],
  ["D011", "D012", 1.5, 1.0],
];

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371.0;
  const rLat1 = (lat1 * Math.PI) / 180;
  const rLon1 = (lon1 * Math.PI) / 180;
  const rLat2 = (lat2 * Math.PI) / 180;
  const rLon2 = (lon2 * Math.PI) / 180;

  const dLat = rLat2 - rLat1;
  const dLon = rLon2 - rLon1;

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rLat1) * Math.cos(rLat2) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function haversineHeuristic(u, v) {
  const nodeU = NAGPUR_NODES[u];
  const nodeV = NAGPUR_NODES[v];
  if (!nodeU || !nodeV) return 0.0;
  return haversineKm(nodeU.latitude, nodeU.longitude, nodeV.latitude, nodeV.longitude);
}

function buildNetworkGraph(closedSet = new Set(), trafficMods = {}) {
  const graph = {};
  for (const k of Object.keys(NAGPUR_NODES)) {
    graph[k] = [];
  }

  for (const [u, v, baseTraffic, roadCond] of DEFAULT_ROAD_EDGES) {
    if (!NAGPUR_NODES[u] || !NAGPUR_NODES[v]) continue;

    // Check closed edges
    const isClosed =
      closedSet.has(`${u}-${v}`) ||
      closedSet.has(`${v}-${u}`) ||
      closedSet.has(JSON.stringify([u, v])) ||
      closedSet.has(JSON.stringify([v, u]));
    if (isClosed) continue;

    const dist = haversineKm(
      NAGPUR_NODES[u].latitude,
      NAGPUR_NODES[u].longitude,
      NAGPUR_NODES[v].latitude,
      NAGPUR_NODES[v].longitude
    );

    const tMult = trafficMods[`${u}-${v}`] || trafficMods[`${v}-${u}`] || 1.0;
    const effectiveTraffic = Math.min(5.0, baseTraffic * tMult);

    const cost = dist * (1.0 + 0.3 * (effectiveTraffic - 1.0) + 0.2 * (roadCond - 1.0));

    graph[u].push({ neighbor: v, cost, distance: dist, traffic: effectiveTraffic });
    graph[v].push({ neighbor: u, cost, distance: dist, traffic: effectiveTraffic });
  }

  return graph;
}

function aStarSearch(graph, start, goal, avoidSet = new Set()) {
  if (!graph[start] || !graph[goal]) return [[], Infinity, Infinity];
  if (avoidSet.has(start) || avoidSet.has(goal)) return [[], Infinity, Infinity];

  // Priority queue elements: [fScore, gScore, node]
  const openSet = [[haversineHeuristic(start, goal), 0.0, start]];
  const cameFrom = {};
  const costSoFar = { [start]: 0.0 };
  const distSoFar = { [start]: 0.0 };

  while (openSet.length > 0) {
    // Pop lowest fScore
    openSet.sort((a, b) => a[0] - b[0]);
    const [, currentG, current] = openSet.shift();

    if (current === goal) break;
    if (currentG > (costSoFar[current] ?? Infinity)) continue;

    for (const edge of graph[current] || []) {
      const neighbor = edge.neighbor;
      if (avoidSet.has(neighbor) && neighbor !== goal) continue;

      const newCost = costSoFar[current] + edge.cost;
      const newDist = distSoFar[current] + edge.distance;

      if (!(neighbor in costSoFar) || newCost < costSoFar[neighbor]) {
        costSoFar[neighbor] = newCost;
        distSoFar[neighbor] = newDist;
        const fScore = newCost + haversineHeuristic(neighbor, goal);
        openSet.push([fScore, newCost, neighbor]);
        cameFrom[neighbor] = current;
      }
    }
  }

  if (!(goal in cameFrom) && start !== goal) {
    return [[], Infinity, Infinity];
  }

  // Reconstruct path
  const path = [];
  let curr = goal;
  while (curr !== start) {
    path.push(curr);
    curr = cameFrom[curr];
  }
  path.push(start);
  path.reverse();

  return [path, costSoFar[goal], distSoFar[goal]];
}

function jsFindOptimalDetour({ start, goal, closed_edges = [], traffic_multipliers = {}, avoid_nodes = [] }) {
  const closedSet = new Set();
  (closed_edges || []).forEach((e) => {
    if (Array.isArray(e) && e.length >= 2) {
      closedSet.add(`${e[0]}-${e[1]}`);
      closedSet.add(JSON.stringify(e));
    }
  });

  const avoidSet = new Set(avoid_nodes || []);

  const tMods = {};
  if (traffic_multipliers) {
    for (const [k, v] of Object.entries(traffic_multipliers)) {
      tMods[k] = Number(v);
    }
  }

  const baseGraph = buildNetworkGraph();
  const [basePath, baseCost, baseDist] = aStarSearch(baseGraph, start, goal);

  const disruptedGraph = buildNetworkGraph(closedSet, tMods);
  const [detourPath, detourCost, detourDist] = aStarSearch(disruptedGraph, start, goal, avoidSet);

  const isRerouted =
    detourPath.length > 0 && JSON.stringify(detourPath) !== JSON.stringify(basePath);

  return {
    start,
    goal,
    base_route: {
      path: basePath,
      cost: Number(baseCost.toFixed(4)),
      distance_km: Number(baseDist.toFixed(3)),
    },
    optimal_route: {
      path: detourPath.length ? detourPath : basePath,
      cost: Number((detourPath.length ? detourCost : baseCost).toFixed(4)),
      distance_km: Number((detourPath.length ? detourDist : baseDist).toFixed(3)),
    },
    detour_required: isRerouted,
    cost_delta: detourPath.length ? Number((detourCost - baseCost).toFixed(4)) : 0.0,
    distance_delta_km: detourPath.length ? Number((detourDist - baseDist).toFixed(3)) : 0.0,
    closed_edges: closed_edges || [],
    avoid_nodes: avoid_nodes || [],
  };
}

/**
 * Execute A* detour pathfinding (executes Python if available, with identical pure JS fallback)
 */
function findAstarDetour({ start, goal, closed_edges = [], traffic_multipliers = {}, avoid_nodes = [] }) {
  return new Promise((resolve) => {
    const pythonExecutable = config.PYTHON_PATH;
    const projectRoot = config.PROJECT_ROOT;

    const pyScript = `
import json, sys
from algorithms.astar.astar import find_optimal_detour

input_data = json.loads(sys.stdin.read())
start = input_data.get("start", "DEPOT")
goal = input_data.get("goal", "D006")
closed_edges = [tuple(e) for e in input_data.get("closed_edges", [])]
traffic_multipliers = input_data.get("traffic_multipliers", {})
avoid_nodes = input_data.get("avoid_nodes", [])

res = find_optimal_detour(
    start=start,
    goal=goal,
    closed_edges=closed_edges,
    traffic_multipliers=traffic_multipliers,
    avoid_nodes=avoid_nodes
)
print(json.dumps(res))
`;

    let child;
    try {
      child = spawn(pythonExecutable, ['-c', pyScript], {
        cwd: projectRoot,
        env: {
          ...process.env,
          PYTHONUNBUFFERED: '1',
          PYTHONPATH: projectRoot,
        },
      });
    } catch (_) {
      return resolve(jsFindOptimalDetour({ start, goal, closed_edges, traffic_multipliers, avoid_nodes }));
    }

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (d) => { stdout += d.toString(); });
    child.stderr.on('data', (d) => { stderr += d.toString(); });

    child.on('error', () => {
      // Fallback to in-process JS solver
      resolve(jsFindOptimalDetour({ start, goal, closed_edges, traffic_multipliers, avoid_nodes }));
    });

    child.on('close', (code) => {
      if (code !== 0) {
        return resolve(jsFindOptimalDetour({ start, goal, closed_edges, traffic_multipliers, avoid_nodes }));
      }
      try {
        const parsed = JSON.parse(stdout.trim());
        resolve(parsed);
      } catch (_) {
        resolve(jsFindOptimalDetour({ start, goal, closed_edges, traffic_multipliers, avoid_nodes }));
      }
    });

    child.stdin.write(JSON.stringify({ start, goal, closed_edges, traffic_multipliers, avoid_nodes }));
    child.stdin.end();
  });
}

module.exports = {
  findAstarDetour,
  jsFindOptimalDetour,
  NAGPUR_NODES,
  DEFAULT_ROAD_EDGES,
  haversineKm,
};
