
# Stage 1: Build React frontend
FROM node:22-alpine AS frontend-build

WORKDIR /frontend

COPY frontend/package*.json ./

RUN npm ci

COPY frontend/ ./

ENV VITE_API_URL=/api

RUN npm run build


# Stage 2: Build Spring Boot backend
FROM maven:3.9-eclipse-temurin-17 AS backend-build

WORKDIR /app

COPY backend/pom.xml ./

COPY backend/src ./src

# Copy React production files into Spring Boot static resources
COPY --from=frontend-build /frontend/dist/ ./src/main/resources/static/

RUN mvn -q -DskipTests package


# Stage 3: Run application
FROM eclipse-temurin:17-jre

WORKDIR /app

COPY --from=backend-build /app/target/annara-api-1.0.0.jar app.jar

EXPOSE 8080

ENTRYPOINT ["java", "-jar", "app.jar"]
