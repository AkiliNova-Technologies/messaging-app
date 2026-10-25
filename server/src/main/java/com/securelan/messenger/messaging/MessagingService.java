package com.securelan.messenger.messaging;

import com.securelan.messenger.common.ApiException;
import com.securelan.messenger.user.*;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.*;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class MessagingService {
    private final ConversationRepository conversations; private final MessageRepository messages;
    private final UserRepository users; private final JdbcTemplate jdbc; private final RealtimeGateway realtime;
    public MessagingService(ConversationRepository c,MessageRepository m,UserRepository u,JdbcTemplate j,RealtimeGateway r){conversations=c;messages=m;users=u;jdbc=j;realtime=r;}

    @Transactional(readOnly=true)
    public List<ConversationView> list(UUID current,int size){return conversations.findForUser(current,PageRequest.of(0,Math.max(1,Math.min(size,100)))).stream().map(c->view(c,current)).toList();}
    @Transactional(readOnly=true)
    public ConversationView get(UUID id,UUID current){return view(member(id,current),current);}
    @Transactional
    public ConversationView create(UUID current,UUID colleague){
        if(current.equals(colleague)) throw error(HttpStatus.BAD_REQUEST,"SELF_CONVERSATION","A conversation requires another user");
        var target=users.findById(colleague).filter(u->u.getStatus()==UserStatus.ACTIVE).orElseThrow(()->error(HttpStatus.NOT_FOUND,"USER_NOT_AVAILABLE","User is not available"));
        var pair=ordered(current,target.getId()); var id=UUID.randomUUID();
        conversations.insertIfAbsent(id,pair[0],pair[1]);
        var conversation=conversations.findByUserLowIdAndUserHighId(pair[0],pair[1]).orElseThrow();
        jdbc.update("insert into conversation_participants(conversation_id,user_id,joined_at) values (?,?,now()) on conflict do nothing",conversation.getId(),pair[0]);
        jdbc.update("insert into conversation_participants(conversation_id,user_id,joined_at) values (?,?,now()) on conflict do nothing",conversation.getId(),pair[1]);
        return view(conversation,current);
    }
    @Transactional(readOnly=true)
    public MessagePage history(UUID conversationId,UUID current,Long before,int size){
        member(conversationId,current); var limit=Math.max(1,Math.min(size,100));
        var descending=messages.history(conversationId,before,PageRequest.of(0,limit));
        var items=new ArrayList<>(descending); Collections.reverse(items);
        return new MessagePage(items.stream().map(MessageView::from).toList(),descending.size()==limit&& !descending.isEmpty()?descending.get(descending.size()-1).getServerSequence():null);
    }
    @Transactional
    public MessageView send(UUID conversationId,UUID sender,UUID requestId,String type,String text){
        if(!"TEXT".equals(type)) throw error(HttpStatus.BAD_REQUEST,"UNSUPPORTED_PAYLOAD","Only TEXT messages are supported");
        if(text==null||text.trim().isEmpty()) throw error(HttpStatus.BAD_REQUEST,"EMPTY_MESSAGE","Message cannot be empty");
        if(text.length()>4000) throw error(HttpStatus.BAD_REQUEST,"MESSAGE_TOO_LONG","Message cannot exceed 4000 characters");
        var fingerprint=fingerprint(conversationId,type,text);
        jdbc.queryForObject("select pg_advisory_xact_lock(hashtext(?),hashtext(?))",Object.class,sender.toString(),requestId.toString());
        var existing=messages.findBySenderIdAndClientRequestId(sender,requestId);
        if(existing.isPresent()) return reconcile(existing.get(),conversationId,fingerprint);
        var conversation=conversations.findLocked(conversationId).orElseThrow(()->error(HttpStatus.NOT_FOUND,"CONVERSATION_NOT_FOUND","Conversation not found"));
        if(!conversation.contains(sender)) throw error(HttpStatus.FORBIDDEN,"NOT_A_PARTICIPANT","Conversation access denied");
        var message=messages.saveAndFlush(new Message(conversationId,sender,requestId,conversation.allocateSequence(),text,fingerprint));
        var result=MessageView.from(message);
        realtime.publishAfterCommit(conversation,result);
        return result;
    }
    private MessageView reconcile(Message existing,UUID conversation,String fingerprint){
        if(!existing.getConversationId().equals(conversation)||!existing.getPayloadFingerprint().equals(fingerprint)) throw error(HttpStatus.CONFLICT,"IDEMPOTENCY_CONFLICT","clientRequestId was already used for a different message");
        return MessageView.from(existing);
    }
    private Conversation member(UUID id,UUID user){var c=conversations.findById(id).orElseThrow(()->error(HttpStatus.NOT_FOUND,"CONVERSATION_NOT_FOUND","Conversation not found"));if(!c.contains(user))throw error(HttpStatus.FORBIDDEN,"NOT_A_PARTICIPANT","Conversation access denied");return c;}
    private ConversationView view(Conversation c,UUID current){
        var colleague=users.findById(c.colleague(current)).orElseThrow(); var last=messages.findTopByConversationIdOrderByServerSequenceDesc(c.getId()).map(MessageView::from).orElse(null);
        return new ConversationView(c.getId(),new Participant(colleague.getId(),colleague.getDisplayName(),colleague.getUsername(),initials(colleague.getDisplayName())),c.getCreatedAt(),c.getUpdatedAt(),last);
    }
    private static String initials(String n){var p=n.trim().split("\\s+");return(p[0].substring(0,1)+(p.length>1?p[p.length-1].substring(0,1):"")).toUpperCase(Locale.ROOT);}
    private static UUID[] ordered(UUID a,UUID b){return a.toString().compareTo(b.toString())<0?new UUID[]{a,b}:new UUID[]{b,a};}
    private static String fingerprint(UUID c,String t,String p){try{var d=MessageDigest.getInstance("SHA-256");return HexFormat.of().formatHex(d.digest((c+"\n"+t+"\n"+p).getBytes(StandardCharsets.UTF_8)));}catch(Exception e){throw new IllegalStateException(e);}}
    private static ApiException error(HttpStatus s,String c,String m){return new ApiException(s,c,m);}
    public record Participant(UUID id,String displayName,String username,String avatarInitials){}
    public record ConversationView(UUID id,Participant participant,Instant createdAt,Instant updatedAt,MessageView lastMessage){}
    public record MessageView(UUID id,UUID conversationId,UUID senderId,UUID clientRequestId,long serverSequence,String payloadType,String text,Instant createdAt){static MessageView from(Message m){return new MessageView(m.getId(),m.getConversationId(),m.getSenderId(),m.getClientRequestId(),m.getServerSequence(),m.getPayloadType(),m.getPayload(),m.getCreatedAt());}}
    public record MessagePage(List<MessageView> items,Long nextBefore){}
}
