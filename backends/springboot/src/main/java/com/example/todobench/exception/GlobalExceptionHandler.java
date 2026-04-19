package com.example.todobench.exception;

import com.example.todobench.dto.ErrorResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.servlet.NoHandlerFoundException;

/**
 * Centralized exception mapping for Spring Boot.
 *
 * This class is critical for parity because Spring's default error responses
 * do not match the compact Express error format used by the benchmark contract.
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

    /**
     * Handle expected application-level errors.
     */
    @ExceptionHandler(AppException.class)
    public ResponseEntity<ErrorResponse> handleAppException(AppException error) {
        return ResponseEntity
                .status(error.getStatusCode())
                .body(new ErrorResponse(error.getMessage()));
    }

    /**
     * Handle malformed JSON or request-body parsing problems.
     *
     * For strict parity with Express, malformed JSON is always mapped to:
     * { "message": "Invalid JSON body" }
     */
    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ErrorResponse> handleUnreadableBody(HttpMessageNotReadableException error) {
        return ResponseEntity
                .status(HttpStatus.BAD_REQUEST)
                .body(new ErrorResponse("Invalid JSON body"));
    }

    /**
     * Handle unknown routes with the same 404 body as Express.
     *
     * This requires:
     * - spring.mvc.throw-exception-if-no-handler-found=true
     * - spring.web.resources.add-mappings=false
     */
    @ExceptionHandler(NoHandlerFoundException.class)
    public ResponseEntity<ErrorResponse> handleNoHandlerFound(NoHandlerFoundException error) {
        return ResponseEntity
                .status(HttpStatus.NOT_FOUND)
                .body(new ErrorResponse("Route not found"));
    }

    /**
     * Final fallback for unexpected internal failures.
     */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> handleUnexpectedException(Exception error) {
        error.printStackTrace();

        return ResponseEntity
                .status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(new ErrorResponse("Internal server error"));
    }
}