package org.assessment_hub.spring_backend.core.exceptions;

import java.util.Map;
import java.util.Objects;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.core.PropertyReferenceException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;

import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.multipart.MultipartException;
import org.springframework.web.multipart.support.MissingServletRequestPartException;
import org.springframework.web.server.ResponseStatusException;

import jakarta.validation.ConstraintViolation;
import jakarta.validation.ConstraintViolationException;
import lombok.extern.slf4j.Slf4j;
import software.amazon.awssdk.core.exception.SdkException;
import software.amazon.awssdk.services.s3.model.NoSuchKeyException;
import software.amazon.awssdk.thirdparty.jackson.core.JsonProcessingException;

import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.validation.FieldError;
import org.springframework.messaging.handler.annotation.support.MethodArgumentNotValidException;

@Slf4j 
@RestControllerAdvice
public class ApiExceptionHandler {

    private static ResponseEntity<Map<String, String>> error(HttpStatus status, String message) {
        return ResponseEntity.status(status).body(Map.of("message", message));
    }

    @ExceptionHandler(BadCredentialsException.class)
    ResponseEntity<Map<String, String>> onBadCredentials(BadCredentialsException ex) {
        return error(HttpStatus.UNAUTHORIZED, "Invalid email or password.");
    }

    @ExceptionHandler(ResponseStatusException.class)
    ResponseEntity<Map<String, String>> onResponseStatus(ResponseStatusException ex) {
        return error(HttpStatus.valueOf(ex.getStatusCode().value()),
                ex.getReason() != null ? ex.getReason() : "Request failed.");
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    ResponseEntity<Map<String, String>> onDataIntegrity(DataIntegrityViolationException ex) {
        return error(HttpStatus.CONFLICT, "An account with this email already exists.");
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    ResponseEntity<Map<String, String>> onUnreadable(HttpMessageNotReadableException ex) {
        return error(HttpStatus.BAD_REQUEST, "Malformed registration data.");
    }

    @ExceptionHandler({MissingServletRequestPartException.class, MultipartException.class})
    ResponseEntity<Map<String, String>> onMultipart(Exception ex) {
        return error(HttpStatus.BAD_REQUEST, "Malformed upload. Please retry the registration.");
    }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    ResponseEntity<Map<String, String>> onTooLarge(MaxUploadSizeExceededException ex) {
        return error(HttpStatus.CONTENT_TOO_LARGE, "The image must be 5 MB or smaller.");
    }

    @ExceptionHandler(JsonProcessingException.class)
    ResponseEntity<Map<String, String>> onJsonParse(JsonProcessingException ex) {
        return error(HttpStatus.BAD_REQUEST, "Malformed JSON in request body.");
    }

    @ExceptionHandler(IllegalArgumentException.class)
    ResponseEntity<Map<String, String>> onIllegalArgument(IllegalArgumentException ex) {
        return error(HttpStatus.BAD_REQUEST, ex.getMessage());
    }

    @ExceptionHandler(AccessDeniedException.class)
    ResponseEntity<Map<String, String>> onAccessDenied(AccessDeniedException ex) {
        return error(HttpStatus.FORBIDDEN, "You are not allowed to access this resource.");
    }

    /** Non-numeric /files/users/abc/profile-pic — currently surfaces as 500. */
    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    ResponseEntity<Map<String, String>> onTypeMismatch(MethodArgumentTypeMismatchException ex) {
        return error(HttpStatus.BAD_REQUEST, "Invalid value for '" + ex.getName() + "'.");
    }

    /** Pic was removed from storage but the DB key still exists (or a tampered URL). */
    @ExceptionHandler(NoSuchKeyException.class)
    ResponseEntity<Map<String, String>> onNoSuchKey(NoSuchKeyException ex) {
        return error(HttpStatus.NOT_FOUND, "The requested file does not exist.");
    }

    /** SeaweedFS down / unreachable — distinguishable from a bug in your code. */
    @ExceptionHandler(SdkException.class)
    ResponseEntity<Map<String, String>> onStorage(SdkException ex) {
        log.error("Storage service failure", ex);
        return error(HttpStatus.SERVICE_UNAVAILABLE, "Storage is temporarily unavailable. Please try again.");
    }

    @ExceptionHandler(PropertyReferenceException.class)
    ResponseEntity<Map<String, String>> onPropertyReference(PropertyReferenceException ex) {
        return error(HttpStatus.BAD_REQUEST, "Invalid sort or filter parameter.");
    }

    @ExceptionHandler(ConstraintViolationException.class)
    ResponseEntity<Map<String, String>> onConstraintViolation(ConstraintViolationException ex) {
        String msg = ex.getConstraintViolations().stream()
                .map(ConstraintViolation::getMessage)
                .filter(Objects::nonNull)
                .findFirst()
                .orElse("Invalid request parameters.");
        return error(HttpStatus.BAD_REQUEST, msg);
    }
    
    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<Map<String, String>> onValidation(MethodArgumentNotValidException ex) {
        String msg = ex.getBindingResult().getFieldErrors().stream()
                .map(FieldError::getDefaultMessage).filter(Objects::nonNull).findFirst()
                .orElse("Validation failed.");
        return error(HttpStatus.BAD_REQUEST, msg);
    }

    @ExceptionHandler(Exception.class)
    ResponseEntity<Map<String, String>> onUnexpected(Exception ex) {
        log.error("Unhandled exception", ex);
        return error(HttpStatus.INTERNAL_SERVER_ERROR, "Something went wrong. Please try again.");
    }
}

