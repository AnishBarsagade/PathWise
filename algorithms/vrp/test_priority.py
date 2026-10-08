import sys
from pathlib import Path
import unittest
import pandas as pd

PROJECT_ROOT = Path(__file__).resolve().parents[2]
ALGORITHMS_DIR = Path(__file__).resolve().parents[1]
for p in [str(PROJECT_ROOT), str(ALGORITHMS_DIR)]:
    if p not in sys.path:
        sys.path.insert(0, p)

from algorithms.vrp.vrp_solver import optimize_routes, validate_data


class TestPriorityModule(unittest.TestCase):
    def test_priority_capacity_constraint_drops_low_first(self):
        """
        Verify that when vehicle capacity is insufficient to serve all deliveries,
        High and Medium priority deliveries are prioritized while Low priority is dropped.
        """
        # 3 deliveries of 100 kg each (Total demand: 300 kg)
        deliveries = [
            {"delivery_id": "D_LOW", "latitude": 21.1400, "longitude": 79.0800, "weight": 100, "priority": "Low"},
            {"delivery_id": "D_HIGH", "latitude": 21.1500, "longitude": 79.0900, "weight": 100, "priority": "High"},
            {"delivery_id": "D_MED", "latitude": 21.1600, "longitude": 79.1000, "weight": 100, "priority": "Medium"},
        ]
        # Vehicle can only carry 200 kg
        vehicles = [
            {"vehicle_id": "V1", "capacity": 200, "fuel_cost": 8.0}
        ]

        result = optimize_routes(deliveries=deliveries, vehicles=vehicles)

        self.assertIn("routes", result)
        self.assertEqual(len(result["routes"]), 1)
        route_stops = [s for s in result["routes"][0]["route"] if s != "DEPOT"]

        # High and Medium must be served, Low dropped
        self.assertIn("D_HIGH", route_stops)
        self.assertIn("D_MED", route_stops)
        self.assertNotIn("D_LOW", route_stops)
        self.assertEqual(result["total_load"], 200)

        # Priority summary validation
        summary = result["priority_summary"]
        self.assertEqual(summary["High"]["served"], 1)
        self.assertEqual(summary["Medium"]["served"], 1)
        self.assertEqual(summary["Low"]["served"], 0)
        self.assertTrue(summary["all_high_priority_served"])

    def test_priority_urgency_visit_ordering(self):
        """
        Verify that priority urgency (service order preference) biases High priority
        to be visited earlier in the vehicle route sequence when distances are comparable.
        """
        deliveries = [
            {"delivery_id": "D_LOW", "latitude": 21.1420, "longitude": 79.0820, "weight": 50, "priority": "Low"},
            {"delivery_id": "D_HIGH", "latitude": 21.1440, "longitude": 79.0840, "weight": 50, "priority": "High"},
            {"delivery_id": "D_MED", "latitude": 21.1460, "longitude": 79.0860, "weight": 50, "priority": "Medium"},
        ]
        vehicles = [
            {"vehicle_id": "V1", "capacity": 300, "fuel_cost": 8.0}
        ]

        # Enable priority urgency weighting
        result = optimize_routes(
            deliveries=deliveries,
            vehicles=vehicles,
            priority_urgency_weight=50,
        )

        stops = [s for s in result["routes"][0]["route"] if s != "DEPOT"]
        self.assertEqual(len(stops), 3)

        # High priority should be visited before Low priority
        high_idx = stops.index("D_HIGH")
        low_idx = stops.index("D_LOW")
        self.assertLess(high_idx, low_idx, "D_HIGH must be visited before D_LOW due to urgency preference.")

    def test_demo_dataset_priority_metrics(self):
        """
        Verify that default demo dataset correctly populates priority metadata
        for all routes and stops, and all high-priority deliveries are served.
        """
        result = optimize_routes()

        self.assertIn("priority_summary", result)
        self.assertIn("deliveries_priority", result)

        ps = result["priority_summary"]
        self.assertEqual(ps["total_deliveries"], 12)
        self.assertEqual(ps["total_served"], 12)

        # Nagpur demo dataset has 5 High, 4 Medium, 3 Low deliveries
        self.assertEqual(ps["High"]["total"], 5)
        self.assertEqual(ps["High"]["served"], 5)
        self.assertEqual(ps["Medium"]["total"], 4)
        self.assertEqual(ps["Medium"]["served"], 4)
        self.assertEqual(ps["Low"]["total"], 3)
        self.assertEqual(ps["Low"]["served"], 3)
        self.assertTrue(ps["all_high_priority_served"])

        # Check each route includes delivery_priorities
        for r in result["routes"]:
            self.assertIn("delivery_priorities", r)
            self.assertIn("delivery_details", r)
            for stop in r["route"]:
                if stop != "DEPOT":
                    self.assertIn(stop, r["delivery_priorities"])
                    self.assertIn(r["delivery_priorities"][stop], ["High", "Medium", "Low"])

    def test_missing_priority_defaults_to_medium(self):
        """
        Verify that deliveries without an explicit priority field gracefully default to Medium.
        """
        deliveries = [
            {"delivery_id": "D1", "latitude": 21.1458, "longitude": 79.0882, "weight": 50},
            {"delivery_id": "D2", "latitude": 21.1500, "longitude": 79.0900, "weight": 60, "priority": "High"},
        ]
        vehicles = [
            {"vehicle_id": "V1", "capacity": 200, "fuel_cost": 8.0}
        ]

        result = optimize_routes(deliveries=deliveries, vehicles=vehicles)
        self.assertEqual(result["deliveries_priority"]["D1"], "Medium")
        self.assertEqual(result["deliveries_priority"]["D2"], "High")
        self.assertEqual(result["priority_summary"]["Medium"]["total"], 1)
        self.assertEqual(result["priority_summary"]["High"]["total"], 1)

    def test_case_insensitive_priority_normalization(self):
        """
        Verify that priority casing ('high', 'LOW', 'mEdIuM') is properly normalized.
        """
        deliveries = [
            {"delivery_id": "D1", "latitude": 21.1458, "longitude": 79.0882, "weight": 50, "priority": "high"},
            {"delivery_id": "D2", "latitude": 21.1500, "longitude": 79.0900, "weight": 60, "priority": "LOW"},
        ]
        vehicles = [
            {"vehicle_id": "V1", "capacity": 200, "fuel_cost": 8.0}
        ]

        result = optimize_routes(deliveries=deliveries, vehicles=vehicles)
        self.assertEqual(result["deliveries_priority"]["D1"], "High")
        self.assertEqual(result["deliveries_priority"]["D2"], "Low")


if __name__ == "__main__":
    unittest.main()
