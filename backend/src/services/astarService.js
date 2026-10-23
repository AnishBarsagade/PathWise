const { spawn } = require('child_process');
const config = require('../config/env');

/**
 * Execute A* detour pathfinding
 */
function findAstarDetour({ start, goal, closed_edges = [], traffic_multipliers = {}, avoid_nodes = [] }) {
  return new Promise((resolve, reject) => {
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

    const child = spawn(pythonExecutable, ['-c', pyScript], {
      cwd: projectRoot,
      env: {
        ...process.env,
        PYTHONUNBUFFERED: '1',
        PYTHONPATH: projectRoot,
      },
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (d) => { stdout += d.toString(); });
    child.stderr.on('data', (d) => { stderr += d.toString(); });

    child.on('error', (err) => reject(new Error(`A* execution error: ${err.message}`)));

    child.on('close', (code) => {
      if (code !== 0) {
        return reject(new Error(stderr.trim() || `A* pathfinder failed with code ${code}`));
      }
      try {
        const parsed = JSON.parse(stdout.trim());
        resolve(parsed);
      } catch (e) {
        reject(new Error(`Invalid JSON from A*: ${e.message}`));
      }
    });

    child.stdin.write(JSON.stringify({ start, goal, closed_edges, traffic_multipliers, avoid_nodes }));
    child.stdin.end();
  });
}

module.exports = { findAstarDetour };
