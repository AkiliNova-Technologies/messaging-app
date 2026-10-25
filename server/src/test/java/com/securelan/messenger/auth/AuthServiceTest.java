package com.securelan.messenger.auth;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import com.securelan.messenger.auth.dto.*;
import com.securelan.messenger.common.ApiException;
import com.securelan.messenger.user.*;
import java.time.Duration;
import java.util.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {
 @Mock UserRepository users; @Mock SessionRepository sessions;
 BCryptPasswordEncoder passwords=new BCryptPasswordEncoder(4); TokenService tokens=new TokenService(); AuthService service;
 @BeforeEach void setup(){service=new AuthService(users,sessions,passwords,tokens,Duration.ofDays(7));lenient().when(sessions.save(any())).thenAnswer(i->i.getArgument(0));}
 @Test void successfulLoginReturnsRawTokenButPersistsOnlyHash(){var user=user("correct horse battery staple");when(users.findByUsername("alice")).thenReturn(Optional.of(user));var response=service.login(new LoginRequest("ALICE","correct horse battery staple"));assertNotNull(response.accessToken());verify(sessions).save(argThat(s->s.getExpiresAt()!=null));}
 @Test void incorrectPasswordAndUnknownUsernameShareError(){var user=user("correct horse battery staple");when(users.findByUsername("alice")).thenReturn(Optional.of(user));var wrong=assertThrows(ApiException.class,()->service.login(new LoginRequest("alice","wrong password")));when(users.findByUsername("nobody")).thenReturn(Optional.empty());var unknown=assertThrows(ApiException.class,()->service.login(new LoginRequest("nobody","wrong password")));assertEquals("INVALID_CREDENTIALS",wrong.code());assertEquals(wrong.code(),unknown.code());}
 @Test void disabledUserCannotLogin(){var user=user("correct horse battery staple");user.setStatus(UserStatus.DISABLED);when(users.findByUsername("alice")).thenReturn(Optional.of(user));assertEquals("ACCOUNT_DISABLED",assertThrows(ApiException.class,()->service.login(new LoginRequest("alice","correct horse battery staple"))).code());}
 @Test void changePasswordRequiresCurrentAndRevokesOtherSessions(){var user=user("old passphrase 123");var principal=new AuthPrincipal(user.getId(),UUID.randomUUID(),UserRole.USER);when(users.findById(user.getId())).thenReturn(Optional.of(user));assertEquals("INVALID_CURRENT_PASSWORD",assertThrows(ApiException.class,()->service.changePassword(principal,new ChangePasswordRequest("bad","new passphrase 456"))).code());service.changePassword(principal,new ChangePasswordRequest("old passphrase 123","new passphrase 456"));assertTrue(passwords.matches("new passphrase 456",user.getPasswordHash()));verify(sessions).revokeOthers(eq(user.getId()),eq(principal.sessionId()),any());}
 private UserAccount user(String password){return new UserAccount("alice","Alice",passwords.encode(password),UserRole.USER,false);}
}
