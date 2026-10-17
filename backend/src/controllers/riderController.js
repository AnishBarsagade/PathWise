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

/**
 * PATCH /api/deliveries/:id/status
 * Updates delivery status.
 * - Admins can update any delivery status.
 * - Riders can update status for deliveries assigned to their active vehicle.
 */
async function updateDeliveryStatus(req, res, next) {
  try {
    const deliveryId = req.params.id;
    const { status } = req.body || {};
    const validStatuses = ['pending', 'assigned', 'in_progress', 'completed', 'cancelled'];

    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        error: 'Validation Error',
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
      });
    }

    const delivery = dbService.getDelivery(deliveryId);
    if (!delivery) {
      return res.status(404).json({
        error: 'Not Found',
        message: `Delivery with ID '${deliveryId}' was not found.`,
      });
    }

    // Role-based authorization
    if (req.user && req.user.role === 'rider') {
      const assignedRiderId = delivery.assigned_vehicle_id
        ? dbService.getRiderByVehicleId(delivery.assigned_vehicle_id)
        : null;

      if (!assignedRiderId || String(assignedRiderId) !== String(req.user.id)) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'Access denied. Riders can only update deliveries assigned to their active vehicle.',
        });
      }
    }

    const updated = dbService.updateDeliveryStatus(deliveryId, status);
    return res.status(200).json({
      message: `Delivery ${deliveryId} status updated to '${status}'.`,
      delivery: updated,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/riders
 * Returns all registered riders (Admin only).
 */
async function listRiders(req, res, next) {
  try {
    const riders = dbService.listRiders();
    return res.status(200).json(riders);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getMyAssignments,
  getRiderAssignmentsById,
  assignRider,
  unassignRider,
  updateDeliveryStatus,
  listRiders,
};

