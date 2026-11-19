# Registro de decisiones de arquitectura (ADR)

Cada decisión de arquitectura o de tooling que se toma en el proyecto queda escrita aquí, en un fichero propio, para que quien llegue después sepa qué se decidió, por qué y qué se descartó. Están en español porque las leen personas; el resto de `docs/` está en inglés porque lo leen los agentes.

El listado de esta carpeta es el índice: los ficheros van numerados en el orden en que se tomaron las decisiones.

## Convenciones

- **Nombre:** `NNNN-titulo-en-minusculas-con-guiones.md`, con un número de cuatro cifras. Cada ADR nuevo lleva el siguiente número libre, y un número no se reutiliza ni se cambia.
- **Trabajo en paralelo:** si dos ramas añaden un ADR a la vez, el número de cada una se reserva en su issue antes de empezar, para que no choquen al integrarse.
- **Una decisión que cambia no se reescribe:** se escribe un ADR nuevo que la sustituye, y el antiguo se queda con una línea al principio que enlaza al nuevo.
- **Idioma:** español de España, con tildes. Los identificadores, rutas y bloques de código se quedan como están en el código.
- **Enlaces:** relativos a esta carpeta: `../backend-testing.md` para un documento de `docs/`, `../../backend/src/…` para el código.

Los ADR del `0001` al `0006` son anteriores a esta plantilla y se trajeron de `backend/docs/` tal cual estaban; por eso no todos usan las mismas secciones.

## Plantilla

```markdown
# <Título de la decisión>

Registro de decisión de arquitectura (ADR): <una frase con qué se decide y por qué importa>.

---

## Contexto

<La situación que obliga a decidir: qué falla o qué falta hoy, con ficheros e issues concretos.>

## Decisión

<Qué se hace, en presente y sin rodeos.>

## Alternativas descartadas

<Cada alternativa que se consideró y por qué no se eligió.>

## Consecuencias

<Qué se gana, qué cuesta y qué hay que hacer a partir de ahora a raíz de esta decisión.>
```
