# Annara — Food Rescue Network

[![Java](https://img.shields.io/badge/Java-17%20%7C%2021%20%7C%2024-orange.svg)](https://www.oracle.com/java/)
[![Spring Boot](https://img.shields.io/badge/Spring%20Boot-3.4.4-brightgreen.svg)](https://spring.io/projects/spring-boot)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas%20%7C%208.2-green.svg)](https://www.mongodb.com/)
[![React](https://img.shields.io/badge/React-19-blue.svg)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-8-purple.svg)](https://vitejs.dev/)
[![Tests](https://img.shields.io/badge/Tests-15%20Passed-success.svg)](#8-automated-testing-results)

> **Annara** is an end-to-end full-stack platform that bridges the gap between surplus food sources (restaurants, catering businesses, corporate gatherings, weddings, and college festivals) and community organizations (NGOs, shelters, and individuals in need). Powered by **Spring Boot**, **MongoDB**, and **React**, registered delivery drivers coordinate transit, share verified live GPS coordinates, and document delivery handovers with photographic proof.

---

## Table of Contents
1. [Project Overview & Architecture](#1-project-overview--architecture)
2. [Technology Stack](#2-technology-stack)
3. [Project Structure](#3-project-structure)
4. [Prerequisites](#4-prerequisites)
5. [Quick Start & Installation](#5-quick-start--installation)
6. [Environment Variables](#6-environment-variables)
7. [MongoDB Configuration (Atlas & Local)](#7-mongodb-configuration-atlas--local)
8. [Automated Testing Results](#8-automated-testing-results)
9. [REST API Reference](#9-rest-api-reference)
10. [User Roles & Permissions Matrix](#10-user-roles--permissions-matrix)
11. [Demonstration & Walkthrough Script](#11-demonstration--walkthrough-script)
12. [GitHub Collaboration Workflow](#12-github-collaboration-workflow)

---

## 1. Project Overview & Architecture

### High-Level Architecture
```
┌────────────────────────────────────────────────────────┐
│                   React 19 / Vite UI                   │
│   (Discover, My Donations, Claims, Requests, Tracking) │
└───────────────────────────▲────────────────────────────┘
                            │ REST / JSON (JWT Auth)
┌───────────────────────────▼────────────────────────────┐
│              Spring Boot 3.4.4 REST API                │
│                                                        │
│  ┌──────────────────┐  ┌─────────────────────────────┐ │
│  │ Security & JWT   │  │ Business Logic Controllers  │ │
│  │ (BCrypt, Roles)  │  │ (Donations, Claims, Delivery)│ │
│  └──────────────────┘  └─────────────────────────────┘ │
│  ┌───────────────────────────────────────────────────┐ │
│  │ Spring Data MongoDB + MongoTemplate               │ │
│  │ (Atomic findAndModify for Race-Free Reservations) │ │
│  └───────────────────────────────────────────────────┘ │
└───────────────────────────▲────────────────────────────┘
                            │ MongoDB Wire Protocol
┌───────────────────────────▼────────────────────────────┐
│              MongoDB (Atlas / Local 8.2)               │
│ (users, donations, claims, food_requests, deliveries,  │
│                   tracking_locations)                  │
└────────────────────────────────────────────────────────┘
```

### Core Business Workflows

```
1. DONATION & CLAIM LIFECYCLE:
   [Restaurant/Donor] ──> Post Donation (Portions Available)
                                │
   [NGO/Recipient]    ──> Claim Portion ──> Status: PENDING (Atomic Decrement)
                                │
   [Restaurant/Donor] ──> Review Claim ──┬─> REJECTED (Atomic Meal Refund)
                                         └─> APPROVED
                                                │
   [Claimant]         ──> Assign Registered Driver ──> Status: ASSIGNED

2. DELIVERY & GPS TRACKING LIFECYCLE:
   ASSIGNED ──> PICKED UP ──> IN TRANSIT (Live GPS Broadcast) ──> DELIVERED
      │                                                              │
      └── Driver / NGO / Recipient Track Real-time Coordinates       └── Claim: COMPLETED

3. FOOD REQUEST & MATCHING LIFECYCLE:
   [NGO/Recipient]    ──> Create Request (OPEN)
                                │
   [Restaurant]       ──> Offer Matching Donation ──> Status: MATCHED
                                │
   [Requester]        ──> Assign Delivery Driver  ──> Status: ASSIGNED
```

---

## 2. Technology Stack

- **Backend**:
  - **Framework**: Spring Boot `3.4.4`
  - **Language**: Java 17+ (Tested with Java 24)
  - **Database Access**: Spring Data MongoDB with `MongoTemplate` atomic conditional updates
  - **Security**: Spring Security 6 with stateless JWT bearer token authentication and BCrypt hashing
  - **Validation**: Jakarta Bean Validation (`@Valid`, `@NotBlank`, `@Min`, `@Max`, `@DecimalMin`)
  - **Testing**: JUnit 5, MockMvc, AssertJ, Spring Boot Test
- **Database**:
  - **Primary Engine**: MongoDB (supports MongoDB Atlas and Local MongoDB Server 8.2 / Docker)
  - **Collections**: `users`, `donations`, `claims`, `food_requests`, `deliveries`, `tracking_locations`
- **Frontend**:
  - **Framework**: React `19.0.0`
  - **Build Tool**: Vite `8.3.5`
  - **Styling**: Native responsive CSS with Annara nature palette (`#315e3b`, `#d6f36a`, `#eaf0df`)
  - **Icons**: Lucide React

---

## 3. Project Structure

```
Annara-Structured/
├── frontend/
│   ├── src/
│   │   ├── main.jsx             # Complete React frontend application
│   │   └── style.css            # Responsive styling rules
│   ├── .env                     # Vite environment configuration
│   ├── .env.example             # Template for frontend environment
│   └── package.json             # NPM package scripts & dependencies
├── backend/
│   ├── src/
│   │   ├── main/
│   │   │   ├── java/com/annara/
│   │   │   │   ├── app/AnnaraApplication.java
│   │   │   │   ├── controller/ApiController.java
│   │   │   │   ├── entity/ (AppUser, Donation, FoodClaim, FoodRequest, Delivery, TrackingLocation)
│   │   │   │   ├── enums/ (ClaimStatus, DeliveryStatus, DonationStatus, RequestStatus, Role)
│   │   │   │   ├── exception/ApiExceptionHandler.java
│   │   │   │   ├── repository/ (ClaimRepo, DeliveryRepo, DonationRepo, RequestRepo, TrackingRepo, UserRepo)
│   │   │   │   └── security/ (JwtFilter, JwtService, SecurityConfig)
│   │   │   └── resources/application.properties
│   │   └── test/
│   │       ├── java/com/annara/ (Auth, Claim/Delivery, Donation, Tracking, Concurrency tests)
│   │       └── resources/application.properties
│   ├── mvnw.cmd / mvnw          # Maven wrapper
│   ├── pom.xml                  # Spring Data MongoDB build configuration
│   └── .env.example             # Backend environment template
├── docs/
│   ├── MONGODB_SETUP.md         # Atlas and local MongoDB setup instructions
│   ├── API_DOCUMENTATION.md     # Full REST API documentation
│   └── TESTING_CHECKLIST.md     # QA manual and automated test matrix
├── uploads/                     # Stored donation & delivery proof images
├── docker-compose.yml           # MongoDB Docker definition
├── start-all.bat                # One-click dual launcher
├── start-backend.bat            # Backend launcher
└── start-frontend.bat           # Frontend launcher
```

---

## 4. Prerequisites

1. **Java**: JDK 17 or higher (JDK 24 installed at `C:\Program Files\Java\jdk-24`).
2. **Node.js**: v18 or higher (with `npm`).
3. **MongoDB**: Local MongoDB service running on `localhost:27017` or a free MongoDB Atlas connection string.

---

## 5. Quick Start & Installation

### Option 1: One-Click Windows Launch
Double-click:
```
start-all.bat
```
This automatically sets `JAVA_HOME` and launches both the Spring Boot Backend on `http://localhost:8080` and the Vite React Frontend on `http://localhost:5173`.

### Option 2: Terminal Commands

**Terminal 1 — Backend (Spring Boot & MongoDB)**
```powershell
cd backend
.\mvnw.cmd spring-boot:run
```

**Terminal 2 — Frontend (Vite React)**
```powershell
cd frontend
npm install
npm run dev
```

Open **`http://localhost:5173`** in your browser.

---

## 6. Environment Variables

### Backend (`backend/.env` or OS Environment)
```env
PORT=8080
MONGODB_URI=mongodb://localhost:27017/annara
MONGODB_DATABASE=annara
JWT_SECRET=replace-with-a-secure-random-32-char-string-in-production
JWT_EXPIRY_HOURS=12
UPLOAD_DIR=uploads
CORS_ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000
```

### Frontend (`frontend/.env`)
```env
VITE_API_URL=http://localhost:8080/api
```

---

## 7. MongoDB Configuration (Atlas & Local)

Detailed guide available in [docs/MONGODB_SETUP.md](docs/MONGODB_SETUP.md).

### Using MongoDB Atlas:
Set `MONGODB_URI` to your Atlas connection string:
```powershell
$env:MONGODB_URI="mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/annara?retryWrites=true&w=majority"
```

### Using Local MongoDB Server:
Ensure local service is active:
```powershell
Get-Service *mongo*
& "C:\Program Files\mongosh\mongosh.exe" --eval "db.adminCommand('ping')"
```

---

## 8. Automated Testing Results

Execute the complete test suite against MongoDB:
```powershell
cd backend
.\mvnw.cmd test
```

### Test Execution Summary:
- `AuthAndSecurityTests`: **5 Passed** (User registration, roles, duplicate email defense, JWT profile)
- `DonationWorkflowTests`: **4 Passed** (Creation, deadline validation, owner edit, cancellation cascade)
- `ClaimAndDeliveryWorkflowTests`: **2 Passed** (Claim lifecycle, over-claim guard, driver assignment, status transitions)
- `ConcurrentClaimAndReservationTests`: **1 Passed** (10 concurrent threads claiming 10 meals each from a 30-meal donation: exactly 3 succeed, 7 rejected, 0 over-claimed)
- `TrackingAndSecurityTests`: **3 Passed** (Driver GPS broadcast, participant access control, proof upload, path traversal defense)
- **Total**: **15 / 15 Passed (100% Success)**

---

## 9. REST API Reference

Detailed endpoints available in [docs/API_DOCUMENTATION.md](docs/API_DOCUMENTATION.md).

- `POST /api/auth/register` — Register donor, NGO, recipient, driver.
- `POST /api/auth/login` — Sign in and receive JWT.
- `GET /api/me` — Retrieve signed-in user profile.
- `GET /api/donations` — Public discovery of surplus food.
- `POST /api/donations` — Create food donation with image upload.
- `POST /api/donations/{id}/claims` — Request surplus food (atomic reservation).
- `PATCH /api/claims/{id}/status` — Donor approves or rejects claim (atomic refund on rejection).
- `POST /api/claims/{id}/delivery` — Assign delivery driver to approved claim.
- `POST /api/tracking` — Driver broadcasts GPS location.
- `GET /api/tracking/delivery/{deliveryId}/latest` — View real-time driver coordinates on map.
- `PATCH /api/deliveries/{id}/status` — Advance delivery: `ASSIGNED` -> `PICKED_UP` -> `IN_TRANSIT` -> `DELIVERED`.
- `POST /api/deliveries/{id}/proof` — Upload handover confirmation photo.

---

## 10. User Roles & Permissions Matrix

| Capability | RESTAURANT | NGO | RECIPIENT | DRIVER | ADMIN |
| :--- | :---: | :---: | :---: | :---: | :---: |
| Browse surplus food listings | Yes | Yes | Yes | Yes | Yes |
| Post food donations & food photos | **Yes** | No | No | No | Yes |
| Edit & cancel own food donations | **Yes** | No | No | No | Yes |
| Claim surplus meals | No | **Yes** | **Yes** | No | Yes |
| Approve / reject claims | **Yes** | No | No | No | Yes |
| Post community food requests | No | **Yes** | **Yes** | No | Yes |
| Match donation against open request | **Yes** | No | No | No | Yes |
| Assign driver to approved delivery | No | **Yes** | **Yes** | No | Yes |
| Update delivery status & share GPS | No | No | No | **Yes** | Yes |
| Upload delivery proof photograph | No | **Yes** | No | **Yes** | Yes |
| View live route & Google Maps link | Yes* | Yes* | Yes* | Yes* | Yes |

*\* Restricted strictly to participants of that specific delivery.*

---

## 11. Demonstration & Walkthrough Script

1. **Public Browse**: Open `http://localhost:5173`. Filter by food category or city.
2. **Donor Registration**: Register as `RESTAURANT`. Click **Create donation**, input 30 portions of Fresh Biryani, set tomorrow's deadline, and publish.
3. **NGO Claim**: Sign in as `NGO`. Click **Claim food**, request 10 portions. The available count drops to 20.
4. **Donor Approval**: Sign in as `RESTAURANT`, navigate to **My donations** -> **Claims**, and click **Approve**.
5. **Assign Driver**: As `NGO`, open **My claims**, click **Assign Driver**, choose a registered driver, and provide the drop-off address.
6. **Driver Delivery & GPS**: Sign in as `DRIVER`. Open **Deliveries**. Click **Share Location** to broadcast live coordinates. Advance status to `PICKED_UP`, `IN_TRANSIT`, and `DELIVERED`. Upload delivery proof image.
7. **Participant Tracking**: As `NGO`, click **Live tracking** to see latitude, longitude, speed, and click **Open in Google Maps**.

---

## 12. GitHub Collaboration Workflow

### Rules for Committing Code:
1. **Never commit `.env` or credentials**: Keep database passwords, Atlas connection strings, and JWT secrets in private environment variables.
2. **Keep `.gitignore` active**: Ensures `node_modules/`, `target/`, and private upload files are never pushed.
3. **Standard Feature Branching**:
   ```bash
   git checkout -b feature/your-feature-name
   git add .
   git commit -m "feat: descriptive commit message"
   git push origin feature/your-feature-name
   ```
4. **Run Tests Before Pushing**:
   ```bash
   cd backend && .\mvnw.cmd test
   cd ../frontend && npm run build
   ```
