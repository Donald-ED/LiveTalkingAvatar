#!/bin/bash
# Setup script for SadTalker

# Colors for terminal output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Setting up SadTalker for talking avatar generation...${NC}"

# Check if SadTalker directory already exists
if [ -d "SadTalker" ]; then
    echo -e "${YELLOW}SadTalker directory already exists.${NC}"
else
    echo -e "${GREEN}Cloning SadTalker repository...${NC}"
    git clone https://github.com/OpenTalker/SadTalker.git
    
    if [ $? -ne 0 ]; then
        echo -e "${RED}Failed to clone SadTalker repository.${NC}"
        exit 1
    fi
fi

# Navigate to SadTalker directory
cd SadTalker || exit 1

# Install requirements
echo -e "${GREEN}Installing Python requirements...${NC}"
pip install -r requirements.txt

if [ $? -ne 0 ]; then
    echo -e "${RED}Failed to install requirements.${NC}"
    exit 1
fi

# Download checkpoints
echo -e "${GREEN}Downloading model checkpoints...${NC}"
chmod +x scripts/download_models.sh
./scripts/download_models.sh

if [ $? -ne 0 ]; then
    echo -e "${RED}Failed to download checkpoints.${NC}"
    exit 1
fi

# Return to original directory
cd ..

echo -e "${GREEN}SadTalker setup complete!${NC}"
echo -e "${GREEN}You can now use generate_talking_face.py to create talking face animations.${NC}"
echo -e "${YELLOW}Example:${NC}"
echo -e "python generate_talking_face.py --text \"Hello, this is a test.\" --image path/to/image.jpg" 