package com.securelan.messenger.messaging;
import com.securelan.messenger.auth.AuthPrincipal;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.*;
import org.springframework.http.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
@RestController @RequestMapping("/api/v1/conversations")
public class MessagingController {
 private final MessagingService service; public MessagingController(MessagingService s){service=s;}
 @GetMapping public List<MessagingService.ConversationView> list(@AuthenticationPrincipal AuthPrincipal p,@RequestParam(defaultValue="50") int size){return service.list(p.userId(),size);}
 @PostMapping public MessagingService.ConversationView create(@AuthenticationPrincipal AuthPrincipal p,@Valid @RequestBody CreateConversation r){return service.create(p.userId(),r.participantId());}
 @GetMapping("/{id}") public MessagingService.ConversationView get(@AuthenticationPrincipal AuthPrincipal p,@PathVariable UUID id){return service.get(id,p.userId());}
 @GetMapping("/{id}/messages") public MessagingService.MessagePage messages(@AuthenticationPrincipal AuthPrincipal p,@PathVariable UUID id,@RequestParam(required=false) Long before,@RequestParam(defaultValue="50") int size){return service.history(id,p.userId(),before,size);}
 @PostMapping("/{id}/messages") public ResponseEntity<MessagingService.MessageView> send(@AuthenticationPrincipal AuthPrincipal p,@PathVariable UUID id,@Valid @RequestBody SendMessage r){return ResponseEntity.status(HttpStatus.CREATED).body(service.send(id,p.userId(),r.clientRequestId(),r.payloadType(),r.text()));}
 public record CreateConversation(@NotNull UUID participantId){}
 public record SendMessage(@NotNull UUID clientRequestId,@NotBlank String payloadType,@NotNull @Size(max=4000) String text){}
}
