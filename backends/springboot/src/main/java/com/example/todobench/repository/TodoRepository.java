package com.example.todobench.repository;

import com.example.todobench.model.Todo;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public class TodoRepository {

        private static final RowMapper<Todo> TODO_ROW_MAPPER = (rs, rowNum) -> new Todo(
                        rs.getLong("id"),
                        rs.getString("title"),
                        rs.getBoolean("completed"),
                        (Integer) rs.getObject("display_order"));

        private final JdbcClient jdbcClient;

        public TodoRepository(JdbcClient jdbcClient) {
                this.jdbcClient = jdbcClient;
        }

        public List<Todo> findAll() {
                return jdbcClient.sql("""
                                SELECT id, title, completed, "order" AS display_order
                                FROM todos
                                ORDER BY id ASC
                                """)
                                .query(TODO_ROW_MAPPER)
                                .list();
        }

        public Optional<Todo> findById(Long id) {
                return jdbcClient.sql("""
                                SELECT id, title, completed, "order" AS display_order
                                FROM todos
                                WHERE id = ?
                                """)
                                .param(id)
                                .query(TODO_ROW_MAPPER)
                                .optional();
        }

        public Todo create(Todo todo) {
                return jdbcClient.sql("""
                                INSERT INTO todos (title, completed, "order")
                                VALUES (?, ?, ?)
                                RETURNING id, title, completed, "order" AS display_order
                                """)
                                .params(
                                                todo.getTitle(),
                                                todo.getCompleted(),
                                                todo.getOrder())
                                .query(TODO_ROW_MAPPER)
                                .single();
        }

        public Optional<Todo> update(Long id, Todo todo) {
                return jdbcClient.sql("""
                                UPDATE todos
                                SET title = ?, completed = ?, "order" = ?
                                WHERE id = ?
                                RETURNING id, title, completed, "order" AS display_order
                                """)
                                .params(
                                                todo.getTitle(),
                                                todo.getCompleted(),
                                                todo.getOrder(),
                                                id)
                                .query(TODO_ROW_MAPPER)
                                .optional();
        }

        public boolean deleteById(Long id) {
                int affectedRows = jdbcClient.sql("""
                                DELETE FROM todos
                                WHERE id = ?
                                """)
                                .param(id)
                                .update();

                return affectedRows > 0;
        }

        public void deleteAll() {
                jdbcClient.sql("""
                                DELETE FROM todos
                                """).update();
        }
}