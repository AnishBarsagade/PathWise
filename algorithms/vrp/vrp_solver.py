import math
from pathlib import Path

import pandas as pd
from ortools.constraint_solver import pywrapcp, routing_enums_pb2

from algorithms.cost_function.cost_function import (
    calculate_route_cost,
    get_ahp_weights_dict,
)


# ============================================================
# PATHS
# ============================================================

PROJECT_ROOT = Path(__file__).resolve().parents[2]

DELIVERIES_FILE = PROJECT_ROOT / "data" / "deliveries.csv"
VEHICLES_FILE = PROJECT_ROOT / "data" / "vehicles.csv"


# Temporary demonstration depot
DEPOT = {
    "latitude": 21.1450,
    "longitude": 79.0880,
}


# ============================================================
# 1. LOAD DATA
# ============================================================

def load_data():
    deliveries = pd.read_csv(DELIVERIES_FILE)
    vehicles = pd.read_csv(VEHICLES_FILE)

    return deliveries, vehicles


# ============================================================
# 2. VALIDATE DATA
# ============================================================

def validate_data(deliveries, vehicles):

    required_delivery_columns = [
        "delivery_id",
        "location",
        "latitude",
        "longitude",
        "weight",
        "priority",
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

    if (deliveries["weight"] <= 0).any():
        raise ValueError("Delivery weight must be greater than 0.")

    if (vehicles["capacity"] <= 0).any():
        raise ValueError("Vehicle capacity must be greater than 0.")

    if (vehicles["fuel_cost"] <= 0).any():
        raise ValueError("Vehicle fuel cost must be greater than 0.")

    if deliveries["weight"].max() > vehicles["capacity"].max():
        raise ValueError(
            "A delivery exceeds the maximum vehicle capacity."
        )

    print("Data validation successful!")


# ============================================================
# 3. HAVERSINE DISTANCE
# ============================================================

def haversine_distance(lat1, lon1, lat2, lon2):

    R = 6371.0  # Earth radius in km

    lat1 = math.radians(lat1)
    lon1 = math.radians(lon1)

    lat2 = math.radians(lat2)
    lon2 = math.radians(lon2)

    dlat = lat2 - lat1
    dlon = lon2 - lon1

    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(lat1)
        * math.cos(lat2)
        * math.sin(dlon / 2) ** 2
    )

    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    return R * c


# ============================================================
# 4. CREATE LOCATIONS
# ============================================================

def create_locations(deliveries):

    locations = [
        {
            "id": "DEPOT",
            "latitude": DEPOT["latitude"],
            "longitude": DEPOT["longitude"],
        }
    ]

    for _, row in deliveries.iterrows():

        locations.append(
            {
                "id": row["delivery_id"],
                "latitude": row["latitude"],
                "longitude": row["longitude"],
            }
        )

    return locations


# ============================================================
# 5. CREATE DISTANCE MATRIX
# ============================================================

def create_distance_matrix(locations):

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

def create_factor_matrices(locations, vehicles):

    n = len(locations)

    distance_matrix = [[0.0] * n for _ in range(n)]

    travel_time_matrix = [[0.0] * n for _ in range(n)]

    traffic_matrix = [[0.0] * n for _ in range(n)]

    fuel_cost_matrix = [[0.0] * n for _ in range(n)]

    weather_matrix = [[0.0] * n for _ in range(n)]

    road_condition_matrix = [[0.0] * n for _ in range(n)]


    # Use average vehicle fuel cost for demonstration.
    average_fuel_cost = vehicles["fuel_cost"].mean()


    for i in range(n):

        for j in range(n):

            if i == j:
                continue


            # --------------------------------------------
            # Distance
            # --------------------------------------------

            distance = haversine_distance(
                locations[i]["latitude"],
                locations[i]["longitude"],
                locations[j]["latitude"],
                locations[j]["longitude"],
            )

            distance_matrix[i][j] = distance


            # --------------------------------------------
            # Travel Time
            #
            # DEMO:
            # Assume average speed = 30 km/h
            # --------------------------------------------

            average_speed = 30.0

            travel_time = (distance / average_speed) * 60

            travel_time_matrix[i][j] = travel_time


            # --------------------------------------------
            # Traffic
            #
            # DEMO VALUE
            # --------------------------------------------

            traffic_matrix[i][j] = 3.0


            # --------------------------------------------
            # Fuel Cost
            #
            # DEMO:
            # fuel cost per km is approximated using
            # vehicle fuel_cost value.
            # --------------------------------------------

            fuel_cost_matrix[i][j] = (
                distance * average_fuel_cost
            )


            # --------------------------------------------
            # Weather
            #
            # DEMO VALUE
            # --------------------------------------------

            weather_matrix[i][j] = 2.0


            # --------------------------------------------
            # Road Condition
            #
            # DEMO VALUE
            # --------------------------------------------

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

def create_multifactor_cost_matrix(factor_matrices):

    n = len(factor_matrices["distance"])

    cost_matrix = [[0] * n for _ in range(n)]


    # Get AHP weights from existing AHP module
    ahp_weights = get_ahp_weights_dict()

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

                road_condition=factor_matrices[
                    "road_condition"
                ][i][j],

                weights=ahp_weights,

            )


            # OR-Tools requires integer costs.
            # Scale the normalized cost.
            cost_matrix[i][j] = int(route_cost * 1000)

    return cost_matrix


# ============================================================
# 8. CREATE OR-TOOLS DATA MODEL
# ============================================================

def create_data_model(
    cost_matrix,
    deliveries,
    vehicles,
):

    data = {}

    data["cost_matrix"] = cost_matrix

    # Depot = node 0
    # Delivery D001 = node 1
    # Delivery D002 = node 2
    # ...
    data["demands"] = [0] + deliveries["weight"].astype(int).tolist()

    data["vehicle_capacities"] = (
        vehicles["capacity"].astype(int).tolist()
    )

    data["num_vehicles"] = len(vehicles)

    data["depot"] = 0

    return data


# ============================================================
# 9. CREATE OR-TOOLS MODEL
# ============================================================

def create_routing_model(data):

    manager = pywrapcp.RoutingIndexManager(
        len(data["cost_matrix"]),
        data["num_vehicles"],
        data["depot"],
    )

    routing = pywrapcp.RoutingModel(manager)


    # ========================================================
    # COST CALLBACK
    # ========================================================

    def cost_callback(from_index, to_index):

        from_node = manager.IndexToNode(from_index)

        to_node = manager.IndexToNode(to_index)

        return data["cost_matrix"][from_node][to_node]


    cost_callback_index = routing.RegisterTransitCallback(
        cost_callback
    )

    routing.SetArcCostEvaluatorOfAllVehicles(
        cost_callback_index
    )


    # ========================================================
    # DEMAND CALLBACK
    # ========================================================

    def demand_callback(from_index):

        from_node = manager.IndexToNode(from_index)

        return data["demands"][from_node]


    demand_callback_index = routing.RegisterUnaryTransitCallback(
        demand_callback
    )


    # ========================================================
    # VEHICLE CAPACITY
    # ========================================================

    routing.AddDimensionWithVehicleCapacity(
        demand_callback_index,
        0,  # no slack
        data["vehicle_capacities"],
        True,  # start cumul at zero
        "Capacity",
    )


    # ========================================================
    # SEARCH PARAMETERS
    # ========================================================

    search_parameters = pywrapcp.DefaultRoutingSearchParameters()

    search_parameters.first_solution_strategy = (
        routing_enums_pb2.FirstSolutionStrategy.PATH_CHEAPEST_ARC
    )


    return manager, routing, search_parameters


# ============================================================
# 10. PRINT SOLUTION
# ============================================================

def print_solution(
    manager,
    routing,
    solution,
    deliveries,
    vehicles,
    factor_matrices,
):

    print("\n")
    print("=" * 30)
    print("PATHWISE MULTI-FACTOR VRP RESULT")
    print("=" * 30)


    total_cost = 0

    total_load = 0


    for vehicle_id in range(len(vehicles)):

        index = routing.Start(vehicle_id)

        route = []

        route_load = 0

        route_cost = 0


        while not routing.IsEnd(index):

            node = manager.IndexToNode(index)

            route.append(node)

            route_load += (
                0
                if node == 0
                else int(deliveries.iloc[node - 1]["weight"])
            )


            next_index = solution.Value(
                routing.NextVar(index)
            )

            route_cost += routing.GetArcCostForVehicle(
                index,
                next_index,
                vehicle_id,
            )

            index = next_index


        route.append(
            manager.IndexToNode(index)
        )


        # Convert node numbers to delivery IDs

        route_names = []

        for node in route:

            if node == 0:
                route_names.append("DEPOT")

            else:
                route_names.append(
                    deliveries.iloc[node - 1]["delivery_id"]
                )


        vehicle_name = vehicles.iloc[
            vehicle_id
        ]["vehicle_id"]

        vehicle_capacity = vehicles.iloc[
            vehicle_id
        ]["capacity"]


        print(f"\nVehicle {vehicle_name}")

        print(
            "Route: "
            + " -> ".join(route_names)
        )

        print(
            f"Load: {route_load} / "
            f"{int(vehicle_capacity)} kg"
        )

        print(
            f"Multi-factor cost: "
            f"{route_cost / 1000:.4f}"
        )


        total_cost += route_cost

        total_load += route_load


    print("\n" + "=" * 30)

    print(
        f"Total multi-factor cost: "
        f"{total_cost / 1000:.4f}"
    )

    print(
        f"Total delivery load: "
        f"{total_load} kg"
    )

    print("=" * 30)


# ============================================================
# 11. MAIN
# ============================================================

def main():

    print("Loading PathWise data...")

    deliveries, vehicles = load_data()

    print(
        f"Deliveries loaded: {len(deliveries)}"
    )

    print(
        f"Vehicles loaded: {len(vehicles)}"
    )


    print("\nValidating data...")

    validate_data(
        deliveries,
        vehicles,
    )


    # --------------------------------------------------------
    # Create locations
    # --------------------------------------------------------

    locations = create_locations(
        deliveries
    )


    print("\nCreating multi-factor matrices...")

    factor_matrices = create_factor_matrices(
        locations,
        vehicles,
    )


    print(
        f"Matrix size: "
        f"{len(locations)} x {len(locations)}"
    )


    # --------------------------------------------------------
    # Multi-factor cost matrix
    # --------------------------------------------------------

    print(
        "\nCreating multi-factor cost matrix..."
    )

    cost_matrix = create_multifactor_cost_matrix(
        factor_matrices
    )
    print("\nMulti-Factor Cost Matrix:")

    for row in cost_matrix:
        print(row)


    # --------------------------------------------------------
    # OR-Tools
    # --------------------------------------------------------

    print("\nRunning OR-Tools...")

    data = create_data_model(
        cost_matrix,
        deliveries,
        vehicles,
    )


    manager, routing, search_parameters = (
        create_routing_model(data)
    )


    solution = routing.SolveWithParameters(
        search_parameters
    )


    if solution:

        print_solution(
            manager,
            routing,
            solution,
            deliveries,
            vehicles,
            factor_matrices,
        )

    else:

        print(
            "No solution found."
        )


# ============================================================
# RUN
# ============================================================

if __name__ == "__main__":
    main()