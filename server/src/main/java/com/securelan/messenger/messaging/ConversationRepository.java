package com.securelan.messenger.messaging;
import jakarta.persistence.LockModeType;
import java.util.*;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
public interface ConversationRepository extends JpaRepository<Conversation,UUID> {
    Optional<Conversation> findByUserLowIdAndUserHighId(UUID low, UUID high);
    @Query("select c from Conversation c where c.userLowId=:user or c.userHighId=:user order by c.updatedAt desc")
    List<Conversation> findForUser(@Param("user") UUID user, Pageable pageable);
    @Lock(LockModeType.PESSIMISTIC_WRITE) @Query("select c from Conversation c where c.id=:id")
    Optional<Conversation> findLocked(@Param("id") UUID id);
    @Modifying @Query(value="insert into conversations(id,type,user_low_id,user_high_id,next_sequence,created_at,updated_at) values (:id,'DIRECT',:low,:high,1,now(),now()) on conflict (user_low_id,user_high_id) do nothing",nativeQuery=true)
    int insertIfAbsent(@Param("id") UUID id,@Param("low") UUID low,@Param("high") UUID high);
}
