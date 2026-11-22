package org.assessment_hub.spring_backend.profile;

import org.assessment_hub.spring_backend.admin.dtos.AdminUserPageDto;
import org.assessment_hub.spring_backend.core.storage.SeaweedStorageService;
import org.assessment_hub.spring_backend.profile.dto.DeleteAccountDto;
import org.assessment_hub.spring_backend.profile.dto.PagedLogsDto;
import org.assessment_hub.spring_backend.profile.dto.PasswordChangeDto;
import org.assessment_hub.spring_backend.profile.dto.ProfileUpdateDto;
import org.assessment_hub.spring_backend.profile.dto.UserDto;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class ProfileService {

    private final UserRepo users;

    private final SeaweedStorageService storage;
    private final ActivityService activity;

    private final PasswordEncoder passwordEncoder;

    @Transactional(readOnly = true)
    public UserDto getProfile() {
        return UserDto.from(getCurrentUser());
    }

    @Transactional(readOnly = true)
    public AdminUserPageDto getAllUsers(int page, int size) {
        Page<UserEntity> result = users.findAll(PageRequest.of(
                Math.max(page, 0),
                Math.min(Math.max(size, 1), 250),
                Sort.by(Sort.Direction.DESC, "createdAt", "userId")));

        return new AdminUserPageDto(
                users.countByStatus(ProfileStatus.PENDING),
                users.countByStatus(ProfileStatus.ACTIVE),
                users.countByStatus(ProfileStatus.RESTRICTED),
                result.getContent().stream().map(UserDto::from).toList());
    }

    @Transactional
    public UserDto updateProfile(ProfileUpdateDto dto) {
        UserEntity user = getCurrentUser();

        // null = "leave unchanged"; send "" to clear mobile/designation
        if (dto.name() != null)        user.setName(dto.name());
        if (dto.mobileNo() != null)    user.setMobileNo(dto.mobileNo());
        if (dto.designation() != null) user.setDesignation(dto.designation());

        users.save(user); // explicit save → @PreUpdate bumps updated_at (new ?v= cache-buster)

        activity.addLog(user, "Profile updated", String.format(
                "Name: %s, Mobile: %s, Designation: %s",
                user.getName(), user.getMobileNo(), user.getDesignation()));

        return UserDto.from(user);
    }

    /** PUT /admin/user — activate / restrict an account. Only AdminService calls this. */
    @Transactional
    public void updateStatusByEmail(String email, ProfileStatus newStatus) {
        UserEntity user = users.findByEmail(email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "No user found with email: " + email));

        // Self-lockout guard: an admin can't restrict/activate their own account.
        if (user.getUserId().equals(getCurrentUser().getUserId()))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "You cannot change the status of your own account.");

        user.setStatus(newStatus);
        users.save(user); // @PreUpdate bumps updated_at
    }

    @Transactional
    public void changePassword(PasswordChangeDto dto) {
        UserEntity user = getCurrentUser();

        if (!passwordEncoder.matches(dto.currentPassword(), user.getPassword()))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Current password is incorrect.");

        user.setPassword(passwordEncoder.encode(dto.newPassword()));
        users.save(user);

        activity.addLog(user, "Password changed", null);
    }

    @Transactional(readOnly = true)
    public SeaweedStorageService.DownloadedObject getProfilePic(String emailParam) {
        UserEntity requester = getCurrentUser();

        UserEntity owner;
        if (emailParam == null || emailParam.isBlank() || emailParam.equals(requester.getEmail())) {
            owner = requester;                                  // own picture — any authenticated user
        } else {
            if (requester.getRole() != UserRole.ADMIN)          // someone else's — admins only
                throw new ResponseStatusException(HttpStatus.FORBIDDEN);
            owner = users.findByEmail(emailParam)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        }

        String key = owner.getProfilePic();
        if (key == null)
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "No profile picture set.");
        return storage.download(key);
    }

    /**
     * A non-empty "profile_pic" part replaces the image; a missing/empty part removes it.
     */
    @Transactional
    public UserDto updateProfilePic(MultipartFile file) {
        UserEntity user = getCurrentUser();
        String oldKey = user.getProfilePic();

        if (file != null && !file.isEmpty()) {
            String newKey = storage.uploadProfilePic(file, user.getEmail());
            user.setProfilePic(newKey);
            users.save(user);
            activity.addLog(user, "New Profile image", null);

            if (oldKey != null && !oldKey.equals(newKey)) {   // e.g. .jpg → .png key change
                try { storage.delete(oldKey); }
                catch (Exception ignored) { }                 // orphan tolerated; never fail the request on cleanup
            }
        } else if (oldKey != null) {
            user.setProfilePic(null);
            users.save(user);
            try { storage.delete(oldKey); }
            catch (Exception ignored) { }
            activity.addLog(user, "Profile image removed", null);
        }

        return UserDto.from(user);
    }

    @Transactional
    public void deleteProfile(DeleteAccountDto dto) {
        UserEntity user = getCurrentUser();

        if (!"Delete".equals(dto.confirmation()))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Type \"Delete\" to confirm.");
        if (!passwordEncoder.matches(dto.password(), user.getPassword()))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Incorrect password.");

        // Not logging the deletion: activity logs cascade-delete with the user, so the entry would vanish anyway.
        String picKey = user.getProfilePic();
        users.delete(user);
        users.flush(); // row (+ cascade-deleted logs) gone before we touch storage; rollback still possible on failure
        if (picKey != null) storage.delete(picKey);
    }

    @Transactional(readOnly = true)
    public PagedLogsDto getLogs(int page, int size) {
        return activity.getAllLogs(page, size);
    }

    @Transactional(readOnly = true)
    public UserEntity getCurrentUser() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || auth instanceof AnonymousAuthenticationToken) 
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Not authenticated.");
        return users.findByEmail(auth.getName())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Not authenticated."));
    }
}
