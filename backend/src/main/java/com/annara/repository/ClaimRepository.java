package com.annara.repository;

import com.annara.entity.FoodClaim;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

public interface ClaimRepository extends MongoRepository<FoodClaim, String> {
    List<FoodClaim> findByClaimantIdOrderByCreatedAtDesc(String claimantId);
    List<FoodClaim> findByDonationDonorIdOrderByCreatedAtDesc(String donorId);
    List<FoodClaim> findByDonationId(String donationId);
}
