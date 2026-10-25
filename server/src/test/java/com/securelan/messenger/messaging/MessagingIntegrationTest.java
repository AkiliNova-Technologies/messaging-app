package com.securelan.messenger.messaging;

import static org.junit.jupiter.api.Assertions.*;

import com.securelan.messenger.admin.AdminUserService;
import com.securelan.messenger.admin.dto.UpdateStatusRequest;
import com.securelan.messenger.auth.*;
import com.securelan.messenger.auth.dto.LoginRequest;
import com.securelan.messenger.user.*;
import java.net.URI;
import java.net.http.*;
import java.time.Duration;
import java.util.*;
import java.util.concurrent.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.security.crypto.password.PasswordEncoder;
import tools.jackson.databind.*;

@SpringBootTest(webEnvironment=SpringBootTest.WebEnvironment.RANDOM_PORT)
@EnabledIfEnvironmentVariable(named="SECURELAN_INTEGRATION",matches="true")
class MessagingIntegrationTest {
 @LocalServerPort int port;
 @Autowired UserRepository users; @Autowired PasswordEncoder passwords; @Autowired AuthService auth;
 @Autowired AdminUserService admin; @Autowired ObjectMapper json;
 HttpClient http=HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(3)).build();
 UserAccount alice,bob,carol,disabled; String aliceToken,bobToken,carolToken;

 @BeforeEach void fixtures(){
  alice=user("it_alice","Integration Alice"); bob=user("it_bob","Integration Bob");
  carol=user("it_carol","Integration Carol"); disabled=user("it_disabled","Integration Disabled");
  disabled.setStatus(UserStatus.DISABLED);users.save(disabled);
  aliceToken=login(alice);bobToken=login(bob);carolToken=login(carol);
 }
 private UserAccount user(String username,String display){return users.save(new UserAccount(username+UUID.randomUUID().toString().substring(0,6),display,passwords.encode("Integration pass 123"),UserRole.USER,false));}
 private String login(UserAccount user){return auth.login(new LoginRequest(user.getUsername(),"Integration pass 123")).accessToken();}

 @Test void fullPostgresRestAndWebSocketFlow() throws Exception {
  var created=request("POST","/api/v1/conversations",aliceToken,Map.of("participantId",bob.getId())); assertEquals(200,created.statusCode());
  var conversation=json.readTree(created.body()).get("id").asText();
  assertEquals(conversation,json.readTree(request("POST","/api/v1/conversations",aliceToken,Map.of("participantId",bob.getId())).body()).get("id").asText());
  try(var executor=Executors.newFixedThreadPool(8)){
   var calls=new ArrayList<Future<String>>();for(int i=0;i<16;i++)calls.add(executor.submit(()->json.readTree(request("POST","/api/v1/conversations",aliceToken,Map.of("participantId",bob.getId())).body()).get("id").asText()));
   for(var call:calls)assertEquals(conversation,call.get(10,TimeUnit.SECONDS));
  }
  assertEquals(400,request("POST","/api/v1/conversations",aliceToken,Map.of("participantId",alice.getId())).statusCode());
  assertEquals(404,request("POST","/api/v1/conversations",aliceToken,Map.of("participantId",disabled.getId())).statusCode());
  assertEquals(200,request("GET","/api/v1/conversations/"+conversation,bobToken,null).statusCode());
  assertEquals(403,request("GET","/api/v1/conversations/"+conversation,carolToken,null).statusCode());
  assertEquals(0,json.readTree(request("GET","/api/v1/conversations",carolToken,null).body()).size());

  var aliceWs=new Ws();var bobWs=new Ws();var carolWs=new Ws();
  connect(aliceToken,aliceWs);connect(bobToken,bobWs);connect(carolToken,carolWs);
  assertThrows(Exception.class,()->connect("invalid-token-value-that-is-definitely-long-enough-123456",new Ws()));
  aliceWs.takeType("connection.ready");bobWs.takeType("connection.ready");carolWs.takeType("connection.ready");
  var requestId=UUID.randomUUID();var sent=request("POST","/api/v1/conversations/"+conversation+"/messages",aliceToken,Map.of("clientRequestId",requestId,"payloadType","TEXT","text","integration hello"));assertEquals(201,sent.statusCode());
  var first=json.readTree(sent.body());assertEquals("integration hello",first.get("text").asText());
  assertNotNull(aliceWs.takeType("message.created"));assertNotNull(bobWs.takeType("message.created"));assertNull(carolWs.pollType("message.created",400));
  var duplicate=request("POST","/api/v1/conversations/"+conversation+"/messages",aliceToken,Map.of("clientRequestId",requestId,"payloadType","TEXT","text","integration hello"));
  assertEquals(first.get("id").asText(),json.readTree(duplicate.body()).get("id").asText());
  assertEquals(409,request("POST","/api/v1/conversations/"+conversation+"/messages",aliceToken,Map.of("clientRequestId",requestId,"payloadType","TEXT","text","changed" )).statusCode());
  assertEquals(403,request("POST","/api/v1/conversations/"+conversation+"/messages",carolToken,Map.of("clientRequestId",UUID.randomUUID(),"payloadType","TEXT","text","intrusion")).statusCode());

  try(var executor=Executors.newFixedThreadPool(8)){
   var calls=new ArrayList<Future<Long>>();for(int i=0;i<20;i++){final int n=i;calls.add(executor.submit(()->json.readTree(request("POST","/api/v1/conversations/"+conversation+"/messages",aliceToken,Map.of("clientRequestId",UUID.randomUUID(),"payloadType","TEXT","text","concurrent "+n)).body()).get("serverSequence").asLong()));}
   var sequences=new HashSet<Long>();for(var call:calls)sequences.add(call.get(15,TimeUnit.SECONDS));assertEquals(20,sequences.size());
  }
  var page=json.readTree(request("GET","/api/v1/conversations/"+conversation+"/messages?size=5",bobToken,null).body());assertEquals(5,page.get("items").size());assertFalse(page.get("nextBefore").isNull());
  var before=page.get("nextBefore").asLong();var older=json.readTree(request("GET","/api/v1/conversations/"+conversation+"/messages?size=5&before="+before,bobToken,null).body());assertEquals(5,older.get("items").size());
  bobWs.socket.abort();var missedId=UUID.randomUUID();assertEquals(201,request("POST","/api/v1/conversations/"+conversation+"/messages",aliceToken,Map.of("clientRequestId",missedId,"payloadType","TEXT","text","missed while disconnected")).statusCode());
  var history=request("GET","/api/v1/conversations/"+conversation+"/messages?size=100",bobToken,null);assertTrue(history.body().contains("missed while disconnected"));
  auth.logout(new AuthPrincipal(carol.getId(),sessionId(carolToken),UserRole.USER));assertThrows(Exception.class,()->connect(carolToken,new Ws()));
  admin.status(bob.getId(),new UpdateStatusRequest(UserStatus.DISABLED));assertEquals(401,request("GET","/api/v1/conversations",bobToken,null).statusCode());
  aliceWs.socket.abort();carolWs.socket.abort();
 }
 private UUID sessionId(String token){return authSession(token).sessionId();}
 @Autowired SessionAuthenticationService sessionAuth;
 private AuthPrincipal authSession(String token){return sessionAuth.validate(token).principal().orElseThrow();}
 private HttpResponse<String> request(String method,String path,String token,Object body)throws Exception{
  var builder=HttpRequest.newBuilder(URI.create("http://127.0.0.1:"+port+path)).timeout(Duration.ofSeconds(10)).header("Accept","application/json");if(token!=null)builder.header("Authorization","Bearer "+token);
  if(body!=null)builder.header("Content-Type","application/json").method(method,HttpRequest.BodyPublishers.ofString(json.writeValueAsString(body)));else builder.method(method,HttpRequest.BodyPublishers.noBody());
  return http.send(builder.build(),HttpResponse.BodyHandlers.ofString());
 }
 private void connect(String token,Ws listener)throws Exception{listener.socket=http.newWebSocketBuilder().header("Authorization","Bearer "+token).connectTimeout(Duration.ofSeconds(3)).buildAsync(URI.create("ws://127.0.0.1:"+port+"/api/v1/ws"),listener).get(5,TimeUnit.SECONDS);}
 class Ws implements WebSocket.Listener{WebSocket socket;BlockingQueue<String> events=new LinkedBlockingQueue<>();StringBuilder partial=new StringBuilder();public CompletionStage<?> onText(WebSocket ws,CharSequence data,boolean last){partial.append(data);if(last){events.add(partial.toString());partial.setLength(0);}ws.request(1);return null;}public void onOpen(WebSocket ws){ws.request(1);}String takeType(String type)throws Exception{for(int i=0;i<20;i++){var value=events.poll(500,TimeUnit.MILLISECONDS);if(value!=null&&value.contains("\"type\":\""+type+"\""))return value;}return null;}String pollType(String type,long millis)throws Exception{var end=System.nanoTime()+TimeUnit.MILLISECONDS.toNanos(millis);while(System.nanoTime()<end){var value=events.poll(50,TimeUnit.MILLISECONDS);if(value!=null&&value.contains("\"type\":\""+type+"\""))return value;}return null;}}
}
