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
public class ClaimAndDeliveryWorkflowTests {

    @Autowired private MockMvc mockMvc;
    @Autowired private UserRepository userRepository;
    @Autowired private DonationRepository donationRepository;
    @Autowired private ClaimRepository claimRepository;
    @Autowired private DeliveryRepository deliveryRepository;
    @Autowired private FoodRequestRepository requestRepository;
    @Autowired private TrackingLocationRepository trackingRepository;

    private String restaurantToken;
    private String ngoToken;
    private String driverToken;
    private String driverId;

    @BeforeEach
    void setUp() throws Exception {
        trackingRepository.deleteAll();
        deliveryRepository.deleteAll();
        claimRepository.deleteAll();
        requestRepository.deleteAll();
        donationRepository.deleteAll();
        userRepository.deleteAll();

        // 1. Restaurant
        String rRes = mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                            {
                                "fullName": "Annapoorna Kitchen",
                                "email": "chef@annapoorna.org",
                                "password": "Password123!",
                                "role": "RESTAURANT"
                            }
                        """))
                .andReturn().getResponse().getContentAsString();
        restaurantToken = rRes.split("\"token\":\"")[1].split("\"")[0];

        // 2. NGO
        String nRes = mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                            {
                                "fullName": "Robin Food NGO",
                                "email": "contact@robinfood.org",
                                "password": "Password123!",
                                "role": "NGO"
                            }
                        """))
                .andReturn().getResponse().getContentAsString();
        ngoToken = nRes.split("\"token\":\"")[1].split("\"")[0];

        // 3. Driver
        String dRes = mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                            {
                                "fullName": "Ramesh Kumar",
                                "phone": "+919988776655",
                                "city": "Bengaluru",
                                "email": "ramesh@expressdelivery.com",
                                "password": "Password123!",
                                "role": "DRIVER"
                            }
                        """))
                .andReturn().getResponse().getContentAsString();
        driverToken = dRes.split("\"token\":\"")[1].split("\"")[0];
        driverId = dRes.split("\"id\":")[1].split(",")[0].trim().replace("\"", "");
    }

    private String createTestDonation(int totalMeals) throws Exception {
        String futureTime = LocalDateTime.now().plusHours(4).toString();
        String json = String.format("""
            {
                "foodName": "Fresh Roti and Sabzi",
                "foodType": "Vegetarian",
                "totalMeals": %d,
                "pickupAddress": "Jayanagar 4th Block",
                "pickupBefore": "%s"
            }
        """, totalMeals, futureTime);

        MockMultipartFile dataPart = new MockMultipartFile("data", "", "application/json", json.getBytes());
        String res = mockMvc.perform(multipart("/api/donations")
                        .file(dataPart)
                        .header("Authorization", "Bearer " + restaurantToken))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();

        return res.split("\"id\":")[1].split(",")[0].trim().replace("\"", "");
    }

    @Test
    @DisplayName("Complete Claim Lifecycle: Claim -> Overclaim Guard -> Reject Restores Meals -> Approve -> Assign Delivery -> Deliver")
    void claimAndDeliveryLifecycle() throws Exception {
        String donationId = createTestDonation(20);

        // 1. Overclaim fails
        mockMvc.perform(post("/api/donations/" + donationId + "/claims")
                        .header("Authorization", "Bearer " + ngoToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"requestedMeals\": 25}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error", containsString("remain")));

        // 2. Valid Claim for 10 meals
        String claimRes = mockMvc.perform(post("/api/donations/" + donationId + "/claims")
                        .header("Authorization", "Bearer " + ngoToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"requestedMeals\": 10}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("PENDING"))
                .andExpect(jsonPath("$.requestedMeals").value(10))
                .andReturn().getResponse().getContentAsString();

        String claimId = claimRes.split("\"id\":")[1].split(",")[0].trim().replace("\"", "");

        // Verify remaining meals decremented on donation
        mockMvc.perform(get("/api/donations/" + donationId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.remainingMeals").value(10))
                .andExpect(jsonPath("$.status").value("PARTIALLY_CLAIMED"));

        // 3. Donor Approves Claim
        mockMvc.perform(patch("/api/claims/" + claimId + "/status")
                        .header("Authorization", "Bearer " + restaurantToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\": \"APPROVED\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("APPROVED"));

        // 4. Claimant assigns delivery to driver
        String delRes = mockMvc.perform(post("/api/claims/" + claimId + "/delivery")
                        .header("Authorization", "Bearer " + ngoToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(String.format("{\"driverId\": \"%s\", \"deliveryAddress\": \"Shelter Home, Koramangala\"}", driverId)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").isNotEmpty())
                .andExpect(jsonPath("$.status").value("ASSIGNED"))
                .andExpect(jsonPath("$.mealCount").value(10))
                .andReturn().getResponse().getContentAsString();

        String deliveryId = delRes.split("\"id\":")[1].split(",")[0].trim().replace("\"", "");

        // 5. Driver verifies delivery in myDeliveries
        mockMvc.perform(get("/api/deliveries/mine")
                        .header("Authorization", "Bearer " + driverToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].id").value(deliveryId));

        // 6. Driver updates status: ASSIGNED -> PICKED_UP -> IN_TRANSIT -> DELIVERED
        mockMvc.perform(patch("/api/deliveries/" + deliveryId + "/status")
                        .header("Authorization", "Bearer " + driverToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\": \"PICKED_UP\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("PICKED_UP"));

        mockMvc.perform(patch("/api/deliveries/" + deliveryId + "/status")
                        .header("Authorization", "Bearer " + driverToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\": \"IN_TRANSIT\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("IN_TRANSIT"));

        mockMvc.perform(patch("/api/deliveries/" + deliveryId + "/status")
                        .header("Authorization", "Bearer " + driverToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\": \"DELIVERED\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("DELIVERED"));

        // 7. Verify claim is COMPLETED
        mockMvc.perform(get("/api/claims/mine")
                        .header("Authorization", "Bearer " + ngoToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].status").value("COMPLETED"));
    }

    @Test
    @DisplayName("Food Request and Donation Matching workflow")
    void requestMatchingWorkflow() throws Exception {
        // 1. NGO creates food request
        String reqRes = mockMvc.perform(post("/api/requests")
                        .header("Authorization", "Bearer " + ngoToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                            {
                                "foodName": "Packed Rice Bowls",
                                "requestedMeals": 15,
                                "description": "For night shelter",
                                "urgency": "HIGH",
                                "deliveryAddress": "City Shelter #4"
                            }
                        """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("OPEN"))
                .andReturn().getResponse().getContentAsString();

        String reqId = reqRes.split("\"id\":")[1].split(",")[0].trim().replace("\"", "");

        // 2. Restaurant creates matching donation
        String donationId = createTestDonation(30);

        // 3. Restaurant matches donation to request
        mockMvc.perform(post("/api/requests/" + reqId + "/match")
                        .header("Authorization", "Bearer " + restaurantToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(String.format("{\"donationId\": \"%s\"}", donationId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("MATCHED"))
                .andExpect(jsonPath("$.matchedDonationId").value(donationId));

        // 4. Requester arranges delivery with driver
        mockMvc.perform(post("/api/requests/" + reqId + "/delivery")
                        .header("Authorization", "Bearer " + ngoToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(String.format("{\"driverId\": \"%s\", \"deliveryAddress\": \"City Shelter #4\"}", driverId)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("ASSIGNED"))
                .andExpect(jsonPath("$.mealCount").value(15));
    }
}
