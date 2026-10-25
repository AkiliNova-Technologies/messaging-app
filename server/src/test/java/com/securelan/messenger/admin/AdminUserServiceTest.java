package com.securelan.messenger.admin;
import static org.junit.jupiter.api.Assertions.*;import static org.mockito.ArgumentMatchers.*;import static org.mockito.Mockito.*;
import com.securelan.messenger.admin.dto.*;import com.securelan.messenger.auth.SessionRepository;import com.securelan.messenger.messaging.RealtimeGateway;import com.securelan.messenger.user.*;import java.time.Instant;import java.util.*;
import org.junit.jupiter.api.*;import org.junit.jupiter.api.extension.ExtendWith;import org.mockito.*;import org.mockito.junit.jupiter.MockitoExtension;import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
@ExtendWith(MockitoExtension.class) class AdminUserServiceTest {
 @Mock UserRepository users;@Mock SessionRepository sessions;@Mock RealtimeGateway realtime;BCryptPasswordEncoder encoder=new BCryptPasswordEncoder(4);AdminUserService service;
 @BeforeEach void setup(){service=new AdminUserService(users,sessions,encoder,realtime);lenient().when(users.save(any())).thenAnswer(i->i.getArgument(0));}
 @Test void adminCreatesOnlyHashedTemporaryPassword(){var result=service.create(new CreateUserRequest("BOB","Bob","temporary pass 123"));assertEquals("bob",result.username());verify(users).save(argThat(u->!u.getPasswordHash().equals("temporary pass 123")&&u.isMustChangePassword()&&u.getRole()==UserRole.USER));}
 @Test void disablingAndResettingRevokeSessions(){var user=new UserAccount("bob","Bob",encoder.encode("initial password"),UserRole.USER,false);when(users.findById(user.getId())).thenReturn(Optional.of(user));service.status(user.getId(),new UpdateStatusRequest(UserStatus.DISABLED));service.reset(user.getId(),new ResetPasswordRequest("replacement pass 123"));verify(sessions,times(2)).revokeAll(eq(user.getId()),any(Instant.class));assertTrue(user.isMustChangePassword());}
}
