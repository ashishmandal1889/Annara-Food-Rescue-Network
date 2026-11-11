# Annara — Quality Assurance & Testing Checklist

## 1. Automated Test Suites Summary

| Test Suite File | Test Count | Scope | Result |
| :--- | :--- | :--- | :--- |
| `AuthAndSecurityTests.java` | 5 | User registration, role guards, BCrypt check, duplicate emails, `/api/me` | **PASS** (5/5) |
| `DonationWorkflowTests.java` | 4 | Create donation, deadline validation, owner edit, cancel, public list/filter | **PASS** (4/4) |
| `ClaimAndDeliveryWorkflowTests.java` | 2 | Claim lifecycle, overclaim prevention, approve, assign driver, status lifecycle, matching | **PASS** (2/2) |
| `ConcurrentClaimAndReservationTests.java` | 1 | 10 concurrent threads claiming 10 meals each from a 30-meal donation | **PASS** (1/1) |
| `TrackingAndSecurityTests.java` | 3 | GPS broadcast, access control, toggle tracking, proof upload, path traversal defense | **PASS** (3/3) |
| **Total Automated Tests** | **15** | Full integration against live MongoDB database | **100% PASS** |

---

## 2. End-to-End Functional Test Checklist

| Scenario | Steps to Execute | Expected Result | Verified Status |
| :--- | :--- | :--- | :--- |
| **1. Public Discovery** | Open `http://localhost:5173` without logging in. Use search bar and city dropdown. | Available donations render with accurate remaining meal badges and expiry countdowns. | **VERIFIED** |
| **2. Donor Registration & Post** | Click "Sign in" -> "Register". Select `RESTAURANT`. Open "Create donation", enter 40 portions, set tomorrow's deadline, click Publish. | Donation appears in MongoDB `donations` collection and immediately on public feed. | **VERIFIED** |
| **3. NGO Claim** | Sign in as `NGO`. Click "Claim food", select 15 portions. | Donation remaining meals decreases from 40 to 25. Claim enters `PENDING` state in "My claims". | **VERIFIED** |
| **4. Donor Approval** | Sign in as Donor. Open "My donations" -> Claims drawer. Click "Approve". | Claim updates to `APPROVED`. | **VERIFIED** |
| **5. Driver Assignment** | Sign in as NGO. On approved claim, click "Assign Driver", select registered driver and enter address. | Delivery created in `ASSIGNED` status in MongoDB `deliveries`. | **VERIFIED** |
| **6. Driver Workflow & GPS** | Sign in as Driver. Open "Deliveries". Click "Share Location". Click "Mark Picked Up" -> "Mark In Transit" -> "Mark Delivered". Upload proof photo. | Location point saved in `tracking_locations`. Delivery advances through states and reaches `DELIVERED`. | **VERIFIED** |
| **7. Live Route Map Verification** | Sign in as NGO. Open "Deliveries" -> Click "Live tracking". Click "Open in Google Maps". | Latest coordinates and speed render with direct Google Maps external link. | **VERIFIED** |
| **8. Rejection / Cancellation Refund** | Make a claim for 10 meals. As Donor, click "Reject" (or as Claimant click "Cancel"). | Remaining meals atomically refunded back to the donation. | **VERIFIED** |
