SELECT 'CREATE DATABASE todo_express'
WHERE NOT EXISTS (
  SELECT FROM pg_database WHERE datname = 'todo_express'
)\gexec

SELECT 'CREATE DATABASE todo_springboot'
WHERE NOT EXISTS (
  SELECT FROM pg_database WHERE datname = 'todo_springboot'
)\gexec

SELECT 'CREATE DATABASE todo_aspnet'
WHERE NOT EXISTS (
  SELECT FROM pg_database WHERE datname = 'todo_aspnet'
)\gexec

SELECT 'CREATE DATABASE todo_fastapi'
WHERE NOT EXISTS (
  SELECT FROM pg_database WHERE datname = 'todo_fastapi'
)\gexec