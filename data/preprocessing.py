import pandas as pd
from pathlib import Path


DATA_DIR = Path(__file__).parent

DELIVERIES_FILE = DATA_DIR / "deliveries.csv"
VEHICLES_FILE = DATA_DIR / "vehicles.csv"


def load_data():
    deliveries = pd.read_csv(DELIVERIES_FILE)
    vehicles = pd.read_csv(VEHICLES_FILE)

    return deliveries, vehicles


def validate_data(deliveries, vehicles):
    print("Checking delivery data...")
    
    required_delivery_columns = [
        "delivery_id",
        "location",
        "latitude",
        "longitude",
        "weight",
        "priority"
    ]

    required_vehicle_columns = [
        "vehicle_id",
        "capacity",
        "fuel_cost"
    ]

    # Check required columns
    for column in required_delivery_columns:
        if column not in deliveries.columns:
            raise ValueError(
                f"Missing delivery column: {column}"
            )

    for column in required_vehicle_columns:
        if column not in vehicles.columns:
            raise ValueError(
                f"Missing vehicle column: {column}"
            )

    # Check missing values
    if deliveries[required_delivery_columns].isnull().any().any():
        raise ValueError("Delivery data contains missing values.")

    if vehicles[required_vehicle_columns].isnull().any().any():
        raise ValueError("Vehicle data contains missing values.")

    # Check numeric values
    if (deliveries["weight"] <= 0).any():
        raise ValueError("Delivery weight must be greater than 0.")

    if (vehicles["capacity"] <= 0).any():
        raise ValueError("Vehicle capacity must be greater than 0.")

    if (vehicles["fuel_cost"] <= 0).any():
        raise ValueError("Fuel cost must be greater than 0.")

   # Check duplicate delivery IDs
    if deliveries["delivery_id"].duplicated().any():
        raise ValueError("Duplicate delivery IDs found.")

    # Check duplicate vehicle IDs
    if vehicles["vehicle_id"].duplicated().any():
        raise ValueError("Duplicate vehicle IDs found.")

    # Check latitude and longitude
    if not deliveries["latitude"].between(-90, 90).all():
        raise ValueError("Invalid latitude values.")

    if not deliveries["longitude"].between(-180, 180).all():
        raise ValueError("Invalid longitude values.")

    # Check priority values
    valid_priorities = ["Low", "Medium", "High"]

    if not deliveries["priority"].isin(valid_priorities).all():
        raise ValueError("Invalid priority values.")

    # Check delivery weight against maximum vehicle capacity
    if deliveries["weight"].max() > vehicles["capacity"].max():
        raise ValueError(
            "A delivery exceeds the maximum vehicle capacity."
        )
    print("Data validation successful!")


def prepare_data(deliveries, vehicles):
    deliveries = deliveries.copy()
    vehicles = vehicles.copy()

    # Convert numeric columns to numeric types
    deliveries["latitude"] = pd.to_numeric(
        deliveries["latitude"]
    )

    deliveries["longitude"] = pd.to_numeric(
        deliveries["longitude"]
    )

    deliveries["weight"] = pd.to_numeric(
        deliveries["weight"]
    )

    vehicles["capacity"] = pd.to_numeric(
        vehicles["capacity"]
    )

    vehicles["fuel_cost"] = pd.to_numeric(
        vehicles["fuel_cost"]
    )

    return deliveries, vehicles


def main():
    deliveries, vehicles = load_data()

    validate_data(deliveries, vehicles)

    deliveries, vehicles = prepare_data(
        deliveries,
        vehicles
    )

    print("\nDeliveries:")
    print(deliveries)

    print("\nVehicles:")
    print(vehicles)


if __name__ == "__main__":
    main()
