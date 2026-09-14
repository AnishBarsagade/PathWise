"""
Unit and integration tests for PathWise Multi-Factor Cost Function.
Tests:
- Dynamic AHP weights loading (no hardcoding)
- Min-Max normalization for cost-type criteria
- Direction consistency (better conditions -> lower cost)
- Route cost calculation interface (arguments and dictionary)
- Batch route evaluation with 3 candidate routes
- OR-Tools integer cost matrix generation
"""

import sys
from pathlib import Path

# Add project paths
CURRENT_DIR = Path(__file__).resolve().parent
ALGORITHMS_DIR = CURRENT_DIR.parent
PROJECT_ROOT = ALGORITHMS_DIR.parent

for p in [str(PROJECT_ROOT), str(ALGORITHMS_DIR)]:
    if p not in sys.path:
        sys.path.insert(0, p)

from algorithms.ahp.ahp import CRITERIA, calculate_ahp_weights
from algorithms.cost_function.cost_function import (
    calculate_route_cost,
    calculate_route_cost_from_dict,
    evaluate_route_batch,
    get_ahp_weights_dict,
    normalize_factors,
    normalize_min_max,
    MultiFactorCostFunction,
    FACTOR_KEYS,
)


def test_ahp_weights_integration():
    """Verify weights are dynamically imported from AHP module and sum to 1.0."""
    weights_list, cr = calculate_ahp_weights()
    assert len(weights_list) == 6, "Expected 6 criteria weights."
    assert abs(sum(weights_list) - 1.0) < 1e-4, "Weights must sum to 1.0."

    weights_dict = get_ahp_weights_dict()
    assert len(weights_dict) == 6, "Expected 6 entries in weights dict."
    for key in FACTOR_KEYS:
        assert key in weights_dict, f"Missing key {key} in weights dict."
        assert weights_dict[key] > 0, f"Weight for {key} must be positive."


def test_normalization_direction():
    """Verify cost-type normalization: min value -> 0.0, max value -> 1.0."""
    # Distance: 10 km (best) vs 50 km (worst)
    assert normalize_min_max(10.0, 10.0, 50.0) == 0.0
    assert normalize_min_max(50.0, 10.0, 50.0) == 1.0
    assert normalize_min_max(30.0, 10.0, 50.0) == 0.5

    # Traffic score: 1 (clear) -> 0.0, 5 (gridlock) -> 1.0
    assert normalize_min_max(1.0, 1.0, 5.0) == 0.0
    assert normalize_min_max(5.0, 1.0, 5.0) == 1.0


def test_calculate_route_cost_interface():
    """Verify clean function signature and dict-based interface."""
    # Direct function call with positional/named parameters
    cost_direct = calculate_route_cost(
        distance=15.0,
        travel_time=30.0,
        traffic=2.0,
        fuel_cost=80.0,
        weather=1.0,
        road_condition=2.0,
    )
    assert 0.0 <= cost_direct <= 1.0, "Cost must be in [0, 1]."

    # Dictionary call
    factor_dict = {
        "distance": 15.0,
        "travel_time": 30.0,
        "traffic": 2.0,
        "fuel_cost": 80.0,
        "weather": 1.0,
        "road_condition": 2.0,
    }
    cost_dict = calculate_route_cost_from_dict(factor_dict)
    assert abs(cost_direct - cost_dict) < 1e-6, "Direct and dict calls must produce identical cost."


def test_route_comparison_better_gets_lower_cost():
    """
    Verify with 3 routes:
    Route A (Optimal) < Route B (Moderate) < Route C (Poor).
    """
    routes = [
        {
            "name": "Route A (Optimal)",
            "distance": 12.0,
            "travel_time": 20.0,
            "traffic": 1.5,
            "fuel_cost": 65.0,
            "weather": 1.0,
            "road_condition": 1.2,
        },
        {
            "name": "Route B (Moderate)",
            "distance": 18.5,
            "travel_time": 38.0,
            "traffic": 3.0,
            "fuel_cost": 105.0,
            "weather": 2.5,
            "road_condition": 2.5,
        },
        {
            "name": "Route C (Congested / Rough)",
            "distance": 26.0,
            "travel_time": 65.0,
            "traffic": 4.5,
            "fuel_cost": 160.0,
            "weather": 4.0,
            "road_condition": 4.5,
        },
    ]

    results = evaluate_route_batch(routes, use_batch_bounds=True)
    assert len(results) == 3

    cost_a = results[0]["multi_factor_cost"]
    cost_b = results[1]["multi_factor_cost"]
    cost_c = results[2]["multi_factor_cost"]

    assert cost_a < cost_b < cost_c, (
        f"Expected Cost(A) < Cost(B) < Cost(C), but got {cost_a}, {cost_b}, {cost_c}"
    )


def test_or_tools_cost_matrix_compatibility():
    """Verify that OR-Tools integer cost matrix is square, zero on diagonal, and integers."""
    cost_fn = MultiFactorCostFunction()
    matrices = {
        "distance": [[0.0, 10.0], [10.0, 0.0]],
        "travel_time": [[0.0, 20.0], [20.0, 0.0]],
        "traffic": [[1.0, 2.0], [2.0, 1.0]],
        "fuel_cost": [[0.0, 50.0], [50.0, 0.0]],
        "weather": [[1.0, 1.0], [1.0, 1.0]],
        "road_condition": [[1.0, 2.0], [2.0, 1.0]],
    }
    matrix = cost_fn.create_or_tools_cost_matrix(matrices, integer_scale=1000)

    assert len(matrix) == 2
    assert len(matrix[0]) == 2
    assert matrix[0][0] == 0
    assert matrix[1][1] == 0
    assert isinstance(matrix[0][1], int)
    assert matrix[0][1] > 0


if __name__ == "__main__":
    test_ahp_weights_integration()
    test_normalization_direction()
    test_calculate_route_cost_interface()
    test_route_comparison_better_gets_lower_cost()
    test_or_tools_cost_matrix_compatibility()
    print("All 5 tests passed successfully!")

