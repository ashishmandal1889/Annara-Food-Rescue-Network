package com.annara.repository;

import com.annara.entity.FoodRequest;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

public interface FoodRequestRepository extends MongoRepository<FoodRequest, String> {
    List<FoodRequest> findAllByOrderByCreatedAtDesc();
    List<FoodRequest> findByRequesterIdOrderByCreatedAtDesc(String requesterId);
}
