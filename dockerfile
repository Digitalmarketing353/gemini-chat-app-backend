# Dockerfile
FROM node:18-alpine AS production
WORKDIR /usr/src/app
COPY package*.json ./

# Install sequelize-cli globally within the image OR ensure it's a production dependency
# Option A: Install globally (simpler for entrypoint script)
RUN npm install -g sequelize-cli
# Option B: If sequelize-cli is in your package.json dependencies (not devDependencies)
# then npx sequelize-cli will work fine. Ensure it's not in devDependencies if using npm ci --omit=dev

RUN npm ci --omit=dev
COPY . .

# Copy the entrypoint script and make it executable
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 3000
ENV NODE_ENV=production
ENV PORT=3000

# Set the entrypoint script
ENTRYPOINT ["docker-entrypoint.sh"]
# The CMD will now be passed as arguments to the entrypoint script
CMD [ "npm", "start" ]