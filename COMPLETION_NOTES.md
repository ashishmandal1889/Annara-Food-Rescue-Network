# Annara Food Rescue Network — MongoDB Migration & Completion Notes

## 1. Migration Overview
- **Objective**: Complete end-to-end migration from relational MySQL/JPA to MongoDB with atomic conditional updates, role authorization, and production readiness.
- **Backend Framework**: Spring Boot 3.4.4, Java 24 (source level 17).
- **Primary Database**: MongoDB (configured for local MongoDB 8.2 & MongoDB Atlas via `MONGODB_URI`).
- **Frontend**: React 18/19 with Vite, pure responsive CSS (`style.css`), and Lucide React icons.

---

## 2. Migrated Components

### A. Document Collections
1. `users` (`com.annara.entity.AppUser`): MongoDB document with `@Indexed(unique = true)` on `email`, index on `role`.
2. `donations` (`com.annara.entity.Donation`): Stores meal availability, pickup window, image filename, and `@DocumentReference` to donor.
3. `claims` (`com.annara.entity.FoodClaim`): Stores meal reservations, claim status, references to donation and claimant.
4. `food_requests` (`com.annara.entity.FoodRequest`): Stores community requests with urgency levels, references to requester and matched donation.
5. `deliveries` (`com.annara.entity.Delivery`): Stores delivery status machine, driver assignment, drop-off address, handover photo proof, and references.
6. `tracking_locations` (`com.annara.entity.TrackingLocation`): Real-time coordinates and speed with compound index on `(deliveryId, recordedAt)`.

### B. Spring Data Mongo Repositories
- `UserRepository extends MongoRepository<AppUser, String>`
- `DonationRepository extends MongoRepository<Donation, String>`
- `ClaimRepository extends MongoRepository<FoodClaim, String>`
- `FoodRequestRepository extends MongoRepository<FoodRequest, String>`
- `DeliveryRepository extends MongoRepository<Delivery, String>`
- `TrackingLocationRepository extends MongoRepository<TrackingLocation, String>`

### C. Concurrency & Over-Claim Prevention
- Replaced SQL pessimistic write locks with **MongoDB atomic conditional updates** (`MongoTemplate.findAndModify`).
- Atomic meal decrement ensures two concurrent users cannot reserve the same surplus meals.
- Rejection and cancellation refund reserved portions atomically to the donation document.
- Verified with multi-threaded concurrency test `ConcurrentClaimAndReservationTests` (10 concurrent threads).

---

## 3. Frontend & API Integration
- Cleaned ID parsing in `frontend/src/main.jsx` to support alphanumeric/hex MongoDB ObjectIds seamlessly.
- Updated Spring Security pattern from `/api/donations/{id:[0-9]+}` to `/api/donations/{id}` to allow public access to MongoDB document IDs.
- Verified session persistence via `GET /api/me`.

---

## 4. Automated Testing Results
- `AuthAndSecurityTests`: **5 / 5 Passed**
- `DonationWorkflowTests`: **4 / 4 Passed**
- `ClaimAndDeliveryWorkflowTests`: **2 / 2 Passed**
- `ConcurrentClaimAndReservationTests`: **1 / 1 Passed**
- `TrackingAndSecurityTests`: **3 / 3 Passed**
- **Total Backend Tests**: **15 / 15 Passed (100%)**
- **Frontend Build**: `vite build` completed successfully in 1.57s.
