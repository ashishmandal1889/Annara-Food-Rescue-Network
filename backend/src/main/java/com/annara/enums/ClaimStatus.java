package com.annara.enums;

/** Claim lifecycle. Existing CONFIRMED values are retained for databases already in use. */
public enum ClaimStatus {
    PENDING, APPROVED, CONFIRMED, REJECTED, CANCELLED, COMPLETED
}
