FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# Same-origin: nginx proxies /api to the backend, so no absolute URL is baked in.
ARG VITE_API_URL=/api
ENV VITE_API_URL=$VITE_API_URL
# Baked in at build time, so a change needs a rebuild, not a restart. Restrict
# the key by HTTP referrer in Google Cloud — it ships in the bundle either way.
ARG VITE_GOOGLE_MAPS_API_KEY=
ENV VITE_GOOGLE_MAPS_API_KEY=$VITE_GOOGLE_MAPS_API_KEY
ARG VITE_GOOGLE_MAPS_MAP_ID=
ENV VITE_GOOGLE_MAPS_MAP_ID=$VITE_GOOGLE_MAPS_MAP_ID
RUN npm run build

FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
