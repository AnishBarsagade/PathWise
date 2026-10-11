const dbService = require("../services/dbService");

/**
 * GET /api/rider/assignments
 * Returns assignments for the currently authenticated rider.
 */
async function getMyAssignments(req, res, next) {
  try {
    const userId = req.user.id;
    const assignments = dbService.getRiderAssignments(userId);
    return res.status(200).json(assignments);
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/rider/assignments/:userId
 * Returns assignments for a specified rider.
 * Riders may only view their own assignments; Admins may view any rider's.
 */
async function getRiderAssignmentsById(req, res, next) {
  try {
    const targetUserId = req.params.userId;

    // Enforce role authorization: riders cannot access another rider's private assignments
    if (req.user.role !== "admin" && String(req.user.id) !== String(targetUserId)) {
      return res.status(403).json({
        error: "Forbidden",
        message: "Access denied. Cannot view another rider's assignments.",
      });
    }

    const assignments = dbService.getRiderAssignments(targetUserId);
    return res.status(200).json(assignments);
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/rider/assignments
 * Assigns a vehicle to a rider. (Admin only)
 */
async function assignRider(req, res, next) {
  try {
    const { user_id, vehicle_id } = req.body || {};

    if (!user_id || !vehicle_id) {
      return res.status(400).json({
        error: "Validation Error",
        message: "user_id and vehicle_id are required.",
      });
    }

    // Verify user exists and is a rider
    const user = dbService.findUserById(user_id);
    if (!user) {
      return res.status(404).json({
        error: "Not Found",
        message: `User with ID ${user_id} was not found.`,
      });
    }

    // Verify vehicle exists
    const vehicle = dbService.getVehicle(vehicle_id);
    if (!vehicle) {
      return res.status(404).json({
        error: "Not Found",
        message: `Vehicle with ID '${vehicle_id}' was not found.`,
      });
    }

    const result = dbService.assignRiderToVehicle(user_id, vehicle_id);
    return res.status(200).json({
      message: `Vehicle ${vehicle_id} successfully assigned to rider ${user.name || user.email}.`,
      assignment: result,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /api/rider/assignments/:userId/:vehicleId?
 * Unassigns a vehicle from a rider. (Admin only)
 */
async function unassignRider(req, res, next) {
  try {
    const { userId, vehicleId } = req.params;
    const removed = dbService.deleteRiderAssignment(userId, vehicleId);
    return res.status(200).json({
      message: "Assignment removed.",
      removed,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getMyAssignments,
  getRiderAssignmentsById,
  assignRider,
  unassignRider,
};

