package com.example.todobench.dto;

/**
 * Compact error response DTO used for strict parity with Express.
 *
 * All handled client/server errors return:
 * { "message": "..." }
 */
public class ErrorResponse {

    private String message;

    public ErrorResponse() {
    }

    public ErrorResponse(String message) {
        this.message = message;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }
}