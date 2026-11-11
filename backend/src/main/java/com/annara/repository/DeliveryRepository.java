package com.annara.repository;

import com.annara.entity.Delivery;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;

import java.util.List;

public interface DeliveryRepository extends MongoRepository<Delivery, String> {
    List<Delivery> findAllByOrderByCreatedAtDesc();
    List<Delivery> findByNgoIdOrderByCreatedAtDesc(String ngoId);
    List<Delivery> findByDriverIdOrderByCreatedAtDesc(String driverId);
    List<Delivery> findByDonationDonorIdOrderByCreatedAtDesc(String donorId);
    boolean existsByClaimId(String claimId);
    List<Delivery> findByClaimClaimantIdOrderByCreatedAtDesc(String claimantId);
    boolean existsByFoodRequestId(String foodRequestId);

    @Query(value = "{ $or: [ {'claim.claimant.$id': ?0}, {'foodRequest.requester.$id': ?0}, {'ngo.$id': ?0}, {'claim.claimant': ?0}, {'foodRequest.requester': ?0}, {'ngo': ?0} ] }", sort = "{ 'createdAt': -1 }")
    List<Delivery> findByRecipientOrNgo(String userId);
}
