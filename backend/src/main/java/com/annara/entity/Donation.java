package com.annara.entity;

import com.annara.enums.DonationStatus;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.DocumentReference;

import java.time.LocalDateTime;

@Document(collection = "donations")
public class Donation {
    @Id
    public String id;

    public String foodName;
    public String description;
    public String foodType;
    public String sourceType = "RESTAURANT";
    public String sourceName;
    public Integer totalMeals;
    public Integer remainingMeals;
    public String pickupAddress;

    @Indexed
    public LocalDateTime pickupBefore;

    public String imageFile;

    @Indexed
    public DonationStatus status = DonationStatus.AVAILABLE;

    @DocumentReference
    public AppUser donor;

    @Indexed
    public LocalDateTime createdAt = LocalDateTime.now();
}
