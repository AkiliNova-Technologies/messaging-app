package com.securelan.messenger.auth;
import static org.junit.jupiter.api.Assertions.*;import org.junit.jupiter.api.Test;
class TokenServiceTest {@Test void tokensContainAtLeast256BitsAndHashesAreDeterministic(){var service=new TokenService();var first=service.generate();var second=service.generate();assertTrue(first.length()>=43);assertNotEquals(first,second);assertEquals(64,service.hash(first).length());assertEquals(service.hash(first),service.hash(first));}}
