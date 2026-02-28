#!/bin/bash
echo ""
echo " ================================================"
echo "  PulsePay - Starting Development Server"
echo " ================================================"
echo ""

if [ ! -f backend/.env ]; then
  echo " ERROR: backend/.env not found!"
  echo " Run: cp .env.example backend/.env"
  echo " Then fill in your DATABASE_URL and JWT_SECRET"
  exit 1
fi

echo " Open: http://localhost:5000"
echo " Admin: http://localhost:5000/admin/"
echo ""
npm run dev
