package com.securelan.messenger.user;

import com.securelan.messenger.auth.AuthPrincipal;
import java.util.*;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController @RequestMapping("/api/v1/users/directory")
public class DirectoryController {
    private final UserRepository users;
    public DirectoryController(UserRepository users){this.users=users;}
    @GetMapping
    public Map<String,Object> directory(@AuthenticationPrincipal AuthPrincipal principal,
            @RequestParam(defaultValue="") String search, @RequestParam(defaultValue="0") int page,
            @RequestParam(defaultValue="25") int size) {
        var bounded=Math.max(1,Math.min(size,50));
        var items=users.directory(principal.userId(), search.trim(), PageRequest.of(Math.max(0,page),bounded)).stream().map(PublicUser::from).toList();
        return Map.of("items",items,"page",Math.max(0,page),"size",bounded,"hasMore",items.size()==bounded);
    }
    public record PublicUser(UUID id,String displayName,String username,String avatarInitials){
        static PublicUser from(UserAccount u){
            var parts=u.getDisplayName().trim().split("\\s+");
            var initials=(parts[0].substring(0,1)+(parts.length>1?parts[parts.length-1].substring(0,1):"")).toUpperCase(Locale.ROOT);
            return new PublicUser(u.getId(),u.getDisplayName(),u.getUsername(),initials);
        }
    }
}
