# Restricciones de unicidad: índice único frente a UNIQUE constraint

Por qué `users.email` **sí** tiene garantizada la unicidad en la base de datos aunque no aparezca como una `UNIQUE CONSTRAINT`, y cómo la declaración del modelo en SQLAlchemy decide cuál de las dos formas acaba en PostgreSQL.

Este documento nace de un falso positivo real: se reportó como bug que a `users.email` "le faltaba la restricción única en la BD". No le faltaba. Merece la pena dejar escrito el porqué, porque la confusión es fácil de repetir.

---

## El malentendido

Al inspeccionar las dos tablas, la asimetría salta a la vista:

```
\d books
Indexes:
    "books_pkey"     PRIMARY KEY, btree (id)
    "books_isbn_key" UNIQUE CONSTRAINT, btree (isbn)   ← constraint

\d users
Indexes:
    "users_pkey"     PRIMARY KEY, btree (id)
    "ix_users_email" UNIQUE, btree (email)             ← índice
```

Y el remate llega al consultar el catálogo de constraints, donde `users.email` no aparece por ninguna parte:

```sql
SELECT table_name, constraint_name, constraint_type
FROM information_schema.table_constraints
WHERE table_name IN ('users', 'books') AND constraint_type = 'UNIQUE';

--  table_name | constraint_name | constraint_type
-- ------------+-----------------+-----------------
--  books      | books_isbn_key  | UNIQUE
-- (users no sale)
```

La conclusión intuitiva es *"a `users.email` le falta la restricción única"*. Es una conclusión **falsa**, y este documento explica por qué.

## Qué hace SQLAlchemy en realidad

La diferencia no la decide PostgreSQL, la decide **cómo se declaró la columna en el modelo ORM**. Ésta es la regla:

| Declaración en el modelo | Lo que SQLAlchemy emite | Cómo se ve en `\d` |
|---|---|---|
| `mapped_column(unique=True)` | `UNIQUE` dentro del `CREATE TABLE` | `books_isbn_key` **UNIQUE CONSTRAINT** |
| `mapped_column(unique=True, index=True)` | `CREATE UNIQUE INDEX` | `ix_users_email` **UNIQUE** (índice) |
| `__table_args__ = (UniqueConstraint(...),)` | `UNIQUE` con nombre explícito | `uq_favourite_lists_owner_name` **UNIQUE CONSTRAINT** |

La clave está en la segunda fila. Cuando pides `index=True` **junto a** `unique=True`, SQLAlchemy no crea las dos cosas: interpreta que quieres *un índice, y que ese índice sea único*. Emite un único `CREATE UNIQUE INDEX` y no genera ninguna constraint.

Visto así es hasta razonable —una constraint sobre una columna que ya tiene su propio índice único sería redundante, y te ahorra un índice duplicado— pero es exactamente lo que despista al leer el esquema después.

Los tres casos conviven hoy en [`sqlalchemy_models.py`](../src/adapters/outbound/persistence/sqlalchemy_models.py):

```python
# línea 22 — unique + index → índice único
email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)

# línea 42 — unique a secas → UNIQUE constraint
isbn: Mapped[str] = mapped_column(String(20), nullable=False, unique=True)

# línea 66 — constraint explícita y nombrada (unicidad compuesta)
__table_args__ = (UniqueConstraint("owner_id", "name", name="uq_favourite_lists_owner_name"),)
```

Tres formas distintas de escribirlo, y por eso tres formas distintas de verlo en el esquema.

## En PostgreSQL las dos garantizan lo mismo

Éste es el punto que desmonta el supuesto bug.

Un índice único no es un primo pobre de la UNIQUE constraint: **es el mecanismo con el que PostgreSQL implementa la UNIQUE constraint**. Cuando declaras una constraint, Postgres crea por debajo un índice único y lo usa para validar cada `INSERT`. No hay una "capa de constraint" adicional por encima. Son la misma máquina, con distinta etiqueta en el catálogo.

Lo cual significa que la unicidad de `users.email` está garantizada hoy, sin tocar nada. Comprobado contra la base de datos real:

```
BEGIN;
INSERT INTO users (email, name, role, hashed_password)
VALUES ('test@test.es', 'Duplicado', 'customer', 'x');

ERROR:  duplicate key value violates unique constraint "ix_users_email"
DETAIL:  Key (email)=(test@test.es) already exists.
```

Fíjate en un detalle delicioso: el propio mensaje de Postgres llama **"unique constraint"** al índice. Para el motor, la distinción que nos preocupaba ni siquiera existe.

Y el código ya cuenta con esta garantía. En [`error_handler.py`](../src/adapters/inbound/middleware/error_handler.py) hay un handler de `IntegrityError` → **409** cuyo comentario lo dice explícitamente: cubre la carrera entre dos peticiones concurrentes. El reparto de responsabilidades es éste:

- **`AuthService`** comprueba con `find_by_email` antes de registrar. Cubre el caso normal y produce un error de negocio limpio (`DuplicateEmailError` → 409).
- **La restricción de BD** es la red que atrapa el caso que la comprobación de negocio no puede cubrir: dos registros simultáneos con el mismo email, ambos pasando el `find_by_email` antes de que ninguno haya hecho commit.

Sin la restricción en la base de datos, ese segundo escenario colaría dos filas con el mismo email. Es decir: la restricción no solo existe — **es load-bearing**.

## Entonces, ¿cuándo importa la diferencia?

Importa poco, pero no es cero. Siendo honestos:

- **Visibilidad en el catálogo.** Solo las constraints aparecen en `information_schema.table_constraints`. Los índices únicos son invisibles ahí. Ésta es la causa real de la confusión, y la única consecuencia que de verdad nos ha mordido.
- **Nombre.** Una constraint puede llevar un nombre explícito y estable (`uq_users_email`); el índice hereda el `ix_<tabla>_<campo>` que genera SQLAlchemy.
- **`ON CONFLICT`.** Los dos sirven como destino de inferencia (`ON CONFLICT (email) DO ...`), así que da igual.
- **Diferibilidad.** Solo una constraint puede declararse `DEFERRABLE`. No se usa en el proyecto.

Lo que **no** cambia, y es lo importante: la garantía de unicidad, el rendimiento de las búsquedas por ese campo (en ambos casos hay un índice B-tree detrás, así que el `find_by_email` del repositorio se resuelve igual de rápido) y el 409 que acaba viendo el cliente.

Dicho de otro modo: migrar `ix_users_email` a una `uq_users_email` sería un cambio **cosmético**. No arreglaría ningún agujero de datos, porque no hay ninguno.

## Convención del proyecto

Para no volver a tropezar:

1. **Unicidad compuesta** → `UniqueConstraint(...)` con nombre explícito en `__table_args__`. Es el patrón que ya usan `favourite_lists` y `favourite_list_items`, y no admite alternativa: `unique=True` es por columna.
2. **Unicidad de una sola columna** → `unique=True` basta. Añade `index=True` únicamente si además vas a filtrar con frecuencia por ese campo, sabiendo que entonces se materializa como índice único y no como constraint.
3. **Al auditar el esquema**, no interpretes la ausencia en `information_schema.table_constraints` como ausencia de restricción. Usa `\d <tabla>`, que lista índices y constraints juntos, o consulta `pg_index.indisunique`. Un `UNIQUE, btree (columna)` bajo *Indexes* protege exactamente igual que una `UNIQUE CONSTRAINT`.

---

Ver también: [arquitectura-hexagonal.md](./arquitectura-hexagonal.md) para el porqué de la separación entre modelos de dominio y modelos ORM.
