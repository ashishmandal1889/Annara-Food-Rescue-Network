package com.annara.repository;

import com.annara.entity.Delivery;
import com.annara.enums.DeliveryStatus;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface DeliveryRepository extends MongoRepository<Delivery, String> {
    List<Delivery> findByDriverIdOrderByCreatedAtDesc(String driverId);
    List<Delivery> findByDriverIdAndStatusIn(String driverId, List<DeliveryStatus> statuses);
    List<Delivery> findByStatusOrderByCreatedAtDesc(DeliveryStatus status);
    List<Delivery> findByDonationDonorIdOrderByCreatedAtDesc(String donorId);
    List<Delivery> findAllByOrderByCreatedAtDesc();

    boolean existsByClaimId(String claimId);
    boolean existsByFoodRequestId(String foodRequestId);
    boolean existsByDriverIdAndStatusIn(String driverId, List<DeliveryStatus> statuses);

    Optional<Delivery> findByClaimId(String claimId);
    Optional<Delivery> findByFoodRequestId(String foodRequestId);

    long countByStatus(DeliveryStatus status);
}
