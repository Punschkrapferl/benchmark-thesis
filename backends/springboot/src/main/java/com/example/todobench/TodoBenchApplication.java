package com.example.todobench;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * Main Spring Boot entry point for the benchmark Todo backend.
 *
 * The @SpringBootApplication annotation enables:
 * - component scanning
 * - auto-configuration
 * - Spring Boot application startup
 *
 * This class is intentionally minimal because the benchmark project aims for
 * a clean, reproducible startup path without unnecessary extra logic here.
 */
@SpringBootApplication
public class TodoBenchApplication {

    /**
     * Start the Spring Boot application.
     */
    public static void main(String[] args) {
        SpringApplication.run(TodoBenchApplication.class, args);
    }
}