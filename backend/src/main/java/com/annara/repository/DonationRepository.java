package com.annara.repository;

import com.annara.entity.Donation;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

public interface DonationRepository extends MongoRepository<Donation, String> {
    List<Donation> findAllByOrderByCreatedAtDesc();
    List<Donation> findByDonorIdOrderByCreatedAtDesc(String donorId);
}
