# syntax = docker/dockerfile:1

# Adjust BUN_VERSION as desired
ARG BUN_VERSION=1.1.40-slim
FROM oven/bun:${BUN_VERSION} as base

LABEL fly_launch_runtime="Bun"

# Bun app lives here
WORKDIR /app

# Install curl
RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y ca-certificates curl gnupg && \
    rm -rf /var/lib/apt/lists /var/cache/apt/archives

# Latest releases available at https://github.com/aptible/supercronic/releases
ENV SUPERCRONIC_URL=https://github.com/aptible/supercronic/releases/download/v0.2.29/supercronic-linux-amd64 \
SUPERCRONIC=supercronic-linux-amd64 \
SUPERCRONIC_SHA1SUM=cd48d45c4b10f3f0bfdd3a57d054cd05ac96812b

RUN curl -fsSLO "$SUPERCRONIC_URL" \
&& echo "${SUPERCRONIC_SHA1SUM}  ${SUPERCRONIC}" | sha1sum -c - \
&& chmod +x "$SUPERCRONIC" \
&& mv "$SUPERCRONIC" "/usr/local/bin/${SUPERCRONIC}" \
&& ln -s "/usr/local/bin/${SUPERCRONIC}" /usr/local/bin/supercronic

# Copy the crontab file
COPY crontab /app/crontab

# Install npm modules
COPY --link bun.lockb package.json ./
RUN bun install --production --frozen-lockfile

# Create a non-root user to run the app
RUN useradd chrome --create-home --shell /bin/bash && \
    chmod -R +r /app/node_modules
USER chrome:chrome

# Copy application code
COPY --link . .

# Start the server
# CMD [ "bun", "run", "start" ]

# Run the app and the cron process
CMD ["sh", "-c", "bun run start & supercronic /app/crontab"]
