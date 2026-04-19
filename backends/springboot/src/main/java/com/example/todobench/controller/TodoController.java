package com.example.todobench.controller;

import com.example.todobench.dto.TodoResponse;
import com.example.todobench.model.Todo;
import com.example.todobench.service.TodoService;
import com.fasterxml.jackson.databind.JsonNode;
import jakarta.servlet.http.HttpServletRequest;
import java.net.URI;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * HTTP controller for the Todo API.
 *
 * Express is the source of truth for this thesis project, so this controller
 * keeps
 * the Spring Boot HTTP behavior aligned as closely as possible with the Express
 * backend:
 * - same routes
 * - same response shape
 * - same status codes
 * - same validation semantics
 * - same error messages
 */
@RestController
@RequestMapping("/todos")
public class TodoController {

    private final TodoService todoService;

    public TodoController(TodoService todoService) {
        this.todoService = todoService;
    }

    /**
     * GET /todos
     * Return all todos ordered by ID.
     */
    @GetMapping
    public List<TodoResponse> getAllTodos(HttpServletRequest request) {
        return todoService.listTodos()
                .stream()
                .map(todo -> toResponse(request, todo))
                .toList();
    }

    /**
     * GET /todos/:id
     * Validate the ID exactly like Express and return the todo if it exists.
     */
    @GetMapping("/{id}")
    public ResponseEntity<TodoResponse> getTodoById(
            @PathVariable String id,
            HttpServletRequest request) {
        Todo todo = todoService.getTodoById(id);
        return ResponseEntity.ok(toResponse(request, todo));
    }

    /**
     * POST /todos
     * Create a new todo using raw JSON so the service layer can distinguish:
     * - missing fields
     * - explicit null
     * - wrong types
     * - object vs array body
     *
     * This is required for strict parity with Express.
     */
    @PostMapping
    public ResponseEntity<TodoResponse> createTodo(
            @RequestBody JsonNode requestBody,
            HttpServletRequest request) {
        Todo created = todoService.createTodo(requestBody);

        return ResponseEntity
                .created(URI.create("/todos/" + created.getId()))
                .body(toResponse(request, created));
    }

    /**
     * PATCH /todos/:id
     * Apply partial updates with Express-equivalent semantics:
     * - unknown fields are rejected
     * - title/completed must have correct types when present
     * - order may be integer or explicit null
     * - explicit null for order clears the column
     */
    @PatchMapping("/{id}")
    public ResponseEntity<TodoResponse> patchTodo(
            @PathVariable String id,
            @RequestBody JsonNode requestBody,
            HttpServletRequest request) {
        Todo updated = todoService.patchTodo(id, requestBody);
        return ResponseEntity.ok(toResponse(request, updated));
    }

    /**
     * DELETE /todos/:id
     * Validate the ID and delete exactly one todo.
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteTodo(@PathVariable String id) {
        todoService.deleteTodo(id);
        return ResponseEntity.noContent().build();
    }

    /**
     * DELETE /todos
     * Remove all todos.
     */
    @DeleteMapping
    public ResponseEntity<Void> deleteAllTodos() {
        todoService.deleteAllTodos();
        return ResponseEntity.noContent().build();
    }

    /**
     * Convert the internal Todo model into the public API response shape.
     */
    private TodoResponse toResponse(HttpServletRequest request, Todo todo) {
        return new TodoResponse(
                todo.getId(),
                todo.getTitle(),
                todo.getCompleted(),
                todo.getOrder(),
                buildAbsoluteTodoUrl(request, todo.getId()));
    }

    /**
     * Build the absolute resource URL in the same basic style as Express.
     *
     * In local parity runs the request host/port are already the backend target,
     * so this produces the same logical result shape as the Express serializer.
     */
    private String buildAbsoluteTodoUrl(HttpServletRequest request, Long todoId) {
        return request.getScheme()
                + "://"
                + request.getServerName()
                + ":"
                + request.getServerPort()
                + "/todos/"
                + todoId;
    }
}