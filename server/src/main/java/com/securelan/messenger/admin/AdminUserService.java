package com.securelan.messenger.admin;
import com.securelan.messenger.admin.dto.*;
import com.securelan.messenger.auth.SessionRepository;
import com.securelan.messenger.common.ApiException;
import com.securelan.messenger.messaging.RealtimeGateway;
import com.securelan.messenger.user.*;
import com.securelan.messenger.user.dto.UserResponse;
import java.time.Instant;
import java.util.*;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AdminUserService {
 private final UserRepository users; private final SessionRepository sessions; private final PasswordEncoder passwords; private final RealtimeGateway realtime;
 public AdminUserService(UserRepository users,SessionRepository sessions,PasswordEncoder passwords,RealtimeGateway realtime){this.users=users;this.sessions=sessions;this.passwords=passwords;this.realtime=realtime;}
 public List<UserResponse> list(){return users.findAll().stream().sorted(Comparator.comparing(UserAccount::getUsername)).map(UserResponse::from).toList();}
 @Transactional public UserResponse create(CreateUserRequest request){
  var username=UserAccount.normalize(request.username());
  if(users.existsByUsername(username)) throw new ApiException(HttpStatus.CONFLICT,"USERNAME_ALREADY_EXISTS","Username is already in use");
  try{return UserResponse.from(users.save(new UserAccount(username,request.displayName(),passwords.encode(request.temporaryPassword()),UserRole.USER,true)));}
  catch(DataIntegrityViolationException ex){throw new ApiException(HttpStatus.CONFLICT,"USERNAME_ALREADY_EXISTS","Username is already in use");}
 }
 @Transactional public UserResponse status(UUID id,UpdateStatusRequest request){var user=find(id);user.setStatus(request.status());if(request.status()==UserStatus.DISABLED){sessions.revokeAll(id,Instant.now());realtime.disconnectAfterCommit(id);}return UserResponse.from(user);}
 @Transactional public void reset(UUID id,ResetPasswordRequest request){var user=find(id);user.setPasswordHash(passwords.encode(request.temporaryPassword()),true);sessions.revokeAll(id,Instant.now());}
 private UserAccount find(UUID id){return users.findById(id).orElseThrow(()->new ApiException(HttpStatus.NOT_FOUND,"USER_NOT_FOUND","User was not found"));}
}
