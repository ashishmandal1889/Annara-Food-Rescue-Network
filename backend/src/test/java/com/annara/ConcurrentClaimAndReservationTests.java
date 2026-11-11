package com.annara;

import com.annara.app.AnnaraApplication;
import com.annara.entity.Donation;
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
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(classes = AnnaraApplication.class)
@AutoConfigureMockMvc
@ActiveProfiles("test")
public class ConcurrentClaimAndReservationTests {

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

        // 1. Restaurant
        String rRes = mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                            {"fullName": "Biryani Zone", "email": "chef@biryani.com", "password": "Password123!", "role": "RESTAURANT"}
                        """)).andReturn().getResponse().getContentAsString();
        restaurantToken = rRes.split("\"token\":\"")[1].split("\"")[0];

        // 2. NGO
        String nRes = mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                            {"fullName": "Feed Bangalore", "email": "contact@feedblr.org", "password": "Password123!", "role": "NGO"}
                        """)).andReturn().getResponse().getContentAsString();
        ngoToken = nRes.split("\"token\":\"")[1].split("\"")[0];
    }

    @Test
    @DisplayName("Concurrent claim requests atomically decrement remaining meals without over-claiming")
    void testConcurrentClaimsPreventOverclaiming() throws Exception {
        int initialMeals = 30;
        int claimBatch = 10;
        int threadCount = 10; // Total 10 threads trying to claim 10 meals each (100 meals attempted on a 30-meal donation)

        String donJson = String.format("""
            {"foodName": "Fresh Meals", "foodType": "Vegetarian", "totalMeals": %d, "pickupAddress": "Indiranagar", "pickupBefore": "%s"}
        """, initialMeals, LocalDateTime.now().plusHours(4).toString());
        MockMultipartFile dataPart = new MockMultipartFile("data", "", "application/json", donJson.getBytes());
        String donRes = mockMvc.perform(multipart("/api/donations").file(dataPart).header("Authorization", "Bearer " + restaurantToken))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        String donationId = donRes.split("\"id\":")[1].split(",")[0].trim().replace("\"", "");

        ExecutorService executor = Executors.newFixedThreadPool(threadCount);
        CountDownLatch latch = new CountDownLatch(1);
        CountDownLatch doneLatch = new CountDownLatch(threadCount);

        AtomicInteger successCount = new AtomicInteger(0);
        AtomicInteger conflictCount = new AtomicInteger(0);

        for (int i = 0; i < threadCount; i++) {
            executor.submit(() -> {
                try {
                    latch.await();
                    int statusCode = mockMvc.perform(post("/api/donations/" + donationId + "/claims")
                                    .header("Authorization", "Bearer " + ngoToken)
                                    .contentType(MediaType.APPLICATION_JSON)
                                    .content(String.format("{\"requestedMeals\": %d}", claimBatch)))
                            .andReturn().getResponse().getStatus();

                    if (statusCode == 201) {
                        successCount.incrementAndGet();
                    } else if (statusCode == 409) {
                        conflictCount.incrementAndGet();
                    }
                } catch (Exception ignored) {
                } finally {
                    doneLatch.countDown();
                }
            });
        }

        // Fire all threads simultaneously
        latch.countDown();
        doneLatch.await();
        executor.shutdown();

        // Exactly 3 requests of 10 meals must succeed (3 * 10 = 30 meals claimed)
        assertEquals(3, successCount.get(), "Exactly 3 claims of 10 meals should succeed for a 30-meal donation");
        assertEquals(7, conflictCount.get(), "The remaining 7 concurrent claim attempts should be rejected with 409 Conflict");

        Donation donation = donationRepository.findById(donationId).orElseThrow();
        assertEquals(0, donation.remainingMeals, "Remaining meals must be exactly 0, never negative");
    }
}
