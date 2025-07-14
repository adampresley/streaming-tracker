# Variables
IMAGE_NAME = streaming-tracker
TAG = latest
TAR_FILE = $(IMAGE_NAME)-$(TAG).tar

# Default target
.PHONY: help
help:
	@echo "Available targets:"
	@echo "  build       - Build Docker image"
	@echo "  build-tar   - Build Docker image and export as TAR"
	@echo "  clean       - Remove Docker image and TAR file"
	@echo "  run         - Run the Docker container"
	@echo "  stop        - Stop running containers"

# Build Docker image
.PHONY: build
build:
	docker build -t $(IMAGE_NAME):$(TAG) .

# Build Docker image and export as TAR
.PHONY: build-tar
build-tar: build
	docker save $(IMAGE_NAME):$(TAG) -o $(TAR_FILE)
	@echo "Docker image saved as $(TAR_FILE)"

# Clean up Docker image and TAR file
.PHONY: clean
clean:
	-docker rmi $(IMAGE_NAME):$(TAG)
	-rm -f $(TAR_FILE)

# Run the Docker container
.PHONY: run
run:
	docker run -d -p 3000:3000 --name $(IMAGE_NAME) $(IMAGE_NAME):$(TAG)

# Stop running containers
.PHONY: stop
stop:
	-docker stop $(IMAGE_NAME)
	-docker rm $(IMAGE_NAME)

# Load TAR file into Docker
.PHONY: load
load:
	docker load -i $(TAR_FILE)
