# Dependencias directas y paquetes del sistema

Registro de decisión de arquitectura (ADR): las dependencias que declara el proyecto se actualizan de una en una; las indirectas, como los paquetes del sistema de las imágenes base, solo tienen que pasar los escaneos de seguridad, y por eso la imagen del backend instala al construirse todos los parches que Debian ya ha publicado.

---

## Contexto

El job `trivy` de [`security.yml`](../../.github/workflows/security.yml) (#21) escanea las dos imágenes y falla con cualquier vulnerabilidad crítica o alta que ya tenga versión corregida. La imagen base del backend, `python:3.12-slim` (Debian 13), tarda unos días en incluir los parches que Debian publica en `trixie-security`. Mientras tanto el job sale en rojo, en todas las PR y en `main`, aunque nadie haya tocado nada.

Pasó dos veces en noviembre de 2026:

- **`zlib1g` (CVE-2026-85091), el 20 de noviembre.** La PR #87 añadió al [`Dockerfile`](../../backend/Dockerfile) un paso que actualizaba solo ese paquete (`--only-upgrade zlib1g`), para no arrastrar nada ajeno al fallo.
- **`libzstd1` (CVE-2026-124851), el 25 de noviembre.** Hizo fallar la PR #98, que solo cambiaba documentación. Para entonces la imagen base ya traía `zlib1g` corregido: el paso de #87 no hacía nada, y había que cambiarlo por otro paquete.

Cambiar de imagen base no lo evitaba. Escaneadas el 25 de noviembre con el mismo Trivy que CI (0.76.2), contando las críticas y altas:

| Imagen | Con parche (ponen el job en rojo) | Sin parche |
|---|---|---|
| `python:3.12-slim` (la que se usa) | 1 (`libzstd1`) | 13 |
| `python:3.13-slim` y `python:3.14-slim` | 6 | 13 |
| `python:3.12-slim-bookworm` | 0 | 32 |
| `python:3.12-alpine` | 16 (`krb5-libs`) | Trivy no las detecta en Alpine |

## Decisión

- **Las dependencias directas, de una en una.** Las que el proyecto declara en `backend/pyproject.toml` y `frontend/package.json` se actualizan una a una, revisando cada cambio.
- **Las indirectas, por escaneo.** Las que el proyecto no elige, como los paquetes del sistema de las imágenes base, no se siguen una a una: basta con que pasen los escaneos de seguridad.
- **La imagen del backend instala todos los parches de Debian.** La etapa final del `Dockerfile` ejecuta `apt-get upgrade` en lugar de actualizar paquetes concretos, y la imagen base sigue siendo `python:3.12-slim`.

## Alternativas descartadas

- **Actualizar solo el paquete afectado**, como en #87. No arrastra nada ajeno al fallo, pero obliga a tocar el `Dockerfile` cada vez que la imagen base se retrasa, y el paso se queda sin hacer nada en cuanto la imagen base se pone al día.
- **Otra imagen base.** Ninguna de las candidatas lo evitaba (tabla del contexto). `slim-bookworm` sale en verde porque Debian 12 aún no tiene el parche de `libzstd1` ni el de `zlib1g`, y `ignore-unfixed` oculta las dos (#99). `alpine` sale en rojo por `krb5-libs`, Trivy no detecta en ella las vulnerabilidades sin parche, y obligaba a pasar a musl y a reescribir el `Dockerfile`.
- **Esperar a que la imagen base se actualice.** El job sigue en rojo mientras tanto, y nada en el repo puede arreglarlo.
- **Ocultar la vulnerabilidad con un `.trivyignore`.** La vulnerabilidad seguiría en la imagen, y la regla del proyecto es corregir un hallazgo, no ocultarlo.

## Consecuencias

- Un parche que Debian ya ha publicado deja de poner el job `trivy` en rojo, sin tocar el `Dockerfile`.
- Dos builds de días distintos pueden llevar versiones distintas de los paquetes del sistema. Ya pasaba antes: la etiqueta `3.12-slim` se reconstruye con cada actualización de Debian y de Python.
- El build instala lo que la imagen base aún no trae. En la primera ejecución en CI fueron `libzstd1`, `login.defs` y `passwd`, en unos segundos.
- La etapa `builder` no se actualiza: no llega a la imagen final y Trivy no la escanea.
- La imagen del frontend, `nginx:1.30-alpine`, no lo necesita hoy. Si un día el job falla por un paquete de Alpine que ya tiene parche, se aplica la misma regla con `apk upgrade`.
- Las vulnerabilidades sin parche siguen sin verse en CI: este ADR no cambia `ignore-unfixed`, que es #99.
- Sustituye lo decidido en #87, actualizar solo `zlib1g`, que no tenía ADR.
