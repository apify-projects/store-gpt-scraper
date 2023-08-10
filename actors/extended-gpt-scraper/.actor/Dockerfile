# Build the TypeScript code in a separate stage, to reduce the size of the final image.
FROM apify/actor-node-playwright-chrome:16 AS builder
ARG ACTOR_PATH_IN_DOCKER_CONTEXT

# Copy root package*.json
COPY --chown=myuser package*.json ./

# Copy package.jsons of all used workspace members
COPY --chown=myuser "${ACTOR_PATH_IN_DOCKER_CONTEXT}/package*.json" "${ACTOR_PATH_IN_DOCKER_CONTEXT}/"
COPY --chown=myuser packages/gpt-scraper-core/package*.json packages/gpt-scraper-core/

# Install all dependencies. Don't audit to speed up the installation.
RUN npm install --include=dev --audit=false

# Next, copy the rest of the source files.
COPY --chown=myuser "${ACTOR_PATH_IN_DOCKER_CONTEXT}" "./${ACTOR_PATH_IN_DOCKER_CONTEXT}"
COPY --chown=myuser packages packages/
COPY --chown=myuser tsconfig.build.json ./

# Build the TypeScript libraries
RUN npm run -w "${ACTOR_PATH_IN_DOCKER_CONTEXT}" build

# Create the final image, only with compiled code and production dependencies.
FROM apify/actor-node-playwright-chrome:16
ARG ACTOR_PATH_IN_DOCKER_CONTEXT

# Copy root package*.json
COPY --chown=myuser package*.json ./

# Copy package.jsons of all workspace members
COPY --chown=myuser "${ACTOR_PATH_IN_DOCKER_CONTEXT}/package*.json" "${ACTOR_PATH_IN_DOCKER_CONTEXT}/"
COPY --chown=myuser packages/gpt-scraper-core/package*.json packages/gpt-scraper-core/

# Install NPM packages, skip optional and development dependencies to
# keep the image small. Avoid logging too much and print the dependency
# tree for debugging
RUN npm --quiet set progress=false \
    && npm install --omit=dev --omit=optional \
    && echo "Installed NPM packages:" \
    && (npm list --omit=dev --all || true) \
    && echo "Node.js version:" \
    && node --version \
    && echo "NPM version:" \
    && npm --version \
    && rm -r ~/.npm

# Copy the rest of the source files.
COPY --chown=myuser "${ACTOR_PATH_IN_DOCKER_CONTEXT}" "./${ACTOR_PATH_IN_DOCKER_CONTEXT}"
COPY --chown=myuser packages packages/

# Copy built JS files from the `builder` stage
COPY --chown=myuser --from=builder "/home/myuser/${ACTOR_PATH_IN_DOCKER_CONTEXT}/dist" "${ACTOR_PATH_IN_DOCKER_CONTEXT}/dist"
COPY --chown=myuser --from=builder /home/myuser/packages/gpt-scraper-core/dist packages/gpt-scraper-core/dist

# Run the actor's start command when running this image
ENV ACTOR_PATH_IN_DOCKER_CONTEXT="${ACTOR_PATH_IN_DOCKER_CONTEXT}"
CMD npm run -w "${ACTOR_PATH_IN_DOCKER_CONTEXT}" start:prod --silent
