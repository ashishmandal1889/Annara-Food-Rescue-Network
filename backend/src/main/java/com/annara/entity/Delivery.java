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
    public String pickupAddress;
    public String deliveryAddress;
    public String proofImageFile;

    @Indexed
    public DeliveryStatus status = DeliveryStatus.PENDING;

    @Indexed
    public LocalDateTime createdAt = LocalDateTime.now();

    public LocalDateTime acceptedAt;
    public LocalDateTime pickedUpAt;
    public LocalDateTime deliveredAt;
    public LocalDateTime confirmedAt;
    public LocalDateTime failedAt;
    public String failureReason;

    public String receiverName;
    public Double deliveryLatitude;
    public Double deliveryLongitude;
    public Boolean recipientConfirmed = false;
    public String recipientNotes;

    public Boolean trackingEnabled = true;
}
