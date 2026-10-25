package com.securelan.messenger.messaging;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
public interface ConversationParticipantRepository extends JpaRepository<ConversationParticipant,ConversationParticipant.Key> {}
