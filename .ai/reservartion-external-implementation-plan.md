# API Endpoint Implementation Plan: POST /api/reservations/external

## 1. Endpoint Overview

This document outlines the implementation plan for the `POST /api/reservations/external` endpoint. Its purpose is to provide a secure and reliable method for external partners or systems to create parking reservations. The endpoint will handle data validation, prevent overbooking, create a reservation record in the database, and trigger a confirmation email.

## 2. Request Details

- **HTTP Method**: `POST`
- **URL Path**: `/api/reservations/external`
- **Headers**:
  - `Content-Type`: `application/json`
  - `Authorization`: `Bearer <YOUR_API_KEY>`
- **Request Body**:
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

## 3. Utilized Types and Schemas

### Zod Schema: `CreateExternalReservationSchema`

A new Zod schema will be defined in `src/lib/schemas/reservation.schema.ts` for input validation.

```typescript
import { z } from "zod";

export const CreateExternalReservationSchema = z
  .object({
    lastName: z.string().min(1, { message: "Last name is required." }),
    firstName: z.string().min(1, { message: "First name is required." }),
    email: z.string().email({ message: "Invalid email address." }),
    phone: z.string().min(1, { message: "Phone number is required." }),
    licensePlate: z.string().min(1, { message: "License plate is required." }),
    checkInDate: z.string().datetime({ message: "Invalid check-in date format." }),
    checkOutDate: z.string().datetime({ message: "Invalid check-out date format." }),
  })
  .refine((data) => new Date(data.checkOutDate) > new Date(data.checkInDate), {
    message: "Check-out date must be after check-in date.",
    path: ["checkOutDate"],
  });
```

### DTO Type: `CreateExternalReservationDto`

This type, representing the validated data, will be inferred from the Zod schema.

```typescript
import { z } from "zod";
import { CreateExternalReservationSchema } from "./reservation.schema";

export type CreateExternalReservationDto = z.infer<typeof CreateExternalReservationSchema>;
```

## 4. Response Details

### Success Response

- **Status Code**: `201 Created`
- **Body**:
  ```json
  {
    "reservationId": "a1b2c3d4-e5f6-7890-1234-567890abcdef",
    "message": "Reservation created successfully."
  }
  ```

### Error Responses

- **Status Code**: `400 Bad Request`
- **Body**: `{ "error": "Invalid input", "details": "[...Zod error details...]" }`

- **Status Code**: `403 Forbidden`
- **Body**: `{ "error": "Access denied. Invalid or missing API key." }`

- **Status Code**: `409 Conflict`
- **Body**: `{ "error": "Parking is full for the selected dates." }`

- **Status Code**: `500 Internal Server Error`
- **Body**: `{ "error": "An unexpected error occurred." }`

## 5. Data Flow

1.  An incoming `POST` request is received by the Astro server endpoint at `/api/reservations/external`.
2.  **Authentication**: A middleware or a dedicated function checks the `Authorization` header for a valid Bearer token (API Key). If invalid or missing, it returns a `403 Forbidden` response.
3.  **Validation**: The request body is parsed and validated against the `CreateExternalReservationSchema`. If validation fails, a `400 Bad Request` response is returned with error details.
4.  **Service Call**: The validated data (DTO) is passed to a new method, `createExternalReservation`, in the `ReservationService`.
5.  **Overbooking Check (Service Layer)**: The service queries the `reservations` table to check for overlapping reservations, ensuring that the total number of concurrent reservations does not exceed the parking capacity. If full, it throws a specific error, leading to a `409 Conflict` response.
6.  **DB Insert (Service Layer)**: A new record is created in the `reservations` table with the provided details and a `pending` status.
7.  **Post-Creation Actions (Service Layer)**: After successful insertion, the service can trigger a confirmation email. This should be handled asynchronously (e.g., via a Supabase Edge Function triggered by a new row in `reservations`) to avoid delaying the API response.
8.  **Response Generation**: The API endpoint receives the new reservation ID from the service, formats the `201 Created` response, and sends it to the client.

## 6. Security Considerations

- **API Key Management**: The valid API key will be stored securely as an environment variable (`EXTERNAL_API_KEY`) on the server. The comparison will be done using a constant-time comparison algorithm to prevent timing attacks.
- **Rate Limiting**: The existing rate-limiting middleware (`src/middleware/rate-limit.ts`) will be applied to this endpoint in `src/middleware/index.ts` to prevent abuse and potential DoS attacks.
- **HTTPS**: All communication must be over HTTPS to protect the API key and user data in transit.

## 7. Performance Considerations

- **Database Indexing**: To ensure the overbooking check is performant, the `reservations` table should have indexes on the `check_in_date` and `check_out_date` columns.
- **Asynchronous Operations**: Non-essential post-creation tasks, like sending emails, will be handled asynchronously to ensure a fast response time for the client.

## 8. Implementation Steps

1.  **Environment Setup**: Add `EXTERNAL_API_KEY` to the project's environment variables (`.env`).
2.  **Update Zod Schema**: Add the `CreateExternalReservationSchema` to `src/lib/schemas/reservation.schema.ts`.
3.  **Implement Service Logic**:
    - Add the `createExternalReservation` method to `src/lib/services/reservation.service.ts`.
    - Implement the overbooking check logic within the service. This will involve querying existing reservations between the given `checkInDate` and `checkOutDate`.
    - Implement the database insertion logic using the Supabase client.
4.  **Create API Endpoint**:
    - In `src/pages/api/reservations/external.ts`, create the `POST` handler.
    - Implement the API key check at the beginning of the handler.
    - Use the `CreateExternalReservationSchema` to parse and validate the request body.
    - Call the `reservationService.createExternalReservation` method with the validated data.
    - Implement comprehensive try-catch blocks to handle potential errors from the service layer and return the appropriate HTTP responses (409, 500).
5.  **Apply Middleware**: Update `src/middleware/index.ts` to apply the rate-limiting middleware to the `/api/reservations/external` route.
6.  **Testing**: Create integration tests to verify all success and error paths, including invalid data, incorrect API key, overbooking scenarios, and server errors.
