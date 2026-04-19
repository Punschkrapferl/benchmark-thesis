package com.example.todobench.exception;

/**
 * Small application-level exception carrying the HTTP status code and
 * the exact message that should be returned to the client.
 *
 * This mirrors the role of AppError in the Express backend.
 */
public class AppException extends RuntimeException {

    private final int statusCode;

    public AppException(int statusCode, String message) {
        super(message);
        this.statusCode = statusCode;
    }

    public int getStatusCode() {
        return statusCode;
    }
}