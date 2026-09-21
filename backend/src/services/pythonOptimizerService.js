const { spawn } = require('child_process');
const config = require('../config/env');

/**
 * Execute the Python multi-factor VRP optimization pipeline
 * @param {Object} inputData - Optional deliveries and vehicles data
 * @returns {Promise<Object>} Optimized routes result
 */
function runOptimization(inputData = {}) {
  return new Promise((resolve, reject) => {
    const pythonExecutable = config.PYTHON_PATH;
    const projectRoot = config.PROJECT_ROOT;

    const args = ['-m', 'algorithms.vrp.vrp_solver', '--json', '--stdin'];

    const child = spawn(pythonExecutable, args, {
      cwd: projectRoot,
      env: {
        ...process.env,
        PYTHONUNBUFFERED: '1',
        PYTHONPATH: projectRoot,
      },
    });

    let stdoutData = '';
    let stderrData = '';

    child.stdout.on('data', (chunk) => {
      stdoutData += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderrData += chunk.toString();
    });

    child.on('error', (err) => {
      const error = new Error(`Python execution failure: ${err.message}`);
      error.statusCode = 500;
      error.error = 'Python execution failure';
      reject(error);
    });

    child.on('close', (code) => {
      const trimmedStdout = stdoutData.trim();

      if (code !== 0) {
        // Attempt to parse JSON error output if available
        if (trimmedStdout) {
          try {
            const parsed = JSON.parse(trimmedStdout);
            if (parsed.error || parsed.message) {
              const err = new Error(parsed.message || parsed.error);
              err.statusCode = parsed.statusCode || 500;
              err.error = parsed.error || 'Optimization failure';
              return reject(err);
            }
          } catch (_) {
            // Fallthrough
          }
        }

        const error = new Error(
          stderrData.trim() || trimmedStdout || `Python process failed with exit code ${code}`
        );
        error.statusCode = 500;
        error.error = 'Optimization failure';
        return reject(error);
      }

      if (!trimmedStdout) {
        const error = new Error('Empty response received from Python optimizer.');
        error.statusCode = 500;
        error.error = 'invalid JSON returned by Python';
        return reject(error);
      }

      try {
        const result = JSON.parse(trimmedStdout);
        if (result.error) {
          const err = new Error(result.message || result.error);
          err.statusCode = 500;
          err.error = result.error;
          return reject(err);
        }
        resolve(result);
      } catch (parseError) {
        const error = new Error(`Invalid JSON returned by Python: ${parseError.message}`);
        error.statusCode = 500;
        error.error = 'invalid JSON returned by Python';
        reject(error);
      }
    });

    // Send payload to Python via stdin
    const payload = inputData && Object.keys(inputData).length > 0 ? JSON.stringify(inputData) : '{}';
    child.stdin.write(payload);
    child.stdin.end();
  });
}

module.exports = {
  runOptimization,
};
