function validateOptimizationInput(req, res, next) {
  const body = req.body;

  // Empty payload defaults to demo dataset
  if (!body || (typeof body === 'object' && Object.keys(body).length === 0)) {
    return next();
  }

  const { deliveries, vehicles } = body;

  // If payload provided, both deliveries and vehicles are required
  if (deliveries === undefined && vehicles === undefined) {
    return next();
  }

  if (deliveries === undefined || deliveries === null) {
    return res.status(400).json({
      error: 'Missing deliveries',
      message: 'Deliveries array is required when providing custom input.',
    });
  }

  if (vehicles === undefined || vehicles === null) {
    return res.status(400).json({
      error: 'Missing vehicles',
      message: 'Vehicles array is required when providing custom input.',
    });
  }

  if (!Array.isArray(deliveries) || deliveries.length === 0) {
    return res.status(400).json({
      error: 'Missing deliveries',
      message: 'Deliveries list must be a non-empty array.',
    });
  }

  if (!Array.isArray(vehicles) || vehicles.length === 0) {
    return res.status(400).json({
      error: 'Missing vehicles',
      message: 'Vehicles list must be a non-empty array.',
    });
  }

  let maxDeliveryWeight = 0;
  for (let i = 0; i < deliveries.length; i++) {
    const d = deliveries[i];
    if (!d || typeof d !== 'object') {
      return res.status(400).json({
        error: 'Invalid delivery data',
        message: `Delivery at index ${i} is not a valid object.`,
      });
    }

    if (!d.delivery_id && d.delivery_id !== 0) {
      return res.status(400).json({
        error: 'Invalid delivery data',
        message: `Delivery at index ${i} is missing delivery_id.`,
      });
    }

    const lat = Number(d.latitude);
    const lon = Number(d.longitude);
    if (isNaN(lat) || lat < -90 || lat > 90) {
      return res.status(400).json({
        error: 'Invalid coordinates',
        message: 'Delivery latitude must be between -90 and 90.',
      });
    }
    if (isNaN(lon) || lon < -180 || lon > 180) {
      return res.status(400).json({
        error: 'Invalid coordinates',
        message: 'Delivery longitude must be between -180 and 180.',
      });
    }

    const weight = Number(d.weight);
    if (isNaN(weight) || weight <= 0) {
      return res.status(400).json({
        error: 'Invalid delivery data',
        message: 'Delivery weight must be greater than 0.',
      });
    }

    if (weight > maxDeliveryWeight) {
      maxDeliveryWeight = weight;
    }
  }

  let maxVehicleCapacity = 0;
  for (let i = 0; i < vehicles.length; i++) {
    const v = vehicles[i];
    if (!v || typeof v !== 'object') {
      return res.status(400).json({
        error: 'Invalid vehicle data',
        message: `Vehicle at index ${i} is not a valid object.`,
      });
    }

    if (!v.vehicle_id && v.vehicle_id !== 0) {
      return res.status(400).json({
        error: 'Invalid vehicle data',
        message: `Vehicle at index ${i} is missing vehicle_id.`,
      });
    }

    const capacity = Number(v.capacity);
    if (isNaN(capacity) || capacity <= 0) {
      return res.status(400).json({
        error: 'Invalid vehicle capacity',
        message: 'Vehicle capacity must be greater than 0.',
      });
    }

    const fuelCost = Number(v.fuel_cost);
    if (isNaN(fuelCost) || fuelCost <= 0) {
      return res.status(400).json({
        error: 'Invalid vehicle data',
        message: 'Vehicle fuel cost must be greater than 0.',
      });
    }

    if (capacity > maxVehicleCapacity) {
      maxVehicleCapacity = capacity;
    }
  }

  if (maxDeliveryWeight > maxVehicleCapacity) {
    return res.status(400).json({
      error: 'Invalid delivery data',
      message: `A delivery weight (${maxDeliveryWeight}) exceeds the maximum vehicle capacity (${maxVehicleCapacity}).`,
    });
  }

  next();
}

module.exports = validateOptimizationInput;
