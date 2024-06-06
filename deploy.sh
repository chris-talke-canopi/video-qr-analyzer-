#!/bin/bash

user=canopi
host=docker.canopi.com.au

# Compress Folder Contents (uses .gitignore values)
git archive -o app.tar.gz main

# Transfer Files to said folder '~/auto-deploy'
scp app.tar.gz .env $user@$host:~/auto-deploy

ssh $user@$host << EOF
  cd ~/auto-deploy
  tar xvzf app.tar.gz

  # Cleanup if exists
  docker container rm -f vidchanalyzer
  docker image rm -f canopi/vidchanalyzer:latest

  # Build, Remove and Deploy Container
  docker build --no-cache -t canopi/vidchanalyzer:latest .
    
  docker run \
    --name vidchanalyzer \
    -p 1356:1356 \
    -dit \
    --restart=unless-stopped \
    canopi/vidchanalyzer:latest

  docker network connect INTERNAL vidchanalyzer

  # Cleanup Files
  ls -l
  rm -rf ~/auto-deploy/*

  # Check Docker
  docker ps | grep vidchanalyzer

  # Disconnect
  exit
EOF

rm -f app.tar.gz