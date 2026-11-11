package com.annara;

import com.annara.app.AnnaraApplication;
import com.annara.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDateTime;

import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(classes = AnnaraApplication.class)
@AutoConfigureMockMvc
@ActiveProfiles("test")
public class TrackingAndSecurityTests {

    @Autowired private MockMvc mockMvc;
    @Autowired private UserRepository userRepository;
    @Autowired private DonationRepository donationRepository;
    @Autowired private ClaimRepository claimRepository;
    @Autowired private DeliveryRepository deliveryRepository;
    @Autowired private TrackingLocationRepository trackingRepository;

    private String restaurantToken;
    private String ngoToken;
    private String driverToken;
    private String unrelatedToken;
    private String deliveryId;

    @BeforeEach
    void setUp() throws Exception {
        trackingRepository.deleteAll();
        deliveryRepository.deleteAll();
        claimRepository.deleteAll();
        donationRepository.deleteAll();
        userRepository.deleteAll();

        // 1. Restaurant
        String rRes = mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                            {"fullName": "Hot Bakes", "email": "bakes@hot.com", "password": "Password123!", "role": "RESTAURANT"}
                        """)).andReturn().getResponse().getContentAsString();
        restaurantToken = rRes.split("\"token\":\"")[1].split("\"")[0];

        // 2. NGO
        String nRes = mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                            {"fullName": "Care NGO", "email": "care@ngo.org", "password": "Password123!", "role": "NGO"}
                        """)).andReturn().getResponse().getContentAsString();
        ngoToken = nRes.split("\"token\":\"")[1].split("\"")[0];

        // 3. Driver
        String dRes = mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                            {"fullName": "Fast Driver", "email": "fast@driver.com", "password": "Password123!", "role": "DRIVER"}
                        """)).andReturn().getResponse().getContentAsString();
        driverToken = dRes.split("\"token\":\"")[1].split("\"")[0];
        String driverId = dRes.split("\"id\":")[1].split(",")[0].trim().replace("\"", "");

        // 4. Unrelated User
        String uRes = mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                            {"fullName": "Stranger", "email": "stranger@other.com", "password": "Password123!", "role": "RECIPIENT"}
                        """)).andReturn().getResponse().getContentAsString();
        unrelatedToken = uRes.split("\"token\":\"")[1].split("\"")[0];

        // Create donation
        String donJson = String.format("""
            {"foodName": "Bread rolls", "foodType": "Bakery", "totalMeals": 20, "pickupAddress": "Koramangala", "pickupBefore": "%s"}
        """, LocalDateTime.now().plusHours(3).toString());
        MockMultipartFile dataPart = new MockMultipartFile("data", "", "application/json", donJson.getBytes());
        String donRes = mockMvc.perform(multipart("/api/donations").file(dataPart).header("Authorization", "Bearer " + restaurantToken))
                .andReturn().getResponse().getContentAsString();
        String donationId = donRes.split("\"id\":")[1].split(",")[0].trim().replace("\"", "");

        // Claim
        String cRes = mockMvc.perform(post("/api/donations/" + donationId + "/claims")
                        .header("Authorization", "Bearer " + ngoToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"requestedMeals\": 10}"))
                .andReturn().getResponse().getContentAsString();
        String claimId = cRes.split("\"id\":")[1].split(",")[0].trim().replace("\"", "");

        // Approve
        mockMvc.perform(patch("/api/claims/" + claimId + "/status")
                .header("Authorization", "Bearer " + restaurantToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"status\": \"APPROVED\"}"));

        // Assign delivery
        String delRes = mockMvc.perform(post("/api/claims/" + claimId + "/delivery")
                        .header("Authorization", "Bearer " + ngoToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(String.format("{\"driverId\": \"%s\", \"deliveryAddress\": \"Indiranagar\"}", driverId)))
                .andReturn().getResponse().getContentAsString();
        deliveryId = delRes.split("\"id\":")[1].split(",")[0].trim().replace("\"", "");
    }

    @Test
    @DisplayName("Driver posts GPS tracking; participants can view but strangers are blocked")
    void gpsTrackingAndAccessControl() throws Exception {
        // Driver shares coordinates
        mockMvc.perform(post("/api/tracking")
                        .header("Authorization", "Bearer " + driverToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(String.format("""
                            {
                                "deliveryId": "%s",
                                "latitude": 12.9716,
                                "longitude": 77.5946,
                                "speed": 25.5
                            }
                        """, deliveryId)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.latitude").value(12.9716))
                .andExpect(jsonPath("$.longitude").value(77.5946));

        // Authorized Participant (NGO) can view latest location
        mockMvc.perform(get("/api/tracking/delivery/" + deliveryId + "/latest")
                        .header("Authorization", "Bearer " + ngoToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.latitude").value(12.9716))
                .andExpect(jsonPath("$.speed").value(25.5));

        // Authorized Participant (Donor) can view history
        mockMvc.perform(get("/api/tracking/delivery/" + deliveryId)
                        .header("Authorization", "Bearer " + restaurantToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)));

        // Unrelated User is blocked with 403 Forbidden
        mockMvc.perform(get("/api/tracking/delivery/" + deliveryId + "/latest")
                        .header("Authorization", "Bearer " + unrelatedToken))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error", containsString("cannot access this delivery")));
    }

    @Test
    @DisplayName("Driver can toggle tracking and disabled tracking rejects GPS broadcast")
    void toggleTrackingEnforced() throws Exception {
        // Toggle tracking off
        mockMvc.perform(patch("/api/deliveries/" + deliveryId + "/tracking")
                        .header("Authorization", "Bearer " + driverToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"enabled\": false}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.trackingEnabled").value(false));

        // Sharing GPS now returns 409 Conflict
        mockMvc.perform(post("/api/tracking")
                        .header("Authorization", "Bearer " + driverToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(String.format("""
                            {"deliveryId": "%s", "latitude": 12.9716, "longitude": 77.5946, "speed": 0.0}
                        """, deliveryId)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error", containsString("disabled")));
    }

    @Test
    @DisplayName("Proof of delivery upload and serving file")
    void proofUploadAndFileAccess() throws Exception {
        MockMultipartFile imageFile = new MockMultipartFile(
                "image", "delivery_proof.jpg", "image/jpeg", "fake-jpeg-binary-content".getBytes()
        );

        String proofRes = mockMvc.perform(multipart("/api/deliveries/" + deliveryId + "/proof")
                        .file(imageFile)
                        .header("Authorization", "Bearer " + driverToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.proofImageUrl", containsString("/api/files/")))
                .andReturn().getResponse().getContentAsString();

        String fileUrl = proofRes.split("\"proofImageUrl\":\"")[1].split("\"")[0];

        // Access uploaded file
        mockMvc.perform(get(fileUrl))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Type", "image/jpeg"));

        // Path traversal attempt rejected with 4xx error (400 Bad Request by web container)
        mockMvc.perform(get("/api/files/../../secret.txt"))
                .andExpect(status().is4xxClientError());

        // Invalid filename format rejected with 404 Not Found
        mockMvc.perform(get("/api/files/invalid-filename.jpg"))
                .andExpect(status().isNotFound());
    }
}
