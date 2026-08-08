#!/usr/bin/env bash
set -e
cd "$(dirname "$0")/.."
[ -f .env ] || cp .env.example .env
npm install
# Serve at root during local dev so hash routes are simplest.
VITE_BASE=/ npm run dev
