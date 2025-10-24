# Frontend Dockerfile - multi-stage build
FROM node:18-alpine as build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:stable-alpine
COPY --from=build /app/build /usr/share/nginx/html
# Optional: copy a custom nginx.conf if you want to route /api to backend
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
