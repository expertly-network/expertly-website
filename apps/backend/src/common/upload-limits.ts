// Request-level multipart caps (registered on @fastify/multipart in main.ts). Each upload route
// still enforces its own, usually smaller, per-kind size/type rules after sniffing the bytes.
export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
/** Most files one request may carry (POST /v1/articles/ai-draft source files). */
export const MAX_UPLOAD_FILES = 5;
