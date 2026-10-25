package com.securelan.messenger.messaging;

import jakarta.persistence.*;
import java.io.Serializable;
import java.time.Instant;
import java.util.UUID;

@Entity @Table(name = "conversation_participants") @IdClass(ConversationParticipant.Key.class)
public class ConversationParticipant {
    @Id @Column(name="conversation_id") private UUID conversationId;
    @Id @Column(name="user_id") private UUID userId;
    @Column(name="joined_at", nullable=false) private Instant joinedAt;
    protected ConversationParticipant() {}
    public ConversationParticipant(UUID conversationId, UUID userId) { this.conversationId=conversationId; this.userId=userId; joinedAt=Instant.now(); }
    public static class Key implements Serializable {
        public UUID conversationId; public UUID userId; public Key() {}
        @Override public boolean equals(Object value) { return value instanceof Key other && Objects.equals(conversationId,other.conversationId) && Objects.equals(userId,other.userId); }
        @Override public int hashCode() { return Objects.hash(conversationId,userId); }
    }
}
