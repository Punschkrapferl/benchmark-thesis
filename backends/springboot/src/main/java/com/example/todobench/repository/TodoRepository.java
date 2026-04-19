package com.example.todobench.repository;

import com.example.todobench.model.Todo;
import java.util.List;
import java.util.Optional;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/**
 * Repository layer for direct PostgreSQL access.
 *
 * This stays intentionally simple:
 * - plain SQL
 * - no ORM
 * - predictable query behavior
 * - easier parity with the Express repository
 */
@Repository
public class TodoRepository {

        /**
         * Map one SQL row into the internal Todo model.
         *
         * The database column name "order" is aliased because ORDER is a reserved SQL
         * keyword.
         */
        private static final RowMapper<Todo> TODO_ROW_MAPPER = (rs, rowNum) -> new Todo(
                        rs.getLong("id"),
                        rs.getString("title"),
                        rs.getBoolean("completed"),
                        (Integer) rs.getObject("display_order"));

        private final JdbcClient jdbcClient;

        public TodoRepository(JdbcClient jdbcClient) {
                this.jdbcClient = jdbcClient;
        }

        /**
         * Return all todos ordered by ID ascending.
         */
        public List<Todo> findAll() {
                return jdbcClient.sql("""
                                SELECT id, title, completed, "order" AS display_order
                                FROM todos
                                ORDER BY id ASC
                                """)
                                .query(TODO_ROW_MAPPER)
                                .list();
        }

        /**
         * Return one todo by ID if it exists.
         */
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

        /**
         * Insert a new todo and return the inserted row.
         */
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

        /**
         * Update a todo and return the updated row.
         *
         * The service layer already resolved patch semantics before this method is
         * called,
         * so the repository can perform a straightforward full-row update.
         */
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

        /**
         * Delete one todo by ID.
         *
         * Return true if a row was deleted, false otherwise.
         */
        public boolean deleteById(Long id) {
                int affectedRows = jdbcClient.sql("""
                                DELETE FROM todos
                                WHERE id = ?
                                """)
                                .param(id)
                                .update();

                return affectedRows > 0;
        }

        /**
         * Delete all todos.
         */
        public void deleteAll() {
                jdbcClient.sql("""
                                DELETE FROM todos
                                """)
                                .update();
        }
}