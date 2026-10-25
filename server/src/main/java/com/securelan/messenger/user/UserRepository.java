package com.securelan.messenger.user;

import java.util.*;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface UserRepository extends JpaRepository<UserAccount, UUID> {
    Optional<UserAccount> findByUsername(String username);
    boolean existsByUsername(String username);
    boolean existsByRole(UserRole role);
    @Query("select u from UserAccount u where u.status = com.securelan.messenger.user.UserStatus.ACTIVE and u.id <> :current and " +
           "(:search = '' or lower(u.displayName) like lower(concat('%',:search,'%')) or lower(u.username) like lower(concat('%',:search,'%'))) order by u.displayName, u.id")
    List<UserAccount> directory(@Param("current") UUID current, @Param("search") String search, Pageable pageable);
}
