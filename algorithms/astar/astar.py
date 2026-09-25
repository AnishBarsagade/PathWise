import heapq


def a_star(graph, start, goal, heuristic):
    open_list = []

    # (estimated_total_cost, current_node)
    heapq.heappush(open_list, (0, start))

    came_from = {}
    cost_so_far = {start: 0}

    while open_list:

        _, current = heapq.heappop(open_list)

        # Goal reached
        if current == goal:
            break

        for neighbor, distance in graph[current]:

            new_cost = cost_so_far[current] + distance

            if neighbor not in cost_so_far or new_cost < cost_so_far[neighbor]:

                cost_so_far[neighbor] = new_cost

                priority = new_cost + heuristic(neighbor, goal)

                heapq.heappush(open_list, (priority, neighbor))

                came_from[neighbor] = current

    # Reconstruct path
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
    # -------------------------
    # Test Road Network
    # -------------------------

    graph = {
        "A": [("B", 4), ("C", 2)],
        "B": [("A", 4), ("C", 1), ("D", 5)],
        "C": [("A", 2), ("B", 1), ("D", 8), ("E", 10)],
        "D": [("B", 5), ("C", 8), ("E", 2)],
        "E": [("C", 10), ("D", 2)]
    }

    # Simple heuristic for demonstration
    def heuristic(node, goal):
        return 0

    path, distance = a_star(graph, "A", "E", heuristic)

    print("Shortest Route:", " -> ".join(path))
    print("Total Distance:", distance)