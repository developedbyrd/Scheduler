import Zernio from '@zernio/node';

const zernio = new Zernio({
  apiKey: process.env.ZERNIO_API_KEY || '',
  baseUrl: process.env.ZERNIO_BASE_URL || '',
});

export default zernio;