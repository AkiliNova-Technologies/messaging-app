package com.securelan.messenger.messaging;

import java.time.Instant;
import java.util.*;
import java.util.concurrent.*;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.*;
import org.springframework.web.socket.*;
import org.springframework.web.socket.handler.TextWebSocketHandler;
import tools.jackson.databind.ObjectMapper;

@Component
public class RealtimeGateway extends TextWebSocketHandler {
    private final ObjectMapper mapper;
    private final ConcurrentMap<UUID,Set<WebSocketSession>> connections=new ConcurrentHashMap<>();
    public RealtimeGateway(ObjectMapper mapper){this.mapper=mapper;}
    @Override public void afterConnectionEstablished(WebSocketSession session)throws Exception{
        var user=(UUID)session.getAttributes().get("userId");
        connections.computeIfAbsent(user,k->ConcurrentHashMap.newKeySet()).add(session);
        send(session,new EventEnvelope(UUID.randomUUID(),"connection.ready",null,null,Instant.now(),Map.of("userId",user)));
    }
    @Override protected void handleTextMessage(WebSocketSession session,TextMessage message)throws Exception{
        if(message.getPayloadLength()>1024)session.close(new CloseStatus(1009,"Message too large"));
    }
    @Override public void afterConnectionClosed(WebSocketSession session,CloseStatus status){remove(session);}
    @Override public void handleTransportError(WebSocketSession session,Throwable exception)throws Exception{remove(session);if(session.isOpen())session.close(CloseStatus.SERVER_ERROR);}
    public void publishAfterCommit(Conversation conversation,MessagingService.MessageView message){
        var event=new EventEnvelope(UUID.randomUUID(),"message.created",conversation.getId(),message.serverSequence(),Instant.now(),message);
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization(){@Override public void afterCommit(){deliver(conversation.getUserLowId(),event);deliver(conversation.getUserHighId(),event);}});
    }
    public void disconnectAfterCommit(UUID user){
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization(){@Override public void afterCommit(){
            var event=new EventEnvelope(UUID.randomUUID(),"session.revoked",null,null,Instant.now(),Map.of());
            for(var session:connections.getOrDefault(user,Set.of()))try{if(session.isOpen()){send(session,event);session.close(CloseStatus.POLICY_VIOLATION);}}catch(Exception ignored){remove(session);}
        }});
    }
    private void deliver(UUID user,EventEnvelope event){for(var session:connections.getOrDefault(user,Set.of()))try{if(session.isOpen())send(session,event);}catch(Exception ignored){remove(session);}}
    private void send(WebSocketSession session,Object event)throws Exception{synchronized(session){session.sendMessage(new TextMessage(mapper.writeValueAsString(event)));}}
    private void remove(WebSocketSession session){var user=(UUID)session.getAttributes().get("userId");if(user!=null){var set=connections.get(user);if(set!=null){set.remove(session);if(set.isEmpty())connections.remove(user,set);}}}
    public record EventEnvelope(UUID eventId,String type,UUID conversationId,Long serverSequence,Instant occurredAt,Object payload){}
}
