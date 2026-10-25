package com.securelan.messenger.auth;

import java.time.Instant;
import java.util.*;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

public interface SessionRepository extends JpaRepository<UserSession, UUID> {
    Optional<UserSession> findByTokenHash(String tokenHash);
    @Modifying @Query("update UserSession s set s.revokedAt = :now where s.user.id = :userId and s.revokedAt is null")
    int revokeAll(@Param("userId") UUID userId, @Param("now") Instant now);
    @Modifying @Query("update UserSession s set s.revokedAt = :now where s.user.id = :userId and s.id <> :exceptId and s.revokedAt is null")
    int revokeOthers(@Param("userId") UUID userId, @Param("exceptId") UUID exceptId, @Param("now") Instant now);
}
