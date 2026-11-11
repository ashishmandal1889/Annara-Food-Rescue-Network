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
public class DonationWorkflowTests {

    @Autowired private MockMvc mockMvc;
    @Autowired private UserRepository userRepository;
    @Autowired private DonationRepository donationRepository;
    @Autowired private ClaimRepository claimRepository;
    @Autowired private DeliveryRepository deliveryRepository;

    private String restaurantToken;
    private String ngoToken;

    @BeforeEach
    void setUp() throws Exception {
        deliveryRepository.deleteAll();
        claimRepository.deleteAll();
        donationRepository.deleteAll();
        userRepository.deleteAll();

        // Register Restaurant
        String rRes = mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                            {
                                "fullName": "Chef Ajay",
                                "organisationName": "Royal Biryani Kitchen",
                                "email": "ajay@royalbiryani.com",
                                "password": "Password123!",
                                "city": "Bengaluru",
                                "role": "RESTAURANT"
                            }
                        """))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        restaurantToken = rRes.split("\"token\":\"")[1].split("\"")[0];

        // Register NGO
        String nRes = mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                            {
                                "fullName": "Food For All NGO",
                                "email": "help@foodforall.org",
                                "password": "Password123!",
                                "city": "Bengaluru",
                                "role": "NGO"
                            }
                        """))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        ngoToken = nRes.split("\"token\":\"")[1].split("\"")[0];
    }

    @Test
    @DisplayName("Restaurant creates donation with valid payload and retrieves it")
    void createAndGetDonation() throws Exception {
        String futureTime = LocalDateTime.now().plusHours(4).toString();
        String donationJson = String.format("""
            {
                "foodName": "Fresh Veg Biryani",
                "description": "Cooked 2 hours ago, sealed food grade containers. No allergens.",
                "foodType": "Vegetarian",
                "sourceType": "RESTAURANT",
                "sourceName": "Royal Biryani Kitchen",
                "totalMeals": 50,
                "pickupAddress": "12 MG Road, Bengaluru",
                "pickupBefore": "%s"
            }
        """, futureTime);

        MockMultipartFile dataPart = new MockMultipartFile(
                "data", "", "application/json", donationJson.getBytes()
        );

        String createRes = mockMvc.perform(multipart("/api/donations")
                        .file(dataPart)
                        .header("Authorization", "Bearer " + restaurantToken))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").isNotEmpty())
                .andExpect(jsonPath("$.foodName").value("Fresh Veg Biryani"))
                .andExpect(jsonPath("$.remainingMeals").value(50))
                .andExpect(jsonPath("$.status").value("AVAILABLE"))
                .andReturn().getResponse().getContentAsString();

        String idStr = createRes.split("\"id\":")[1].split(",")[0].trim().replace("\"", "");

        // Public retrieval of single donation
        mockMvc.perform(get("/api/donations/" + idStr))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.foodName").value("Fresh Veg Biryani"))
                .andExpect(jsonPath("$.city").value("Bengaluru"));

        // Public retrieval in list
        mockMvc.perform(get("/api/donations?q=Biryani&city=Bengaluru"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].id").value(idStr));
    }

    @Test
    @DisplayName("Non-restaurant cannot create donation")
    void nonRestaurantCannotCreateDonation() throws Exception {
        String futureTime = LocalDateTime.now().plusHours(4).toString();
        String donationJson = String.format("""
            {
                "foodName": "Surplus Rice",
                "foodType": "Vegetarian",
                "totalMeals": 10,
                "pickupAddress": "Indiranagar",
                "pickupBefore": "%s"
            }
        """, futureTime);

        MockMultipartFile dataPart = new MockMultipartFile(
                "data", "", "application/json", donationJson.getBytes()
        );

        mockMvc.perform(multipart("/api/donations")
                        .file(dataPart)
                        .header("Authorization", "Bearer " + ngoToken))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error", containsString("RESTAURANT")));
    }

    @Test
    @DisplayName("Past deadline is rejected with 400 Bad Request")
    void pastDeadlineRejected() throws Exception {
        String pastTime = LocalDateTime.now().minusHours(1).toString();
        String donationJson = String.format("""
            {
                "foodName": "Expired Rice",
                "foodType": "Vegetarian",
                "totalMeals": 10,
                "pickupAddress": "Indiranagar",
                "pickupBefore": "%s"
            }
        """, pastTime);

        MockMultipartFile dataPart = new MockMultipartFile(
                "data", "", "application/json", donationJson.getBytes()
        );

        mockMvc.perform(multipart("/api/donations")
                        .file(dataPart)
                        .header("Authorization", "Bearer " + restaurantToken))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error", containsString("must be in the future")));
    }

    @Test
    @DisplayName("Donor can edit and cancel own donation")
    void editAndCancelDonation() throws Exception {
        String futureTime = LocalDateTime.now().plusHours(5).toString();
        String donationJson = String.format("""
            {
                "foodName": "Lunch Trays",
                "foodType": "Mixed",
                "totalMeals": 30,
                "pickupAddress": "Koramangala",
                "pickupBefore": "%s"
            }
        """, futureTime);

        MockMultipartFile dataPart = new MockMultipartFile("data", "", "application/json", donationJson.getBytes());
        String res = mockMvc.perform(multipart("/api/donations").file(dataPart).header("Authorization", "Bearer " + restaurantToken))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();

        String id = res.split("\"id\":")[1].split(",")[0].trim().replace("\"", "");

        // Edit
        String editJson = String.format("""
            {
                "foodName": "Updated Lunch Trays",
                "description": "Now packed in 40 boxes",
                "foodType": "Mixed",
                "sourceType": "RESTAURANT",
                "sourceName": "Royal Biryani Kitchen",
                "totalMeals": 40,
                "pickupAddress": "Koramangala 5th Block",
                "pickupBefore": "%s"
            }
        """, futureTime);

        mockMvc.perform(put("/api/donations/" + id)
                        .header("Authorization", "Bearer " + restaurantToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(editJson))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.foodName").value("Updated Lunch Trays"))
                .andExpect(jsonPath("$.totalMeals").value(40))
                .andExpect(jsonPath("$.remainingMeals").value(40));

        // Cancel
        mockMvc.perform(patch("/api/donations/" + id + "/cancel")
                        .header("Authorization", "Bearer " + restaurantToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CANCELLED"));
    }
}
