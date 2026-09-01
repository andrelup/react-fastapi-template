# Decisión de stack: Python + FastAPI frente a Node.js + Express

Registro de decisión de arquitectura (ADR): por qué el backend de BookShelf está construido con **Python 3.12 + FastAPI** en lugar de **Node.js + Express** (u otro framework del ecosistema JavaScript como NestJS o Fastify).

---

## Contexto

BookShelf es una tienda de libros cuyo diferencial es la **IA aplicada al catálogo**: búsqueda semántica con embeddings sobre PostgreSQL + pgvector, y recomendaciones generadas con LLMs. El backend es una API REST consumida por una SPA React independiente, organizada en arquitectura hexagonal (ver [arquitectura-hexagonal.md](./arquitectura-hexagonal.md)).

Los dos candidatos finalistas fueron los stacks dominantes para APIs REST:

- **Python 3.12 + FastAPI** (async, Pydantic, SQLAlchemy 2.0)
- **Node.js + Express** (el framework más extendido del ecosistema JS; las conclusiones aplican en gran medida a NestJS y Fastify)

## Criterios de evaluación

### 1. Rendimiento

Es el criterio donde más mitos circulan, así que conviene ser preciso: **ninguno de los dos lenguajes es "más rápido" en términos absolutos; depende del tipo de carga**.

- En benchmarks de throughput puro (servir JSON sin tocar base de datos), Node.js suele superar a Python: el motor V8 compila JIT y el event loop de Node lleva quince años optimizándose para exactamente ese escenario.
- En cargas realistas de API con base de datos (consultas vía ORM, serialización de múltiples filas), FastAPI sobre Uvicorn/uvloop es de los frameworks Python más rápidos que existen y en [benchmarks independientes](https://www.travisluong.com/fastapi-vs-express-js-vs-flask-vs-nest-js-benchmark/) llega a superar a Express y NestJS en fetch múltiple con serialización.
- Para una API CRUD como la de BookShelf, **el cuello de botella real es la base de datos y la red, no el framework**. La diferencia de rendimiento entre ambos stacks es irrelevante a la escala de este proyecto.

Conclusión honesta: el rendimiento **no fue un factor decisivo** — ambos stacks están sobrados para este caso de uso. Quien elija entre estos dos frameworks por microsegundos de benchmark está optimizando lo que no importa.

### 2. Productividad: cuánto código hay que escribir (y mantener)

Aquí FastAPI tiene una ventaja objetiva y medible: **trae de serie tres cosas que en Express hay que ensamblar a mano**.

| Necesidad | FastAPI | Express |
|---|---|---|
| Validación de entrada | Pydantic, integrada: el schema *es* el type hint | Librería externa (Zod, Joi, express-validator) + wiring manual |
| Documentación OpenAPI/Swagger | Generada automáticamente desde los type hints | Librería externa (swagger-jsdoc, tsoa) + anotaciones manuales que se desincronizan |
| Inyección de dependencias | `Depends()` nativo | Manual o framework adicional (NestJS, InversifyJS) |

En BookShelf esto se ve directamente: los schemas de `adapters/inbound/schemas/` validan la entrada, serializan la salida y generan la documentación interactiva de `/docs` sin una sola línea extra. Un payload inválido devuelve un 422 detallado sin código de validación manual. En Express, cada una de esas responsabilidades es código propio que escribir, testear y mantener sincronizado.

Por tanto, la intuición de "en Python se escribe menos" es cierta **en este caso**, pero no por el lenguaje en sí, sino porque FastAPI integra validación + serialización + documentación en una sola declaración de tipos.

### 3. Tipado estático

Empate técnico con matices. TypeScript es un sistema de tipos más maduro y su adopción en el ecosistema JS es casi universal. Python compensa con `mypy` en modo strict (obligatorio en este repo) y con una particularidad valiosa: **los type hints de Pydantic son a la vez tipos estáticos y validación en runtime**, mientras que los tipos de TypeScript se borran al compilar y no protegen frente a datos externos malformados (de ahí la necesidad de Zod). Además, los `typing.Protocol` permiten implementar los ports de la arquitectura hexagonal por tipado estructural, sin acoplar los adaptadores al contrato por herencia.

### 4. Ecosistema de IA — el factor decisivo

BookShelf necesita generar embeddings, hablar con LLMs y hacer búsqueda vectorial. **Python es la lengua franca del machine learning**: los SDKs de los proveedores de IA tratan Python como ciudadano de primera clase, y librerías como numpy o los clientes de pgvector tienen su mejor soporte ahí. El ecosistema JS tiene equivalentes, pero llegan más tarde, con menos documentación y comunidades más pequeñas.

Elegir Node habría significado nadar contra corriente exactamente en la parte del proyecto que lo diferencia. Este criterio, por sí solo, habría bastado para decidir.

### 5. Modelo de concurrencia

Ambos resuelven bien el I/O concurrente: Node con su event loop nativo (todo es async desde el diseño), Python con `asyncio` + Uvicorn (async opt-in, obligatorio en este repo para endpoints, servicios y repositorios). La pega clásica de Python — el GIL limita el trabajo CPU-bound en un solo proceso — se mitiga igual que en Node (que también es mono-hilo por proceso): múltiples workers. Para una API I/O-bound, empate.

### 6. Un solo lenguaje en todo el stack

La ventaja estructural de Express: con Node, frontend y backend comparten lenguaje, tooling y potencialmente tipos y validadores. Para equipos pequeños full-stack JS es un argumento serio que reduce el cambio de contexto. En BookShelf pesó menos porque los dos proyectos son deliberadamente independientes (conectados solo por API REST) y el objetivo formativo incluía precisamente trabajar con dos stacks.

### 7. Comunidad y mercado

Ambos ecosistemas son enormes y no hubo diferencia práctica. Express tiene más base instalada histórica; FastAPI es el framework Python de mayor crecimiento y domina en proyectos de IA y data.

## Decisión

**Python 3.12 + FastAPI**, por este orden de peso:

1. **Ecosistema de IA** — el corazón diferencial del proyecto (embeddings, LLMs, pgvector) vive en Python.
2. **Productividad tipada** — validación, serialización y documentación OpenAPI derivadas de una única declaración de tipos, sin boilerplate.
3. **Encaje con la arquitectura hexagonal** — `typing.Protocol` + inyección de dependencias nativa hacen naturales los ports & adapters.

El rendimiento, pese a la creencia popular en ambas direcciones, fue neutral: ninguno de los dos stacks sería el cuello de botella.

## Tabla resumen: ventajas y desventajas

| Criterio | Python + FastAPI | Node.js + Express |
|---|---|---|
| **Rendimiento (JSON puro)** | ➖ Correcto, por debajo de V8 en throughput bruto | ➕ Excelente, V8 + event loop maduro |
| **Rendimiento (API + BD, async)** | ➕ Entre los mejores de Python; competitivo o superior en cargas con ORM | ➕ Bueno; empate práctico en APIs I/O-bound |
| **Validación de entrada** | ➕ Pydantic integrado, errores 422 automáticos | ➖ Librería externa + wiring manual |
| **Documentación de API** | ➕ OpenAPI/Swagger autogenerada, siempre sincronizada | ➖ Manual (swagger-jsdoc/tsoa), tiende a desactualizarse |
| **Inyección de dependencias** | ➕ `Depends()` nativo | ➖ Manual o framework adicional |
| **Tipado** | ➕ mypy strict + tipos con validación en runtime (Pydantic) | ➕ TypeScript maduro, pero los tipos se borran en runtime |
| **Ecosistema IA/ML** | ➕➕ Lengua franca del ML: SDKs, embeddings, pgvector de primera clase | ➖ Equivalentes existentes pero de segunda ola |
| **Concurrencia** | ➕ asyncio + Uvicorn; GIL irrelevante en I/O-bound | ➕ Async nativo desde el diseño |
| **Trabajo CPU-bound** | ➖ GIL: requiere workers/procesos | ➖ Mono-hilo: requiere workers/procesos (misma mitigación) |
| **Lenguaje único full-stack** | ➖ Frontend en TS, backend en Python: dos contextos | ➕ JS/TS en todo el stack, tipos compartibles |
| **Curva de aprendizaje** | ➕ Sintaxis concisa, framework muy guiado | ➕ Minimalista, pero exige más decisiones de arquitectura propias |
| **Comunidad / empleo** | ➕ Enorme; dominante en data/IA | ➕ Enorme; dominante en web/tiempo real |

## Referencias

- [FastAPI — Benchmarks](https://fastapi.tiangolo.com/benchmarks/)
- [TechEmpower Web Framework Benchmarks](https://www.techempower.com/benchmarks/)
- [FastAPI vs Express.js vs Flask vs Nest.js — benchmark independiente (Travis Luong)](https://www.travisluong.com/fastapi-vs-express-js-vs-flask-vs-nest-js-benchmark/)
- [Backend Battle 2025: FastAPI vs Express (Slincom)](https://www.slincom.com/blog/programming/fastapi-vs-express-backend-comparison-2025)
- [FastAPI vs Express for Solo Developers (SoloDevStack)](https://solodevstack.com/blog/fastapi-vs-expressjs-solo-developers)
- [FastAPI — Alternatives, Inspiration and Comparisons](https://fastapi.tiangolo.com/alternatives/)
