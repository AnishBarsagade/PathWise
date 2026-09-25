import argparse
import json
import math
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, Union

import pandas as pd
from ortools.constraint_solver import pywrapcp, routing_enums_pb2

# Ensure project root is in sys.path
PROJECT_ROOT = Path(__file__).resolve().parents[2]
ALGORITHMS_DIR = Path(__file__).resolve().parents[1]
for p in [str(PROJECT_ROOT), str(ALGORITHMS_DIR)]:
    if p not in sys.path:
        sys.path.insert(0, p)

try:
    from algorithms.cost_function.cost_function import (
        calculate_route_cost,
        get_ahp_weights_dict,
    )
except ImportError:
    try:
        from cost_function.cost_function import (
            calculate_route_cost,
            get_ahp_weights_dict,
        )
    except ImportError:
        from PathWise.algorithms.cost_function.cost_function import (
            calculate_route_cost,
            get_ahp_weights_dict,
        )


# ============================================================
# PATHS & DEFAULTS
# ============================================================

DELIVERIES_FILE = PROJECT_ROOT / "data" / "deliveries.csv"
VEHICLES_FILE = PROJECT_ROOT / "data" / "vehicles.csv"

DEPOT = {
    "latitude": 21.1450,
    "longitude": 79.0880,
}


# ============================================================
# 1. LOAD DATA
# ============================================================

def load_data(
    deliveries_path: Optional[Union[str, Path]] = None,
    vehicles_path: Optional[Union[str, Path]] = None,
) -> Tuple[pd.DataFrame, pd.DataFrame]:
    deliv_p = Path(deliveries_path) if deliveries_path else DELIVERIES_FILE
    veh_p = Path(vehicles_path) if vehicles_path else VEHICLES_FILE

    deliveries = pd.read_csv(deliv_p)
    vehicles = pd.read_csv(veh_p)

    return deliveries, vehicles


# ============================================================
# 2. VALIDATE DATA
# ============================================================

def validate_data(deliveries: pd.DataFrame, vehicles: pd.DataFrame) -> None:
    if deliveries is None or len(deliveries) == 0:
        raise ValueError("Missing deliveries data.")

    if vehicles is None or len(vehicles) == 0:
        raise ValueError("Missing vehicles data.")

    required_delivery_columns = [
        "delivery_id",
        "latitude",
        "longitude",
        "weight",
    ]

    required_vehicle_columns = [
        "vehicle_id",
        "capacity",
        "fuel_cost",
    ]

    for column in required_delivery_columns:
        if column not in deliveries.columns:
            raise ValueError(f"Missing delivery column: {column}")

    for column in required_vehicle_columns:
        if column not in vehicles.columns:
            raise ValueError(f"Missing vehicle column: {column}")

    if deliveries[required_delivery_columns].isnull().any().any():
        raise ValueError("Delivery data contains missing values.")

    if vehicles[required_vehicle_columns].isnull().any().any():
        raise ValueError("Vehicle data contains missing values.")

    # Validate coordinate ranges
    if ((deliveries["latitude"] < -90) | (deliveries["latitude"] > 90)).any():
        raise ValueError("Delivery latitude must be between -90 and 90.")

    if ((deliveries["longitude"] < -180) | (deliveries["longitude"] > 180)).any():
        raise ValueError("Delivery longitude must be between -180 and 180.")

    if (deliveries["weight"] <= 0).any():
        raise ValueError("Delivery weight must be greater than 0.")

    if (vehicles["capacity"] <= 0).any():
        raise ValueError("Vehicle capacity must be greater than 0.")

    if (vehicles["fuel_cost"] <= 0).any():
        raise ValueError("Vehicle fuel cost must be greater than 0.")

    max_delivery_weight = deliveries["weight"].max()
    max_vehicle_capacity = vehicles["capacity"].max()
    if max_delivery_weight > max_vehicle_capacity:
        raise ValueError(
            f"A delivery weight ({max_delivery_weight}) exceeds the maximum vehicle capacity ({max_vehicle_capacity})."
        )


# ============================================================
# 3. HAVERSINE DISTANCE
# ============================================================

def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371.0  # Earth radius in km

    r_lat1 = math.radians(lat1)
    r_lon1 = math.radians(lon1)
    r_lat2 = math.radians(lat2)
    r_lon2 = math.radians(lon2)

    dlat = r_lat2 - r_lat1
    dlon = r_lon2 - r_lon1

    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(r_lat1)
        * math.cos(r_lat2)
        * math.sin(dlon / 2) ** 2
    )

    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c


# ============================================================
# 4. CREATE LOCATIONS
# ============================================================

def create_locations(
    deliveries: pd.DataFrame,
    depot: Optional[Dict[str, float]] = None,
) -> List[Dict[str, Any]]:
    depot_loc = depot or DEPOT
    locations = [
        {
            "id": "DEPOT",
            "latitude": float(depot_loc["latitude"]),
            "longitude": float(depot_loc["longitude"]),
        }
    ]

    for _, row in deliveries.iterrows():
        locations.append(
            {
                "id": str(row["delivery_id"]),
                "latitude": float(row["latitude"]),
                "longitude": float(row["longitude"]),
            }
        )

    return locations


# ============================================================
# 5. CREATE DISTANCE MATRIX
# ============================================================

def create_distance_matrix(locations: List[Dict[str, Any]]) -> List[List[float]]:
    n = len(locations)
    distance_matrix = [[0.0] * n for _ in range(n)]

    for i in range(n):
        for j in range(n):
            if i == j:
                continue
            distance_matrix[i][j] = haversine_distance(
                locations[i]["latitude"],
                locations[i]["longitude"],
                locations[j]["latitude"],
                locations[j]["longitude"],
            )

    return distance_matrix


# ============================================================
# 6. CREATE DEMONSTRATION FACTORS
# ============================================================

def create_factor_matrices(
    locations: List[Dict[str, Any]],
    vehicles: pd.DataFrame,
) -> Dict[str, List[List[float]]]:
    n = len(locations)

    distance_matrix = [[0.0] * n for _ in range(n)]
    travel_time_matrix = [[0.0] * n for _ in range(n)]
    traffic_matrix = [[0.0] * n for _ in range(n)]
    fuel_cost_matrix = [[0.0] * n for _ in range(n)]
    weather_matrix = [[0.0] * n for _ in range(n)]
    road_condition_matrix = [[0.0] * n for _ in range(n)]

    average_fuel_cost = float(vehicles["fuel_cost"].mean())
    average_speed = 30.0  # km/h

    for i in range(n):
        for j in range(n):
            if i == j:
                continue

            distance = haversine_distance(
                locations[i]["latitude"],
                locations[i]["longitude"],
                locations[j]["latitude"],
                locations[j]["longitude"],
            )

            distance_matrix[i][j] = distance
            travel_time_matrix[i][j] = (distance / average_speed) * 60
            traffic_matrix[i][j] = 3.0
            fuel_cost_matrix[i][j] = distance * average_fuel_cost
            weather_matrix[i][j] = 2.0
            road_condition_matrix[i][j] = 2.0

    return {
        "distance": distance_matrix,
        "travel_time": travel_time_matrix,
        "traffic": traffic_matrix,
        "fuel_cost": fuel_cost_matrix,
        "weather": weather_matrix,
        "road_condition": road_condition_matrix,
    }


# ============================================================
# 7. CREATE MULTI-FACTOR COST MATRIX
# ============================================================

def create_multifactor_cost_matrix(
    factor_matrices: Dict[str, List[List[float]]],
    verbose: bool = False,
) -> List[List[int]]:
    n = len(factor_matrices["distance"])
    cost_matrix = [[0] * n for _ in range(n)]
    ahp_weights = get_ahp_weights_dict()

    if verbose:
        print("\nAHP Weights:")
        for factor, weight in ahp_weights.items():
            print(f"{factor}: {weight:.4f}")

    for i in range(n):
        for j in range(n):
            if i == j:
                cost_matrix[i][j] = 0
                continue

            route_cost = calculate_route_cost(
                distance=factor_matrices["distance"][i][j],
                travel_time=factor_matrices["travel_time"][i][j],
                traffic=factor_matrices["traffic"][i][j],
                fuel_cost=factor_matrices["fuel_cost"][i][j],
                weather=factor_matrices["weather"][i][j],
                road_condition=factor_matrices["road_condition"][i][j],
                weights=ahp_weights,
            )

            cost_matrix[i][j] = int(route_cost * 1000)

    return cost_matrix


# ============================================================
# 8. CREATE OR-TOOLS DATA MODEL
# ============================================================

def create_data_model(
    cost_matrix: List[List[int]],
    deliveries: pd.DataFrame,
    vehicles: pd.DataFrame,
) -> Dict[str, Any]:
    data = {}
    data["cost_matrix"] = cost_matrix
    data["demands"] = [0] + deliveries["weight"].astype(int).tolist()
    data["vehicle_capacities"] = vehicles["capacity"].astype(int).tolist()
    data["num_vehicles"] = len(vehicles)
    data["depot"] = 0
    return data


# ============================================================
# 9. CREATE OR-TOOLS MODEL
# ============================================================

def create_routing_model(data: Dict[str, Any]):
    manager = pywrapcp.RoutingIndexManager(
        len(data["cost_matrix"]),
        data["num_vehicles"],
        data["depot"],
    )

    routing = pywrapcp.RoutingModel(manager)

    def cost_callback(from_index, to_index):
        from_node = manager.IndexToNode(from_index)
        to_node = manager.IndexToNode(to_index)
        return data["cost_matrix"][from_node][to_node]

    cost_callback_index = routing.RegisterTransitCallback(cost_callback)
    routing.SetArcCostEvaluatorOfAllVehicles(cost_callback_index)

    def demand_callback(from_index):
        from_node = manager.IndexToNode(from_index)
        return data["demands"][from_node]

    demand_callback_index = routing.RegisterUnaryTransitCallback(demand_callback)

    routing.AddDimensionWithVehicleCapacity(
        demand_callback_index,
        0,  # no slack
        data["vehicle_capacities"],
        True,  # start cumul at zero
        "Capacity",
    )

    search_parameters = pywrapcp.DefaultRoutingSearchParameters()
    search_parameters.first_solution_strategy = (
        routing_enums_pb2.FirstSolutionStrategy.PATH_CHEAPEST_ARC
    )

    return manager, routing, search_parameters


try:
    from algorithms.astar.astar import a_star
except ImportError:
    try:
        from astar.astar import a_star
    except ImportError:
        pass


# ============================================================
# 10. FORMAT SOLUTION (STRUCTURED DATA)
# ============================================================

def format_solution(
    manager: pywrapcp.RoutingIndexManager,
    routing: pywrapcp.RoutingModel,
    solution: Any,
    deliveries: pd.DataFrame,
    vehicles: pd.DataFrame,
    factor_matrices: Optional[Dict[str, List[List[float]]]] = None,
    include_empty_routes: bool = False,
) -> Dict[str, Any]:
    routes = []
    total_cost = 0
    total_load = 0
    total_distance = 0.0

    distance_matrix = factor_matrices.get("distance") if factor_matrices else None

    for vehicle_id in range(len(vehicles)):
        index = routing.Start(vehicle_id)
        route_nodes = []
        route_load = 0
        route_cost = 0
        route_distance = 0.0

        while not routing.IsEnd(index):
            node = manager.IndexToNode(index)
            route_nodes.append(node)
            route_load += 0 if node == 0 else int(deliveries.iloc[node - 1]["weight"])

            next_index = solution.Value(routing.NextVar(index))
            next_node = manager.IndexToNode(next_index)
            route_cost += routing.GetArcCostForVehicle(index, next_index, vehicle_id)
            if distance_matrix:
                route_distance += distance_matrix[node][next_node]
            index = next_index

        route_nodes.append(manager.IndexToNode(index))

        route_names = []
        for node in route_nodes:
            if node == 0:
                route_names.append("DEPOT")
            else:
                route_names.append(str(deliveries.iloc[node - 1]["delivery_id"]))

        vehicle_name = str(vehicles.iloc[vehicle_id]["vehicle_id"])
        vehicle_capacity = int(vehicles.iloc[vehicle_id]["capacity"])
        scaled_cost = round(route_cost / 1000.0, 4)

        route_dict = {
            "vehicle_id": vehicle_name,
            "route": route_names,
            "load": route_load,
            "capacity": vehicle_capacity,
            "distance": round(route_distance, 2),
            "cost": scaled_cost,
        }

        total_cost += route_cost
        total_load += route_load
        total_distance += route_distance

        # If vehicle served any deliveries (has nodes besides DEPOT -> DEPOT)
        if len(route_names) > 2 or include_empty_routes:
            routes.append(route_dict)

    return {
        "routes": routes,
        "total_cost": round(total_cost / 1000.0, 4),
        "total_distance": round(total_distance, 2),
        "total_load": total_load,
    }


# ============================================================
# 11. PRINT SOLUTION (DISPLAY LOGIC)
# ============================================================

def print_solution(
    result: Dict[str, Any],
    all_vehicles: Optional[pd.DataFrame] = None,
) -> None:
    print("\n")
    print("=" * 30)
    print("PATHWISE MULTI-FACTOR VRP RESULT")
    print("=" * 30)

    for r in result.get("routes", []):
        print(f"\nVehicle {r['vehicle_id']}")
        print("Route: " + " -> ".join(r["route"]))
        print(f"Load: {r['load']} / {r['capacity']} kg")
        if "distance" in r:
            print(f"Distance: {r['distance']} km")
        print(f"Multi-factor cost: {r['cost']:.4f}")

    print("\n" + "=" * 30)
    print(f"Total multi-factor cost: {result['total_cost']:.4f}")
    if "total_distance" in result:
        print(f"Total distance: {result['total_distance']} km")
    print(f"Total delivery load: {result['total_load']} kg")
    print("=" * 30)


# ============================================================
# 12. OPTIMIZE ROUTES (CORE CALLABLE FUNCTION)
# ============================================================

def optimize_routes(
    deliveries: Optional[Union[pd.DataFrame, List[Dict[str, Any]]]] = None,
    vehicles: Optional[Union[pd.DataFrame, List[Dict[str, Any]]]] = None,
    depot: Optional[Dict[str, float]] = None,
    verbose: bool = False,
) -> Dict[str, Any]:
    # 1. Load data if not provided
    if deliveries is None or vehicles is None:
        demo_deliveries, demo_vehicles = load_data()
        if deliveries is None:
            deliveries = demo_deliveries
        if vehicles is None:
            vehicles = demo_vehicles

    # Convert list of dicts to DataFrame if needed
    if isinstance(deliveries, list):
        deliveries = pd.DataFrame(deliveries)
    if isinstance(vehicles, list):
        vehicles = pd.DataFrame(vehicles)

    # 2. Validate
    validate_data(deliveries, vehicles)

    # 3. Create locations
    locations = create_locations(deliveries, depot=depot)

    # 4. Multi-factor matrices
    factor_matrices = create_factor_matrices(locations, vehicles)

    # 5. Multi-factor cost matrix
    cost_matrix = create_multifactor_cost_matrix(factor_matrices, verbose=verbose)

    # 6. OR-Tools Data & Routing Model
    data = create_data_model(cost_matrix, deliveries, vehicles)
    manager, routing, search_parameters = create_routing_model(data)

    # 7. Solve
    solution = routing.SolveWithParameters(search_parameters)

    if not solution:
        raise RuntimeError("No feasible VRP solution found for the provided inputs.")

    # 8. Return structured solution
    return format_solution(
        manager,
        routing,
        solution,
        deliveries,
        vehicles,
        factor_matrices=factor_matrices,
    )


# ============================================================
# 13. MAIN / CLI
# ============================================================

def main():
    parser = argparse.ArgumentParser(description="PathWise VRP Optimization Engine")
    parser.add_argument("--json", action="store_true", help="Output result as JSON to stdout")
    parser.add_argument("--input", type=str, default=None, help="Path to input JSON file or raw JSON string, or '-' for stdin")
    parser.add_argument("--stdin", action="store_true", help="Read input JSON from stdin")
    args = parser.parse_args()

    input_data = None
    # Check if input was provided via --input or --stdin
    if args.stdin or args.input == "-":
        stdin_content = sys.stdin.read().strip()
        if stdin_content:
            try:
                input_data = json.loads(stdin_content)
            except Exception as e:
                if args.json:
                    print(json.dumps({"error": "Invalid JSON input", "message": str(e)}))
                    sys.exit(1)
                raise
    elif args.input:
        input_str = args.input.strip()
        if Path(input_str).is_file():
            with open(input_str, "r", encoding="utf-8") as f:
                input_data = json.load(f)
        else:
            try:
                input_data = json.loads(input_str)
            except Exception as e:
                if args.json:
                    print(json.dumps({"error": "Invalid JSON input", "message": str(e)}))
                    sys.exit(1)
                raise

    deliveries = None
    vehicles = None
    depot = None

    if input_data:
        deliveries = input_data.get("deliveries")
        vehicles = input_data.get("vehicles")
        depot = input_data.get("depot")

    try:
        result = optimize_routes(
            deliveries=deliveries,
            vehicles=vehicles,
            depot=depot,
            verbose=not args.json,
        )

        if args.json:
            print(json.dumps(result))
        else:
            print_solution(result)

    except Exception as exc:
        if args.json:
            print(json.dumps({"error": "Optimization Error", "message": str(exc)}))
            sys.exit(1)
        else:
            print(f"Error during optimization: {exc}", file=sys.stderr)
            sys.exit(1)


if __name__ == "__main__":
    main()