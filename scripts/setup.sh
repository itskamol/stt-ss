#!/bin/bash

# Simple Environment Setup Script

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🚀 Staff App Environment Setup${NC}"
echo ""

# Check if local.env exists
# Check if local.env exists
if [ ! -f "config/environments/local.env" ]; then
    echo -e "${YELLOW}📝 Creating local.env from template...${NC}"
    cp config/environments/.env.example config/environments/local.env
    echo -e "${GREEN}✅ Created config/environments/local.env${NC}"
    echo -e "${YELLOW}⚠️  Please edit local.env and update the values if needed${NC}"
else
    echo -e "${GREEN}✅ local.env already exists${NC}"
fi

# Make scripts executable
chmod +x scripts/docker-env.sh
chmod +x scripts/setup.sh

echo ""
echo -e "${BLUE}🎯 Quick Start:${NC}"
echo -e "1. Edit config/environments/local.env if needed"
echo -e "2. Run: ${GREEN}./scripts/docker-env.sh dev up${NC}"
echo -e "3. Open: ${GREEN}http://localhost:3001/api/v1${NC}"
echo ""
echo -e "${BLUE}📋 Available commands:${NC}"
echo -e "  ./scripts/docker-env.sh dev up      # Start development"
echo -e "  ./scripts/docker-env.sh dev down    # Stop services"
echo -e "  ./scripts/docker-env.sh dev logs    # View logs"
echo -e "  ./scripts/docker-env.sh dev restart # Restart services"
echo ""