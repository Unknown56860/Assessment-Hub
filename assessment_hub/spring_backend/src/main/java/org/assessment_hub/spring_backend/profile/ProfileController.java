package org.assessment_hub.spring_backend.profile;

import java.time.Duration;

import org.assessment_hub.spring_backend.core.storage.SeaweedStorageService;
import org.assessment_hub.spring_backend.profile.dto.DeleteAccountDto;
import org.assessment_hub.spring_backend.profile.dto.PagedLogsDto;
import org.assessment_hub.spring_backend.profile.dto.PasswordChangeDto;
import org.assessment_hub.spring_backend.profile.dto.ProfileUpdateDto;
import org.assessment_hub.spring_backend.profile.dto.UserDto;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.logout.SecurityContextLogoutHandler;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

//  - /profile   (GET), to get the profile information.
//  - /profile   (PUT), to update the profile information.
//  - /profile   (DELETE), to delete the profile.

//  - /profile/pfp?user={}    (GET), to get the profile picture.
//  - /profile/pfp            (POST), to update/remove the profile picture.
//  - /profile/password       (PUT), to update the profile password.

//  - /profile/logs?page=0&size=50   (GET), get the activity logs of the user.

@RestController
@RequestMapping("/profile")
@RequiredArgsConstructor
public class ProfileController {

    private final ProfileService profiles;

    @GetMapping
    public ResponseEntity<UserDto> getProfile() {
        return ResponseEntity.ok(profiles.getProfile());
    }
    
    @PutMapping
    public ResponseEntity<UserDto> updateProfile(@Valid @RequestBody ProfileUpdateDto dto) {
        return ResponseEntity.ok(profiles.updateProfile(dto));
    }

    @DeleteMapping
    public ResponseEntity<Void> deleteProfile(@Valid @RequestBody DeleteAccountDto dto,
                                              HttpServletRequest request, HttpServletResponse response) {
        profiles.deleteProfile(dto);
        // Account is gone → kill the session so the deleted user isn't left logged in
        new SecurityContextLogoutHandler().logout(request, response,
                SecurityContextHolder.getContext().getAuthentication());
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/password")
    public ResponseEntity<Void> changePassword(@Valid @RequestBody PasswordChangeDto dto) {
        profiles.changePassword(dto);
        return ResponseEntity.noContent().build(); // current session stays valid — password is only checked at login
    }

    /** Serves the profile picture. No ?user= → own pic; ?user={email} → admins may fetch others'. */
    @GetMapping("/pfp")
    public ResponseEntity<byte[]> profilePic(@RequestParam(required = false) String user) {
        SeaweedStorageService.DownloadedObject obj = profiles.getProfilePic(user);

        MediaType type;
        try { type = MediaType.parseMediaType(obj.contentType()); }
        catch (Exception e) { type = MediaType.APPLICATION_OCTET_STREAM; }

        return ResponseEntity.ok()
                .contentType(type)
                .cacheControl(CacheControl.maxAge(Duration.ofDays(30)).cachePrivate()) // never shared-cache it
                .body(obj.content());
    }

    /** Multipart, mirroring /auth/register: optional "profile_pic" part; empty/missing part removes the image. */
    @PostMapping(value = "/pfp", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<UserDto> updateProfilePic(
            @RequestPart(value = "profile_pic", required = false) MultipartFile profilePic) {
        return ResponseEntity.ok(profiles.updateProfilePic(profilePic));
    }

    @GetMapping("/logs")
    public ResponseEntity<PagedLogsDto> logs(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {
        return ResponseEntity.ok(profiles.getLogs(page, size));
    }
}
