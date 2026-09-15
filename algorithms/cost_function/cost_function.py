"""
Multi-Factor Cost Function Module for PathWise.

This module computes a composite, multi-factor route cost that sits
between A* route generation and OR-Tools Vehicle Routing Problem (VRP)
optimization.

Factors Evaluated:
1. Distance (km)           - Cost-type: shorter is better.
2. Travel Time (min)       - Cost-type: faster is better.
3. Traffic (1-5 score)     - Cost-type: 1 = Free flow, 5 = Severe congestion.
4. Fuel Cost (₹)           - Cost-type: lower cost is better.
5. Weather (1-5 score)     - Cost-type: 1 = Clear/Optimal, 5 = Severe storm/Hazardous.
6. Road Condition (1-5)    - Cost-type: 1 = Excellent/Smooth, 5 = Severe potholes/Poor.

Higher normalized cost corresponds to a worse route; lower cost corresponds to an optimal route.
Weights are dynamically loaded from the AHP module (algorithms.ahp.ahp).
"""

import sys
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Union

# Ensure algorithms and PathWise packages can be imported regardless of execution context
CURRENT_DIR = Path(__file__).resolve().parent
ALGORITHMS_DIR = CURRENT_DIR.parent
PROJECT_ROOT = ALGORITHMS_DIR.parent

for p in [str(PROJECT_ROOT), str(ALGORITHMS_DIR)]:
    if p not in sys.path:
        sys.path.insert(0, p)

# Dynamically import AHP calculation without hardcoding weights
try:
    from algorithms.ahp.ahp import CRITERIA, calculate_ahp_weights
except ImportError:
    try:
        from ahp.ahp import CRITERIA, calculate_ahp_weights
    except ImportError:
        from PathWise.algorithms.ahp.ahp import CRITERIA, calculate_ahp_weights

# Standard factor keys matching the 6 criteria
FACTOR_KEYS = [
    "distance",
    "travel_time",
    "traffic",
    "fuel_cost",
    "weather",
    "road_condition",
]

# Mapping from canonical key to AHP CRITERIA display names
KEY_TO_CRITERIA_NAME = {
    "distance": "Distance",
    "travel_time": "Travel Time",
    "traffic": "Traffic",
    "fuel_cost": "Fuel Cost",
    "weather": "Weather",
    "road_condition": "Road Condition",
}

# Default operational reference bounds for Nagpur city delivery network
# Used for single-route normalization when no batch comparison set is provided.
DEFAULT_BOUNDS = {
    "distance": (1.0, 30.0),       # km (local delivery hops)
    "travel_time": (5.0, 90.0),     # minutes
    "traffic": (1.0, 5.0),          # score: 1 (free-flow) to 5 (severe gridlock)
    "fuel_cost": (10.0, 300.0),     # ₹
    "weather": (1.0, 5.0),          # score: 1 (clear) to 5 (severe storm)
    "road_condition": (1.0, 5.0),   # score: 1 (smooth asphalt) to 5 (severe damage)
}


def get_ahp_weights_dict() -> Dict[str, float]:
    """
    Fetch priority weights dynamically calculated by the AHP module.
    Returns a dictionary mapping canonical factor keys to their respective weights.
    """
    weights_list, _ = calculate_ahp_weights()
    weights_dict = {}
    for criterion, weight in zip(CRITERIA, weights_list):
        key = criterion.lower().replace(" ", "_")
        weights_dict[key] = weight
    return weights_dict


def normalize_min_max(value: float, min_val: float, max_val: float) -> float:
    """
    Min-Max normalization (linear feature scaling) for cost-type criteria.
    Maps value to [0.0, 1.0].
    
    Formula:
        N = (value - min_val) / (max_val - min_val)
        
    - If value == min_val (best condition), N = 0.0 (minimum cost penalty).
    - If value == max_val (worst condition), N = 1.0 (maximum cost penalty).
    - If min_val == max_val, N = 0.0 (no variance between alternatives).
    """
    if max_val <= min_val:
        return 0.0
    normalized = (value - min_val) / (max_val - min_val)
    # Clamp to [0.0, 1.0] to safeguard against out-of-bound edge cases
    return max(0.0, min(1.0, float(normalized)))


def normalize_factors(
    factors: Dict[str, float],
    bounds: Optional[Dict[str, Tuple[float, float]]] = None,
) -> Dict[str, float]:
    """
    Normalize a dictionary of raw factor values using specified or default bounds.
    """
    active_bounds = bounds or DEFAULT_BOUNDS
    normalized = {}
    for key in FACTOR_KEYS:
        val = factors.get(key, 0.0)
        min_val, max_val = active_bounds.get(key, (0.0, 1.0))
        normalized[key] = normalize_min_max(val, min_val, max_val)
    return normalized


def calculate_route_cost(
    distance: float,
    travel_time: float,
    traffic: float,
    fuel_cost: float,
    weather: float,
    road_condition: float,
    weights: Optional[Union[Dict[str, float], List[float]]] = None,
    bounds: Optional[Dict[str, Tuple[float, float]]] = None,
    normalized: bool = False,
) -> float:
    """
    Calculate the composite multi-factor cost for a route or edge.
    
    Parameters:
        distance: Distance in km.
        travel_time: Travel time in minutes.
        traffic: Traffic score (1 = clear, 5 = severe congestion).
        fuel_cost: Fuel cost in ₹.
        weather: Weather score (1 = optimal, 5 = severe storm).
        road_condition: Road condition score (1 = smooth, 5 = severe damage).
        weights: Optional dictionary or list of AHP weights. If None, dynamically
                 retrieved from algorithms.ahp.ahp.
        bounds: Optional min/max reference bounds for normalization.
        normalized: If True, inputs are assumed to already be normalized in [0, 1].
        
    Returns:
        float: Weighted multi-factor cost in range [0.0, 1.0].
               Lower cost indicates a better route.
    """
    raw_factors = {
        "distance": float(distance),
        "travel_time": float(travel_time),
        "traffic": float(traffic),
        "fuel_cost": float(fuel_cost),
        "weather": float(weather),
        "road_condition": float(road_condition),
    }

    # Obtain normalized factors
    if normalized:
        norm_factors = raw_factors
    else:
        norm_factors = normalize_factors(raw_factors, bounds=bounds)

    # Resolve AHP weights
    if weights is None:
        weights_dict = get_ahp_weights_dict()
    elif isinstance(weights, list):
        if len(weights) != len(FACTOR_KEYS):
            raise ValueError(f"Expected {len(FACTOR_KEYS)} weights, got {len(weights)}")
        weights_dict = {k: float(w) for k, w in zip(FACTOR_KEYS, weights)}
    elif isinstance(weights, dict):
        weights_dict = {}
        for k in FACTOR_KEYS:
            # Match case-insensitively or by AHP criteria name
            display_name = KEY_TO_CRITERIA_NAME[k]
            if k in weights:
                weights_dict[k] = float(weights[k])
            elif display_name in weights:
                weights_dict[k] = float(weights[display_name])
            elif k.replace("_", " ") in weights:
                weights_dict[k] = float(weights[k.replace("_", " ")])
            else:
                raise KeyError(f"Missing weight for criterion: {k}")
    else:
        raise TypeError("Weights must be a dict, list, or None.")

    # Calculate weighted multi-factor cost
    total_cost = sum(weights_dict[k] * norm_factors[k] for k in FACTOR_KEYS)
    return total_cost


def calculate_route_cost_from_dict(
    factor_dict: Dict[str, float],
    weights: Optional[Union[Dict[str, float], List[float]]] = None,
    bounds: Optional[Dict[str, Tuple[float, float]]] = None,
    normalized: bool = False,
) -> float:
    """
    Convenience wrapper to calculate route cost directly from a dictionary.
    Handles varied key casing (e.g. 'Distance' or 'distance', 'travel_time' or 'Travel Time').
    """
    canonical_factors = {}
    normalized_input_keys = {
        k.strip().lower().replace(" ", "_"): v for k, v in factor_dict.items()
    }
    for key in FACTOR_KEYS:
        if key in normalized_input_keys:
            canonical_factors[key] = float(normalized_input_keys[key])
        else:
            raise KeyError(f"Missing required factor: '{key}' in input dictionary.")

    return calculate_route_cost(
        distance=canonical_factors["distance"],
        travel_time=canonical_factors["travel_time"],
        traffic=canonical_factors["traffic"],
        fuel_cost=canonical_factors["fuel_cost"],
        weather=canonical_factors["weather"],
        road_condition=canonical_factors["road_condition"],
        weights=weights,
        bounds=bounds,
        normalized=normalized,
    )


def evaluate_route_batch(
    routes: List[Dict[str, Union[str, float]]],
    weights: Optional[Union[Dict[str, float], List[float]]] = None,
    bounds: Optional[Dict[str, Tuple[float, float]]] = None,
    use_batch_bounds: bool = True,
) -> List[Dict]:
    """
    Evaluate and compare a batch of candidate routes.
    
    If use_batch_bounds is True, min-max bounds are computed across the
    candidate routes, allowing relative comparison. Otherwise, reference bounds are used.
    
    Returns detailed evaluation dictionary for each route including:
    - route_name
    - raw_factors
    - normalized_factors
    - ahp_weights
    - multi_factor_cost
    """
    if not routes:
        return []

    # Resolve AHP weights
    if weights is None:
        weights_dict = get_ahp_weights_dict()
    elif isinstance(weights, list):
        weights_dict = {k: float(w) for k, w in zip(FACTOR_KEYS, weights)}
    else:
        weights_dict = {k: float(weights.get(k, weights.get(KEY_TO_CRITERIA_NAME[k]))) for k in FACTOR_KEYS}

    # Determine bounds
    if use_batch_bounds and len(routes) > 1:
        computed_bounds = {}
        for k in FACTOR_KEYS:
            values = [float(r.get(k, r.get(KEY_TO_CRITERIA_NAME[k]))) for r in routes]
            min_v = min(values)
            max_v = max(values)
            computed_bounds[k] = (min_v, max_v)
        effective_bounds = computed_bounds
    else:
        effective_bounds = bounds or DEFAULT_BOUNDS

    results = []
    for r in routes:
        name = r.get("name", r.get("route_name", f"Route_{len(results) + 1}"))
        raw = {
            k: float(r.get(k, r.get(KEY_TO_CRITERIA_NAME[k])))
            for k in FACTOR_KEYS
        }
        norm = normalize_factors(raw, bounds=effective_bounds)
        cost = sum(weights_dict[k] * norm[k] for k in FACTOR_KEYS)

        results.append({
            "name": name,
            "raw_factors": raw,
            "normalized_factors": norm,
            "ahp_weights": weights_dict,
            "multi_factor_cost": cost,
        })

    return results


class MultiFactorCostFunction:
    """
    Reusable Multi-Factor Cost Function class for route evaluation and
    OR-Tools cost matrix construction.
    """

    def __init__(
        self,
        weights: Optional[Union[Dict[str, float], List[float]]] = None,
        bounds: Optional[Dict[str, Tuple[float, float]]] = None,
    ):
        if weights is None:
            self.weights = get_ahp_weights_dict()
        elif isinstance(weights, list):
            self.weights = {k: float(w) for k, w in zip(FACTOR_KEYS, weights)}
        else:
            self.weights = {
                k: float(weights.get(k, weights.get(KEY_TO_CRITERIA_NAME[k])))
                for k in FACTOR_KEYS
            }
        self.bounds = bounds or DEFAULT_BOUNDS

    def evaluate_edge(
        self,
        distance: float,
        travel_time: float,
        traffic: float,
        fuel_cost: float,
        weather: float,
        road_condition: float,
    ) -> float:
        """Calculate multi-factor cost for a single edge/route."""
        return calculate_route_cost(
            distance=distance,
            travel_time=travel_time,
            traffic=traffic,
            fuel_cost=fuel_cost,
            weather=weather,
            road_condition=road_condition,
            weights=self.weights,
            bounds=self.bounds,
        )

    def create_or_tools_cost_matrix(
        self,
        node_factor_matrices: Dict[str, List[List[float]]],
        integer_scale: int = 1000,
    ) -> List[List[int]]:
        """
        Convert pairwise factor matrices between nodes into a single 2D integer
        cost matrix ready for Google OR-Tools VRP.
        
        Parameters:
            node_factor_matrices: Dict containing 2D matrices for each factor:
                - 'distance': [[float]]
                - 'travel_time': [[float]]
                - 'traffic': [[float]]
                - 'fuel_cost': [[float]]
                - 'weather': [[float]]
                - 'road_condition': [[float]]
            integer_scale: Multiplier to convert floating point costs to 64-bit
                           integers required by OR-Tools (default: 1000).
                           
        Returns:
            List[List[int]]: 2D square matrix of integer costs where
                            matrix[i][i] = 0.
        """
        num_nodes = len(node_factor_matrices["distance"])
        cost_matrix = [[0] * num_nodes for _ in range(num_nodes)]

        for i in range(num_nodes):
            for j in range(num_nodes):
                if i == j:
                    cost_matrix[i][j] = 0
                else:
                    raw_cost = self.evaluate_edge(
                        distance=node_factor_matrices["distance"][i][j],
                        travel_time=node_factor_matrices["travel_time"][i][j],
                        traffic=node_factor_matrices["traffic"][i][j],
                        fuel_cost=node_factor_matrices["fuel_cost"][i][j],
                        weather=node_factor_matrices["weather"][i][j],
                        road_condition=node_factor_matrices["road_condition"][i][j],
                    )
                    # Scale to integer for OR-Tools compatibility
                    cost_matrix[i][j] = int(round(raw_cost * integer_scale))

        return cost_matrix


# ---------------------------------------------------------------------------
# Test Demonstration
# ---------------------------------------------------------------------------
def run_test_example():
    """
    Demonstration and verification with 3 candidate routes.
    Verifies that a route with better overall conditions receives a lower cost.
    """
    print("=" * 80)
    print("PathWise Multi-Factor Cost Function Verification & Test")
    print("=" * 80)

    # 1. Display AHP Weights dynamically retrieved
    weights = get_ahp_weights_dict()
    print("\n1. AHP Priority Weights (Dynamically Imported from algorithms.ahp.ahp):")
    print("-" * 55)
    for key in FACTOR_KEYS:
        name = KEY_TO_CRITERIA_NAME[key]
        print(f"  - {name:<16} (W_{key:<14}): {weights[key]:.4f} ({weights[key]*100:.1f}%)")
    print(f"  Total Weight Sum: {sum(weights.values()):.4f}")

    # 2. Define 3 realistic candidate routes
    candidate_routes = [
        {
            "name": "Route A (Highway / Optimal)",
            "distance": 12.0,       # 12 km
            "travel_time": 20.0,    # 20 min
            "traffic": 1.5,         # Light traffic
            "fuel_cost": 65.0,      # ₹65
            "weather": 1.0,         # Clear sky
            "road_condition": 1.2,  # Smooth highway
        },
        {
            "name": "Route B (Suburban / Moderate)",
            "distance": 18.5,       # 18.5 km
            "travel_time": 38.0,    # 38 min
            "traffic": 3.0,         # Moderate traffic
            "fuel_cost": 105.0,     # ₹105
            "weather": 2.5,         # Light overcast / drizzle
            "road_condition": 2.5,  # Fair road
        },
        {
            "name": "Route C (Congested / Poor Road)",
            "distance": 26.0,       # 26 km
            "travel_time": 65.0,    # 65 min
            "traffic": 4.5,         # Severe congestion
            "fuel_cost": 160.0,     # ₹160
            "weather": 4.0,         # Heavy rain
            "road_condition": 4.5,  # Broken road / potholes
        },
    ]

    print("\n2. Evaluating Candidate Routes (Batch Min-Max Normalization):")
    print("-" * 80)

    batch_eval = evaluate_route_batch(candidate_routes, weights=weights, use_batch_bounds=True)

    for res in batch_eval:
        print(f"\nRoute: {res['name']}")
        print("  Raw Factor Values:")
        for k in FACTOR_KEYS:
            display_name = KEY_TO_CRITERIA_NAME[k]
            unit = {
                "distance": "km",
                "travel_time": "min",
                "traffic": "score (1-5)",
                "fuel_cost": "INR",
                "weather": "score (1-5)",
                "road_condition": "score (1-5)",
            }[k]
            print(f"    * {display_name:<16}: {res['raw_factors'][k]:>6.1f} {unit}")

        print("  Normalized Factor Values [0.0 = Best, 1.0 = Worst]:")
        for k in FACTOR_KEYS:
            display_name = KEY_TO_CRITERIA_NAME[k]
            print(f"    * N_{k:<14}: {res['normalized_factors'][k]:.4f}")

        print(f"  -> Final Multi-Factor Cost: {res['multi_factor_cost']:.4f}")

    # 3. Verification Assertion
    cost_a = batch_eval[0]["multi_factor_cost"]
    cost_b = batch_eval[1]["multi_factor_cost"]
    cost_c = batch_eval[2]["multi_factor_cost"]

    print("\n3. Verification Result:")
    print("-" * 55)
    print(f"  Cost(Route A): {cost_a:.4f}")
    print(f"  Cost(Route B): {cost_b:.4f}")
    print(f"  Cost(Route C): {cost_c:.4f}")

    assert cost_a < cost_b < cost_c, (
        f"Verification FAILED: Expected Cost(A) < Cost(B) < Cost(C), but got {cost_a}, {cost_b}, {cost_c}"
    )
    print("  [SUCCESS] Cost(Route A) < Cost(Route B) < Cost(Route C)")
    print("  Verification Passed: Route with better overall conditions receives a lower cost.")

    # 4. OR-Tools Cost Matrix Demonstration
    print("\n4. OR-Tools Cost Matrix Generation Demonstration:")
    print("-" * 55)
    cost_fn = MultiFactorCostFunction()

    # Small 3x3 node network (e.g. Depot, Delivery 1, Delivery 2)
    sample_factor_matrices = {
        "distance": [
            [0.0, 12.0, 26.0],
            [12.0, 0.0, 18.5],
            [26.0, 18.5, 0.0],
        ],
        "travel_time": [
            [0.0, 20.0, 65.0],
            [20.0, 0.0, 38.0],
            [65.0, 38.0, 0.0],
        ],
        "traffic": [
            [1.0, 1.5, 4.5],
            [1.5, 1.0, 3.0],
            [4.5, 3.0, 1.0],
        ],
        "fuel_cost": [
            [0.0, 65.0, 160.0],
            [65.0, 0.0, 105.0],
            [160.0, 105.0, 0.0],
        ],
        "weather": [
            [1.0, 1.0, 4.0],
            [1.0, 1.0, 2.5],
            [4.0, 2.5, 1.0],
        ],
        "road_condition": [
            [1.0, 1.2, 4.5],
            [1.2, 1.0, 2.5],
            [4.5, 2.5, 1.0],
        ],
    }

    or_tools_matrix = cost_fn.create_or_tools_cost_matrix(
        sample_factor_matrices,
        integer_scale=1000,
    )
    print("  Generated OR-Tools Integer Cost Matrix (Scale factor = 1000):")
    for row in or_tools_matrix:
        print("   ", row)
    print("=" * 80)


if __name__ == "__main__":
    run_test_example()
