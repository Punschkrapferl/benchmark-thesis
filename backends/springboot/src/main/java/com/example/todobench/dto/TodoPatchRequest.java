package com.example.todobench.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

public class TodoPatchRequest {

    private String title;
    private Boolean completed;

    @JsonProperty("order")
    private Integer order;

    public TodoPatchRequest() {
    }

    public TodoPatchRequest(String title, Boolean completed, Integer order) {
        this.title = title;
        this.completed = completed;
        this.order = order;
    }

    public String getTitle() {
        return title;
    }

    public Boolean getCompleted() {
        return completed;
    }

    public Integer getOrder() {
        return order;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public void setCompleted(Boolean completed) {
        this.completed = completed;
    }

    public void setOrder(Integer order) {
        this.order = order;
    }
}