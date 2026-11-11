package com.annara.entity;

import com.annara.enums.ClaimStatus;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.DocumentReference;

import java.time.LocalDateTime;

@Document(collection = "claims")
public class FoodClaim {
    @Id
    public String id;

    @DocumentReference
    public Donation donation;

    @DocumentReference
    public AppUser claimant;

    public Integer requestedMeals;

    @Indexed
    public ClaimStatus status = ClaimStatus.PENDING;

    @Indexed
    public LocalDateTime createdAt = LocalDateTime.now();
}
