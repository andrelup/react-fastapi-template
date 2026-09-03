# syntax=docker/dockerfile:1

# Etapa de desarrollo: la que usa docker compose (`make dev`). Trae las
# dependencias instaladas en la imagen; el codigo fuente se monta como volumen
# desde el host para el hot reload de Vite.
FROM node:24-alpine AS development

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci

COPY . .

EXPOSE 3000

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

# Etapa de build: compila la SPA a ficheros estaticos en /app/dist.
FROM node:24-alpine AS builder

WORKDIR /app

# La URL de la API se inyecta en el bundle en tiempo de build, no de ejecucion.
ARG VITE_API_URL=http://localhost:8000
ENV VITE_API_URL=${VITE_API_URL}

COPY package.json package-lock.json ./

RUN npm ci

COPY . .

RUN npm run build

# Etapa final: nginx sirviendo los estaticos, sin Node ni dependencias de dev.
FROM nginx:1.27-alpine AS runtime

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=10s --timeout=5s --start-period=5s --retries=5 \
    CMD wget --spider -q http://localhost/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
