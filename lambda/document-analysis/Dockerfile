# ==============================================================================
# Stage 1: Install dependencies
# ==============================================================================
FROM node:22-slim AS deps

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ==============================================================================
# Stage 2: Build (esbuild bundle)
# ==============================================================================
FROM deps AS builder

WORKDIR /app
COPY src ./src/
COPY lambda ./lambda/
COPY tsconfig.json ./

RUN npx esbuild lambda/document-analysis/handler.ts \
      --bundle \
      --platform=node \
      --target=node22 \
      --outfile=dist/handler.js \
      --external:pdf-to-img \
      --external:mammoth \
      --external:openai \
      --external:minio \
      --external:pdfjs-dist

# ==============================================================================
# Stage 3: Lambda runtime
# ==============================================================================
FROM public.ecr.aws/lambda/nodejs:22

# Copy built handler
COPY --from=builder /app/dist/handler.js ${LAMBDA_TASK_ROOT}/dist/handler.js

# Copy node_modules (runtime deps)
COPY --from=builder /app/node_modules ${LAMBDA_TASK_ROOT}/node_modules

CMD ["dist/handler.handler"]
