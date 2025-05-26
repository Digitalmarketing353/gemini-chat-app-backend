#!/bin/sh
# docker-entrypoint.sh

echo "Docker Entrypoint: Running database migrations..."
npx sequelize-cli db:migrate
MIGRATION_STATUS=$? # Capture exit status of migrations

if [ $MIGRATION_STATUS -ne 0 ]; then
    echo "Docker Entrypoint: Database migrations FAILED with status $MIGRATION_STATUS. Exiting."
    exit $MIGRATION_STATUS
fi
echo "Docker Entrypoint: Database migrations COMPLETED."

echo "Docker Entrypoint: Running database seeders..."
npx sequelize-cli db:seed:all # Run all seeders
SEED_STATUS=$? # Capture exit status of seeders

if [ $SEED_STATUS -ne 0 ]; then
    echo "Docker Entrypoint: Database seeders FAILED with status $SEED_STATUS. Continuing startup, but initial data might be missing."
    # You might choose to exit here too if seeds are critical: exit $SEED_STATUS
fi
echo "Docker Entrypoint: Database seeders COMPLETED."


echo "Docker Entrypoint: Starting application..."
# Execute the original CMD from Dockerfile (e.g., npm start)
exec "$@"