package org.assessment_hub.spring_backend.auth;

import org.assessment_hub.spring_backend.auth.dto.LoginDto;
import org.assessment_hub.spring_backend.auth.dto.RegisterDto;
import org.assessment_hub.spring_backend.core.storage.SeaweedStorageService;
import org.assessment_hub.spring_backend.profile.ActivityService;
import org.assessment_hub.spring_backend.profile.UserEntity;
import org.assessment_hub.spring_backend.profile.UserRepo;
import org.assessment_hub.spring_backend.profile.dto.UserDto;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;

import lombok.RequiredArgsConstructor;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepo users;
    private final PasswordEncoder passwordEncoder;
    private final AuthenticationManager authManager;
    private final SecurityContextRepository securityContextRepository;
    private final SeaweedStorageService storage;
    private final ActivityService activity;

    @Transactional 
    public UserDto registerUser(RegisterDto dto, MultipartFile profilePic) {
        if (users.existsByEmail(dto.email())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "An account with this email already exists.");
        }

        UserEntity user = users.save(UserEntity.builder()
                .name(dto.name())
                .email(dto.email())
                .password(passwordEncoder.encode(dto.password()))
                .mobileNo(dto.mobileNo())
                .designation(dto.designation())
                .build());

        if (profilePic != null && !profilePic.isEmpty()) {
            user.setProfilePic(storage.uploadProfilePic(profilePic, dto.email()));
            users.save(user); // bumps updated_at → new ?v= cache-buster
        }

        activity.addLog(user, "Profile registered", String.format(
                "Name: %s, Email: %s, Mobile: %s, Designation: %s, Access level: %s, Profile status: %s",
                dto.name(), dto.email(), dto.mobileNo(), dto.designation(), user.getRole(), user.getStatus()));

        return UserDto.from(user);
    }

    @Transactional
    public UserDto authenticateUser(LoginDto credentials, HttpServletRequest request, HttpServletResponse response) {
        Authentication auth = authManager.authenticate(
                UsernamePasswordAuthenticationToken.unauthenticated(credentials.email(), credentials.password()));

        SecurityContext context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(auth);
        SecurityContextHolder.setContext(context);
        securityContextRepository.saveContext(context, request, response); // persists the JSESSIONID-backed session

        UserEntity user = users.findByEmail(credentials.email())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid email or password."));
        request.getSession(true).setAttribute("USER", user);

        activity.addLog(user, "Login", null);
        return UserDto.from(user);
    }

    /** Used by GET /auth/me to restore the session on page refresh. */
    @Transactional(readOnly = true)
    public UserDto currentUser() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || auth instanceof AnonymousAuthenticationToken) return null;
        return users.findByEmail(auth.getName()).map(UserDto::from).orElse(null);
    }
}
