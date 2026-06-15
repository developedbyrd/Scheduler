// The Zernio SDK exports a default class. Using a default import works at runtime,
// but TypeScript sometimes treats the imported value as a namespace without a
// construct signature. Adding a ts-ignore ensures the constructor call is
// accepted while keeping the correct runtime behavior.
// @ts-ignore
import Zernio from '@zernio/node';

// @ts-ignore – Zernio's type definitions do not expose a construct signature.
const ZernioCtor = Zernio as any;
const zernio = new ZernioCtor({
  apiKey: process.env.ZERNIO_API_KEY || '',
  // The SDK expects `baseURL` (capitalized) for overriding the API endpoint.
  baseURL: process.env.ZERNIO_BASE_URL || '',
});

export default zernio;