#!/bin/bash

# Reservation API Testing Script
# Authentication has been temporarily removed for development
BASE_URL="http://localhost:3000"

echo "========================================="
echo "Reservation API Testing Script"
echo "Base URL: $BASE_URL"
echo "========================================="

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print test results
print_test() {
    echo -e "${YELLOW}Testing: $1${NC}"
}

print_success() {
    echo -e "${GREEN}✓ SUCCESS: $1${NC}"
}

print_error() {
    echo -e "${RED}✗ ERROR: $1${NC}"
}

# Test 1: Create Reservation
print_test "POST /api/reservations - Create Reservation"
response=$(curl -s -w "\nHTTPSTATUS:%{http_code}" -X POST "$BASE_URL/api/reservations" \
  -H "Content-Type: application/json" \
  -d '{
    "last_name": "Smith",
    "first_name": "John",
    "email": "john.smith@example.com",
    "phone": "+1-555-0123",
    "license_plate": "ABC-123",
    "planned_check_in": "2025-12-01T10:00:00Z",
    "planned_check_out": "2025-12-05T18:00:00Z",
    "source": "phone",
    "total_cost": 250.00,
    "flight_direction": "arriving",
    "notes": "VIP customer"
  }')

http_code=$(echo "$response" | grep "HTTPSTATUS:" | cut -d: -f2)
body=$(echo "$response" | sed '/HTTPSTATUS:/d')

if [ "$http_code" -eq 201 ]; then
    print_success "Reservation created successfully"
    reservation_id=$(echo "$body" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
    echo "Created reservation ID: $reservation_id"
else
    print_error "Failed to create reservation (HTTP $http_code)"
    echo "Response: $body"
fi

echo

# Test 2: Get Today's Arrivals
print_test "POST /api/rpc/get_todays_arrivals - Get Today's Arrivals"
response=$(curl -s -w "\nHTTPSTATUS:%{http_code}" -X POST "$BASE_URL/api/rpc/get_todays_arrivals" \
  -H "Content-Type: application/json")

http_code=$(echo "$response" | grep "HTTPSTATUS:" | cut -d: -f2)
body=$(echo "$response" | sed '/HTTPSTATUS:/d')

if [ "$http_code" -eq 200 ]; then
    print_success "Retrieved today's arrivals"
    count=$(echo "$body" | grep -o '"id"' | wc -l)
    echo "Found $count arrivals"
else
    print_error "Failed to get today's arrivals (HTTP $http_code)"
    echo "Response: $body"
fi

echo

# Test 3: Get Today's Departures
print_test "POST /api/reservations/departures - Get Today's Departures"
response=$(curl -s -w "\nHTTPSTATUS:%{http_code}" -X POST "$BASE_URL/api/reservations/departures" \
  -H "Content-Type: application/json")

http_code=$(echo "$response" | grep "HTTPSTATUS:" | cut -d: -f2)
body=$(echo "$response" | sed '/HTTPSTATUS:/d')

if [ "$http_code" -eq 200 ]; then
    print_success "Retrieved today's departures"
    count=$(echo "$body" | grep -o '"id"' | wc -l)
    echo "Found $count departures"
else
    print_error "Failed to get today's departures (HTTP $http_code)"
    echo "Response: $body"
fi

echo

# Test 4: Create External Reservation
print_test "POST /api/reservations/external - Create External Reservation"
response=$(curl -s -w "\nHTTPSTATUS:%{http_code}" -X POST "$BASE_URL/api/reservations/external" \
  -H "Content-Type: application/json" \
  -d '{
    "lastName": "Johnson",
    "firstName": "Sarah",
    "email": "sarah.johnson@example.com",
    "phone": "+1-555-0456",
    "licensePlate": "XYZ-789",
    "checkInDate": "2025-12-15T08:00:00Z",
    "checkOutDate": "2025-12-18T20:00:00Z"
  }')

http_code=$(echo "$response" | grep "HTTPSTATUS:" | cut -d: -f2)
body=$(echo "$response" | sed '/HTTPSTATUS:/d')

if [ "$http_code" -eq 201 ]; then
    print_success "External reservation created successfully"
    ext_reservation_id=$(echo "$body" | grep -o '"reservationId":"[^"]*"' | cut -d'"' -f4)
    echo "Created external reservation ID: $ext_reservation_id"
else
    print_error "Failed to create external reservation (HTTP $http_code)"
    echo "Response: $body"
fi

echo

# Test 5: Update Reservation (if we have a reservation ID)
if [ -n "$reservation_id" ]; then
    print_test "PATCH /api/reservations - Update Reservation"
    response=$(curl -s -w "\nHTTPSTATUS:%{http_code}" -X PATCH "$BASE_URL/api/reservations?id=$reservation_id" \
      -H "Content-Type: application/json" \
      -d '{
        "phone": "+1-555-0987",
        "notes": "Updated contact info",
        "status": "confirmed"
      }')

    http_code=$(echo "$response" | grep "HTTPSTATUS:" | cut -d: -f2)
    body=$(echo "$response" | sed '/HTTPSTATUS:/d')

    if [ "$http_code" -eq 200 ]; then
        print_success "Reservation updated successfully"
    else
        print_error "Failed to update reservation (HTTP $http_code)"
        echo "Response: $body"
    fi
    echo
fi

# Test 6: Delete Reservation (if we have a reservation ID)
if [ -n "$reservation_id" ]; then
    print_test "DELETE /api/reservations - Delete Reservation"
    response=$(curl -s -w "\nHTTPSTATUS:%{http_code}" -X DELETE "$BASE_URL/api/reservations?id=$reservation_id")

    http_code=$(echo "$response" | grep "HTTPSTATUS:" | cut -d: -f2)

    if [ "$http_code" -eq 204 ]; then
        print_success "Reservation deleted successfully"
    else
        print_error "Failed to delete reservation (HTTP $http_code)"
    fi
    echo
fi

# Error Tests Section
echo "========================================="
echo "Error Tests"
echo "========================================="

# Test 7: Validation Error - Missing required fields
print_test "POST /api/reservations - Validation Error"
response=$(curl -s -w "\nHTTPSTATUS:%{http_code}" -X POST "$BASE_URL/api/reservations" \
  -H "Content-Type: application/json" \
  -d '{
    "last_name": "Smith"
  }')

http_code=$(echo "$response" | grep "HTTPSTATUS:" | cut -d: -f2)

if [ "$http_code" -eq 400 ]; then
    print_success "Validation properly rejected missing fields"
else
    print_error "Validation failed (HTTP $http_code)"
fi

echo

# Test 8: Invalid UUID for Update
print_test "PATCH /api/reservations - Invalid UUID"
response=$(curl -s -w "\nHTTPSTATUS:%{http_code}" -X PATCH "$BASE_URL/api/reservations?id=invalid-uuid" \
  -H "Content-Type: application/json" \
  -d '{
    "notes": "Updated notes"
  }')

http_code=$(echo "$response" | grep "HTTPSTATUS:" | cut -d: -f2)

if [ "$http_code" -eq 400 ]; then
    print_success "Invalid UUID properly rejected"
else
    print_error "UUID validation failed (HTTP $http_code)"
fi

echo

# Test 9: Reservation not found
print_test "PATCH /api/reservations - Reservation Not Found"
response=$(curl -s -w "\nHTTPSTATUS:%{http_code}" -X PATCH "$BASE_URL/api/reservations?id=99999999-9999-9999-9999-999999999999" \
  -H "Content-Type: application/json" \
  -d '{
    "notes": "This reservation does not exist"
  }')

http_code=$(echo "$response" | grep "HTTPSTATUS:" | cut -d: -f2)

if [ "$http_code" -eq 404 ]; then
    print_success "Non-existent reservation properly handled"
else
    print_error "Not found handling failed (HTTP $http_code)"
fi

echo

echo "========================================="
echo "Test Summary"
echo "========================================="
echo "All endpoints are now open without authentication for development."
echo "Run: chmod +x test_reservations.sh && ./test_reservations.sh"
