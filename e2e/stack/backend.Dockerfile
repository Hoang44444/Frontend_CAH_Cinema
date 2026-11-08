# Build backend từ bản clone trong e2e/.stack/backend (nhánh main của repo backend,
# nơi chưa có Dockerfile).
FROM eclipse-temurin:17-jdk AS build
WORKDIR /app

# Wrapper và build script trước, src sau: sửa code không phải tải lại dependency.
COPY gradle gradle
COPY gradlew build.gradle settings.gradle ./
RUN chmod +x gradlew && ./gradlew --no-daemon dependencies --configuration runtimeClasspath || true

COPY src src
RUN ./gradlew --no-daemon bootJar -x test

FROM eclipse-temurin:17-jre
WORKDIR /app

# Image postgres:15 chỉ biết Asia/Ho_Chi_Minh, không biết Asia/Saigon.
ENV TZ=Asia/Ho_Chi_Minh
ENV JAVA_TOOL_OPTIONS="-Duser.timezone=Asia/Ho_Chi_Minh"

COPY --from=build /app/build/libs/*-SNAPSHOT.jar app.jar

EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
