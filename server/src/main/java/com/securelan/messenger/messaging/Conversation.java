package com.securelan.messenger.messaging;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity @Table(name = "conversations")
public class Conversation {
    @Id private UUID id;
    @Column(nullable = false) private String type;
    @Column(name = "user_low_id", nullable = false) private UUID userLowId;
    @Column(name = "user_high_id", nullable = false) private UUID userHighId;
    @Column(name = "next_sequence", nullable = false) private long nextSequence;
    @Column(name = "created_at", nullable = false) private Instant createdAt;
    @Column(name = "updated_at", nullable = false) private Instant updatedAt;
    protected Conversation() {}
    public Conversation(UUID first, UUID second) {
        id = UUID.randomUUID(); type = "DIRECT";
        if (first.toString().compareTo(second.toString()) < 0) { userLowId = first; userHighId = second; }
        else { userLowId = second; userHighId = first; }
        nextSequence = 1; createdAt = updatedAt = Instant.now();
    }
    public UUID getId() { return id; }
    public UUID getUserLowId() { return userLowId; }
    public UUID getUserHighId() { return userHighId; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public long allocateSequence() { var value = nextSequence++; updatedAt = Instant.now(); return value; }
    public boolean contains(UUID userId) { return userLowId.equals(userId) || userHighId.equals(userId); }
    public UUID colleague(UUID userId) { return userLowId.equals(userId) ? userHighId : userLowId; }
}
