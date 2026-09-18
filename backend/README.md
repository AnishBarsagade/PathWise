# PathWise Backend API

The Node.js / Express API layer for the PathWise Multi-Factor Delivery Route Optimization platform. It bridges the frontend UI with the Python optimization engine (`A*` + `AHP` + `Multi-Factor Cost` + `OR-Tools VRP`).

---

## 🚀 Quick Start

### 1. Prerequisites & Python Environment

Ensure Python (3.9+) is installed with the required optimization packages:

```bash
pip install pandas numpy ortools
```

*(Optional)* You can customize the Python executable path via an environment variable or `.env` file:

```env
PORT=3000
CORS_ORIGIN=http://localhost:5173
PYTHON_PATH=python
```

### 2. Install Backend Dependencies

From the `PathWise/backend` directory:

```bash
npm install
```

### 3. Run the Backend Server

- **Development Mode** (with hot reloading):
  ```bash
  npm run dev
  ```

- **Production Mode**:
  ```bash
  npm start
  ```

The server will start at `http://localhost:3000`.

### 4. Run Automated Tests

- **Backend Integration Tests (Jest & Supertest)**:
  ```bash
  npm test
  ```

- **Python Algorithm Tests (unittest)** from `PathWise/`:
  ```bash
  python -m unittest algorithms/vrp/test_vrp.py
  ```

---

## 📡 API Endpoints

### 1. Health Check

Checks if the backend API service is running.

- **Method**: `GET`
- **URL**: `/api/health`
- **Response**: `200 OK`
  ```json
  {
    "status": "ok",
    "service": "PathWise backend"
  }
  ```

---

### 2. Route Optimization

Runs the multi-factor VRP optimization pipeline on either the built-in demo dataset (`data/deliveries.csv` & `data/vehicles.csv`) or custom deliveries and vehicle fleets passed in the request body.

- **Method**: `POST`
- **URL**: `/api/optimize`
- **Headers**: `Content-Type: application/json`

#### Option A: Running with Default Demo Data
Send an empty JSON body `{}`:

```bash
curl -X POST http://localhost:3000/api/optimize \
  -H "Content-Type: application/json" \
  -d "{}"
```

#### Option B: Running with Custom Deliveries and Vehicles
Send structured deliveries and fleet objects:

```json
{
  "deliveries": [
    {
      "delivery_id": "D001",
      "latitude": 21.1458,
      "longitude": 79.0882,
      "weight": 120,
      "priority": "High"
    },
    {
      "delivery_id": "D002",
      "latitude": 21.1500,
      "longitude": 79.0900,
      "weight": 80,
      "priority": "Medium"
    }
  ],
  "vehicles": [
    {
      "vehicle_id": "V001",
      "capacity": 500,
      "fuel_cost": 8.5
    }
  ]
}
```

#### Successful Response (`200 OK`)

```json
{
  "routes": [
    {
      "vehicle_id": "V004",
      "route": [
        "DEPOT",
        "D003",
        "D010",
        "D008",
        "D001",
        "DEPOT"
      ],
      "load": 430,
      "capacity": 600,
      "cost": 0.665
    },
    {
      "vehicle_id": "V005",
      "route": [
        "DEPOT",
        "D009",
        "D012",
        "D011",
        "D007",
        "D004",
        "D005",
        "D006",
        "D002",
        "DEPOT"
      ],
      "load": 790,
      "capacity": 800,
      "cost": 1.133
    }
  ],
  "total_cost": 1.798,
  "total_load": 1220
}
```

---

## ⚠️ Error Handling

The API validates all input parameters and returns clean HTTP error responses:

| Status Code | Reason | Example Response |
| :--- | :--- | :--- |
| **`400 Bad Request`** | Invalid delivery data / missing fields / exceeded capacity | `{"error": "Invalid delivery data", "message": "Delivery weight must be greater than 0."}` |
| **`400 Bad Request`** | Out of bounds coordinates | `{"error": "Invalid coordinates", "message": "Delivery latitude must be between -90 and 90."}` |
| **`500 Internal Server Error`** | Optimization or execution failure | `{"error": "Optimization failure", "message": "..."}` |
