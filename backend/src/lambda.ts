import serverlessExpress from '@codegenie/serverless-express';
import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2, Handler } from 'aws-lambda';
import { loadCloudSecrets } from './infrastructure/config/cloud-secrets';

type HttpHandler = Handler<APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2>;
let initialized: Promise<HttpHandler> | undefined;

async function initialize(): Promise<HttpHandler> {
  await loadCloudSecrets();
  const { createApplication } = await import('./bootstrap');
  const app = await createApplication();
  try {
    await app.init();
    return serverlessExpress<APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2>({
      app: app.getHttpAdapter().getInstance(),
      eventSourceName: 'AWS_API_GATEWAY_V2',
      resolutionMode: 'PROMISE',
      respondWithErrors: false,
      logSettings: { level: 'error' },
      binarySettings: { contentTypes: ['image/*', 'application/pdf', 'application/octet-stream'] },
    });
  } catch (error) {
    await app.close();
    throw error;
  }
}

export const handler: HttpHandler = async (event, context, callback) => {
  context.callbackWaitsForEmptyEventLoop = false;
  // Share initialization as well as the application across warm invocations.
  initialized ??= initialize().catch((error: unknown) => {
    initialized = undefined;
    throw error;
  });
  const proxy = await initialized;
  const response = await proxy(event, context, callback);
  if (!response) throw new Error('El adaptador Lambda no produjo una respuesta HTTP');
  return response;
};
