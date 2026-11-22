package org.assessment_hub.spring_backend.profile.dto;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.time.ZoneOffset;

import org.assessment_hub.spring_backend.profile.UserEntity;

public record UserDto(
        String role,
        String email,
        String name,
        String mobileNo,
        String designation,
        String profilePic,       
        LocalDateTime createdAt,
        LocalDateTime updatedAt,
        String status) {

    public static UserDto from(UserEntity u) {
        return new UserDto(
            u.getRole().name(), u.getEmail(), u.getName(),
            u.getMobileNo(), u.getDesignation(), buildProfilePicUrl(u),
            u.getCreatedAt(), u.getUpdatedAt(), u.getStatus().name());
    }

    public static String buildProfilePicUrl(UserEntity u) {
        String key = u.getProfilePic();
        if (key == null) return null;
        String email = URLEncoder.encode(u.getEmail(), StandardCharsets.UTF_8);
        String version = String.valueOf(u.getUpdatedAt() == null ? 0
                : u.getUpdatedAt().toEpochSecond(ZoneOffset.UTC));
        return "/profile/pfp?user=" + email + "&v=" + version;
    }
}
