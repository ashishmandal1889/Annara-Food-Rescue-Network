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

## 5. Delivery & GPS Tracking Endpoints

### List Available Drivers
- **Method**: `GET /api/drivers`
- **Access**: Role `NGO`, `RECIPIENT`, or `ADMIN`
- **Response**: `200 OK`

### List My Deliveries
- **Method**: `GET /api/deliveries/mine`
- **Access**: Authenticated (Driver, NGO, Recipient, Donor, Admin)
- **Response**: `200 OK`

### Update Delivery Status
- **Method**: `PATCH /api/deliveries/{id}/status`
- **Access**: Assigned Driver or Admin
- **Request Body**: `{"status": "PICKED_UP"}` / `IN_TRANSIT` / `DELIVERED` / `CANCELLED`
- **Response**: `200 OK`

### Upload Delivery Handover Proof
- **Method**: `POST /api/deliveries/{id}/proof`
- **Access**: Assigned Driver or NGO
- **Content-Type**: `multipart/form-data`
- **Part**: `image` (Handover confirmation photo)
- **Response**: `200 OK`

### Toggle GPS Tracking
- **Method**: `PATCH /api/deliveries/{id}/tracking`
- **Access**: Assigned Driver
- **Request Body**: `{"enabled": true}` or `{"enabled": false}`
- **Response**: `200 OK`

### Broadcast Driver GPS Location
- **Method**: `POST /api/tracking`
- **Access**: Assigned Driver
- **Request Body**:
  ```json
  {
    "deliveryId": "<delivery-id>",
    "latitude": 12.9716,
    "longitude": 77.5946,
    "speed": 28.5
  }
  ```
- **Response**: `201 Created`

### Get Latest Tracking Coordinate
- **Method**: `GET /api/tracking/delivery/{deliveryId}/latest`
- **Access**: Authorized Delivery Participants Only
- **Response**: `200 OK`

### Get Tracking History Trail
- **Method**: `GET /api/tracking/delivery/{deliveryId}`
- **Access**: Authorized Delivery Participants Only
- **Response**: `200 OK` (Breadcrumb route coordinates)
