package com.annara.repository;

import com.annara.entity.DeliveryProof;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface DeliveryProofRepository extends MongoRepository<DeliveryProof, String> {
    List<DeliveryProof> findByDeliveryIdOrderByDeliveredAtDesc(String deliveryId);
    Optional<DeliveryProof> findFirstByDeliveryIdOrderByDeliveredAtDesc(String deliveryId);
    void deleteByDeliveryId(String deliveryId);
}
