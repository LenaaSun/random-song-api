
# API

## Overview

1. **Song Discovery** – Browse a Spotify-integrated song database by genre, get random songs, and view all available genres.

The API connects to MongoDB Atlas and seeds data from a CSV file on first startup.

## Installation

```bash
# Clone the repository
git clone <your-repo-url>

# Navigate to the project directory
cd api

# Install dependencies
npm install
```

## Running the Server

```bash
# Start the development server
npm run dev

# Or start in production
npm start
```

The server will be available at `http://localhost:3000` (or your configured port in your .env file).

## Usage

Basic get request:

```bash
curl `http://localhost:3000/get-random-song-by-genre?genre=$genrevalue`
```

## API Endpoints
see index.js

## Contributing

Guidelines for contributing to this project.

## License

MIT
