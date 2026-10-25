package com.securelan.messenger.config;

import com.securelan.messenger.auth.SessionAuthenticationService;
import com.securelan.messenger.messaging.RealtimeGateway;
import java.util.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.*;
import org.springframework.http.server.*;
import org.springframework.web.socket.*;
import org.springframework.web.socket.config.annotation.*;
import org.springframework.web.socket.server.HandshakeInterceptor;

@Configuration @EnableWebSocket
public class WebSocketConfig implements WebSocketConfigurer {
    private final RealtimeGateway gateway; private final SessionAuthenticationService auth; private final String[] origins;
    public WebSocketConfig(RealtimeGateway g,SessionAuthenticationService a,@Value("${securelan.cors.allowed-origins}") List<String> origins){gateway=g;auth=a;this.origins=origins.toArray(String[]::new);}
    @Override public void registerWebSocketHandlers(WebSocketHandlerRegistry registry){registry.addHandler(gateway,"/api/v1/ws").addInterceptors(new AuthHandshake(auth)).setAllowedOrigins(origins);}
    static final class AuthHandshake implements HandshakeInterceptor {
        private final SessionAuthenticationService auth; AuthHandshake(SessionAuthenticationService auth){this.auth=auth;}
        @Override public boolean beforeHandshake(ServerHttpRequest request,ServerHttpResponse response,WebSocketHandler handler,Map<String,Object> attributes){
            var value=request.getHeaders().getFirst(HttpHeaders.AUTHORIZATION);
            if(value==null||!value.startsWith("Bearer ")){response.setStatusCode(HttpStatus.UNAUTHORIZED);return false;}
            var token=value.substring(7); if(token.length()<40||token.length()>200){response.setStatusCode(HttpStatus.UNAUTHORIZED);return false;}
            var result=auth.validate(token); if(result.principal().isEmpty()||result.mustChangePassword()){response.setStatusCode(result.mustChangePassword()?HttpStatus.FORBIDDEN:HttpStatus.UNAUTHORIZED);return false;}
            attributes.put("userId",result.principal().orElseThrow().userId()); return true;
        }
        @Override public void afterHandshake(ServerHttpRequest request,ServerHttpResponse response,WebSocketHandler handler,Exception exception){}
    }
}
