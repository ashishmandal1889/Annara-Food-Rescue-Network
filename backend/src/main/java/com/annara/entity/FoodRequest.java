package com.annara.entity;

import com.annara.enums.RequestStatus;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.DocumentReference;

import java.time.LocalDateTime;

@Document(collection = "food_requests")
public class FoodRequest {
    @Id
    public String id;

    @DocumentReference
    public AppUser requester;

    @DocumentReference
    public Donation matchedDonation;

    public String foodName;
    public Integer requestedMeals;
    public String description;
    public String urgency = "NORMAL";
    public LocalDateTime neededBefore;
    public String deliveryAddress;

    @Indexed
    public RequestStatus status = RequestStatus.OPEN;

    @Indexed
    public LocalDateTime createdAt = LocalDateTime.now();
}
