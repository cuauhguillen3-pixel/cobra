# Etapa de construcción
FROM node:18-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Declarar argumentos de construcción para capturar las variables de Railway
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY

# Establecerlas como variables de entorno para que el build las vea
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY

RUN npm run build

# Etapa de producción
FROM node:18-alpine

WORKDIR /app

RUN npm install -g serve

COPY --from=builder /app/dist ./dist

EXPOSE 3000

CMD ["serve", "-s", "dist", "-l", "3000"]
