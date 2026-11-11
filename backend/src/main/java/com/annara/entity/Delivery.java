package com.annara.entity;

import com.annara.enums.DeliveryStatus;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.DocumentReference;

import java.time.LocalDateTime;

@Document(collection = "deliveries")
public class Delivery {
    @Id
    public String id;

    @DocumentReference
    public Donation donation;

    @DocumentReference
    public AppUser ngo;

    @DocumentReference
    public AppUser driver;

    @DocumentReference
    public FoodClaim claim;

    @DocumentReference
    public FoodRequest foodRequest;

    public Integer mealCount;
    public String deliveryAddress;
    public String proofImageFile;

    @Indexed
    public DeliveryStatus status = DeliveryStatus.ASSIGNED;

    @Indexed
    public LocalDateTime createdAt = LocalDateTime.now();

    public LocalDateTime deliveredAt;
    public Boolean trackingEnabled = true;
}
