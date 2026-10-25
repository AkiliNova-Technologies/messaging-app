package com.securelan.messenger.common;

import jakarta.servlet.http.HttpServletRequest;
import java.time.Instant;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<ApiError> validation(MethodArgumentNotValidException exception, HttpServletRequest request) {
        var status = HttpStatus.BAD_REQUEST;
        var message = exception.getBindingResult().getFieldErrors().stream().findFirst()
                .map(error -> error.getField() + ": " + error.getDefaultMessage()).orElse("Request validation failed");
        return ResponseEntity.status(status).body(new ApiError(Instant.now(), status.value(), "VALIDATION_ERROR", message, request.getRequestURI()));
    }

    @ExceptionHandler(ApiException.class)
    ResponseEntity<ApiError> api(ApiException exception, HttpServletRequest request) {
        return ResponseEntity.status(exception.status()).body(new ApiError(Instant.now(), exception.status().value(), exception.code(), exception.getMessage(), request.getRequestURI()));
    }
}
