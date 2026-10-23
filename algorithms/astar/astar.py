"""
PathWise A* Multi-Factor Pathfinder Module.

Provides:
1. Core A* search algorithm using priority queue.
2. Haversine distance heuristic (admissible & consistent).
3. Road network graph representing Nagpur delivery nodes & street links.
4. Dynamic detour calculation around closed roads, construction zones, or severe traffic congestion.
"""

import heapq
import math
import sys
from typing import Any, Callable, Dict, List, Optional, Set, Tuple


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Computes great-circle distance between two GPS coordinates in kilometers."""
    R = 6371.0
    r_lat1 = math.radians(lat1)
    r_lon1 = math.radians(lon1)
    r_lat2 = math.radians(lat2)
    r_lon2 = math.radians(lon2)

    dlat = r_lat2 - r_lat1
    dlon = r_lon2 - r_lon1

    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(r_lat1) * math.cos(r_lat2) * math.sin(dlon / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c


# Coordinate catalog for Nagpur operational delivery network
NAGPUR_NODES: Dict[str, Dict[str, Any]] = {
    "DEPOT": {"latitude": 21.1450, "longitude": 79.0880, "name": "Central Hub (Sitabuldi)"},
    "D001":  {"latitude": 21.1458, "longitude": 79.0882, "name": "Dharampeth"},
    "D002":  {"latitude": 21.1500, "longitude": 79.0900, "name": "Ramdaspeth"},
    "D003":  {"latitude": 21.1400, "longitude": 79.0800, "name": "Dhantoli"},
    "D004":  {"latitude": 21.1350, "longitude": 79.0750, "name": "Congress Nagar"},
    "D005":  {"latitude": 21.1550, "longitude": 79.0950, "name": "Civil Lines"},
    "D006":  {"latitude": 21.1600, "longitude": 79.1000, "name": "Sadar"},
    "D007":  {"latitude": 21.1300, "longitude": 79.0700, "name": "Rahate Colony"},
    "D008":  {"latitude": 21.1250, "longitude": 79.0650, "name": "Ajni"},
    "D009":  {"latitude": 21.1650, "longitude": 79.1050, "name": "Kadbi Chowk"},
    "D010":  {"latitude": 21.1700, "longitude": 79.1100, "name": "Mankapur"},
    "D011":  {"latitude": 21.1200, "longitude": 79.0600, "name": "Pratap Nagar"},
    "D012":  {"latitude": 21.1150, "longitude": 79.0550, "name": "Khamla"},
}

# Base road connectivity edges: (NodeA, NodeB, default_traffic [1-5], road_condition [1-5])
DEFAULT_ROAD_EDGES: List[Tuple[str, str, float, float]] = [
    ("DEPOT", "D001", 2.0, 1.0),
    ("DEPOT", "D002", 2.5, 1.5),
    ("DEPOT", "D003", 2.0, 1.0),
    ("DEPOT", "D005", 3.0, 2.0),
    ("D001", "D002", 1.5, 1.0),
    ("D001", "D005", 2.0, 1.5),
    ("D002", "D003", 1.8, 1.0),
    ("D002", "D006", 2.5, 1.5),
    ("D003", "D004", 1.5, 1.0),
    ("D003", "D007", 2.0, 1.5),
    ("D004", "D007", 1.5, 1.0),
    ("D004", "D008", 2.2, 2.0),
    ("D005", "D006", 2.0, 1.0),
    ("D005", "D009", 2.8, 2.0),
    ("D006", "D009", 2.0, 1.5),
    ("D006", "D010", 3.0, 2.5),
    ("D007", "D008", 1.5, 1.0),
    ("D007", "D011", 2.0, 1.5),
    ("D008", "D011", 1.8, 1.0),
    ("D008", "D012", 2.5, 2.0),
    ("D009", "D010", 2.0, 1.5),
    ("D011", "D012", 1.5, 1.0),
]


def build_network_graph(
    nodes: Optional[Dict[str, Dict[str, Any]]] = None,
    edges: Optional[List[Tuple[str, str, float, float]]] = None,
    closed_edges: Optional[Set[Tuple[str, str]]] = None,
    traffic_multipliers: Optional[Dict[Tuple[str, str], float]] = None,
) -> Dict[str, List[Dict[str, Any]]]:
    """
    Constructs an adjacency list graph where edge weights reflect multi-factor segment cost.
    Edge cost = distance_km * (1.0 + 0.3 * (traffic - 1.0) + 0.2 * (road_condition - 1.0)).
    """
    active_nodes = nodes or NAGPUR_NODES
    active_edges = edges or DEFAULT_ROAD_EDGES
    closed_set = closed_edges or set()
    traffic_mods = traffic_multipliers or {}

    graph: Dict[str, List[Dict[str, Any]]] = {k: [] for k in active_nodes}

    for u, v, base_traffic, road_cond in active_edges:
        if u not in active_nodes or v not in active_nodes:
            continue

        # Check if segment is blocked in either direction
        if (u, v) in closed_set or (v, u) in closed_set:
            continue

        dist = haversine_km(
            active_nodes[u]["latitude"], active_nodes[u]["longitude"],
            active_nodes[v]["latitude"], active_nodes[v]["longitude"],
        )

        t_mult = traffic_mods.get((u, v), traffic_mods.get((v, u), 1.0))
        effective_traffic = min(5.0, base_traffic * t_mult)

        # Multi-factor penalty function
        cost = dist * (1.0 + 0.3 * (effective_traffic - 1.0) + 0.2 * (road_cond - 1.0))

        graph[u].append({"neighbor": v, "cost": cost, "distance": dist, "traffic": effective_traffic})
        graph[v].append({"neighbor": u, "cost": cost, "distance": dist, "traffic": effective_traffic})

    return graph


def a_star_search(
    graph: Dict[str, List[Dict[str, Any]]],
    start: str,
    goal: str,
    heuristic_fn: Callable[[str, str], float],
    avoid_nodes: Optional[Set[str]] = None,
) -> Tuple[List[str], float, float]:
    """
    Standard A* algorithm.
    Returns: (path_nodes, total_cost, total_distance_km).
    """
    if start not in graph or goal not in graph:
        return [], float("inf"), float("inf")

    avoid = avoid_nodes or set()
    if start in avoid or goal in avoid:
        return [], float("inf"), float("inf")

    open_set: List[Tuple[float, float, str]] = []  # (f_score, g_score, node)
    heapq.heappush(open_set, (heuristic_fn(start, goal), 0.0, start))

    came_from: Dict[str, str] = {}
    cost_so_far: Dict[str, float] = {start: 0.0}
    dist_so_far: Dict[str, float] = {start: 0.0}

    while open_set:
        _, current_g, current = heapq.heappop(open_set)

        if current == goal:
            break

        if current_g > cost_so_far.get(current, float("inf")):
            continue

        for edge in graph.get(current, []):
            neighbor = edge["neighbor"]
            if neighbor in avoid and neighbor != goal:
                continue

            new_cost = cost_so_far[current] + edge["cost"]
            new_dist = dist_so_far[current] + edge.get("distance", edge["cost"])

            if neighbor not in cost_so_far or new_cost < cost_so_far[neighbor]:
                cost_so_far[neighbor] = new_cost
                dist_so_far[neighbor] = new_dist
                f_score = new_cost + heuristic_fn(neighbor, goal)
                heapq.heappush(open_set, (f_score, new_cost, neighbor))
                came_from[neighbor] = current

    if goal not in came_from and start != goal:
        return [], float("inf"), float("inf")

    # Reconstruct path
    path = []
    curr = goal
    while curr != start:
        path.append(curr)
        curr = came_from[curr]
    path.append(start)
    path.reverse()

    return path, cost_so_far[goal], dist_so_far[goal]


def haversine_heuristic(node: str, goal: str, nodes: Optional[Dict[str, Dict[str, Any]]] = None) -> float:
    """Admissible A* heuristic: Euclidean/Haversine distance under optimal conditions."""
    active_nodes = nodes or NAGPUR_NODES
    if node not in active_nodes or goal not in active_nodes:
        return 0.0
    return haversine_km(
        active_nodes[node]["latitude"], active_nodes[node]["longitude"],
        active_nodes[goal]["latitude"], active_nodes[goal]["longitude"],
    )


def find_optimal_detour(
    start: str,
    goal: str,
    closed_edges: Optional[List[Tuple[str, str]]] = None,
    traffic_multipliers: Optional[Dict[str, float]] = None,
    avoid_nodes: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """
    Computes optimal route or alternative detour between start and goal.
    Handles road closures and congestion multipliers.
    """
    closed_set = set(closed_edges) if closed_edges else set()
    avoid_set = set(avoid_nodes) if avoid_nodes else set()

    # Format traffic multiplier keys if passed as string tuples
    t_mods = {}
    if traffic_multipliers:
        for k, v in traffic_multipliers.items():
            if isinstance(k, tuple):
                t_mods[k] = float(v)
            elif isinstance(k, str) and "-" in k:
                p1, p2 = k.split("-")
                t_mods[(p1.strip(), p2.strip())] = float(v)

    # 1. Base network (no closures)
    base_graph = build_network_graph()
    base_path, base_cost, base_dist = a_star_search(
        base_graph, start, goal, lambda u, v: haversine_heuristic(u, v)
    )

    # 2. Disrupted network
    disrupted_graph = build_network_graph(
        closed_edges=closed_set,
        traffic_multipliers=t_mods,
    )
    detour_path, detour_cost, detour_dist = a_star_search(
        disrupted_graph, start, goal, lambda u, v: haversine_heuristic(u, v), avoid_nodes=avoid_set
    )

    is_rerouted = detour_path != base_path and len(detour_path) > 0

    return {
        "start": start,
        "goal": goal,
        "base_route": {
            "path": base_path,
            "cost": round(base_cost, 4),
            "distance_km": round(base_dist, 3),
        },
        "optimal_route": {
            "path": detour_path,
            "cost": round(detour_cost, 4),
            "distance_km": round(detour_dist, 3),
        },
        "detour_required": is_rerouted,
        "cost_delta": round(detour_cost - base_cost, 4) if len(detour_path) else 0.0,
        "distance_delta_km": round(detour_dist - base_dist, 3) if len(detour_path) else 0.0,
        "closed_edges": list(closed_set),
        "avoid_nodes": list(avoid_set),
    }


# Backwards compatibility function matching original toy signature
def a_star(graph, start, goal, heuristic):
    """Backwards compatibility adapter for original toy interface."""
    open_list = []
    heapq.heappush(open_list, (0, start))
    came_from = {}
    cost_so_far = {start: 0}

    while open_list:
        _, current = heapq.heappop(open_list)
        if current == goal:
            break
        for neighbor, distance in graph.get(current, []):
            new_cost = cost_so_far[current] + distance
            if neighbor not in cost_so_far or new_cost < cost_so_far[neighbor]:
                cost_so_far[neighbor] = new_cost
                priority = new_cost + heuristic(neighbor, goal)
                heapq.heappush(open_list, (priority, neighbor))
                came_from[neighbor] = current

    if goal not in came_from and start != goal:
        return [], float("inf")

    path = []
    current = goal
    while current != start:
        path.append(current)
        current = came_from[current]
    path.append(start)
    path.reverse()
    return path, cost_so_far[goal]


if __name__ == "__main__":
    import json
    # Demo execution
    res = find_optimal_detour("DEPOT", "D006", closed_edges=[("DEPOT", "D005"), ("D001", "D005")])
    print(json.dumps(res, indent=2))