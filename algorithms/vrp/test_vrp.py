import sys
from pathlib import Path
import unittest
import pandas as pd

PROJECT_ROOT = Path(__file__).resolve().parents[2]
ALGORITHMS_DIR = Path(__file__).resolve().parents[1]
for p in [str(PROJECT_ROOT), str(ALGORITHMS_DIR)]:
    if p not in sys.path:
        sys.path.insert(0, p)

try:
    from algorithms.vrp.vrp_solver import optimize_routes, validate_data
except ImportError:
    try:
        from vrp.vrp_solver import optimize_routes, validate_data
    except ImportError:
        from PathWise.algorithms.vrp.vrp_solver import optimize_routes, validate_data


class TestVRPSolver(unittest.TestCase):
    def test_optimize_demo_dataset(self):
        """Test optimization with default demo data."""
        result = optimize_routes()
        self.assertIn("routes", result)
        self.assertIn("total_cost", result)
        self.assertIn("total_load", result)

        self.assertGreater(len(result["routes"]), 0)
        self.assertEqual(result["total_load"], 1220)
        self.assertAlmostEqual(result["total_cost"], 1.798, places=3)

        # Check routes structure
        assigned_deliveries = []
        for r in result["routes"]:
            self.assertTrue(r["vehicle_id"].startswith("V"))
            self.assertGreaterEqual(r["capacity"], r["load"])
            self.assertEqual(r["route"][0], "DEPOT")
            self.assertEqual(r["route"][-1], "DEPOT")
            assigned_deliveries.extend([stop for stop in r["route"] if stop != "DEPOT"])

        # Check all 12 deliveries are assigned exactly once
        self.assertEqual(len(assigned_deliveries), 12)
        self.assertEqual(len(set(assigned_deliveries)), 12)

    def test_custom_deliveries_and_vehicles(self):
        """Test optimization with custom deliveries and vehicles."""
        custom_deliveries = [
            {"delivery_id": "D1", "latitude": 21.1458, "longitude": 79.0882, "weight": 50, "priority": "High"},
            {"delivery_id": "D2", "latitude": 21.1500, "longitude": 79.0900, "weight": 70, "priority": "Medium"},
        ]
        custom_vehicles = [
            {"vehicle_id": "V1", "capacity": 200, "fuel_cost": 8.0}
        ]

        result = optimize_routes(deliveries=custom_deliveries, vehicles=custom_vehicles)
        self.assertEqual(result["total_load"], 120)
        self.assertEqual(len(result["routes"]), 1)
        route_stops = result["routes"][0]["route"]
        self.assertEqual(route_stops[0], "DEPOT")
        self.assertEqual(route_stops[-1], "DEPOT")
        self.assertIn("D1", route_stops)
        self.assertIn("D2", route_stops)

    def test_invalid_weight_exceeds_capacity(self):
        """Test error when delivery weight exceeds maximum vehicle capacity."""
        deliveries = [
            {"delivery_id": "D1", "latitude": 21.1458, "longitude": 79.0882, "weight": 1000}
        ]
        vehicles = [
            {"vehicle_id": "V1", "capacity": 500, "fuel_cost": 8.0}
        ]
        with self.assertRaises(ValueError) as ctx:
            optimize_routes(deliveries=deliveries, vehicles=vehicles)
        self.assertIn("exceeds the maximum vehicle capacity", str(ctx.exception))

    def test_negative_weight_validation(self):
        """Test error on non-positive delivery weight."""
        deliveries = [
            {"delivery_id": "D1", "latitude": 21.1458, "longitude": 79.0882, "weight": -10}
        ]
        vehicles = [
            {"vehicle_id": "V1", "capacity": 500, "fuel_cost": 8.0}
        ]
        with self.assertRaises(ValueError) as ctx:
            optimize_routes(deliveries=deliveries, vehicles=vehicles)
        self.assertIn("Delivery weight must be greater than 0", str(ctx.exception))

    def test_invalid_coordinates(self):
        """Test error on invalid coordinates."""
        deliveries = [
            {"delivery_id": "D1", "latitude": 120.0, "longitude": 79.0882, "weight": 50}
        ]
        vehicles = [
            {"vehicle_id": "V1", "capacity": 500, "fuel_cost": 8.0}
        ]
        with self.assertRaises(ValueError) as ctx:
            optimize_routes(deliveries=deliveries, vehicles=vehicles)
        self.assertIn("Delivery latitude must be between -90 and 90", str(ctx.exception))


if __name__ == "__main__":
    unittest.main()
