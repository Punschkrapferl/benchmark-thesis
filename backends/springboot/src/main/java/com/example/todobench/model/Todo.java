package com.example.todobench.model;

/**
 * Internal domain model representing one todo record.
 *
 * This class is used inside the Spring Boot backend between the repository,
 * service, and controller layers. It represents the logical todo entity
 * independently from the external JSON response DTO.
 */
public class Todo {

    /**
     * Database-generated unique identifier.
     */
    private Long id;

    /**
     * Human-readable todo title.
     */
    private String title;

    /**
     * Completion status of the todo.
     */
    private boolean completed;

    /**
     * Optional ordering field used by the shared API contract.
     */
    private Integer order;

    /**
     * Default constructor.
     */
    public Todo() {
    }

    /**
     * Full constructor used when mapping database rows back into the model.
     */
    public Todo(Long id, String title, boolean completed, Integer order) {
        this.id = id;
        this.title = title;
        this.completed = completed;
        this.order = order;
    }

    /**
     * Constructor used when creating a new todo before it has a database ID.
     */
    public Todo(String title, boolean completed, Integer order) {
        this.title = title;
        this.completed = completed;
        this.order = order;
    }

    /**
     * Return the database ID.
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
     * Standard boolean getter variant.
     */
    public boolean isCompleted() {
        return completed;
    }

    /**
     * Alternate boolean getter.
     *
     * Keeping this getter can make usage simpler in places where the code expects
     * a getX() naming style instead of isX().
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
     * Set the database ID.
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
     * Set the completion status.
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
}