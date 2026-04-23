#!/bin/bash
echo "Starting BLOC Scoring System..."

# Start backend
cd "$(dirname "$0")/backend"
node src/index.js &
BACKEND_PID=$!
echo "Backend started (PID: $BACKEND_PID) → http://localhost:3001"

# Start frontend
cd "$(dirname "$0")/frontend"
npm run dev &
FRONTEND_PID=$!
echo "Frontend started (PID: $FRONTEND_PID) → http://localhost:5173"

echo ""
echo "Open: http://localhost:5173"
echo "Login: admin / admin1234"
echo ""
echo "Press Ctrl+C to stop both servers."

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; echo 'Stopped.'" SIGINT SIGTERM
wait
