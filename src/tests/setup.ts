// vitest global setup: configure Neon WebSocket for Node.js test environment
import ws from 'ws';
import { neonConfig } from '@neondatabase/serverless';

neonConfig.webSocketConstructor = ws;
