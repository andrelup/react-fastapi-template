-- Habilita pgvector para la búsqueda semántica.
-- Este script solo se ejecuta en el primer arranque del volumen de datos.
CREATE EXTENSION IF NOT EXISTS vector;
