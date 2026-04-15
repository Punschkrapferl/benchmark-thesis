package com.example.todobench.controller;

import com.example.todobench.dto.TodoCreateRequest;
import com.example.todobench.dto.TodoPatchRequest;
import com.example.todobench.dto.TodoResponse;
import com.example.todobench.model.Todo;
import com.example.todobench.repository.TodoRepository;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.util.List;
import java.util.Optional;

@RestController
@RequestMapping("/todos")
public class TodoController {

    private final TodoRepository todoRepository;

    public TodoController(TodoRepository todoRepository) {
        this.todoRepository = todoRepository;
    }

    @GetMapping
    public List<TodoResponse> getAllTodos(HttpServletRequest request) {
        return todoRepository.findAll()
                .stream()
                .map(todo -> toResponse(request, todo))
                .toList();
    }

    @GetMapping("/{id}")
    public ResponseEntity<TodoResponse> getTodoById(@PathVariable Long id, HttpServletRequest request) {
        Optional<Todo> todo = todoRepository.findById(id);

        return todo.map(value -> ResponseEntity.ok(toResponse(request, value)))
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @PostMapping
    public ResponseEntity<TodoResponse> createTodo(
            @RequestBody TodoCreateRequest requestBody,
            HttpServletRequest request) {
        boolean completed = requestBody.getCompleted() != null && requestBody.getCompleted();

        Todo todoToCreate = new Todo(
                requestBody.getTitle(),
                completed,
                requestBody.getOrder());

        Todo created = todoRepository.create(todoToCreate);

        return ResponseEntity
                .created(URI.create("/todos/" + created.getId()))
                .body(toResponse(request, created));
    }

    @PatchMapping("/{id}")
    public ResponseEntity<TodoResponse> patchTodo(
            @PathVariable Long id,
            @RequestBody TodoPatchRequest requestBody,
            HttpServletRequest request) {
        Optional<Todo> existingOpt = todoRepository.findById(id);

        if (existingOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        Todo existing = existingOpt.get();

        if (requestBody.getTitle() != null) {
            existing.setTitle(requestBody.getTitle());
        }

        if (requestBody.getCompleted() != null) {
            existing.setCompleted(requestBody.getCompleted());
        }

        if (requestBody.getOrder() != null) {
            existing.setOrder(requestBody.getOrder());
        }

        Optional<Todo> updatedOpt = todoRepository.update(id, existing);

        return updatedOpt.map(todo -> ResponseEntity.ok(toResponse(request, todo)))
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteTodo(@PathVariable Long id) {
        boolean deleted = todoRepository.deleteById(id);

        if (!deleted) {
            return ResponseEntity.notFound().build();
        }

        return ResponseEntity.noContent().build();
    }

    @DeleteMapping
    public ResponseEntity<Void> deleteAllTodos() {
        todoRepository.deleteAll();
        return ResponseEntity.noContent().build();
    }

    private TodoResponse toResponse(HttpServletRequest request, Todo todo) {
        return new TodoResponse(
                todo.getId(),
                todo.getTitle(),
                todo.getCompleted(),
                todo.getOrder(),
                buildAbsoluteTodoUrl(request, todo.getId()));
    }

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