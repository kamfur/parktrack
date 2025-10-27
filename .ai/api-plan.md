# REST API Plan

This document outlines the REST API for the ParkTrack application, based on the database schema, PRD, and tech stack. The API is primarily powered by Supabase's auto-generated PostgREST endpoints, supplemented by custom Edge Functions for specific business logic.

## 1. Resources

| Resource | Database Table | Description |
| :--- | :--- | :--- |
| **Reservations** | `public.reservations` | Manages customer parking reservations. |
| **Payments** | `public.payments` | Tracks payments associated with reservations. |
| **Daily Occupancy** | `public.daily_occupancy` | Stores daily parking occupancy for reporting. |
| **Settings** | `public.settings` | A key-value store for global application settings. |
| **Pricing Rules** | `public.pricing_rules` | Defines pricing tiers based on stay duration. |
| **Transfer Vehicles**| `public.transfer_vehicles`| Manages the fleet of transfer vehicles. |

## 2. Endpoints

### 2.1 Reservations Resource

#### GET `/reservations`

- **Description**: Retrieves a list of reservations. Supports filtering, sorting, and pagination.
- **Query Parameters**:
  - `select=<columns>`: Specify columns to return.
  - `id=eq.<uuid>`: Filter by ID.
  - `last_name=ilike.*<name>*`: Filter by last name (case-insensitive).
  - `planned_check_in=gte.<date>&planned_check_out=lte.<date>`: Filter by date range.
  - `order=<column>.<asc|desc>`: Sort results.
  - `offset=<number>&limit=<number>`: Paginate results.
- **Success Response**:
  - **Code**: `200 OK`
  - **Payload**:
    ```json
    [
      {
        "id": "uuid",
        "last_name": "Kowalski",
        "first_name": "Jan",
        "email": "jan.kowalski@example.com",
        "phone": "123456789",
        "flight_direction": "departure",
        "license_plate": "WX12345",
        "status": "confirmed",
        "source": "phone",
        "total_cost": 210.00,
        "is_paid": false,
        "notes": "Customer will be late.",
        "planned_check_in": "2025-11-10T14:00:00Z",
        "planned_check_out": "2025-11-17T12:00:00Z",
        "actual_check_in": null,
        "actual_check_out": null,
        "created_at": "2025-10-24T10:00:00Z",
        "updated_at": "2025-10-24T10:00:00Z",
        "created_by": "uuid",
        "last_modified_by": "uuid"
      }
    ]
    ```

#### POST `/reservations`

- **Description**: Creates a new reservation. Intended for internal staff use.
- **Request Payload**:
  ```json
  {
    "last_name": "Nowak",
    "planned_check_in": "2025-12-01T08:00:00Z",
    "planned_check_out": "2025-12-05T18:00:00Z",
    "source": "walk_in",
    "total_cost": 120.00,
    "email": "anna.nowak@example.com"
  }
  ```
- **Success Response**:
  - **Code**: `201 Created`
  - **Payload**: The newly created reservation object.
- **Error Responses**:
  - **Code**: `400 Bad Request` - If required fields are missing or data violates DB constraints.
  - **Code**: `409 Conflict` - If overbooking logic (implemented via triggers/RLS) prevents creation.

#### PATCH `/reservations?id=eq.<uuid>`

- **Description**: Updates an existing reservation. Used for check-in, check-out, and other modifications.
- **Request Payload**:
  ```json
  // Example for Check-in
  {
    "status": "in_progress",
    "actual_check_in": "2025-11-10T14:05:12Z",
    "license_plate": "WZ54321"
  }
  ```
- **Success Response**:
  - **Code**: `200 OK`
  - **Payload**: The updated reservation object.
- **Error Responses**:
  - **Code**: `400 Bad Request` - If data violates DB constraints.
  - **Code**: `404 Not Found` - If reservation with the given ID does not exist.

#### DELETE `/reservations?id=eq.<uuid>`

- **Description**: Deletes a reservation.
- **Success Response**:
  - **Code**: `204 No Content`
- **Error Responses**:
  - **Code**: `404 Not Found` - If reservation with the given ID does not exist.

---

### 2.2 Custom Functions & Endpoints

#### POST `/rpc/get_todays_arrivals`

- **Description**: Retrieves all reservations with a planned check-in for the current day, sorted chronologically.
- **Request Payload**: (Empty)
- **Success Response**:
  - **Code**: `200 OK`
  - **Payload**: An array of reservation objects.

#### POST `/rpc/get_todays_departures`

- **Description**: Retrieves all reservations with a planned check-out for the current day, sorted chronologically.
- **Request Payload**: (Empty)
- **Success Response**:
  - **Code**: `200 OK`
  - **Payload**: An array of reservation objects.

#### POST `/functions/v1/create-reservation-external`

- **Description**: A dedicated, secure endpoint for creating reservations from external sources (e.g., a public website). This function will handle overbooking checks, cost calculation, and trigger confirmation emails.
- **Request Payload**:
  ```json
  {
    "lastName": "Smith",
    "firstName": "John",
    "email": "john.smith@web.com",
    "phone": "987654321",
    "licensePlate": "E123XYZ",
    "checkInDate": "2025-11-20T10:00:00Z",
    "checkOutDate": "2025-11-25T16:30:00Z"
  }
  ```
- **Success Response**:
  - **Code**: `201 Created`
  - **Payload**:
    ```json
    {
      "reservationId": "uuid",
      "message": "Reservation created successfully."
    }
    ```
- **Error Responses**:
  - **Code**: `400 Bad Request` - Invalid input data format.
  - **Code**: `403 Forbidden` - Invalid or missing API key.
  - **Code**: `409 Conflict` - Parking is full for the selected dates (overbooking).
  - **Code**: `500 Internal Server Error` - Failed to send confirmation email or other server-side issue.

---

### 2.3 Other Resources

Endpoints for `Payments`, `Daily Occupancy`, `Settings`, `Pricing Rules`, and `Transfer Vehicles` will follow standard PostgREST CRUD patterns (`GET`, `POST`, `PATCH`, `DELETE`) similar to the `Reservations` resource. They will be used for internal management within the admin dashboard.

**Example**: `GET /daily_occupancy?date=gte.2025-11-01&date=lte.2025-11-30` to fetch data for the occupancy calendar.

## 3. Authentication and Authorization

ignore for now// will be done later

## 4. Validation and Business Logic

- **Data Validation**:
  - Primary validation is enforced at the database level through `NOT NULL`, `CHECK`, and `UNIQUE` constraints. Invalid requests will result in a `400 Bad Request` response from the API.
  - **Example**: Creating a reservation with `planned_check_out` before `planned_check_in` will be rejected by the database `CHECK (planned_check_out > planned_check_in)` constraint.
  - The external API Edge Function will have an additional layer of validation for its specific payload schema.

- **Business Logic Implementation**:
  - **Overbooking Prevention**: This logic is implemented within the `create-reservation-external` Edge Function. It will query the `daily_occupancy` table and compare it against the `total_parking_spots` setting before creating a new reservation. A similar check (likely via a database trigger or RLS policy) will protect against internal overbooking.
  - **Cost Calculation**: The database function `public.calculate_total_cost` is used. For the external API, the Edge Function calls this. For internal updates, the `trg_update_cost` database trigger automatically recalculates the `total_cost` if dates are changed.
  - **Automated Emails**: The logic to send a confirmation email will be triggered from the `create-reservation-external` Edge Function and via a database hook for internal reservations.
