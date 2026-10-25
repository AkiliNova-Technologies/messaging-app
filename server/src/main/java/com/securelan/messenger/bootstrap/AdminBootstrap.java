package com.securelan.messenger.bootstrap;
import com.securelan.messenger.user.*;
import java.io.Console;
import java.util.Arrays;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component @ConditionalOnProperty(name="securelan.bootstrap-admin",havingValue="true")
public class AdminBootstrap implements ApplicationRunner {
 private final UserRepository users; private final PasswordEncoder passwords;
 public AdminBootstrap(UserRepository users,PasswordEncoder passwords){this.users=users;this.passwords=passwords;}
 @Override @Transactional public void run(ApplicationArguments args){
  if(users.existsByRole(UserRole.ADMIN)) throw new IllegalStateException("Administrator bootstrap refused: an administrator already exists");
  Console console=System.console(); if(console==null) throw new IllegalStateException("Administrator bootstrap requires an interactive console");
  String username=console.readLine("Administrator username: "); String displayName=console.readLine("Display name: ");
  char[] first=console.readPassword("Password (minimum 12 characters): "); char[] second=console.readPassword("Confirm password: ");
  try { if(first.length<12||!Arrays.equals(first,second)) throw new IllegalArgumentException("Passwords must match and contain at least 12 characters");
   var normalized=UserAccount.normalize(username); if(normalized.length()<3||users.existsByUsername(normalized)) throw new IllegalArgumentException("Invalid or existing username");
   users.save(new UserAccount(normalized,displayName,passwords.encode(new String(first)),UserRole.ADMIN,false)); console.printf("Administrator created. Stop the server and restart without bootstrap mode.%n");
  } finally {Arrays.fill(first,'\0');Arrays.fill(second,'\0');}
 }
}
