package com.example.todobench.model;

public class Todo {

    private Long id;
    private String title;
    private boolean completed;
    private Integer order;

    public Todo() {
    }

    public Todo(Long id, String title, boolean completed, Integer order) {
        this.id = id;
        this.title = title;
        this.completed = completed;
        this.order = order;
    }

    public Todo(String title, boolean completed, Integer order) {
        this.title = title;
        this.completed = completed;
        this.order = order;
    }

    public Long getId() {
        return id;
    }

    public String getTitle() {
        return title;
    }

    public boolean isCompleted() {
        return completed;
    }

    public boolean getCompleted() {
        return completed;
    }

    public Integer getOrder() {
        return order;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public void setCompleted(boolean completed) {
        this.completed = completed;
    }

    public void setOrder(Integer order) {
        this.order = order;
    }
}