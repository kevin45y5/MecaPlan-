# ============================================================
# sugoi_project :: API Node/Express
# ============================================================
FROM node:20-alpine

WORKDIR /app

# Instalar dependencias primero (mejor capa de caché)
COPY package.json ./
RUN npm install --omit=dev

# Código fuente
COPY src ./src

ENV PORT=3001
EXPOSE 3001

CMD ["node", "src/app.js"]
