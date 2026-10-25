package com.securelan.messenger.messaging;
import java.util.*;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
public interface MessageRepository extends JpaRepository<Message,UUID> {
    Optional<Message> findBySenderIdAndClientRequestId(UUID senderId, UUID requestId);
    @Query("select m from Message m where m.conversationId=:conversation and (:before is null or m.serverSequence < :before) order by m.serverSequence desc")
    List<Message> history(@Param("conversation") UUID conversation, @Param("before") Long before, Pageable pageable);
    Optional<Message> findTopByConversationIdOrderByServerSequenceDesc(UUID conversationId);
}
