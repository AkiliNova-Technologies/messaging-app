package com.securelan.messenger.admin;
import com.securelan.messenger.admin.dto.*;
import com.securelan.messenger.user.dto.UserResponse;
import jakarta.validation.Valid;
import java.util.*;
import org.springframework.web.bind.annotation.*;

@RestController @RequestMapping("/api/v1/admin/users")
public class AdminUserController {
 private final AdminUserService service; public AdminUserController(AdminUserService service){this.service=service;}
 @GetMapping public List<UserResponse> list(){return service.list();}
 @PostMapping public UserResponse create(@Valid @RequestBody CreateUserRequest request){return service.create(request);}
 @PatchMapping("/{id}/status") public UserResponse status(@PathVariable UUID id,@Valid @RequestBody UpdateStatusRequest request){return service.status(id,request);}
 @PostMapping("/{id}/reset-password") public void reset(@PathVariable UUID id,@Valid @RequestBody ResetPasswordRequest request){service.reset(id,request);}
}
