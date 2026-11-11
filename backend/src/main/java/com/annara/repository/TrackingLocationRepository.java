package com.annara.repository;

import com.annara.entity.TrackingLocation;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

public interface TrackingLocationRepository extends MongoRepository<TrackingLocation, String> {
    List<TrackingLocation> findByDeliveryIdOrderByRecordedAtAsc(String deliveryId);
    Optional<TrackingLocation> findFirstByDeliveryIdOrderByRecordedAtDesc(String deliveryId);
}
