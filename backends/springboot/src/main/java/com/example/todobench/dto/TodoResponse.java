package com.example.todobench.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.annotation.JsonPropertyOrder;

/**
 * Public API response DTO for one todo item.
 *
 * This class defines the exact JSON shape returned to the client.
 * The property order is fixed so the serialized JSON stays stable and
 * aligned with the shared benchmark contract used across all backends.
 */
@JsonPropertyOrder({ "id", "title", "completed", "order", "url" })
public class TodoResponse {

    /**
     * Database-generated unique identifier of the todo.
     */
    private Long id;

    /**
     * Human-readable todo title.
     */
    private String title;

    /**
     * Completion flag of the todo.
     */
    private boolean completed;

    /**
     * Optional display order field.
     *
     * The JSON field name must be exactly "order" to match the shared API contract.
     */
    @JsonProperty("order")
    private Integer order;

    /**
     * Absolute URL pointing to this todo resource.
     */
    private String url;

    /**
     * Default constructor required by some serialization/deserialization tools.
     */
    public TodoResponse() {
    }

    /**
     * Convenience constructor used by the controller when building responses.
     */
    public TodoResponse(Long id, String title, boolean completed, Integer order, String url) {
        this.id = id;
        this.title = title;
        this.completed = completed;
        this.order = order;
        this.url = url;
    }

    /**
     * Return the todo ID.
     */
    public Long getId() {
        return id;
    }

    /**
     * Return the todo title.
     */
    public String getTitle() {
        return title;
    }

    /**
     * Return whether the todo is completed.
     */
    public boolean getCompleted() {
        return completed;
    }

    /**
     * Return the optional display order.
     */
    public Integer getOrder() {
        return order;
    }

    /**
     * Return the absolute URL of this todo resource.
     */
    public String getUrl() {
        return url;
    }

    /**
     * Set the todo ID.
     */
    public void setId(Long id) {
        this.id = id;
    }

    /**
     * Set the todo title.
     */
    public void setTitle(String title) {
        this.title = title;
    }

    /**
     * Set the completion flag.
     */
    public void setCompleted(boolean completed) {
        this.completed = completed;
    }

    /**
     * Set the optional display order.
     */
    public void setOrder(Integer order) {
        this.order = order;
    }

    /**
     * Set the absolute resource URL.
     */
    public void setUrl(String url) {
        this.url = url;
    }
}