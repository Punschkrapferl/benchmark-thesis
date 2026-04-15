package com.example.todobench.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.annotation.JsonPropertyOrder;

@JsonPropertyOrder({ "id", "title", "completed", "order", "url" })
public class TodoResponse {

    private Long id;
    private String title;
    private boolean completed;

    @JsonProperty("order")
    private Integer order;

    private String url;

    public TodoResponse() {
    }

    public TodoResponse(Long id, String title, boolean completed, Integer order, String url) {
        this.id = id;
        this.title = title;
        this.completed = completed;
        this.order = order;
        this.url = url;
    }

    public Long getId() {
        return id;
    }

    public String getTitle() {
        return title;
    }

    public boolean getCompleted() {
        return completed;
    }

    public Integer getOrder() {
        return order;
    }

    public String getUrl() {
        return url;
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

    public void setUrl(String url) {
        this.url = url;
    }
}