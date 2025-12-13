FROM node:18-alpine
WORKDIR /app

COPY package.json package-lock.json* ./
# Install dependencies at container start instead of build time to avoid CI/network issues.
# The docker-compose command runs `npm install` when the container starts.

COPY . ./

EXPOSE 5173

CMD ["sh", "-c", "npm run dev -- --host 0.0.0.0 --port 5173"]
