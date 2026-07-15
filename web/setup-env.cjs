// Loaded via --require before server.ts so process.env is populated
// before @t3-oss/env-nextjs validates and caches env vars.
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
