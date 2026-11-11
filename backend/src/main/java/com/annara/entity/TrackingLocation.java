package com.annara.entity;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

@Document(collection = "tracking_locations")
@CompoundIndexes({
    @CompoundIndex(name = "idx_tracking_delivery_recorded", def = "{'deliveryId': 1, 'recordedAt': 1}")
})
public class TrackingLocation {
    @Id
    public String id;

    @Indexed
    public String deliveryId;

    public Double latitude;
    public Double longitude;
    public Double speed;
    public LocalDateTime recordedAt = LocalDateTime.now();
}
