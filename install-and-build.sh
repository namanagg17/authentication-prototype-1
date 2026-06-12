#!/bin/bash
set -e

echo "=== Installing dependencies and building all modules ==="
ROOT_DIR=$(pwd)

# Function to install and build
install_and_build() {
  local dir=$1
  local is_service=$2 # true or false
  
  echo "--------------------------------------------------"
  echo "Setting up: $dir"
  echo "--------------------------------------------------"
  
  # 1. Install Backend
  cd "$ROOT_DIR/$dir"
  echo "Installing backend dependencies in $dir..."
  npm install
  
  # 2. Install & Build Frontend
  if [ -d "frontend" ]; then
    cd frontend
    echo "Installing frontend dependencies in $dir/frontend..."
    npm install
    echo "Building frontend in $dir/frontend..."
    npm run build
  fi
}

# Run for each
install_and_build "idp"
install_and_build "shopping-service"
install_and_build "prime-service"
install_and_build "music-service"

echo "=================================================="
echo "Setup finished successfully!"
echo "You can now start each service using 'node server.js' inside its directory."
echo "=================================================="
