# Direcciones obligatorias en el `.env` de cada entorno

Registro de decisión de arquitectura (ADR): ninguna URL ni dirección que necesita la plataforma tiene valor por defecto en el código; cada entorno las declara en su propio `.env`, su ausencia es un error que dice qué falta, y `make` solo prueba y ejecuta en local, porque desplegar será trabajo de CI.

---

## Contexto

La plataforma arrancaba aunque faltase su configuración de red, porque el código traía valores por defecto que apuntaban a `localhost`: la URL de la API en el frontend, repetida en `api-client.ts`, en el `ARG` del `Dockerfile` y en el build arg del compose; y los orígenes CORS y el host y el puerto de PostgreSQL, en el backend y en el compose. Además, `make build` ejecutaba `docker build` sin leer el `.env`, así que la imagen del frontend salía siempre con `localhost`, y en desarrollo Vite buscaba sus `.env` en `frontend/`, de modo que el `.env` de la raíz no llegaba a `make dev-front`.

Un `.env` incompleto no avisaba: la aplicación arrancaba apuntando a `localhost` y, en cualquier entorno que no fuese el equipo del desarrollador, fallaba en silencio, con peticiones a una API que no existe o con CORS rechazando el origen real. En una plantilla es peor, porque quien la clona no sabe qué tiene que configurar hasta que algo falla. Salió a la luz al revisar qué comprueba CI de las imágenes Docker (#21 y #27).

## Decisión

- **Sin direcciones por defecto.** La URL de la API, los orígenes CORS y el host y el puerto de la base de datos son obligatorios en [`settings.py`](../../backend/src/config/settings.py), en [`lib/env.ts`](../../frontend/src/lib/env.ts) y en [`docker-compose.yml`](../../infra/docker-compose.yml) (`${VAR:?…}`), igual que ya lo eran la contraseña de la base de datos y la clave JWT. Los valores que no son direcciones (algoritmo y caducidad del token, nivel de log, nombre de la aplicación) conservan su valor por defecto. El host `postgres` del servicio `backend` del compose se queda fijo: es el nombre del servicio en la red de Docker, no una dirección de ningún entorno.
- **Un error que dice qué falta.** El backend falla al cargar la configuración con un error de pydantic que nombra el campo; `hide_input_in_errors` evita que ese error imprima el resto de valores leídos del `.env`, secretos incluidos, ahora que es el error habitual de un `.env` incompleto. `vite.config.ts` llama a `requireApiUrl` antes de que arranquen `vite`, `vite build` o `vitest`. El compose y el `Dockerfile` del frontend fallan con su propio mensaje.
- **Un `.env` por entorno.** `.env` en local, creado desde `.env.example` por `make setup`, que además avisa de las claves de `.env.example` que le faltan a un `.env` antiguo. `.env.staging` y `.env.prod` para los demás entornos, nunca versionados. No se usa `.env.production`, porque Vite lo cargaría por su cuenta en cada `vite build` ahora que su `envDir` es la raíz del repo. `frontend/.env.example` desaparece: el de la raíz es el único.
- **CI saca sus valores de un secret.** CI no puede leer el `.env` de nadie. El mantenedor crea a mano el secret de Actions `CI_DOTENV` con el contenido de un `.env` de valores de mentira (la base de datos de CI solo existe dentro del job), y los jobs `test-backend` y `test-frontend` lo vuelcan al `.env` de la raíz, o fallan diciendo que falta.
- **`make` solo prueba y ejecuta en local.** `make build` construye a través del compose y lee el env-file igual que `make preview`. Sin `ENV` usa el `.env` y etiqueta las imágenes como `:latest`; `make build ENV=staging` usa el `.env.staging` y las etiqueta como `:staging`, para que las de un entorno no pisen las de otro. Las imágenes de otro entorno solo comprueban que el build funciona con sus valores y no se arrancan en local, porque el navegador llamaría a la API de ese entorno y su CORS rechazaría las peticiones. `make dev` y `make preview` usan siempre el `.env`.
- **`make prod` pasa a llamarse `make preview`.** Sigue levantando en local el stack con las imágenes de producción, como prueba de humo; el nombre `prod` confundía ahora que `.env.prod` es el entorno de producción de verdad.
- **Desplegar será trabajo de CI.** Ningún target, script ni workflow del repo publica ni despliega imágenes. Cuando un proyecto creado desde la plantilla salga a internet, será ese proyecto el que añada su workflow de despliegue.

## Alternativas descartadas

- **Copiar `.env.example` a `.env` en CI.** Era lo más sencillo y no necesitaba ningún secret, pero ataba la configuración de CI al fichero de ejemplo, que se edita pensando en el desarrollo local. Se prefirió que los valores de CI vivan fuera del repo, como vivirán los de un entorno real.
- **Versionar un `.env.ci`.** Rompía la regla de que el único `.env` versionado es el de ejemplo, y dejaba en el repo un fichero de configuración donde un valor real podría colarse sin que nada lo frenase.
- **Un target de `make` por entorno** (`build-staging`, `build-prod`). Repetía la misma receta por cada entorno y obligaba a tocar el `Makefile` para añadir uno; con `ENV` basta con crear su `.env.<entorno>`.
- **Quitar `make prod` y levantar en local el stack con los valores de producción.** Apuntaría el equipo de un desarrollador a la base de datos de producción, y `make build` ya cubre construir las imágenes de otro entorno sin arrancarlas. Se mantiene la prueba de humo con el `.env` local, con otro nombre.

## Consecuencias

- Un `.env` incompleto falla en el primer comando, con un mensaje que dice qué falta, en lugar de arrancar contra `localhost`. Un `.env` anterior a este cambio necesita la URL de la API y los orígenes CORS antes de que vuelvan a funcionar `make dev-back`, `make dev-front` o `make test`; `make setup` dice cuáles faltan.
- `docker build ./frontend` sin `--build-arg VITE_API_URL=…` deja de funcionar, a propósito. Lo que el ADR [0008](./0008-version-de-node-en-un-unico-sitio.md) dice de construir la imagen «a secas» vale ya solo para la versión de Node. El job de Trivy de #21, que construirá las dos imágenes, tendrá que pasarle la URL.
- `make build` y `make preview` necesitan el env-file completo, no solo las variables que usa cada imagen: compose interpola el fichero entero antes de hacer nada.
- CI no pasa hasta que existe el secret `CI_DOTENV`. Cuando entre Dependabot (#16), el mismo secret tendrá que crearse también en los secrets de Dependabot, porque sus PR no ven los de Actions. Las credenciales de la base de datos del secret tienen que coincidir con las del servicio `postgres` de `ci-backend.yml`.
- #29 pondrá un proxy delante: la URL de la API pasará a ser una ruta relativa, que `requireApiUrl` ya acepta, y los orígenes CORS podrán dejar de hacer falta en producción.
- Quedan fuera las URL de Playwright (`frontend/playwright.config.ts`): son de una herramienta de pruebas, no de la plataforma.
