package com.example.todobench.service;

import com.example.todobench.exception.AppException;
import com.example.todobench.model.Todo;
import com.example.todobench.repository.TodoRepository;
import com.fasterxml.jackson.databind.JsonNode;
import java.util.Iterator;
import java.util.List;
import java.util.Set;
import org.springframework.stereotype.Service;

/**
 * Service layer that mirrors the validation and business behavior of the
 * Express backend.
 *
 * This layer is intentionally explicit because the thesis benchmark requires
 * strict parity.
 * We do not rely on framework-default validation behavior here, because
 * framework defaults
 * often differ in subtle ways across stacks.
 */
@Service
public class TodoService {

    private static final Set<String> PATCH_ALLOWED_FIELDS = Set.of("title", "completed", "order");

    private final TodoRepository todoRepository;

    public TodoService(TodoRepository todoRepository) {
        this.todoRepository = todoRepository;
    }

    /**
     * Return all todos.
     */
    public List<Todo> listTodos() {
        return todoRepository.findAll();
    }

    /**
     * Return one todo or raise a parity-aligned 404 error.
     */
    public Todo getTodoById(String rawId) {
        long todoId = parseAndValidateTodoId(rawId);

        return todoRepository.findById(todoId)
                .orElseThrow(() -> new AppException(404, "Todo not found"));
    }

    /**
     * Validate and create a new todo exactly like Express.
     *
     * POST semantics:
     * - body must be a JSON object
     * - title is required and must be a string
     * - completed is optional, but if present must be a boolean
     * - order is optional and may be integer or null
     * - unknown fields are ignored, matching the current Express implementation
     */
    public Todo createTodo(JsonNode payload) {
        ensureJsonObject(payload);

        JsonNode titleNode = payload.get("title");
        if (titleNode == null || titleNode.isNull() || !titleNode.isTextual()) {
            throw new AppException(400, "Field \"title\" is required and must be a string");
        }

        boolean completed = false;
        JsonNode completedNode = payload.get("completed");
        if (completedNode != null) {
            if (!completedNode.isBoolean()) {
                throw new AppException(400, "Field \"completed\" must be a boolean");
            }
            completed = completedNode.booleanValue();
        }

        Integer order = null;
        JsonNode orderNode = payload.get("order");
        if (orderNode != null) {
            if (!orderNode.isNull() && !orderNode.canConvertToInt()) {
                throw new AppException(400, "Field \"order\" must be an integer or null");
            }

            if (!orderNode.isNull()) {
                order = orderNode.intValue();
            }
        }

        Todo todoToCreate = new Todo(
                titleNode.textValue(),
                completed,
                order);

        return todoRepository.create(todoToCreate);
    }

    /**
     * Validate and partially update a todo exactly like Express.
     *
     * PATCH semantics:
     * - body must be a JSON object
     * - unknown fields are rejected
     * - title, if present, must be a string and cannot be null
     * - completed, if present, must be a boolean and cannot be null
     * - order, if present, may be integer or null
     * - explicit order:null clears the DB field
     */
    public Todo patchTodo(String rawId, JsonNode payload) {
        long todoId = parseAndValidateTodoId(rawId);
        ensureJsonObject(payload);
        validatePatchKeys(payload);

        Todo existing = todoRepository.findById(todoId)
                .orElseThrow(() -> new AppException(404, "Todo not found"));

        if (payload.has("title")) {
            JsonNode titleNode = payload.get("title");
            if (titleNode == null || titleNode.isNull() || !titleNode.isTextual()) {
                throw new AppException(400, "Field \"title\" must be a string");
            }
            existing.setTitle(titleNode.textValue());
        }

        if (payload.has("completed")) {
            JsonNode completedNode = payload.get("completed");
            if (completedNode == null || completedNode.isNull() || !completedNode.isBoolean()) {
                throw new AppException(400, "Field \"completed\" must be a boolean");
            }
            existing.setCompleted(completedNode.booleanValue());
        }

        if (payload.has("order")) {
            JsonNode orderNode = payload.get("order");
            if (!orderNode.isNull() && !orderNode.canConvertToInt()) {
                throw new AppException(400, "Field \"order\" must be an integer or null");
            }

            if (orderNode.isNull()) {
                existing.setOrder(null);
            } else {
                existing.setOrder(orderNode.intValue());
            }
        }

        return todoRepository.update(todoId, existing)
                .orElseThrow(() -> new AppException(404, "Todo not found"));
    }

    /**
     * Delete one todo by ID or raise a parity-aligned 404.
     */
    public void deleteTodo(String rawId) {
        long todoId = parseAndValidateTodoId(rawId);

        boolean deleted = todoRepository.deleteById(todoId);
        if (!deleted) {
            throw new AppException(404, "Todo not found");
        }
    }

    /**
     * Delete all todos.
     */
    public void deleteAllTodos() {
        todoRepository.deleteAll();
    }

    /**
     * Match Express ID validation:
     * - must be an integer
     * - must be positive
     */
    private long parseAndValidateTodoId(String rawId) {
        final long numericId;

        try {
            numericId = Long.parseLong(rawId);
        } catch (NumberFormatException error) {
            throw new AppException(400, "Invalid todo id");
        }

        if (numericId <= 0) {
            throw new AppException(400, "Invalid todo id");
        }

        return numericId;
    }

    /**
     * Match Express object validation.
     *
     * Arrays, strings, numbers, booleans, and null are all rejected.
     */
    private void ensureJsonObject(JsonNode payload) {
        if (payload == null || !payload.isObject()) {
            throw new AppException(400, "Request body must be a JSON object");
        }
    }

    /**
     * PATCH is stricter than POST in the Express implementation.
     * Unknown fields must be rejected.
     */
    private void validatePatchKeys(JsonNode payload) {
        Iterator<String> fieldNames = payload.fieldNames();

        while (fieldNames.hasNext()) {
            String fieldName = fieldNames.next();
            if (!PATCH_ALLOWED_FIELDS.contains(fieldName)) {
                throw new AppException(400, "Unknown field \"" + fieldName + "\"");
            }
        }
    }
}