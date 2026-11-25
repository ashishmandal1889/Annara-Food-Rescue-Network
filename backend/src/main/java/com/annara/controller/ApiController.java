package com.annara.controller;

import com.annara.entity.*;
import com.annara.enums.*;
import com.annara.repository.*;
import com.annara.security.JwtService;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.data.mongodb.core.FindAndModifyOptions;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

@RestController
@RequestMapping("/api")
public class ApiController {

    private final UserRepository users;
    private final DonationRepository donations;
    private final ClaimRepository claims;
    private final FoodRequestRepository requests;
    private final DeliveryRepository deliveries;
    private final DeliveryProofRepository deliveryProofs;
    private final TrackingLocationRepository trackingLocations;
    private final MongoTemplate mongoTemplate;
    private final PasswordEncoder encoder;
    private final JwtService jwt;
    private final Path uploadRoot;

    public ApiController(
            UserRepository users,
            DonationRepository donations,
            ClaimRepository claims,
            FoodRequestRepository requests,
            DeliveryRepository deliveries,
            DeliveryProofRepository deliveryProofs,
            TrackingLocationRepository trackingLocations,
            MongoTemplate mongoTemplate,
            PasswordEncoder encoder,
            JwtService jwt,
            @Value("${app.upload-dir:uploads}") String uploadDir
    ) throws IOException {

        this.users = users;
        this.donations = donations;
        this.claims = claims;
        this.requests = requests;
        this.deliveries = deliveries;
        this.deliveryProofs = deliveryProofs;
        this.trackingLocations = trackingLocations;
        this.mongoTemplate = mongoTemplate;
        this.encoder = encoder;
        this.jwt = jwt;

        uploadRoot = Paths.get(uploadDir)
                .toAbsolutePath()
                .normalize();

        Files.createDirectories(uploadRoot);
    }

    // -------------------- REQUEST DTOs --------------------

    public record Register(
            @NotBlank String fullName,
            String organisationName,
            @Email @NotBlank String email,
            @NotBlank @Size(min = 8, max = 100) String password,
            String phone,
            String city,
            @NotBlank String role
    ) {}

    public record Login(
            @Email @NotBlank String email,
            @NotBlank String password
    ) {}

    public record AuthResponse(
            String token,
            Map<String, Object> user
    ) {}

    public record DonationInput(
            @NotBlank String foodName,
            String description,
            @NotBlank String foodType,
            String sourceType,
            String sourceName,
            @NotNull @Min(1) @Max(100000) Integer totalMeals,
            @NotBlank String pickupAddress,
            @NotNull LocalDateTime pickupBefore
    ) {}

    public record ClaimInput(
            @NotNull @Min(1) Integer requestedMeals
    ) {}

    public record RequestInput(
            @NotBlank String foodName,
            @NotNull @Min(1) Integer requestedMeals,
            String description,
            String urgency,
            LocalDateTime neededBefore,
            @NotBlank String deliveryAddress
    ) {}

    public record DeliveryInput(
            @NotBlank String donationId,
            String driverId,
            @NotNull @Min(1) Integer mealCount,
            @NotBlank String deliveryAddress
    ) {}

    public record StatusInput(@NotBlank String status) {}

    public record ClaimDeliveryInput(@NotBlank String driverId, @NotBlank String deliveryAddress) {}
    public record RequestMatchInput(@NotBlank String donationId) {}

    public record DeliveryAssignInput(@NotBlank String driverId, String deliveryAddress) {}
    public record DeliveryRejectInput(String reason) {}
    public record DeliveryStatusUpdateInput(
            @NotBlank String status,
            String failureReason,
            String receiverName,
            Double latitude,
            Double longitude
    ) {}
    public record DeliveryConfirmInput(String notes) {}
    public record DeliveryFailInput(@NotBlank String reason) {}

    public record TrackingToggle(@NotNull Boolean enabled) {}

    public record TrackingInput(
            @NotBlank String deliveryId,
            @NotNull @DecimalMin("-90.0") @DecimalMax("90.0") Double latitude,
            @NotNull @DecimalMin("-180.0") @DecimalMax("180.0") Double longitude,
            @DecimalMin("0.0") Double speed
    ) {}

    public record DeliveryLocationInput(
            @NotNull @DecimalMin("-90.0") @DecimalMax("90.0") Double latitude,
            @NotNull @DecimalMin("-180.0") @DecimalMax("180.0") Double longitude,
            @DecimalMin("0.0") Double speed
    ) {}

    // -------------------- HEALTH --------------------

    @GetMapping("/health")
    public Map<String, String> health() {
        return Map.of(
                "status", "ok",
                "app", "Annara Food Rescue",
                "database", "MongoDB"
        );
    }

    // -------------------- REGISTRATION --------------------

    @PostMapping("/auth/register")
    public ResponseEntity<?> register(
            @Valid @RequestBody Register in
    ) {
        String email = in.email().trim().toLowerCase(Locale.ROOT);

        if (users.existsByEmailIgnoreCase(email)) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Email already registered"
            );
        }

        Role role;

        try {
            role = Role.valueOf(
                    in.role().trim().toUpperCase(Locale.ROOT)
            );
        } catch (Exception e) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Choose RESTAURANT, NGO, RECIPIENT or DRIVER"
            );
        }

        if (role == Role.ADMIN) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Admin accounts are created by an administrator"
            );
        }

        AppUser user = new AppUser();
        user.fullName = in.fullName().trim();
        user.organisationName = in.organisationName() == null ? null : in.organisationName().trim();
        user.email = email;
        user.passwordHash = encoder.encode(in.password());
        user.phone = in.phone() == null ? null : in.phone().trim();
        user.city = in.city() == null ? null : in.city().trim();
        user.role = role;

        users.save(user);

        String token = jwt.issue(user);

        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(new AuthResponse(token, userMap(user)));
    }

    // -------------------- LOGIN --------------------

    @PostMapping("/auth/login")
    public AuthResponse login(
            @Valid @RequestBody Login in
    ) {
        String email = in.email().trim().toLowerCase(Locale.ROOT);

        AppUser user = users.findByEmailIgnoreCase(email)
                .orElseThrow(() ->
                        new ResponseStatusException(
                                HttpStatus.UNAUTHORIZED,
                                "Invalid email or password"
                        )
                );

        if (!encoder.matches(in.password(), user.passwordHash)) {
            throw new ResponseStatusException(
                    HttpStatus.UNAUTHORIZED,
                    "Invalid email or password"
            );
        }

        String token = jwt.issue(user);

        return new AuthResponse(token, userMap(user));
    }

    // -------------------- CURRENT USER --------------------

    @GetMapping("/me")
    public Map<String, Object> me(Authentication authentication) {
        return userMap(current(authentication));
    }

    // -------------------- CREATE DONATION --------------------

    @PostMapping(
            value = "/donations",
            consumes = MediaType.MULTIPART_FORM_DATA_VALUE
    )
    public ResponseEntity<?> createDonation(
            Authentication authentication,
            @RequestPart("data") @Valid DonationInput in,
            @RequestPart(value = "image", required = false) MultipartFile image
    ) throws IOException {

        AppUser donor = current(authentication);
        requireRole(donor, Role.RESTAURANT);

        if (in.pickupBefore().isBefore(LocalDateTime.now())) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Pickup-before time must be in the future"
            );
        }

        Donation donation = new Donation();

        donation.donor = donor;
        donation.foodName = in.foodName().trim();
        donation.description = in.description();
        donation.foodType = in.foodType().trim();
        donation.sourceType = in.sourceType() == null ? "RESTAURANT" : in.sourceType().trim();
        donation.sourceName = in.sourceName() == null ? null : in.sourceName().trim();
        donation.totalMeals = in.totalMeals();
        donation.remainingMeals = in.totalMeals();
        donation.pickupAddress = in.pickupAddress().trim();
        donation.pickupBefore = in.pickupBefore();
        donation.status = DonationStatus.AVAILABLE;

        if (image != null && !image.isEmpty()) {
            donation.imageFile = storeImage(image);
        }

        donations.save(donation);

        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(donationMap(donation));
    }

    // -------------------- PUBLIC & MARKETPLACE DONATIONS --------------------

    @GetMapping("/donations")
    public List<Map<String, Object>> listDonations(
            @RequestParam(required = false) String foodType,
            @RequestParam(required = false) String city
    ) {
        return donations.findAllByOrderByCreatedAtDesc()
                .stream()
                .filter(d -> d.status == DonationStatus.AVAILABLE || d.status == DonationStatus.PARTIALLY_CLAIMED)
                .filter(d -> d.pickupBefore != null && d.pickupBefore.isAfter(LocalDateTime.now()))
                .filter(d -> d.remainingMeals != null && d.remainingMeals > 0)
                .filter(d -> foodType == null || foodType.isBlank() || foodType.equalsIgnoreCase("ALL")
                        || (d.foodType != null && d.foodType.equalsIgnoreCase(foodType.trim())))
                .filter(d -> city == null || city.isBlank() || city.equalsIgnoreCase("ALL")
                        || (d.donor != null && d.donor.city != null && d.donor.city.equalsIgnoreCase(city.trim())))
                .map(this::donationMap)
                .toList();
    }

    @GetMapping("/donations/{id}")
    public Map<String, Object> getDonation(
            @PathVariable String id
    ) {
        Donation donation = donations.findById(id)
                .orElseThrow(() ->
                        new ResponseStatusException(
                                HttpStatus.NOT_FOUND,
                                "Donation not found"
                        )
                );

        return donationMap(donation);
    }

    // -------------------- DONOR'S OWN DONATIONS --------------------

    @GetMapping("/donations/mine")
    public List<Map<String, Object>> myDonations(
            Authentication authentication
    ) {
        AppUser donor = current(authentication);
        requireRole(donor, Role.RESTAURANT);

        return donations
                .findByDonorIdOrderByCreatedAtDesc(donor.id)
                .stream()
                .map(this::donationMap)
                .toList();
    }

    // -------------------- UPDATE DONATION --------------------

    @PutMapping("/donations/{id}")
    public Map<String, Object> updateDonation(
            @PathVariable String id,
            Authentication authentication,
            @Valid @RequestBody DonationInput in
    ) {
        AppUser donor = current(authentication);
        Donation donation = donations.findById(id).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Donation not found"));
        if (donation.donor == null || !donation.donor.id.equals(donor.id)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You can only edit your own donations");
        }
        if (donation.status == DonationStatus.CANCELLED || donation.status == DonationStatus.EXPIRED) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Cannot edit a cancelled or expired donation");
        }
        int claimed = donation.totalMeals - donation.remainingMeals;
        if (in.totalMeals() < claimed) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Total meals cannot be less than already claimed portions (" + claimed + ")");
        }
        donation.foodName = in.foodName().trim();
        donation.description = in.description();
        donation.foodType = in.foodType().trim();
        if (in.sourceType() != null) donation.sourceType = in.sourceType().trim();
        if (in.sourceName() != null) donation.sourceName = in.sourceName().trim();
        donation.totalMeals = in.totalMeals();
        donation.remainingMeals = in.totalMeals() - claimed;
        donation.pickupAddress = in.pickupAddress().trim();
        donation.pickupBefore = in.pickupBefore();
        if (donation.remainingMeals == 0) {
            donation.status = DonationStatus.FULLY_CLAIMED;
        } else if (claimed > 0) {
            donation.status = DonationStatus.PARTIALLY_CLAIMED;
        } else {
            donation.status = DonationStatus.AVAILABLE;
        }
        donations.save(donation);
        return donationMap(donation);
    }

    // -------------------- CANCEL DONATION --------------------

    @RequestMapping(value = {"/donations/{id}", "/donations/{id}/cancel"}, method = {RequestMethod.DELETE, RequestMethod.PATCH})
    public Map<String, Object> cancelDonation(
            @PathVariable String id,
            Authentication authentication
    ) {
        AppUser donor = current(authentication);
        Donation donation = donations.findById(id).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Donation not found"));
        if (donation.donor == null || !donation.donor.id.equals(donor.id)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You can only cancel your own donations");
        }
        if (donation.status == DonationStatus.CANCELLED) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Donation is already cancelled");
        }
        List<FoodClaim> pendingClaims = claims.findByDonationDonorIdOrderByCreatedAtDesc(donor.id).stream()
                .filter(c -> c.donation != null && c.donation.id.equals(id))
                .filter(c -> c.status == ClaimStatus.PENDING)
                .toList();
        for (FoodClaim pc : pendingClaims) {
            pc.status = ClaimStatus.CANCELLED;
            claims.save(pc);
        }
        donation.status = DonationStatus.CANCELLED;
        donations.save(donation);
        return donationMap(donation);
    }

    // -------------------- MY CLAIMS --------------------

    @GetMapping("/claims/mine")
    public List<Map<String, Object>> myClaims(
            Authentication authentication
    ) {
        AppUser user = current(authentication);

        return claims
                .findByClaimantIdOrderByCreatedAtDesc(user.id)
                .stream()
                .map(this::claimMap)
                .toList();
    }

    // -------------------- CLAIM A DONATION (CONCURRENCY-SAFE ATOMIC UPDATE) --------------------

    @PostMapping("/donations/{id}/claims")
    public ResponseEntity<?> claim(
            @PathVariable String id,
            Authentication authentication,
            @Valid @RequestBody ClaimInput in
    ) {
        AppUser user = current(authentication);
        requireOneOf(user, Role.NGO, Role.RECIPIENT, Role.ADMIN);

        Donation donation = donations.findById(id)
                .orElseThrow(() ->
                        new ResponseStatusException(
                                HttpStatus.NOT_FOUND,
                                "Donation not found"
                        )
                );

        if (
                donation.pickupBefore == null
                        || !donation.pickupBefore.isAfter(LocalDateTime.now())
                        || donation.remainingMeals == null
                        || donation.remainingMeals <= 0
                        || (
                        donation.status != DonationStatus.AVAILABLE
                                && donation.status != DonationStatus.PARTIALLY_CLAIMED
                )
        ) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "This donation is no longer available"
            );
        }

        if (in.requestedMeals() > donation.remainingMeals) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Only " + donation.remainingMeals + " meals remain"
            );
        }

        // Atomic conditional update in MongoDB to prevent race conditions and over-claiming
        Query query = new Query(Criteria.where("_id").is(id)
                .and("remainingMeals").gte(in.requestedMeals())
                .and("status").in(DonationStatus.AVAILABLE, DonationStatus.PARTIALLY_CLAIMED)
                .and("pickupBefore").gt(LocalDateTime.now()));

        Update update = new Update().inc("remainingMeals", -in.requestedMeals());
        Donation updated = mongoTemplate.findAndModify(query, update, FindAndModifyOptions.options().returnNew(true), Donation.class);

        if (updated == null) {
            Donation current = donations.findById(id).orElse(donation);
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Only " + Math.max(0, current.remainingMeals != null ? current.remainingMeals : 0) + " meals remain"
            );
        }

        DonationStatus nextStatus = updated.remainingMeals == 0
                ? DonationStatus.FULLY_CLAIMED
                : DonationStatus.PARTIALLY_CLAIMED;
        updated.status = nextStatus;

        mongoTemplate.updateFirst(
                new Query(Criteria.where("_id").is(id)),
                new Update().set("status", nextStatus),
                Donation.class
        );

        FoodClaim claim = new FoodClaim();
        claim.donation = updated;
        claim.claimant = user;
        claim.requestedMeals = in.requestedMeals();
        claim.status = ClaimStatus.PENDING;

        claims.save(claim);

        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(claimMap(claim));
    }

    // -------------------- DONOR CLAIM REVIEW & AUTOMATIC DELIVERY CREATION --------------------

    @GetMapping("/donations/{id}/claims")
    public List<Map<String, Object>> claimsForDonation(
            @PathVariable String id,
            Authentication authentication
    ) {
        AppUser donor = current(authentication);
        Donation donation = donations.findById(id).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Donation not found"));
        if (donation.donor == null || !donation.donor.id.equals(donor.id)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You can only view claims on your own donation");
        }
        return claims.findByDonationDonorIdOrderByCreatedAtDesc(donor.id).stream()
                .filter(c -> c.donation != null && c.donation.id.equals(id))
                .map(c -> {
                    Map<String, Object> row = claimMap(c);
                    if (c.claimant != null) {
                        row.put("claimantName", c.claimant.fullName);
                        row.put("claimantOrganisation", Objects.toString(c.claimant.organisationName, ""));
                        row.put("claimantEmail", c.claimant.email);
                        row.put("claimantPhone", Objects.toString(c.claimant.phone, ""));
                        row.put("claimantCity", Objects.toString(c.claimant.city, ""));
                        row.put("claimantRole", c.claimant.role.name());
                    }
                    return row;
                }).toList();
    }

    @PatchMapping("/claims/{id}/status")
    public Map<String, Object> reviewClaim(
            @PathVariable String id,
            Authentication authentication,
            @Valid @RequestBody StatusInput in
    ) {
        AppUser donor = current(authentication);
        FoodClaim claim = claims.findById(id).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Claim not found"));
        if (claim.donation == null || claim.donation.donor == null
                || !claim.donation.donor.id.equals(donor.id)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You can only review claims on your own donations");
        }
        String requested = in.status().trim().toUpperCase(Locale.ROOT);
        if (!requested.equals("APPROVED") && !requested.equals("REJECTED")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Status must be APPROVED or REJECTED");
        }
        if (claim.status != ClaimStatus.PENDING) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Only pending claims can be reviewed");
        }
        if (claim.donation == null || claim.donation.status == DonationStatus.CANCELLED
                || claim.donation.status == DonationStatus.EXPIRED) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Cannot review claims on a cancelled or expired donation");
        }
        if (requested.equals("APPROVED")) {
            claim.status = ClaimStatus.APPROVED;

            // 1. AUTOMATIC DELIVERY CREATION AFTER CLAIM APPROVAL
            if (!deliveries.existsByClaimId(claim.id)) {
                Delivery delivery = new Delivery();
                delivery.claim = claim;
                delivery.donation = claim.donation;
                delivery.ngo = (claim.claimant != null && claim.claimant.role == Role.NGO) ? claim.claimant : null;
                delivery.mealCount = claim.requestedMeals;
                delivery.pickupAddress = claim.donation != null ? claim.donation.pickupAddress : "";
                String defaultDest = "";
                if (claim.claimant != null) {
                    if (claim.claimant.city != null && !claim.claimant.city.isBlank()) {
                        defaultDest = claim.claimant.city + " Collection Drop-off";
                    } else if (claim.claimant.fullName != null) {
                        defaultDest = claim.claimant.fullName + " Collection Point";
                    }
                }
                delivery.deliveryAddress = defaultDest.isBlank() ? "Recipient Destination Address" : defaultDest;
                delivery.status = DeliveryStatus.PENDING;
                delivery.createdAt = LocalDateTime.now();
                deliveries.save(delivery);
            }
        } else {
            // Rejection refunds reserved meals back to donation
            Query query = new Query(Criteria.where("_id").is(claim.donation.id));
            Update update = new Update().inc("remainingMeals", claim.requestedMeals);
            Donation donation = mongoTemplate.findAndModify(query, update, FindAndModifyOptions.options().returnNew(true), Donation.class);
            if (donation != null) {
                int cappedMeals = Math.min(donation.totalMeals, donation.remainingMeals);
                DonationStatus nextStatus = (donation.status != DonationStatus.CANCELLED && donation.status != DonationStatus.EXPIRED)
                        ? (cappedMeals >= donation.totalMeals ? DonationStatus.AVAILABLE : DonationStatus.PARTIALLY_CLAIMED)
                        : donation.status;
                mongoTemplate.updateFirst(
                        new Query(Criteria.where("_id").is(donation.id)),
                        new Update().set("remainingMeals", cappedMeals).set("status", nextStatus),
                        Donation.class
                );
            }
            claim.status = ClaimStatus.REJECTED;
        }
        claims.save(claim);
        return claimMap(claim);
    }

    @DeleteMapping("/claims/{id}")
    public Map<String, Object> cancelClaim(
            @PathVariable String id,
            Authentication authentication
    ) {
        AppUser claimant = current(authentication);
        FoodClaim claim = claims.findById(id).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Claim not found"));
        if (claim.claimant == null || !claim.claimant.id.equals(claimant.id)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You can only cancel your own claim");
        }
        if (claim.status != ClaimStatus.PENDING) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Only pending claims can be cancelled");
        }
        // Refund claimed meals back to donation
        if (claim.donation != null) {
            Query query = new Query(Criteria.where("_id").is(claim.donation.id));
            Update update = new Update().inc("remainingMeals", claim.requestedMeals);
            Donation donation = mongoTemplate.findAndModify(query, update, FindAndModifyOptions.options().returnNew(true), Donation.class);
            if (donation != null) {
                int cappedMeals = Math.min(donation.totalMeals, donation.remainingMeals);
                DonationStatus nextStatus = (donation.status != DonationStatus.CANCELLED && donation.status != DonationStatus.EXPIRED)
                        ? (cappedMeals >= donation.totalMeals ? DonationStatus.AVAILABLE : DonationStatus.PARTIALLY_CLAIMED)
                        : donation.status;
                mongoTemplate.updateFirst(
                        new Query(Criteria.where("_id").is(donation.id)),
                        new Update().set("remainingMeals", cappedMeals).set("status", nextStatus),
                        Donation.class
                );
            }
        }
        claim.status = ClaimStatus.CANCELLED;
        claims.save(claim);
        return claimMap(claim);
    }

    // -------------------- CREATE FOOD REQUEST --------------------

    @PostMapping("/requests")
    public ResponseEntity<?> createRequest(
            Authentication authentication,
            @Valid @RequestBody RequestInput in
    ) {
        AppUser user = current(authentication);
        requireOneOf(user, Role.NGO, Role.RECIPIENT, Role.ADMIN);

        FoodRequest request = new FoodRequest();

        request.requester = user;
        request.foodName = in.foodName().trim();
        request.requestedMeals = in.requestedMeals();
        request.description = in.description();
        request.urgency = in.urgency() == null || in.urgency().isBlank() ? "NORMAL" : in.urgency().trim().toUpperCase(Locale.ROOT);
        if (!List.of("LOW", "NORMAL", "HIGH", "URGENT").contains(request.urgency)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Urgency must be LOW, NORMAL, HIGH or URGENT");
        }
        request.neededBefore = in.neededBefore();
        if (request.neededBefore != null && !request.neededBefore.isAfter(LocalDateTime.now())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Needed-before time must be in the future");
        }
        request.deliveryAddress = in.deliveryAddress().trim();

        requests.save(request);

        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(requestMap(request));
    }

    // -------------------- LIST FOOD REQUESTS --------------------

    @GetMapping("/requests")
    public List<Map<String, Object>> listRequests(
            Authentication authentication
    ) {
        AppUser user = current(authentication);

        List<FoodRequest> foodRequests;

        if (user.role == Role.NGO || user.role == Role.RECIPIENT) {
            foodRequests = requests.findByRequesterIdOrderByCreatedAtDesc(user.id);
        } else {
            foodRequests = requests.findAllByOrderByCreatedAtDesc();
        }

        return foodRequests.stream()
                .map(this::requestMap)
                .toList();
    }

    @DeleteMapping("/requests/{id}")
    public Map<String, Object> cancelRequest(
            @PathVariable String id,
            Authentication authentication
    ) {
        AppUser requester = current(authentication);
        FoodRequest request = requests.findById(id).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Food request not found"));
        if (request.requester == null || !request.requester.id.equals(requester.id)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You can only cancel your own request");
        }
        if (request.status == RequestStatus.FULFILLED || request.status == RequestStatus.CANCELLED
                || deliveries.existsByFoodRequestId(request.id)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "This request can no longer be cancelled");
        }
        request.status = RequestStatus.CANCELLED;
        request.matchedDonation = null;
        requests.save(request);
        return requestMap(request);
    }

    // -------------------- DONOR OFFERS FOOD FOR A REQUEST --------------------

    @PostMapping("/requests/{id}/match")
    public Map<String, Object> matchRequest(
            @PathVariable String id,
            Authentication authentication,
            @Valid @RequestBody RequestMatchInput in
    ) {
        AppUser donor = current(authentication);
        requireRole(donor, Role.RESTAURANT);
        FoodRequest request = requests.findById(id).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Food request not found"));
        if (request.status != RequestStatus.OPEN) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Only open requests can be matched");
        }
        Donation donation = donations.findById(in.donationId()).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Donation not found"));
        if (donation.donor == null || !donation.donor.id.equals(donor.id)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You can only offer your own donation");
        }
        if (donation.remainingMeals == null || donation.remainingMeals < request.requestedMeals
                || donation.pickupBefore == null || !donation.pickupBefore.isAfter(LocalDateTime.now())
                || (donation.status != DonationStatus.AVAILABLE && donation.status != DonationStatus.PARTIALLY_CLAIMED)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Donation does not have enough available meals");
        }
        request.matchedDonation = donation;
        request.status = RequestStatus.MATCHED;
        requests.save(request);
        return requestMap(request);
    }

    @PostMapping("/requests/{id}/delivery")
    public ResponseEntity<?> createDeliveryForRequest(
            @PathVariable String id,
            Authentication authentication,
            @Valid @RequestBody ClaimDeliveryInput in
    ) {
        AppUser requester = current(authentication);
        requireOneOf(requester, Role.NGO, Role.RECIPIENT);
        FoodRequest request = requests.findById(id).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Food request not found"));
        if (request.requester == null || !request.requester.id.equals(requester.id)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "This request does not belong to your account");
        }
        if (request.status != RequestStatus.MATCHED || request.matchedDonation == null) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "A donor must match this request before delivery is arranged");
        }
        if (deliveries.existsByFoodRequestId(request.id)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "A delivery already exists for this request");
        }

        // Atomic deduction
        Query query = new Query(Criteria.where("_id").is(request.matchedDonation.id)
                .and("remainingMeals").gte(request.requestedMeals));
        Update update = new Update().inc("remainingMeals", -request.requestedMeals);
        Donation donation = mongoTemplate.findAndModify(query, update, FindAndModifyOptions.options().returnNew(true), Donation.class);
        if (donation == null) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Not enough meals remain in the matched donation");
        }
        DonationStatus nextStatus = donation.remainingMeals == 0 ? DonationStatus.FULLY_CLAIMED : DonationStatus.PARTIALLY_CLAIMED;
        donation.status = nextStatus;
        mongoTemplate.updateFirst(
                new Query(Criteria.where("_id").is(donation.id)),
                new Update().set("status", nextStatus),
                Donation.class
        );

        AppUser driver = users.findById(in.driverId()).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Driver not found"));
        requireRole(driver, Role.DRIVER);

        if (deliveries.existsByDriverIdAndStatusIn(driver.id,
                List.of(DeliveryStatus.ACCEPTED, DeliveryStatus.PICKED_UP, DeliveryStatus.IN_TRANSIT))) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Driver " + driver.fullName + " currently has an active delivery in progress");
        }

        Delivery delivery = new Delivery();
        delivery.foodRequest = request;
        delivery.donation = donation;
        delivery.ngo = requester.role == Role.NGO ? requester : null;
        delivery.driver = driver;
        delivery.mealCount = request.requestedMeals;
        delivery.pickupAddress = donation.pickupAddress;
        delivery.deliveryAddress = in.deliveryAddress().trim();
        delivery.status = DeliveryStatus.ASSIGNED;
        deliveries.save(delivery);

        return ResponseEntity.status(HttpStatus.CREATED).body(deliveryMap(delivery));
    }

    // -------------------- CREATE DIRECT DELIVERY --------------------

    @PostMapping("/deliveries")
    public ResponseEntity<?> createDelivery(
            Authentication authentication,
            @Valid @RequestBody DeliveryInput in
    ) {
        AppUser creator = current(authentication);
        requireOneOf(creator, Role.NGO, Role.RECIPIENT, Role.RESTAURANT, Role.ADMIN);

        Donation donation = donations.findById(in.donationId())
                .orElseThrow(() ->
                        new ResponseStatusException(
                                HttpStatus.NOT_FOUND,
                                "Donation not found"
                        )
                );

        if (donation.status == DonationStatus.CANCELLED || donation.status == DonationStatus.EXPIRED) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "This donation is no longer available"
            );
        }

        if (in.mealCount() > donation.remainingMeals) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Only " + donation.remainingMeals + " meals remain"
            );
        }

        AppUser driver = null;
        if (in.driverId() != null && !in.driverId().isBlank()) {
            driver = users.findById(in.driverId())
                    .orElseThrow(() ->
                            new ResponseStatusException(
                                    HttpStatus.NOT_FOUND,
                                    "Driver not found"
                            )
                    );
            requireRole(driver, Role.DRIVER);
            if (deliveries.existsByDriverIdAndStatusIn(driver.id,
                    List.of(DeliveryStatus.ACCEPTED, DeliveryStatus.PICKED_UP, DeliveryStatus.IN_TRANSIT))) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "Driver " + driver.fullName + " currently has an active delivery in progress");
            }
        }

        // Atomic deduction
        Query query = new Query(Criteria.where("_id").is(in.donationId())
                .and("remainingMeals").gte(in.mealCount()));
        Update update = new Update().inc("remainingMeals", -in.mealCount());
        Donation updated = mongoTemplate.findAndModify(query, update, FindAndModifyOptions.options().returnNew(true), Donation.class);
        if (updated == null) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Only " + donation.remainingMeals + " meals remain");
        }
        DonationStatus nextStatus = updated.remainingMeals == 0
                ? DonationStatus.FULLY_CLAIMED
                : DonationStatus.PARTIALLY_CLAIMED;
        updated.status = nextStatus;
        mongoTemplate.updateFirst(
                new Query(Criteria.where("_id").is(updated.id)),
                new Update().set("status", nextStatus),
                Donation.class
        );

        Delivery delivery = new Delivery();
        delivery.donation = updated;
        delivery.ngo = creator.role == Role.NGO ? creator : null;
        delivery.driver = driver;
        delivery.mealCount = in.mealCount();
        delivery.pickupAddress = updated.pickupAddress;
        delivery.deliveryAddress = in.deliveryAddress().trim();
        delivery.status = driver != null ? DeliveryStatus.ASSIGNED : DeliveryStatus.PENDING;

        deliveries.save(delivery);

        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(deliveryMap(delivery));
    }

    // -------------------- CREATE DELIVERY FROM APPROVED CLAIM --------------------

    @PostMapping("/claims/{claimId}/delivery")
    public ResponseEntity<?> createDeliveryFromClaim(
            @PathVariable String claimId,
            Authentication authentication,
            @Valid @RequestBody ClaimDeliveryInput in
    ) {
        AppUser requester = current(authentication);
        requireOneOf(requester, Role.NGO, Role.RECIPIENT, Role.ADMIN, Role.RESTAURANT);
        FoodClaim claim = claims.findById(claimId).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Claim not found"));
        if (claim.claimant == null || (!claim.claimant.id.equals(requester.id) && requester.role != Role.ADMIN
                && (claim.donation == null || claim.donation.donor == null || !claim.donation.donor.id.equals(requester.id)))) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "This claim does not belong to your account");
        }
        if (claim.status != ClaimStatus.APPROVED && claim.status != ClaimStatus.CONFIRMED) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "The donor must approve this claim before delivery is arranged");
        }

        AppUser driver = users.findById(in.driverId()).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Driver not found"));
        requireRole(driver, Role.DRIVER);

        if (deliveries.existsByDriverIdAndStatusIn(driver.id,
                List.of(DeliveryStatus.ACCEPTED, DeliveryStatus.PICKED_UP, DeliveryStatus.IN_TRANSIT))) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Driver " + driver.fullName + " currently has an active delivery in progress");
        }

        // Check if an auto-created delivery exists
        Delivery delivery = deliveries.findByClaimId(claim.id).orElse(null);
        if (delivery != null) {
            if (delivery.status != DeliveryStatus.PENDING && delivery.status != DeliveryStatus.CANCELLED) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "A delivery already exists for this claim");
            }
            delivery.driver = driver;
            delivery.deliveryAddress = in.deliveryAddress().trim();
            delivery.status = DeliveryStatus.ASSIGNED;
            deliveries.save(delivery);
            return ResponseEntity.status(HttpStatus.CREATED).body(deliveryMap(delivery));
        }

        delivery = new Delivery();
        delivery.claim = claim;
        delivery.donation = claim.donation;
        delivery.ngo = requester.role == Role.NGO ? requester : (claim.claimant != null && claim.claimant.role == Role.NGO ? claim.claimant : null);
        delivery.driver = driver;
        delivery.mealCount = claim.requestedMeals;
        delivery.pickupAddress = claim.donation != null ? claim.donation.pickupAddress : "";
        delivery.deliveryAddress = in.deliveryAddress().trim();
        delivery.status = DeliveryStatus.ASSIGNED;
        deliveries.save(delivery);

        return ResponseEntity.status(HttpStatus.CREATED).body(deliveryMap(delivery));
    }

    // -------------------- DRIVER ASSIGNMENT --------------------

    @RequestMapping(value = "/deliveries/{id}/assign", method = {RequestMethod.PUT, RequestMethod.POST})
    public Map<String, Object> assignDriver(
            @PathVariable String id,
            Authentication authentication,
            @Valid @RequestBody DeliveryAssignInput in
    ) {
        AppUser user = current(authentication);
        Delivery delivery = deliveries.findById(id).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Delivery not found"));

        boolean isAdmin = user.role == Role.ADMIN;
        boolean isDonor = delivery.donation != null && delivery.donation.donor != null && delivery.donation.donor.id.equals(user.id);
        boolean isNgo = delivery.ngo != null && delivery.ngo.id.equals(user.id);
        boolean isClaimant = delivery.claim != null && delivery.claim.claimant != null && delivery.claim.claimant.id.equals(user.id);
        boolean isRequester = delivery.foodRequest != null && delivery.foodRequest.requester != null && delivery.foodRequest.requester.id.equals(user.id);

        if (!isAdmin && !isDonor && !isNgo && !isClaimant && !isRequester) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You are not authorized to assign a driver for this delivery");
        }

        if (delivery.status != DeliveryStatus.PENDING && delivery.status != DeliveryStatus.ASSIGNED) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Driver can only be assigned to pending or assigned deliveries");
        }

        AppUser driver = users.findById(in.driverId()).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Driver not found"));
        requireRole(driver, Role.DRIVER);

        if (deliveries.existsByDriverIdAndStatusIn(driver.id,
                List.of(DeliveryStatus.ACCEPTED, DeliveryStatus.PICKED_UP, DeliveryStatus.IN_TRANSIT))) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Driver " + driver.fullName + " currently has an active delivery in progress");
        }

        delivery.driver = driver;
        if (in.deliveryAddress() != null && !in.deliveryAddress().isBlank()) {
            delivery.deliveryAddress = in.deliveryAddress().trim();
        }
        delivery.status = DeliveryStatus.ASSIGNED;
        deliveries.save(delivery);

        return deliveryMap(delivery);
    }

    // -------------------- DRIVER ACCEPT / REJECT --------------------

    @RequestMapping(value = "/deliveries/{id}/accept", method = {RequestMethod.PUT, RequestMethod.POST})
    public Map<String, Object> acceptDelivery(
            @PathVariable String id,
            Authentication authentication
    ) {
        AppUser driver = current(authentication);
        requireRole(driver, Role.DRIVER);

        Delivery delivery = deliveries.findById(id).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Delivery not found"));

        if (delivery.driver == null || !delivery.driver.id.equals(driver.id)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "This delivery is not assigned to you");
        }

        if (delivery.status != DeliveryStatus.ASSIGNED) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Only assigned deliveries can be accepted");
        }

        if (deliveries.existsByDriverIdAndStatusIn(driver.id,
                List.of(DeliveryStatus.ACCEPTED, DeliveryStatus.PICKED_UP, DeliveryStatus.IN_TRANSIT))) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "You already have another active delivery in progress");
        }

        delivery.status = DeliveryStatus.ACCEPTED;
        delivery.acceptedAt = LocalDateTime.now();
        deliveries.save(delivery);

        return deliveryMap(delivery);
    }

    @RequestMapping(value = "/deliveries/{id}/reject", method = {RequestMethod.PUT, RequestMethod.POST})
    public Map<String, Object> rejectDelivery(
            @PathVariable String id,
            Authentication authentication,
            @RequestBody(required = false) DeliveryRejectInput in
    ) {
        AppUser driver = current(authentication);
        requireRole(driver, Role.DRIVER);

        Delivery delivery = deliveries.findById(id).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Delivery not found"));

        if (delivery.driver == null || !delivery.driver.id.equals(driver.id)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "This delivery is not assigned to you");
        }

        if (delivery.status != DeliveryStatus.ASSIGNED) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Only assigned deliveries can be rejected");
        }

        delivery.driver = null;
        delivery.status = DeliveryStatus.PENDING;
        delivery.failureReason = (in != null && in.reason() != null && !in.reason().isBlank())
                ? "Driver rejected: " + in.reason().trim()
                : "Driver rejected assignment";
        deliveries.save(delivery);

        return deliveryMap(delivery);
    }

    // -------------------- LIST DELIVERIES (WITH STATUS FILTERS & ROLES) --------------------

    @GetMapping("/deliveries")
    public List<Map<String, Object>> listDeliveries(
            @RequestParam(required = false) String status,
            Authentication authentication
    ) {
        AppUser user = current(authentication);
        List<Delivery> all;

        if (user.role == Role.ADMIN) {
            all = deliveries.findAllByOrderByCreatedAtDesc();
        } else if (user.role == Role.DRIVER) {
            all = deliveries.findByDriverIdOrderByCreatedAtDesc(user.id);
        } else if (user.role == Role.NGO || user.role == Role.RECIPIENT) {
            all = deliveries.findAllByOrderByCreatedAtDesc().stream()
                    .filter(d -> (d.ngo != null && user.id.equals(d.ngo.id))
                            || (d.claim != null && d.claim.claimant != null && user.id.equals(d.claim.claimant.id))
                            || (d.foodRequest != null && d.foodRequest.requester != null && user.id.equals(d.foodRequest.requester.id)))
                    .toList();
        } else if (user.role == Role.RESTAURANT) {
            all = deliveries.findByDonationDonorIdOrderByCreatedAtDesc(user.id);
        } else {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied");
        }

        if (status != null && !status.isBlank() && !status.equalsIgnoreCase("ALL")) {
            try {
                DeliveryStatus filterStatus = DeliveryStatus.valueOf(status.trim().toUpperCase(Locale.ROOT));
                all = all.stream().filter(d -> d.status == filterStatus).toList();
            } catch (IllegalArgumentException ignored) {}
        }

        return all.stream().map(this::deliveryMap).toList();
    }

    @GetMapping("/deliveries/{id}")
    public Map<String, Object> getDelivery(
            @PathVariable String id,
            Authentication authentication
    ) {
        AppUser user = current(authentication);
        Delivery delivery = deliveries.findById(id).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Delivery not found"));
        requireDeliveryParticipant(user, delivery);
        Map<String, Object> res = deliveryMap(delivery);

        // Include proof history
        List<Map<String, Object>> proofs = deliveryProofs.findByDeliveryIdOrderByDeliveredAtDesc(delivery.id)
                .stream().map(p -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("id", p.id);
                    m.put("deliveryId", p.deliveryId);
                    m.put("proofImageUrl", p.proofImageFile != null ? "/api/files/" + p.proofImageFile : null);
                    m.put("receiverName", p.receiverName);
                    m.put("latitude", p.latitude);
                    m.put("longitude", p.longitude);
                    m.put("deliveredAt", p.deliveredAt);
                    m.put("recipientConfirmed", p.recipientConfirmed);
                    m.put("confirmedAt", p.confirmedAt);
                    m.put("recipientNotes", p.recipientNotes);
                    return m;
                }).toList();
        res.put("proofs", proofs);

        // Include latest tracking
        trackingLocations.findFirstByDeliveryIdOrderByRecordedAtDesc(delivery.id)
                .ifPresent(loc -> res.put("latestTracking", trackingMap(loc)));

        return res;
    }

    @GetMapping("/deliveries/mine")
    public List<Map<String, Object>> myDeliveries(
            Authentication authentication
    ) {
        return listDeliveries(null, authentication);
    }

    // -------------------- UPDATE DELIVERY STATUS (STATE MACHINE) --------------------

    @RequestMapping(value = "/deliveries/{id}/status", method = {RequestMethod.PUT, RequestMethod.PATCH})
    public Map<String, Object> updateDelivery(
            @PathVariable String id,
            Authentication authentication,
            @Valid @RequestBody DeliveryStatusUpdateInput in
    ) {
        AppUser user = current(authentication);
        Delivery delivery = deliveries.findById(id)
                .orElseThrow(() ->
                        new ResponseStatusException(
                                HttpStatus.NOT_FOUND,
                                "Delivery not found"
                        )
                );

        boolean isDriver = delivery.driver != null && delivery.driver.id.equals(user.id);
        boolean isNgo = delivery.ngo != null && delivery.ngo.id.equals(user.id);
        boolean isClaimant = delivery.claim != null && delivery.claim.claimant != null
                && delivery.claim.claimant.id.equals(user.id);
        boolean isRequester = delivery.foodRequest != null && delivery.foodRequest.requester != null
                && delivery.foodRequest.requester.id.equals(user.id);
        boolean isDonor = delivery.donation != null && delivery.donation.donor != null
                && delivery.donation.donor.id.equals(user.id);
        boolean isAdmin = user.role == Role.ADMIN;

        if (!isDriver && !isNgo && !isClaimant && !isRequester && !isDonor && !isAdmin) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "Not your delivery"
            );
        }

        DeliveryStatus nextStatus;
        try {
            nextStatus = DeliveryStatus.valueOf(
                    in.status().trim().toUpperCase(Locale.ROOT)
            );
        } catch (Exception e) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Invalid delivery status: " + in.status()
            );
        }

        boolean validTransition =
                (delivery.status == DeliveryStatus.PENDING && (nextStatus == DeliveryStatus.ASSIGNED || nextStatus == DeliveryStatus.CANCELLED))
                        || (delivery.status == DeliveryStatus.ASSIGNED && (nextStatus == DeliveryStatus.ACCEPTED || nextStatus == DeliveryStatus.PICKED_UP || nextStatus == DeliveryStatus.CANCELLED || nextStatus == DeliveryStatus.PENDING))
                        || (delivery.status == DeliveryStatus.ACCEPTED && (nextStatus == DeliveryStatus.PICKED_UP || nextStatus == DeliveryStatus.CANCELLED || nextStatus == DeliveryStatus.FAILED))
                        || (delivery.status == DeliveryStatus.PICKED_UP && (nextStatus == DeliveryStatus.IN_TRANSIT || nextStatus == DeliveryStatus.DELIVERED || nextStatus == DeliveryStatus.FAILED))
                        || (delivery.status == DeliveryStatus.IN_TRANSIT && (nextStatus == DeliveryStatus.DELIVERED || nextStatus == DeliveryStatus.FAILED))
                        || (delivery.status == DeliveryStatus.DELIVERED && (nextStatus == DeliveryStatus.CONFIRMED || nextStatus == DeliveryStatus.FAILED))
                        || (delivery.status == nextStatus);

        if (!validTransition) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Invalid delivery transition from " + delivery.status + " to " + nextStatus);
        }

        if ((nextStatus == DeliveryStatus.PICKED_UP || nextStatus == DeliveryStatus.IN_TRANSIT || nextStatus == DeliveryStatus.DELIVERED)
                && !isDriver && !isAdmin) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only the assigned driver can update transit progress");
        }

        if (nextStatus == DeliveryStatus.CONFIRMED && !isNgo && !isClaimant && !isRequester && !isAdmin) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only the recipient organization or claimant can confirm delivery");
        }

        if (nextStatus == DeliveryStatus.CANCELLED) {
            if (delivery.status != DeliveryStatus.PENDING && delivery.status != DeliveryStatus.ASSIGNED && delivery.status != DeliveryStatus.ACCEPTED) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "Cannot cancel a delivery that is already picked up or in transit");
            }
            // Refund meals atomically to donation
            if (delivery.donation != null) {
                Query query = new Query(Criteria.where("_id").is(delivery.donation.id));
                Update update = new Update().inc("remainingMeals", delivery.mealCount);
                Donation donation = mongoTemplate.findAndModify(query, update, FindAndModifyOptions.options().returnNew(true), Donation.class);
                if (donation != null) {
                    int cappedMeals = Math.min(donation.totalMeals, donation.remainingMeals);
                    DonationStatus nxtStatus = (donation.status != DonationStatus.CANCELLED && donation.status != DonationStatus.EXPIRED)
                            ? (cappedMeals >= donation.totalMeals ? DonationStatus.AVAILABLE : DonationStatus.PARTIALLY_CLAIMED)
                            : donation.status;
                    mongoTemplate.updateFirst(
                            new Query(Criteria.where("_id").is(donation.id)),
                            new Update().set("remainingMeals", cappedMeals).set("status", nxtStatus),
                            Donation.class
                    );
                }
            }
            if (delivery.foodRequest != null) {
                delivery.foodRequest.status = RequestStatus.MATCHED;
                requests.save(delivery.foodRequest);
            }
            if (delivery.claim != null) {
                delivery.claim.status = ClaimStatus.CANCELLED;
                claims.save(delivery.claim);
            }
        }

        delivery.status = nextStatus;

        if (nextStatus == DeliveryStatus.ACCEPTED) {
            delivery.acceptedAt = LocalDateTime.now();
        } else if (nextStatus == DeliveryStatus.PICKED_UP) {
            delivery.pickedUpAt = LocalDateTime.now();
        } else if (nextStatus == DeliveryStatus.DELIVERED) {
            delivery.deliveredAt = LocalDateTime.now();
            if (delivery.foodRequest != null) {
                delivery.foodRequest.status = RequestStatus.FULFILLED;
                requests.save(delivery.foodRequest);
            }
            if (delivery.claim != null) {
                delivery.claim.status = ClaimStatus.COMPLETED;
                claims.save(delivery.claim);
            }
        } else if (nextStatus == DeliveryStatus.CONFIRMED) {
            delivery.confirmedAt = LocalDateTime.now();
            delivery.recipientConfirmed = true;
            if (delivery.claim != null) {
                delivery.claim.status = ClaimStatus.COMPLETED;
                claims.save(delivery.claim);
            }
        } else if (nextStatus == DeliveryStatus.FAILED) {
            delivery.failedAt = LocalDateTime.now();
            delivery.failureReason = in.failureReason() != null ? in.failureReason() : "Delivery marked failed";
        }

        if (in.receiverName() != null && !in.receiverName().isBlank()) {
            delivery.receiverName = in.receiverName().trim();
        }
        if (in.latitude() != null) delivery.deliveryLatitude = in.latitude();
        if (in.longitude() != null) delivery.deliveryLongitude = in.longitude();

        deliveries.save(delivery);

        return deliveryMap(delivery);
    }

    // -------------------- RECIPIENT CONFIRMATION & FAILURE REPORTING --------------------

    @RequestMapping(value = "/deliveries/{id}/confirm", method = {RequestMethod.PUT, RequestMethod.POST})
    public Map<String, Object> confirmDelivery(
            @PathVariable String id,
            Authentication authentication,
            @RequestBody(required = false) DeliveryConfirmInput in
    ) {
        AppUser user = current(authentication);
        Delivery delivery = deliveries.findById(id).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Delivery not found"));

        boolean isNgo = delivery.ngo != null && delivery.ngo.id.equals(user.id);
        boolean isClaimant = delivery.claim != null && delivery.claim.claimant != null && delivery.claim.claimant.id.equals(user.id);
        boolean isRequester = delivery.foodRequest != null && delivery.foodRequest.requester != null && delivery.foodRequest.requester.id.equals(user.id);
        boolean isAdmin = user.role == Role.ADMIN;

        if (!isNgo && !isClaimant && !isRequester && !isAdmin) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only the recipient organization or claimant can confirm delivery receipt");
        }

        if (delivery.status != DeliveryStatus.DELIVERED) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Can only confirm delivery after it has been marked DELIVERED by driver");
        }

        delivery.status = DeliveryStatus.CONFIRMED;
        delivery.recipientConfirmed = true;
        delivery.confirmedAt = LocalDateTime.now();
        if (in != null && in.notes() != null && !in.notes().isBlank()) {
            delivery.recipientNotes = in.notes().trim();
        }

        deliveryProofs.findFirstByDeliveryIdOrderByDeliveredAtDesc(delivery.id).ifPresent(p -> {
            p.recipientConfirmed = true;
            p.confirmedAt = LocalDateTime.now();
            if (delivery.recipientNotes != null) p.recipientNotes = delivery.recipientNotes;
            deliveryProofs.save(p);
        });

        if (delivery.claim != null) {
            delivery.claim.status = ClaimStatus.COMPLETED;
            claims.save(delivery.claim);
        }

        deliveries.save(delivery);
        return deliveryMap(delivery);
    }

    @RequestMapping(value = "/deliveries/{id}/fail", method = {RequestMethod.PUT, RequestMethod.POST})
    public Map<String, Object> reportDeliveryFailed(
            @PathVariable String id,
            Authentication authentication,
            @Valid @RequestBody DeliveryFailInput in
    ) {
        AppUser user = current(authentication);
        Delivery delivery = deliveries.findById(id).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Delivery not found"));

        requireDeliveryParticipant(user, delivery);

        if (delivery.status == DeliveryStatus.CONFIRMED || delivery.status == DeliveryStatus.CANCELLED) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Cannot mark a confirmed or cancelled delivery as failed");
        }

        delivery.status = DeliveryStatus.FAILED;
        delivery.failureReason = in.reason().trim();
        delivery.failedAt = LocalDateTime.now();
        deliveries.save(delivery);

        return deliveryMap(delivery);
    }

    // -------------------- DRIVER LOCATION TRACKING (REAL-TIME GPS) --------------------

    @PostMapping("/deliveries/{id}/tracking")
    public ResponseEntity<?> saveDeliveryTracking(
            @PathVariable String id,
            Authentication authentication,
            @Valid @RequestBody DeliveryLocationInput in
    ) {
        AppUser driver = current(authentication);
        Delivery delivery = deliveries.findById(id).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Delivery not found"));

        if (!driver.id.equals(delivery.driver != null ? delivery.driver.id : null) && driver.role != Role.ADMIN) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You can only broadcast location for your assigned delivery");
        }

        if (Boolean.FALSE.equals(delivery.trackingEnabled) || delivery.status == DeliveryStatus.DELIVERED
                || delivery.status == DeliveryStatus.CONFIRMED || delivery.status == DeliveryStatus.CANCELLED || delivery.status == DeliveryStatus.FAILED) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Tracking is disabled or closed for this delivery");
        }

        TrackingLocation location = new TrackingLocation();
        location.deliveryId = delivery.id;
        location.latitude = in.latitude();
        location.longitude = in.longitude();
        location.speed = in.speed();
        location.recordedAt = LocalDateTime.now();
        trackingLocations.save(location);

        delivery.deliveryLatitude = in.latitude();
        delivery.deliveryLongitude = in.longitude();
        deliveries.save(delivery);

        return ResponseEntity.status(HttpStatus.CREATED).body(trackingMap(location));
    }

    @PostMapping("/tracking")
    public ResponseEntity<?> saveTrackingLocation(
            Authentication authentication,
            @Valid @RequestBody TrackingInput in
    ) {
        return saveDeliveryTracking(in.deliveryId(), authentication,
                new DeliveryLocationInput(in.latitude(), in.longitude(), in.speed()));
    }

    @RequestMapping(value = "/deliveries/{id}/tracking", method = {RequestMethod.GET})
    public List<Map<String, Object>> getDeliveryTracking(
            @PathVariable String id,
            Authentication authentication
    ) {
        AppUser user = current(authentication);
        Delivery delivery = deliveries.findById(id).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Delivery not found"));
        requireDeliveryParticipant(user, delivery);
        return trackingLocations.findByDeliveryIdOrderByRecordedAtAsc(id)
                .stream().map(this::trackingMap).toList();
    }

    @GetMapping("/deliveries/{id}/tracking/latest")
    public Map<String, Object> getLatestDeliveryTracking(
            @PathVariable String id,
            Authentication authentication
    ) {
        AppUser user = current(authentication);
        Delivery delivery = deliveries.findById(id).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Delivery not found"));
        requireDeliveryParticipant(user, delivery);
        return trackingLocations.findFirstByDeliveryIdOrderByRecordedAtDesc(id)
                .map(this::trackingMap)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "No location has been shared yet"));
    }

    @PatchMapping("/deliveries/{id}/tracking")
    public Map<String, Object> toggleTracking(
            @PathVariable String id,
            Authentication authentication,
            @Valid @RequestBody TrackingToggle in
    ) {
        AppUser driver = current(authentication);
        requireRole(driver, Role.DRIVER);
        Delivery delivery = deliveries.findById(id).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Delivery not found"));
        if (delivery.driver == null || !delivery.driver.id.equals(driver.id)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You can only control tracking for your assigned delivery");
        }
        if (delivery.status == DeliveryStatus.DELIVERED || delivery.status == DeliveryStatus.CONFIRMED || delivery.status == DeliveryStatus.CANCELLED || delivery.status == DeliveryStatus.FAILED) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Tracking is closed for this delivery");
        }
        delivery.trackingEnabled = in.enabled();
        deliveries.save(delivery);
        return deliveryMap(delivery);
    }

    @GetMapping("/tracking/delivery/{deliveryId}")
    public List<Map<String, Object>> trackingHistory(
            @PathVariable String deliveryId,
            Authentication authentication
    ) {
        return getDeliveryTracking(deliveryId, authentication);
    }

    @GetMapping("/tracking/delivery/{deliveryId}/latest")
    public Map<String, Object> latestTracking(
            @PathVariable String deliveryId,
            Authentication authentication
    ) {
        return getLatestDeliveryTracking(deliveryId, authentication);
    }

    // -------------------- UPLOAD DELIVERY PROOF --------------------

    @PostMapping(
            value = "/deliveries/{id}/proof",
            consumes = MediaType.MULTIPART_FORM_DATA_VALUE
    )
    public Map<String, Object> uploadProof(
            @PathVariable String id,
            Authentication authentication,
            @RequestPart("image") MultipartFile image,
            @RequestParam(value = "receiverName", required = false) String receiverName,
            @RequestParam(value = "latitude", required = false) Double latitude,
            @RequestParam(value = "longitude", required = false) Double longitude
    ) throws IOException {

        AppUser user = current(authentication);

        Delivery delivery = deliveries.findById(id)
                .orElseThrow(() ->
                        new ResponseStatusException(
                                HttpStatus.NOT_FOUND,
                                "Delivery not found"
                        )
                );

        boolean isDriver = delivery.driver != null && delivery.driver.id.equals(user.id);
        boolean isNgo = delivery.ngo != null && delivery.ngo.id.equals(user.id);
        boolean isAdmin = user.role == Role.ADMIN;

        if (!isDriver && !isNgo && !isAdmin) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "Not your delivery"
            );
        }

        String filename = storeImage(image);

        DeliveryProof proof = new DeliveryProof();
        proof.deliveryId = delivery.id;
        proof.proofImageFile = filename;
        proof.receiverName = receiverName != null && !receiverName.isBlank() ? receiverName.trim() : delivery.receiverName;
        proof.latitude = latitude;
        proof.longitude = longitude;
        proof.deliveredAt = LocalDateTime.now();
        deliveryProofs.save(proof);

        delivery.proofImageFile = filename;
        if (proof.receiverName != null) {
            delivery.receiverName = proof.receiverName;
        }
        if (latitude != null) delivery.deliveryLatitude = latitude;
        if (longitude != null) delivery.deliveryLongitude = longitude;

        // If driver uploads handover proof while in transit or picked up, mark as DELIVERED
        if (delivery.status == DeliveryStatus.IN_TRANSIT || delivery.status == DeliveryStatus.PICKED_UP) {
            delivery.status = DeliveryStatus.DELIVERED;
            delivery.deliveredAt = LocalDateTime.now();
            if (delivery.foodRequest != null) {
                delivery.foodRequest.status = RequestStatus.FULFILLED;
                requests.save(delivery.foodRequest);
            }
            if (delivery.claim != null) {
                delivery.claim.status = ClaimStatus.COMPLETED;
                claims.save(delivery.claim);
            }
        }

        deliveries.save(delivery);

        return deliveryMap(delivery);
    }

    // -------------------- ADMIN SUMMARY & STATS --------------------

    @GetMapping("/deliveries/summary")
    public Map<String, Object> deliverySummary(Authentication authentication) {
        AppUser user = current(authentication);
        requireRole(user, Role.ADMIN);

        Map<String, Object> sum = new LinkedHashMap<>();
        sum.put("totalDeliveries", deliveries.count());
        sum.put("pendingDeliveries", deliveries.countByStatus(DeliveryStatus.PENDING));
        sum.put("assignedDeliveries", deliveries.countByStatus(DeliveryStatus.ASSIGNED));
        sum.put("acceptedDeliveries", deliveries.countByStatus(DeliveryStatus.ACCEPTED));
        sum.put("pickedUpDeliveries", deliveries.countByStatus(DeliveryStatus.PICKED_UP));
        sum.put("inTransitDeliveries", deliveries.countByStatus(DeliveryStatus.IN_TRANSIT));
        sum.put("deliveredDeliveries", deliveries.countByStatus(DeliveryStatus.DELIVERED));
        sum.put("confirmedDeliveries", deliveries.countByStatus(DeliveryStatus.CONFIRMED));
        sum.put("failedDeliveries", deliveries.countByStatus(DeliveryStatus.FAILED));
        sum.put("cancelledDeliveries", deliveries.countByStatus(DeliveryStatus.CANCELLED));

        long totalMealsDelivered = deliveries.findByStatusOrderByCreatedAtDesc(DeliveryStatus.DELIVERED).stream()
                .mapToLong(d -> d.mealCount != null ? d.mealCount : 0).sum()
                + deliveries.findByStatusOrderByCreatedAtDesc(DeliveryStatus.CONFIRMED).stream()
                .mapToLong(d -> d.mealCount != null ? d.mealCount : 0).sum();
        sum.put("totalMealsDelivered", totalMealsDelivered);

        List<AppUser> allDrivers = users.findByRole(Role.DRIVER);
        sum.put("totalDrivers", allDrivers.size());
        long availableDrivers = allDrivers.stream()
                .filter(d -> !deliveries.existsByDriverIdAndStatusIn(d.id,
                        List.of(DeliveryStatus.ACCEPTED, DeliveryStatus.PICKED_UP, DeliveryStatus.IN_TRANSIT)))
                .count();
        sum.put("availableDrivers", availableDrivers);

        return sum;
    }

    // -------------------- LIST DRIVERS WITH AVAILABILITY --------------------

    @GetMapping("/drivers")
    public List<Map<String, Object>> drivers(
            Authentication authentication
    ) {
        AppUser user = current(authentication);
        requireOneOf(user, Role.NGO, Role.RECIPIENT, Role.RESTAURANT, Role.ADMIN);

        return users.findByRole(Role.DRIVER)
                .stream()
                .map(driver -> {
                    Map<String, Object> result = new LinkedHashMap<>();
                    result.put("id", driver.id);
                    result.put("fullName", driver.fullName);
                    result.put("phone", Objects.toString(driver.phone, ""));
                    result.put("city", Objects.toString(driver.city, ""));

                    boolean busy = deliveries.existsByDriverIdAndStatusIn(driver.id,
                            List.of(DeliveryStatus.ACCEPTED, DeliveryStatus.PICKED_UP, DeliveryStatus.IN_TRANSIT));
                    result.put("available", !busy);
                    result.put("activeDeliveries", deliveries.findByDriverIdAndStatusIn(driver.id,
                            List.of(DeliveryStatus.ASSIGNED, DeliveryStatus.ACCEPTED, DeliveryStatus.PICKED_UP, DeliveryStatus.IN_TRANSIT)).size());
                    return result;
                })
                .toList();
    }

    // -------------------- SERVE UPLOADED IMAGES --------------------

    @GetMapping("/files/{name}")
    public ResponseEntity<Resource> file(
            @PathVariable String name
    ) throws IOException {

        if (!name.matches("^[a-f0-9-]{36}\\.(jpg|jpeg|png|webp|gif)$")) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        }

        Path path = uploadRoot.resolve(name).normalize();

        if (!path.startsWith(uploadRoot) || !Files.isRegularFile(path)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        }

        String contentType = Files.probeContentType(path);
        MediaType mediaType = MediaType.parseMediaType(
                contentType == null ? "application/octet-stream" : contentType
        );

        return ResponseEntity.ok()
                .contentType(mediaType)
                .header("X-Content-Type-Options", "nosniff")
                .body(new FileSystemResource(path));
    }

    // -------------------- STORE IMAGE --------------------

    private String storeImage(MultipartFile file) throws IOException {
        if (file == null || file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Please select an image");
        }

        if (file.getSize() > 5L * 1024 * 1024) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Image must be 5 MB or smaller");
        }

        String contentType = file.getContentType() == null
                ? "" : file.getContentType().toLowerCase(Locale.ROOT);

        if (!List.of("image/jpeg", "image/png", "image/webp", "image/gif").contains(contentType)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Upload a JPEG, PNG, WebP or GIF image");
        }

        String extension = switch (contentType) {
            case "image/jpeg" -> "jpg";
            case "image/png" -> "png";
            case "image/webp" -> "webp";
            default -> "gif";
        };

        String filename = UUID.randomUUID() + "." + extension;
        Path destination = uploadRoot.resolve(filename).normalize();

        if (!destination.startsWith(uploadRoot)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid image path");
        }

        try (InputStream input = file.getInputStream()) {
            Files.copy(input, destination, StandardCopyOption.REPLACE_EXISTING);
        }

        return filename;
    }

    // -------------------- AUTHENTICATED USER HELPER --------------------

    private AppUser current(Authentication authentication) {
        if (authentication == null || !(authentication.getPrincipal() instanceof String id)) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Please sign in");
        }

        return users.findById(id)
                .orElseThrow(() ->
                        new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Account not found")
                );
    }

    // -------------------- ROLE VALIDATION --------------------

    private void requireRole(AppUser user, Role requiredRole) {
        if (user.role != requiredRole) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "This action requires " + requiredRole);
        }
    }

    private void requireOneOf(AppUser user, Role... allowedRoles) {
        boolean allowed = Arrays.stream(allowedRoles).anyMatch(role -> role == user.role);
        if (!allowed) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Your account type cannot perform this action");
        }
    }

    private void requireDeliveryParticipant(AppUser user, Delivery delivery) {
        boolean isDriver = delivery.driver != null && delivery.driver.id.equals(user.id);
        boolean isNgo = delivery.ngo != null && delivery.ngo.id.equals(user.id);
        boolean isClaimant = delivery.claim != null && delivery.claim.claimant != null
                && delivery.claim.claimant.id.equals(user.id);
        boolean isDonor = delivery.donation != null && delivery.donation.donor != null
                && delivery.donation.donor.id.equals(user.id);
        boolean isRequester = delivery.foodRequest != null && delivery.foodRequest.requester != null
                && delivery.foodRequest.requester.id.equals(user.id);
        if (!(isDriver || isNgo || isClaimant || isDonor || isRequester || user.role == Role.ADMIN)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You cannot access this delivery's details");
        }
    }

    // -------------------- RESPONSE MAPPERS --------------------

    private Map<String, Object> userMap(AppUser user) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("id", user.id);
        result.put("fullName", user.fullName);
        result.put("organisationName", Objects.toString(user.organisationName, ""));
        result.put("email", user.email);
        result.put("phone", Objects.toString(user.phone, ""));
        result.put("city", Objects.toString(user.city, ""));
        result.put("role", user.role.name());
        return result;
    }

    private Map<String, Object> trackingMap(TrackingLocation location) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("id", location.id);
        result.put("deliveryId", location.deliveryId);
        result.put("latitude", location.latitude);
        result.put("longitude", location.longitude);
        result.put("speed", location.speed);
        result.put("recordedAt", location.recordedAt);
        return result;
    }

    private Map<String, Object> donationMap(Donation donation) {
        Map<String, Object> result = new LinkedHashMap<>();

        result.put("id", donation.id);
        result.put("foodName", donation.foodName);
        result.put("description", donation.description);
        result.put("foodType", donation.foodType);
        result.put("sourceType", donation.sourceType);
        result.put("sourceName", donation.sourceName);
        result.put("totalMeals", donation.totalMeals);
        result.put("remainingMeals", donation.remainingMeals);
        result.put("pickupAddress", donation.pickupAddress);
        result.put("pickupBefore", donation.pickupBefore);
        result.put("status", donation.status);
        result.put(
                "imageUrl",
                donation.imageFile == null ? null : "/api/files/" + donation.imageFile
        );

        if (donation.donor != null) {
            result.put(
                    "donorName",
                    donation.sourceName != null && !donation.sourceName.isBlank()
                            ? donation.sourceName
                            : (donation.donor.organisationName == null
                            || donation.donor.organisationName.isBlank()
                            ? donation.donor.fullName
                            : donation.donor.organisationName)
            );
            result.put("city", donation.donor.city);
        } else {
            result.put("donorName", donation.sourceName != null ? donation.sourceName : "Donor");
            result.put("city", null);
        }

        return result;
    }

    private Map<String, Object> claimMap(FoodClaim claim) {
        Map<String, Object> result = new LinkedHashMap<>();

        result.put("id", claim.id);
        result.put("requestedMeals", claim.requestedMeals);
        result.put("status", claim.status);
        result.put("createdAt", claim.createdAt);

        Donation donation = claim.donation;
        if (donation == null) {
            result.put("donationId", null);
            result.put("foodName", null);
            result.put("donorName", null);
            return result;
        }

        result.put("donationId", donation.id);
        result.put("foodName", donation.foodName);

        AppUser donor = donation.donor;
        if (donor == null) {
            result.put("donorName", null);
        } else {
            String organisationName = donor.organisationName;
            String donorName = organisationName == null || organisationName.isBlank()
                    ? donor.fullName
                    : organisationName;
            result.put("donorName", donorName);
        }

        return result;
    }

    private Map<String, Object> requestMap(FoodRequest request) {
        Map<String, Object> result = new LinkedHashMap<>();

        result.put("id", request.id);
        result.put("foodName", request.foodName);
        result.put("requestedMeals", request.requestedMeals);
        result.put("description", request.description);
        result.put("urgency", request.urgency);
        result.put("neededBefore", request.neededBefore);
        result.put("deliveryAddress", request.deliveryAddress);
        result.put("status", request.status);
        result.put("matchedDonationId", request.matchedDonation == null ? null : request.matchedDonation.id);
        result.put("createdAt", request.createdAt);

        if (request.requester != null) {
            result.put(
                    "requesterName",
                    request.requester.organisationName == null
                            || request.requester.organisationName.isBlank()
                            ? request.requester.fullName
                            : request.requester.organisationName
            );
            result.put("city", request.requester.city);
        } else {
            result.put("requesterName", "Community requester");
            result.put("city", null);
        }

        return result;
    }

    private Map<String, Object> deliveryMap(Delivery delivery) {
        Map<String, Object> result = new LinkedHashMap<>();

        result.put("id", delivery.id);
        result.put("donationId", delivery.donation != null ? delivery.donation.id : null);
        result.put("requestId", delivery.foodRequest != null ? delivery.foodRequest.id : null);
        result.put("claimId", delivery.claim != null ? delivery.claim.id : null);
        result.put("foodName", delivery.donation != null ? delivery.donation.foodName : "Food package");

        result.put(
                "ngoName",
                delivery.ngo == null ? "Community recipient" :
                        (delivery.ngo.organisationName == null
                                || delivery.ngo.organisationName.isBlank()
                                ? delivery.ngo.fullName
                                : delivery.ngo.organisationName)
        );

        if (delivery.driver != null) {
            result.put("driverId", delivery.driver.id);
            result.put("driverName", delivery.driver.fullName);
            result.put("driverPhone", Objects.toString(delivery.driver.phone, ""));
        } else {
            result.put("driverId", null);
            result.put("driverName", "Unassigned Driver");
            result.put("driverPhone", "");
        }

        if (delivery.donation != null && delivery.donation.donor != null) {
            result.put("donorId", delivery.donation.donor.id);
            result.put("donorName", delivery.donation.sourceName != null && !delivery.donation.sourceName.isBlank()
                    ? delivery.donation.sourceName
                    : (delivery.donation.donor.organisationName == null || delivery.donation.donor.organisationName.isBlank()
                    ? delivery.donation.donor.fullName : delivery.donation.donor.organisationName));
            result.put("donorPhone", Objects.toString(delivery.donation.donor.phone, ""));
            result.put("pickupAddress", delivery.pickupAddress != null && !delivery.pickupAddress.isBlank()
                    ? delivery.pickupAddress : delivery.donation.pickupAddress);
        } else if (delivery.donation != null) {
            result.put("donorId", null);
            result.put("donorName", delivery.donation.sourceName != null ? delivery.donation.sourceName : "Donor");
            result.put("donorPhone", "");
            result.put("pickupAddress", delivery.pickupAddress != null && !delivery.pickupAddress.isBlank()
                    ? delivery.pickupAddress : delivery.donation.pickupAddress);
        } else {
            result.put("donorId", null);
            result.put("donorName", "Donor");
            result.put("donorPhone", "");
            result.put("pickupAddress", delivery.pickupAddress != null ? delivery.pickupAddress : "");
        }

        AppUser recipient = delivery.claim != null ? delivery.claim.claimant
                : (delivery.foodRequest != null ? delivery.foodRequest.requester : delivery.ngo);
        result.put("recipientId", recipient != null ? recipient.id : null);
        result.put("recipientName", recipient == null ? "Community recipient" :
                (recipient.organisationName == null || recipient.organisationName.isBlank() ? recipient.fullName : recipient.organisationName));
        result.put("recipientPhone", recipient == null ? "" : Objects.toString(recipient.phone, ""));
        result.put("mealCount", delivery.mealCount);
        result.put("deliveryAddress", delivery.deliveryAddress);
        result.put("status", delivery.status);
        result.put("trackingEnabled", delivery.trackingEnabled);
        result.put("createdAt", delivery.createdAt);
        result.put("acceptedAt", delivery.acceptedAt);
        result.put("pickedUpAt", delivery.pickedUpAt);
        result.put("deliveredAt", delivery.deliveredAt);
        result.put("confirmedAt", delivery.confirmedAt);
        result.put("failedAt", delivery.failedAt);
        result.put("failureReason", delivery.failureReason);
        result.put("receiverName", delivery.receiverName);
        result.put("recipientConfirmed", delivery.recipientConfirmed != null && delivery.recipientConfirmed);
        result.put("recipientNotes", delivery.recipientNotes);
        result.put("deliveryLatitude", delivery.deliveryLatitude);
        result.put("deliveryLongitude", delivery.deliveryLongitude);

        result.put(
                "proofImageUrl",
                delivery.proofImageFile == null
                        ? null
                        : "/api/files/" + delivery.proofImageFile
        );

        return result;
    }
}
