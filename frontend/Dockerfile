# syntax=docker/dockerfile:1

# Etapa de build: compila la SPA a ficheros estaticos en /app/dist.
# Versión de Node de la etapa de build. Debe coincidir con `frontend/.nvmrc`;
# el job `lint` de CI lo comprueba. Se declara antes del primer FROM porque un
# Dockerfile no puede leer ficheros en ese punto.
ARG NODE_VERSION=24

FROM node:${NODE_VERSION}-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci

# La URL de la API se inyecta en el bundle en tiempo de build, no de ejecucion.
# No tiene valor por defecto: cada entorno la pasa como build arg (compose la
# lee del env-file) y, si falta, el build se para aqui diciendo cual. Va
# despues de `npm ci` para que construir las imagenes de otro entorno, con
# otra URL, no invalide la cache de las dependencias.
ARG VITE_API_URL
RUN test -n "$VITE_API_URL" || { echo "Falta el build arg VITE_API_URL: pasalo con --build-arg, o construye con make build, que lo lee del .env" >&2; exit 1; }
ENV VITE_API_URL=${VITE_API_URL}

COPY . .

RUN npm run build

# Etapa final: nginx sirviendo los estaticos, sin Node ni dependencias de dev.
FROM nginx:1.27-alpine AS runtime

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

# La imagen corre como el usuario nginx, no como root. Para seguir sirviendo en
# el 80 (puerto privilegiado) se le da al binario la capacidad de bindearlo, en
# lugar de arrancar el master como root, y se le pasa la propiedad de lo que
# nginx escribe en caliente (cache y fichero de pid).
RUN apk add --no-cache --virtual .setcap libcap \
    && setcap cap_net_bind_service=+ep /usr/sbin/nginx \
    && apk del .setcap \
    && touch /var/run/nginx.pid \
    && chown -R nginx:nginx /var/cache/nginx /var/run/nginx.pid

USER nginx

EXPOSE 80

# 127.0.0.1 y no localhost: nginx escucha solo en IPv4 y localhost resuelve
# antes a ::1 dentro del contenedor.
HEALTHCHECK --interval=10s --timeout=5s --start-period=5s --retries=5 \
    CMD wget --spider -q http://127.0.0.1/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
