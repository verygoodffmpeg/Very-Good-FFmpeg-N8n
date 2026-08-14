/* eslint-disable -- dev-only file, excluded from the published package */
/**
 * Loads e2e test environment variables from test/.env.test.
 */
import { config } from 'dotenv';
import path from 'node:path';

config({ path: path.resolve(__dirname, '.env.test'), quiet: true });