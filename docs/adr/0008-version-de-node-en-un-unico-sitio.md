# Versión de Node declarada en un único sitio

Registro de decisión de arquitectura (ADR): la versión de Node del proyecto se declara en `frontend/.nvmrc`, y CI, el entorno local, `engines` y el `Dockerfile` se derivan de ella o se comprueban contra ella.

---

## Contexto

La versión de Node aparecía en sitios que no se hablaban entre sí: `frontend/Dockerfile` (`node:24-alpine`), los dos jobs de `ci-frontend.yml` (`node-version: '24'`) y el README raíz, que pedía «Node.js 20+», algo que ya no era cierto. No había `.nvmrc` ni `engines`.

Quien clonaba la plantilla y ejecutaba `npm install` con la versión de Node que tuviera podía obtener un resultado distinto del de CI y del de la imagen Docker, sin que nada se lo advirtiera.

## Decisión

- `frontend/.nvmrc` (contiene `24`) es la **fuente**. Las herramientas de Node de la máquina local (`nvm`, `fnm`…) la leen, y CI también, con `node-version-file: frontend/.nvmrc` en sus dos jobs.
- `frontend/package.json` declara `"engines": { "node": "^24" }`. Sin `engine-strict`, `npm` solo avisa con otra versión mayor; no bloquea la instalación.
- `frontend/Dockerfile` declara `ARG NODE_VERSION=24` antes del primer `FROM` y parte de `node:${NODE_VERSION}-alpine`. Un `Dockerfile` no puede leer un fichero del contexto antes de `FROM`, así que repite el valor como argumento con valor por defecto.
- El job `lint` de `ci-frontend.yml` tiene un paso, el primero tras el checkout, que falla diciendo qué no coincide si el `ARG` del `Dockerfile` o `engines.node` se desvían de `.nvmrc`.

## Alternativas descartadas

- **Pasar siempre `--build-arg NODE_VERSION=$(cat .nvmrc)`.** Haría que `.nvmrc` fuese la única fuente real, pero un `docker build ./frontend` a secas dejaría de funcionar, y con él `make build`, `make prod` y `docker compose`, que tendrían que conocer ese argumento.
- **Dejar la versión fija en el `Dockerfile` con un comentario que diga «mantener igual que `.nvmrc`».** Un comentario no falla: la versión divergería sin que nadie se enterase.

## Consecuencias

- Subir de versión de Node son tres ediciones (`.nvmrc`, `engines` y el `ARG`). Si se olvida una, el job `lint` falla con un mensaje que dice cuál.
- `engines` acepta solo la `^24` porque es la única versión mayor que prueban CI y Docker. Node 26 es hoy la versión LTS actual, y quien la use verá un aviso de `npm` a propósito: la plantilla no garantiza nada que no haya probado.
- `docker build ./frontend` sin argumentos sigue funcionando; `infra/docker-compose.yml` y el `Makefile` no cambian.
- La comprobación cubre solo el valor por defecto del `ARG`. Quien construya la imagen con `--build-arg NODE_VERSION=…` se sale de lo que CI prueba, y es decisión suya.
- El paso de comprobación es un pequeño script de shell dentro del workflow, sin dependencias, que se puede ejecutar a mano desde `frontend/`.
