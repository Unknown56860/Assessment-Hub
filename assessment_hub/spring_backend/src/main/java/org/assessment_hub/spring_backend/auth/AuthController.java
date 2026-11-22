package org.assessment_hub.spring_backend.auth;

import org.assessment_hub.spring_backend.auth.dto.LoginDto;
import org.assessment_hub.spring_backend.auth.dto.RegisterDto;
import org.assessment_hub.spring_backend.profile.dto.UserDto;

import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

//  - /auth/register   (POST), get user data to create a new profile (including an optional profile pic)
//  - /auth/login      (POST), get user login information (email + password, session based)
//  - /auth/logout     (POST), logout of the session

@RestController
@RequestMapping("/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    /** Multipart: JSON travels as the "user" part (application/json), optional "profile_pic" file part. */
    @PostMapping(value = "/register", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<UserDto> register(
            @RequestPart("user") @Valid RegisterDto user,
            @RequestPart(value = "profile_pic", required = false) MultipartFile profilePic) {
        return ResponseEntity.status(HttpStatus.CREATED).body(authService.registerUser(user, profilePic));
    }

    @PostMapping("/login")
    public ResponseEntity<UserDto> login(@Valid @RequestBody LoginDto credentials,
                                         HttpServletRequest request, HttpServletResponse response) {
        return ResponseEntity.ok(authService.authenticateUser(credentials, request, response));
    }

    @GetMapping("/me")
    public ResponseEntity<UserDto> me() {
        UserDto user = authService.currentUser();
        return user == null ? ResponseEntity.status(HttpStatus.UNAUTHORIZED).build() : ResponseEntity.ok(user);
    }

    // POST /auth/logout is handled by Spring Security's LogoutFilter — no controller method needed.
}
