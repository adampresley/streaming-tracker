# Start from golang base image
FROM golang:1.25.1-alpine3.21 AS builder

EXPOSE 8080

# Set the current working directory inside the container
WORKDIR /build

# Install necessary packages
RUN apk add --no-cache make

# Copy go.mod, go.sum files and download deps
COPY go.mod ./
COPY go.sum ./
COPY Makefile ./
RUN go mod download

# Copy sources to the working directory and build
COPY . .
RUN echo "Building app" && make build

# Start a new stage from debian
FROM alpine:3.22.1
LABEL org.opencontainers.image.source=https://github.com/adampresley/streaming-tracker

WORKDIR /dist

RUN mkdir -p /dist/sql-migrations

# Copy the build artifacts from the previous stage
COPY --from=builder /build/cmd/streaming-tracker/streaming-tracker .

# Run the executable
ENTRYPOINT ["./streaming-tracker"]

