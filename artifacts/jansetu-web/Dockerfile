FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm install --legacy-peer-deps

# Build the React app
# REACT_APP_BACKEND_URL is intentionally empty so the app uses relative /api URLs,
# which Nginx proxies to the backend container.
COPY . .
RUN REACT_APP_BACKEND_URL="" npm run build

# ─── Production image ───────────────────────────────────────────────────────
FROM nginx:1.27-alpine

# Copy built React app
COPY --from=builder /app/build /usr/share/nginx/html

# Copy Nginx site config
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80 443

CMD ["nginx", "-g", "daemon off;"]
