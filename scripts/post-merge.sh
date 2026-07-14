#!/bin/bash
set -e

echo "=== Post-merge setup ==="

# Install Python backend dependencies
echo "Installing Python dependencies..."
cd backend
pip install -r requirements.txt -q
cd ..

# Install frontend Node dependencies
echo "Installing Node dependencies..."
cd frontend
npm install --legacy-peer-deps --silent
cd ..

echo "=== Post-merge setup complete ==="
