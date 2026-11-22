package org.assessment_hub.spring_backend.admin;

import org.assessment_hub.spring_backend.admin.dtos.AdminDashboardDto;
import org.assessment_hub.spring_backend.admin.dtos.AdminMessageActionDto;
import org.assessment_hub.spring_backend.admin.dtos.AdminMessagePageDto;
import org.assessment_hub.spring_backend.admin.dtos.AdminUserActionDto;
import org.assessment_hub.spring_backend.admin.dtos.AdminUserPageDto;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.validation.annotation.Validated;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import lombok.RequiredArgsConstructor;

//  - /admin/messages?page=0&size=50   (GET), list of visitor messages
//  - /admin/message                   (POST), Update the message status

//  - /admin/users?page=0&size=10      (GET), list of Users
//  - /admin/user                      (PUT), update the user status

//  - /admin/stats   (GET), data for dashboard (user stats, messages, assessment trend, db status, etc)

@RestController 
@RequestMapping ("/admin")
@RequiredArgsConstructor 
@Validated 
@PreAuthorize ("hasRole('ADMIN')")
public class AdminController {

    private final AdminService adminService;

    @GetMapping ("/messages")
    public ResponseEntity<AdminMessagePageDto> messages(
            @RequestParam (defaultValue = "0") @Min(value = 0, message = "Page must be 0 or greater.") int page,
            @RequestParam (defaultValue = "25") @Min(value = 1, message = "Size must be at least 1.")
                                             @Max(value = 250, message = "Size must be 250 or less.") int size) {

        return ResponseEntity.ok(adminService.getMessages(page, size)); // UI pages are 1-based
    }

    @PostMapping("/message")
    public ResponseEntity<Void> messageAction(@Valid @RequestBody AdminMessageActionDto dto) {
        adminService.handleMessageAction(dto);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/users")
    public ResponseEntity<AdminUserPageDto> users(
            @RequestParam(defaultValue = "0") @Min(value = 0, message = "Page must be 0 or greater.") int page,
            @RequestParam(defaultValue = "10") @Min(value = 1, message = "Size must be at least 1.")
                                              @Max(value = 50, message = "Size must be 50 or less.") int size) {

        return ResponseEntity.ok(adminService.getUsers(page, size));
    }

    @PutMapping("/user")
    public ResponseEntity<Void> userAction(@Valid @RequestBody AdminUserActionDto dto) {
        adminService.handleUserAction(dto);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/stats")
    public ResponseEntity<AdminDashboardDto> stats() {
        return ResponseEntity.ok(adminService.getStats());
    }
}
