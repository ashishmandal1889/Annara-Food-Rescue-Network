# Annara — REST API Reference Manual

Base API URL: `http://localhost:8080/api`

---

## 1. Authentication Endpoints

### Register User
- **Method**: `POST /api/auth/register`
- **Access**: Public
- **Request Body**:
  ```json
  {
    "fullName": "Chef Ajay",
    "organisationName": "Royal Biryani Kitchen",
    "email": "chef@royalbiryani.com",
    "password": "Password123!",
    "phone": "+919876543210",
    "city": "Bengaluru",
    "role": "RESTAURANT"
  }
  ```
- **Response**: `201 Created`
  ```json
  {
    "token": "eyJhbGciOiJIUzM4NCJ9...",
    "user": {
      "id": "6af41155b747b52aa2caefa4",
      "fullName": "Chef Ajay",
      "role": "RESTAURANT",
      "email": "chef@royalbiryani.com",
      "city": "Bengaluru"
    }
  }
  ```

### User Login
- **Method**: `POST /api/auth/login`
- **Access**: Public
- **Request Body**:
  ```json
  {
    "email": "chef@royalbiryani.com",
    "password": "Password123!"
  }
  ```
- **Response**: `200 OK` (Returns JWT token and user profile)

### Get Current User Profile
- **Method**: `GET /api/me`
- **Access**: Authenticated (`Bearer <token>`)
- **Response**: `200 OK`

---

## 2. Food Donation Endpoints

### Browse Available Donations
- **Method**: `GET /api/donations`
- **Access**: Public
- **Query Parameters**:
  - `q` (string, optional): Search keyword for food name, type, description.
  - `city` (string, optional): Filter by donor city.
- **Response**: `200 OK` (Array of donations with remaining meals and deadlines)

### View Single Donation
- **Method**: `GET /api/donations/{id}`
- **Access**: Public
- **Response**: `200 OK`

### View My Donations
- **Method**: `GET /api/donations/mine`
- **Access**: Role `RESTAURANT` or `ADMIN`
- **Response**: `200 OK`

### Create Donation
- **Method**: `POST /api/donations`
- **Access**: Role `RESTAURANT`
- **Content-Type**: `multipart/form-data`
- **Parts**:
  - `data`: JSON blob with donation fields (`foodName`, `totalMeals`, `pickupBefore`, `pickupAddress`, etc.)
  - `image` (optional): Uploaded food image (JPEG, PNG, WebP $\le 5$ MB).
- **Response**: `201 Created`

### Edit Donation
- **Method**: `PUT /api/donations/{id}`
- **Access**: Donation Owner (`RESTAURANT`)
- **Request Body**: JSON with updated fields.
- **Response**: `200 OK`

### Cancel Donation
- **Method**: `PATCH /api/donations/{id}/cancel`
- **Access**: Donation Owner (`RESTAURANT`)
- **Response**: `200 OK` (Marks donation CANCELLED and cascades cancellation to pending claims).

---

## 3. Food Claim Endpoints

### Claim Meals from Donation
- **Method**: `POST /api/donations/{id}/claims`
- **Access**: Role `NGO`, `RECIPIENT`, or `ADMIN`
- **Request Body**:
  ```json
  {
    "requestedMeals": 10
  }
  ```
- **Response**: `201 Created` (Atomically reserves meals, updates donation remaining count).

### View My Claims
- **Method**: `GET /api/claims/mine`
- **Access**: Role `NGO`, `RECIPIENT`, or `ADMIN`
- **Response**: `200 OK`

### View Claims for a Donation
- **Method**: `GET /api/donations/{id}/claims`
- **Access**: Donation Owner (`RESTAURANT`)
- **Response**: `200 OK` (List of claims on the donor's listing).

### Review Claim (Approve / Reject)
- **Method**: `PATCH /api/claims/{id}/status`
- **Access**: Donation Owner (`RESTAURANT`)
- **Request Body**: `{"status": "APPROVED"}` or `{"status": "REJECTED"}`
- **Response**: `200 OK` (Rejection atomically refunds meals back to donation).

### Cancel Pending Claim
- **Method**: `DELETE /api/claims/{id}`
- **Access**: Claim Owner (`NGO` / `RECIPIENT`)
- **Response**: `200 OK` (Atomically refunds reserved meals back to donation).

---

## 4. Food Request Endpoints

### Create Food Request
- **Method**: `POST /api/requests`
- **Access**: Role `NGO`, `RECIPIENT`, or `ADMIN`
- **Request Body**:
  ```json
  {
    "foodName": "Dinner meal boxes",
    "requestedMeals": 25,
    "description": "Needed for shelter community",
    "urgency": "HIGH",
    "neededBefore": "2026-11-12T20:00:00",
    "deliveryAddress": "Sector 4 Community Hall"
  }
  ```
- **Response**: `201 Created`

### List Food Requests
- **Method**: `GET /api/requests`
- **Access**: Authenticated
- **Response**: `200 OK`

### Match Donation to Request
- **Method**: `POST /api/requests/{id}/match`
- **Access**: Role `RESTAURANT`
- **Request Body**: `{"donationId": "<donation-id>"}`
- **Response**: `200 OK`

### Arrange Delivery for Matched Request
- **Method**: `POST /api/requests/{id}/delivery`
- **Access**: Requester (`NGO` / `RECIPIENT`)
- **Request Body**: `{"driverId": "<driver-id>", "deliveryAddress": "..."}`
- **Response**: `201 Created`

---

## 5. Delivery Management, Proof & GPS Tracking Endpoints

### List Available Drivers
- **Method**: `GET /api/drivers`
- **Access**: Role `NGO`, `RECIPIENT`, `RESTAURANT`, or `ADMIN`
- **Response**: `200 OK` (Includes `available: boolean` and `activeDeliveries: int` count to prevent conflicting assignments)

### Admin Deliveries Metrics Summary
- **Method**: `GET /api/deliveries/summary`
- **Access**: Role `ADMIN`
- **Response**: `200 OK`
  ```json
  {
    "totalDeliveries": 42,
    "pendingDeliveries": 4,
    "assignedDeliveries": 6,
    "acceptedDeliveries": 3,
    "pickedUpDeliveries": 2,
    "inTransitDeliveries": 5,
    "deliveredDeliveries": 12,
    "confirmedDeliveries": 10,
    "failedDeliveries": 2,
    "cancelledDeliveries": 1,
    "totalMealsDelivered": 980,
    "totalDrivers": 8,
    "availableDrivers": 5
  }
  ```

### List Deliveries (With Filters)
- **Method**: `GET /api/deliveries` (or `GET /api/deliveries/mine`)
- **Access**: Authenticated
- **Query Parameters**:
  - `status` (optional): Filter by `PENDING`, `ASSIGNED`, `ACCEPTED`, `PICKED_UP`, `IN_TRANSIT`, `DELIVERED`, `CONFIRMED`, `FAILED`, `CANCELLED`
- **Response**: `200 OK`

### Get Delivery Details & Lifecycle
- **Method**: `GET /api/deliveries/{id}`
- **Access**: Authorized Delivery Participants or `ADMIN`
- **Response**: `200 OK` (Includes full timeline, proof history from `delivery_proofs`, and latest GPS location)

### Assign Driver
- **Method**: `PUT /api/deliveries/{id}/assign` (or `POST /api/deliveries/{id}/assign`)
- **Access**: `ADMIN`, Donor (`RESTAURANT`), or Recipient (`NGO` / `RECIPIENT`)
- **Request Body**:
  ```json
  {
    "driverId": "<driver-id>",
    "deliveryAddress": "City Shelter #4"
  }
  ```
- **Validation**: Verifies driver is not busy with another active delivery in `ACCEPTED`, `PICKED_UP`, or `IN_TRANSIT` to prevent conflicting assignments.
- **Response**: `200 OK` (Status updated to `ASSIGNED`)

### Driver Accept Assignment
- **Method**: `PUT /api/deliveries/{id}/accept`
- **Access**: Assigned `DRIVER`
- **Response**: `200 OK` (Status updated to `ACCEPTED`, sets `acceptedAt`)

### Driver Decline Assignment
- **Method**: `PUT /api/deliveries/{id}/reject`
- **Access**: Assigned `DRIVER`
- **Request Body** (optional): `{"reason": "Vehicle issue"}`
- **Response**: `200 OK` (Status resets to `PENDING`, unassigns driver for re-queueing)

### Update Delivery Status (Lifecycle Transitions)
- **Method**: `PUT /api/deliveries/{id}/status` (or `PATCH /api/deliveries/{id}/status`)
- **Access**: Authorized Participant or `ADMIN`
- **Valid Transitions**:
  - `PENDING` $\rightarrow$ `ASSIGNED`, `CANCELLED`
  - `ASSIGNED` $\rightarrow$ `ACCEPTED`, `PENDING`, `PICKED_UP`, `CANCELLED`
  - `ACCEPTED` $\rightarrow$ `PICKED_UP`, `CANCELLED`, `FAILED`
  - `PICKED_UP` $\rightarrow$ `IN_TRANSIT`, `DELIVERED`, `FAILED`
  - `IN_TRANSIT` $\rightarrow$ `DELIVERED`, `FAILED`
  - `DELIVERED` $\rightarrow$ `CONFIRMED`, `FAILED`
- **Request Body**: `{"status": "PICKED_UP"}` / `IN_TRANSIT` / `DELIVERED`
- **Response**: `200 OK`

### Broadcast Real-Time GPS Tracking Location
- **Method**: `POST /api/deliveries/{id}/tracking` (or `POST /api/tracking`)
- **Access**: Assigned `DRIVER` or `ADMIN`
- **Request Body**:
  ```json
  {
    "latitude": 12.971598,
    "longitude": 77.594562,
    "speed": 28.5
  }
  ```
- **Response**: `201 Created`

### Retrieve GPS Tracking History Trail
- **Method**: `GET /api/deliveries/{id}/tracking` (or `GET /api/tracking/delivery/{id}`)
- **Access**: Delivery Participants or `ADMIN`
- **Response**: `200 OK` (Breadcrumb coordinate array for Leaflet polyline rendering)

### Retrieve Latest Driver Coordinate
- **Method**: `GET /api/deliveries/{id}/tracking/latest`
- **Access**: Delivery Participants or `ADMIN`
- **Response**: `200 OK`

### Upload Delivery Handover Proof
- **Method**: `POST /api/deliveries/{id}/proof`
- **Access**: Assigned `DRIVER`, `NGO`, or `ADMIN`
- **Content-Type**: `multipart/form-data`
- **Parts**:
  - `image`: Handover photo (JPEG, PNG, WebP $\le 5$ MB)
  - `receiverName` (optional): Name of person receiving the food
  - `latitude` (optional): Geotagged drop-off latitude
  - `longitude` (optional): Geotagged drop-off longitude
- **Database Persistence**: Saved in MongoDB `delivery_proofs` collection with timestamp and link to `deliveries`
- **Response**: `200 OK` (Transitions status to `DELIVERED`)

### Recipient Confirm Food Receipt
- **Method**: `PUT /api/deliveries/{id}/confirm`
- **Access**: Recipient (`NGO` / `RECIPIENT`) or `ADMIN`
- **Request Body** (optional): `{"notes": "Meals received in hygienic condition"}`
- **Response**: `200 OK` (Transitions status to `CONFIRMED`, sets `recipientConfirmed = true`, marks claim `COMPLETED`)

### Report Delivery Issue / Failure
- **Method**: `PUT /api/deliveries/{id}/fail`
- **Access**: Delivery Participants or `ADMIN`
- **Request Body**: `{"reason": "Food damaged in transit / recipient unavailable"}`
- **Response**: `200 OK` (Transitions status to `FAILED`, sets `failureReason`)
