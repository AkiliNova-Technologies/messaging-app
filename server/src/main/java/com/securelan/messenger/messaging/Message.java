package com.securelan.messenger.messaging;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity @Table(name="messages")
public class Message {
    @Id private UUID id;
    @Column(name="conversation_id", nullable=false) private UUID conversationId;
    @Column(name="sender_id", nullable=false) private UUID senderId;
    @Column(name="client_request_id", nullable=false) private UUID clientRequestId;
    @Column(name="server_sequence", nullable=false) private long serverSequence;
    @Column(name="payload_type", nullable=false) private String payloadType;
    @Column(nullable=false, length=4000) private String payload;
    @Column(name="payload_fingerprint", nullable=false, length=64) private String payloadFingerprint;
    @Column(name="created_at", nullable=false) private Instant createdAt;
    protected Message() {}
    public Message(UUID conversationId, UUID senderId, UUID clientRequestId, long sequence, String payload, String fingerprint) {
        id=UUID.randomUUID(); this.conversationId=conversationId; this.senderId=senderId; this.clientRequestId=clientRequestId;
        serverSequence=sequence; payloadType="TEXT"; this.payload=payload; payloadFingerprint=fingerprint; createdAt=Instant.now();
    }
    public UUID getId(){return id;} public UUID getConversationId(){return conversationId;} public UUID getSenderId(){return senderId;}
    public UUID getClientRequestId(){return clientRequestId;} public long getServerSequence(){return serverSequence;}
    public String getPayloadType(){return payloadType;} public String getPayload(){return payload;} public String getPayloadFingerprint(){return payloadFingerprint;}
    public Instant getCreatedAt(){return createdAt;}
}
