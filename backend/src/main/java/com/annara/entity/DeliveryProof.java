package com.annara.entity;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

@Document(collection = "delivery_proofs")
public class DeliveryProof {
    @Id
    public String id;

    @Indexed
    public String deliveryId;

    public String proofImageFile;
    public String receiverName;
    public Double latitude;
    public Double longitude;

    @Indexed
    public LocalDateTime deliveredAt = LocalDateTime.now();

    public Boolean recipientConfirmed = false;
    public LocalDateTime confirmedAt;
    public String recipientNotes;
}
