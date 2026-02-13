import serverless from 'serverless-http';
import { expressApp } from '../../src/index.js';

export const handler = serverless(expressApp, {
  basePath: '/.netlify/functions/app'
});
