# Annara — MongoDB Setup & Configuration Guide

This guide describes how to configure and connect the Annara Food Rescue Network backend with **MongoDB Atlas** (cloud-hosted) or **Local MongoDB Server**.

---

## 1. Option A: Connecting to MongoDB Atlas (Cloud)

### Step 1: Create a MongoDB Atlas Cluster
1. Navigate to [mongodb.com/atlas](https://www.mongodb.com/atlas) and sign in or create a free account.
2. Create a new project (e.g. `Annara-Food-Rescue`) and deploy a free **M0 Sandbox** cluster.
3. Choose a provider and region nearest to your location (e.g. AWS / Mumbai `ap-south-1`).

### Step 2: Configure Database Access (Credentials)
1. In the Atlas dashboard, navigate to **Security** -> **Database Access**.
2. Click **Add New Database User**.
3. Choose **Password** authentication:
   - Username: `annara_admin`
   - Password: `<your-secure-password>`
4. Grant the user `Read and write to any database` or restrict to database `annara`.
5. Click **Add User**.

### Step 3: Configure Network Access (IP Whitelist)
1. In the Atlas dashboard, navigate to **Security** -> **Network Access**.
2. Click **Add IP Address**.
3. For local development or cloud deployment, click **Allow Access from Anywhere** (`0.0.0.0/0`) or enter your current public IP.
4. Click **Confirm**.

### Step 4: Get Connection String
1. Navigate to **Deployment** -> **Database** and click **Connect**.
2. Select **Drivers** -> Java / Spring Boot.
3. Copy the SRV connection URI:
   ```
   mongodb+srv://annara_admin:<password>@cluster0.xxxxx.mongodb.net/annara?retryWrites=true&w=majority
   ```

### Step 5: Configure Backend Environment Variables
Set the environment variable in your terminal, or create `backend/.env`:
```env
MONGODB_URI=mongodb+srv://annara_admin:<your-password>@cluster0.xxxxx.mongodb.net/annara?retryWrites=true&w=majority
MONGODB_DATABASE=annara
```

---

## 2. Option B: Connecting to Local MongoDB Server

### Step 1: Verify Local MongoDB Service
On Windows, MongoDB Server runs as a service named `MongoDB` on standard port `27017`.
Check if MongoDB is running via PowerShell:
```powershell
Get-Service *mongo*
& "C:\Program Files\mongosh\mongosh.exe" --eval "db.adminCommand('ping')"
```
If not started:
```powershell
Start-Service MongoDB
```

### Step 2: Default Configuration
By default, Annara is configured to automatically connect to your local MongoDB server without requiring manual credentials:
```properties
spring.data.mongodb.uri=mongodb://localhost:27017/annara
spring.data.mongodb.database=annara
```

---

## 3. MongoDB Collections & Indexes

The Annara backend automatically initializes and manages the following 6 collections:

| Collection Name | Document Entity | Primary Key | Key Indexes |
| :--- | :--- | :--- | :--- |
| `users` | `AppUser` | `id` (String / ObjectId) | `email` (Unique), `role` |
| `donations` | `Donation` | `id` (String / ObjectId) | `status`, `pickupBefore`, `createdAt`, `donor.id` |
| `claims` | `FoodClaim` | `id` (String / ObjectId) | `status`, `createdAt`, `claimant.id`, `donation.id` |
| `food_requests` | `FoodRequest` | `id` (String / ObjectId) | `status`, `createdAt`, `requester.id` |
| `deliveries` | `Delivery` | `id` (String / ObjectId) | `status`, `createdAt`, `driver.id`, `donation.id` |
| `tracking_locations`| `TrackingLocation` | `id` (String / ObjectId) | Compound Index: `{deliveryId: 1, recordedAt: 1}` |

---

## 4. Concurrency & Over-Claim Prevention Architecture

Unlike relational databases that rely on SQL table/row locks, Annara utilizes **MongoDB atomic conditional updates** (`MongoTemplate.findAndModify`):

```java
Query query = new Query(Criteria.where("_id").is(donationId)
        .and("remainingMeals").gte(requestedMeals)
        .and("status").in(DonationStatus.AVAILABLE, DonationStatus.PARTIALLY_CLAIMED)
        .and("pickupBefore").gt(LocalDateTime.now()));

Update update = new Update().inc("remainingMeals", -requestedMeals);
Donation updated = mongoTemplate.findAndModify(query, update, options, Donation.class);
```

**Benefits**:
- **Zero Race Conditions**: Under high concurrency, simultaneous requests cannot allocate the same surplus meals.
- **Atomic Rollback**: When claims are rejected or cancelled, portions are returned back to the donation atomically.
- **Cluster Friendly**: Works across standalone MongoDB instances, replica sets, and MongoDB Atlas clusters.
