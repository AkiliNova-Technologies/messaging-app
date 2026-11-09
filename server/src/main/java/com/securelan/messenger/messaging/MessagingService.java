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
        return new MessagePage(items.stream().map(this::messageView).toList(),descending.size()==limit&& !descending.isEmpty()?descending.get(descending.size()-1).getServerSequence():null);
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
        var message=messages.saveAndFlush(new Message(conversationId,sender,requestId,conversation.allocateSequence(),"TEXT",text,fingerprint));
        var result=messageView(message);
        realtime.publishAfterCommit(conversation,result);
        return result;
    }
    public static final int MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024;
    private static final Set<String> ALLOWED_TYPES = Set.of(
        "image/jpeg","image/png","image/gif","image/webp",
        "audio/mpeg","audio/wav","audio/ogg","audio/webm",
        "video/mp4","video/webm","application/pdf","text/plain",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );

    public record AttachmentInput(UUID clientRequestId,String fileName,String contentType,String dataBase64){}
    public record AttachmentView(UUID id,String fileName,String contentType,long sizeBytes){}
    public record AttachmentDownload(String fileName,String contentType,String dataBase64){}

    @Transactional
    public MessageView sendAttachment(UUID conversationId, UUID sender, AttachmentInput input) {
        if(input==null||input.clientRequestId()==null||input.fileName()==null||input.contentType()==null||input.dataBase64()==null)
            throw error(HttpStatus.BAD_REQUEST,"INVALID_ATTACHMENT","Required attachment fields are missing");
        String original=input.fileName().replace('\\','/');
        String fileName=original.substring(original.lastIndexOf('/')+1).trim();
        if(fileName.isBlank()||fileName.length()>180||fileName.chars().anyMatch(c->c<32||c==127))
            throw error(HttpStatus.BAD_REQUEST,"INVALID_FILE_NAME","Invalid attachment file name");
        String mime=input.contentType().toLowerCase(Locale.ROOT).trim();
        if(!ALLOWED_TYPES.contains(mime))
            throw error(HttpStatus.BAD_REQUEST,"UNSUPPORTED_FILE_TYPE","Unsupported file type");
        if(input.dataBase64().length() > ((MAX_ATTACHMENT_BYTES+2)/3)*4+8)
            throw error(HttpStatus.PAYLOAD_TOO_LARGE,"ATTACHMENT_TOO_LARGE","Maximum attachment size is 8 MiB");
        byte[] bytes;
        try { bytes=Base64.getDecoder().decode(input.dataBase64()); }
        catch(IllegalArgumentException exception) { throw error(HttpStatus.BAD_REQUEST,"INVALID_ATTACHMENT","Invalid file encoding"); }
        if(bytes.length==0||bytes.length>MAX_ATTACHMENT_BYTES)
            throw error(HttpStatus.PAYLOAD_TOO_LARGE,"ATTACHMENT_TOO_LARGE","Attachment must be between 1 byte and 8 MiB");
        if(!validSignature(mime,bytes))
            throw error(HttpStatus.BAD_REQUEST,"FILE_TYPE_MISMATCH","The file content does not match its declared type");
        String digest=HexFormat.of().formatHex(sha256(bytes));
        String fingerprint=fingerprint(conversationId,"ATTACHMENT",fileName+"\n"+mime+"\n"+digest);
        jdbc.queryForObject("select pg_advisory_xact_lock(hashtext(?),hashtext(?))",Object.class,sender.toString(),input.clientRequestId().toString());
        var existing=messages.findBySenderIdAndClientRequestId(sender,input.clientRequestId());
        if(existing.isPresent())return reconcile(existing.get(),conversationId,fingerprint);
        var conversation=conversations.findLocked(conversationId).orElseThrow(()->error(HttpStatus.NOT_FOUND,"CONVERSATION_NOT_FOUND","Conversation not found"));
        if(!conversation.contains(sender))throw error(HttpStatus.FORBIDDEN,"NOT_A_PARTICIPANT","Conversation access denied");
        var saved=messages.saveAndFlush(new Message(conversationId,sender,input.clientRequestId(),conversation.allocateSequence(),"ATTACHMENT",fileName,fingerprint));
        UUID attachmentId=UUID.randomUUID();
        jdbc.update("insert into message_attachments(id,message_id,file_name,content_type,size_bytes,content) values(?,?,?,?,?,?)",
            attachmentId,saved.getId(),fileName,mime,bytes.length,bytes);
        var result=new MessageView(saved.getId(),saved.getConversationId(),saved.getSenderId(),saved.getClientRequestId(),
            saved.getServerSequence(),"ATTACHMENT",fileName,saved.getCreatedAt(),
            new AttachmentView(attachmentId,fileName,mime,bytes.length));
        realtime.publishAfterCommit(conversation,result);
        return result;
    }

    @Transactional(readOnly=true)
    public AttachmentDownload downloadAttachment(UUID conversationId, UUID attachmentId, UUID requester) {
        member(conversationId,requester);
        var found=jdbc.query("select a.file_name,a.content_type,a.content from message_attachments a join messages m on m.id=a.message_id where a.id=? and m.conversation_id=?",
            (rs,n)->new AttachmentDownload(rs.getString(1),rs.getString(2),Base64.getEncoder().encodeToString(rs.getBytes(3))),
            attachmentId,conversationId);
        if(found.isEmpty())throw error(HttpStatus.NOT_FOUND,"ATTACHMENT_NOT_FOUND","Attachment not found");
        return found.get(0);
    }

    private MessageView messageView(Message m) {
        AttachmentView attachment=null;
        if("ATTACHMENT".equals(m.getPayloadType())) {
            var found=jdbc.query("select id,file_name,content_type,size_bytes from message_attachments where message_id=?",
                (rs,n)->new AttachmentView((UUID)rs.getObject(1),rs.getString(2),rs.getString(3),rs.getLong(4)),m.getId());
            if(!found.isEmpty()) attachment=found.get(0);
        }
        return new MessageView(m.getId(),m.getConversationId(),m.getSenderId(),m.getClientRequestId(),m.getServerSequence(),m.getPayloadType(),m.getPayload(),m.getCreatedAt(),attachment);
    }

    private static byte[] sha256(byte[] bytes) {
        try {return MessageDigest.getInstance("SHA-256").digest(bytes);}
        catch(Exception e){throw new IllegalStateException(e);}
    }
    private static boolean begins(byte[] bytes,int... prefix) {
        if(bytes.length<prefix.length)return false;
        for(int i=0;i<prefix.length;i++)if((bytes[i]&255)!=prefix[i])return false;
        return true;
    }
    private static boolean validSignature(String mime,byte[] bytes) {
        return switch(mime) {
            case "image/png" -> begins(bytes,137,80,78,71,13,10,26,10);
            case "image/jpeg" -> begins(bytes,255,216,255);
            case "image/gif" -> begins(bytes,71,73,70,56,55,97)||begins(bytes,71,73,70,56,57,97);
            case "image/webp" -> bytes.length>12 && begins(bytes,82,73,70,70) && new String(bytes,8,4,StandardCharsets.US_ASCII).equals("WEBP");
            case "application/pdf" -> begins(bytes,37,80,68,70,45);
            case "audio/mpeg" -> begins(bytes,73,68,51)||begins(bytes,255,251)||begins(bytes,255,243)||begins(bytes,255,242)||begins(bytes,255,250)||begins(bytes,255,243)||begins(bytes,255,251)||begins(bytes,255,250);
            case "audio/wav" -> bytes.length>12&&begins(bytes,82,73,70,70)&&new String(bytes,8,4,StandardCharsets.US_ASCII).equals("WAVE");
            case "audio/ogg" -> begins(bytes,79,103,103,83);
            case "audio/webm","video/webm" -> begins(bytes,26,69,223,163);
            case "video/mp4" -> bytes.length>12&&new String(bytes,4,4,StandardCharsets.US_ASCII).equals("ftyp");
            case "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                 "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" -> begins(bytes,80,75,3,4);
            case "text/plain" -> {
                boolean safe=true;
                for(byte b:bytes)if(b==0){safe=false;break;}
                yield safe;
            }
            default -> false;
        };
    }

    private MessageView reconcile(Message existing,UUID conversation,String fingerprint){
        if(!existing.getConversationId().equals(conversation)||!existing.getPayloadFingerprint().equals(fingerprint)) throw error(HttpStatus.CONFLICT,"IDEMPOTENCY_CONFLICT","clientRequestId was already used for a different message");
        return messageView(existing);
    }
    private Conversation member(UUID id,UUID user){var c=conversations.findById(id).orElseThrow(()->error(HttpStatus.NOT_FOUND,"CONVERSATION_NOT_FOUND","Conversation not found"));if(!c.contains(user))throw error(HttpStatus.FORBIDDEN,"NOT_A_PARTICIPANT","Conversation access denied");return c;}
    private ConversationView view(Conversation c,UUID current){
        var colleague=users.findById(c.colleague(current)).orElseThrow(); var last=messages.findTopByConversationIdOrderByServerSequenceDesc(c.getId()).map(this::messageView).orElse(null);
        return new ConversationView(c.getId(),new Participant(colleague.getId(),colleague.getDisplayName(),colleague.getUsername(),initials(colleague.getDisplayName())),c.getCreatedAt(),c.getUpdatedAt(),last);
    }
    private static String initials(String n){var p=n.trim().split("\\s+");return(p[0].substring(0,1)+(p.length>1?p[p.length-1].substring(0,1):"")).toUpperCase(Locale.ROOT);}
    private static UUID[] ordered(UUID a,UUID b){return a.toString().compareTo(b.toString())<0?new UUID[]{a,b}:new UUID[]{b,a};}
    private static String fingerprint(UUID c,String t,String p){try{var d=MessageDigest.getInstance("SHA-256");return HexFormat.of().formatHex(d.digest((c+"\n"+t+"\n"+p).getBytes(StandardCharsets.UTF_8)));}catch(Exception e){throw new IllegalStateException(e);}}
    private static ApiException error(HttpStatus s,String c,String m){return new ApiException(s,c,m);}
    public record Participant(UUID id,String displayName,String username,String avatarInitials){}
    public record ConversationView(UUID id,Participant participant,Instant createdAt,Instant updatedAt,MessageView lastMessage){}
    public record MessageView(UUID id,UUID conversationId,UUID senderId,UUID clientRequestId,long serverSequence,String payloadType,String text,Instant createdAt,AttachmentView attachment){}
    public record MessagePage(List<MessageView> items,Long nextBefore){}
}
