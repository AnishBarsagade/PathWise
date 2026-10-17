import unittest
from algorithms.astar.astar import (
    a_star,
    a_star_search,
    build_network_graph,
    find_optimal_detour,
    haversine_heuristic,
    haversine_km,
)


class TestAStar(unittest.TestCase):
    def test_haversine_positive(self):
        dist = haversine_km(21.1450, 79.0880, 21.1600, 79.1000)
        self.assertGreater(dist, 1.0)
        self.assertLess(dist, 5.0)

    def test_legacy_a_star_compatibility(self):
        graph = {
            "A": [("B", 4), ("C", 2)],
            "B": [("A", 4), ("C", 1), ("D", 5)],
            "C": [("A", 2), ("B", 1), ("D", 8), ("E", 10)],
            "D": [("B", 5), ("C", 8), ("E", 2)],
            "E": [("C", 10), ("D", 2)],
        }
        path, cost = a_star(graph, "A", "E", lambda n, g: 0)
        self.assertEqual(path, ["A", "C", "B", "D", "E"])
        self.assertEqual(cost, 10)

    def test_network_graph_detour_around_closed_roads(self):
        # Path from DEPOT to D006 (Sadar) without closures
        detour_info = find_optimal_detour(
            start="DEPOT",
            goal="D006",
            closed_edges=[("DEPOT", "D005"), ("D001", "D005")],
        )
        self.assertTrue(detour_info["detour_required"])
        self.assertTrue(len(detour_info["optimal_route"]["path"]) >= 2)
        # Should not use closed edge D002 -> D006
        path = detour_info["optimal_route"]["path"]
        for i in range(len(path) - 1):
            pair = (path[i], path[i + 1])
            rev = (path[i + 1], path[i])
            self.assertNotIn(pair, [("D001", "D005"), ("DEPOT", "D005")])
            self.assertNotIn(rev, [("D001", "D005"), ("DEPOT", "D005")])


if __name__ == "__main__":
    unittest.main()
