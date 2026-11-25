FROM node:22-alpine AS runtime
ENV NODE_ENV=production PORT=8080
WORKDIR /app
COPY --chown=node:node package.json server.mjs ./
USER node
EXPOSE 8080
CMD ["node", "server.mjs"]
