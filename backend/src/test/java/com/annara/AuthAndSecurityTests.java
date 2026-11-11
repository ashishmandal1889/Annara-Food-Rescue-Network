package com.annara;

import com.annara.app.AnnaraApplication;
import com.annara.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(classes = AnnaraApplication.class)
@AutoConfigureMockMvc
@ActiveProfiles("test")
public class AuthAndSecurityTests {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private UserRepository userRepository;

    @BeforeEach
    void setUp() {
        userRepository.deleteAll();
    }

    @Test
    @DisplayName("Registration succeeds for supported roles")
    void registerSupportedRoles() throws Exception {
        String json = """
            {
                "fullName": "Green Table Kitchen",
                "organisationName": "Green Table Ltd",
                "email": "restaurant@greentable.com",
                "password": "Password123!",
                "phone": "+919876543210",
                "city": "Bengaluru",
                "role": "RESTAURANT"
            }
        """;

        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.token").isString())
                .andExpect(jsonPath("$.user.email").value("restaurant@greentable.com"))
                .andExpect(jsonPath("$.user.role").value("RESTAURANT"))
                .andExpect(jsonPath("$.user.password").doesNotExist())
                .andExpect(jsonPath("$.user.passwordHash").doesNotExist());
    }

    @Test
    @DisplayName("Public registration forbids ADMIN role")
    void registerAdminForbidden() throws Exception {
        String json = """
            {
                "fullName": "Malicious Admin",
                "email": "hacker@domain.com",
                "password": "Password123!",
                "role": "ADMIN"
            }
        """;

        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error", containsString("Admin accounts")));
    }

    @Test
    @DisplayName("Registration rejects duplicate email")
    void registerDuplicateEmail() throws Exception {
        String json = """
            {
                "fullName": "User One",
                "email": "duplicate@example.com",
                "password": "Password123!",
                "role": "NGO"
            }
        """;

        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json))
                .andExpect(status().isCreated());

        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error", containsString("already registered")));
    }

    @Test
    @DisplayName("Login succeeds with valid credentials and fails with invalid")
    void loginValidation() throws Exception {
        String regJson = """
            {
                "fullName": "Driver Dave",
                "email": "dave@drivers.com",
                "password": "CorrectPassword123",
                "role": "DRIVER"
            }
        """;

        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(regJson))
                .andExpect(status().isCreated());

        // Valid Login
        String validLogin = """
            {
                "email": "dave@drivers.com",
                "password": "CorrectPassword123"
            }
        """;

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(validLogin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").isString())
                .andExpect(jsonPath("$.user.role").value("DRIVER"));

        // Invalid Password
        String invalidPass = """
            {
                "email": "dave@drivers.com",
                "password": "WrongPassword!"
            }
        """;

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(invalidPass))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error", containsString("Invalid email or password")));
    }

    @Test
    @DisplayName("GET /api/me requires valid JWT and returns profile")
    void meEndpoint() throws Exception {
        mockMvc.perform(get("/api/me"))
                .andExpect(status().isUnauthorized());

        // Register and get token
        String regJson = """
            {
                "fullName": "NGO Care",
                "organisationName": "Care India Foundation",
                "email": "care@ngo.org",
                "password": "SecurePassword123",
                "city": "Mumbai",
                "role": "NGO"
            }
        """;

        String res = mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(regJson))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();

        String token = res.split("\"token\":\"")[1].split("\"")[0];

        mockMvc.perform(get("/api/me")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.fullName").value("NGO Care"))
                .andExpect(jsonPath("$.organisationName").value("Care India Foundation"))
                .andExpect(jsonPath("$.email").value("care@ngo.org"))
                .andExpect(jsonPath("$.role").value("NGO"));
    }
}
