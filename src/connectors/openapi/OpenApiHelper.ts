/*
 * Minimal OpenAPI helper used at runtime to surface small, actionable
 * hints when an API returns a client-side error (for example a 400
 * from a search endpoint). We intentionally keep this lightweight and
 * dependency-free — the JSON specs are bundled with the app so we
 * can read them synchronously.
 */
import jellyseerrSpec from '@/connectors/openapi-specs/jellyseerr-openapi.json';
import sonarrSpec from '@/connectors/openapi-specs/sonarr-openapi.json';
import radarrSpec from '@/connectors/openapi-specs/radarr-openapi.json';
import prowlarrSpec from '@/connectors/openapi-specs/prowlarr-openapi.json';
import bazarrSpec from '@/connectors/openapi-specs/bazarr-openapi.json';

type OpenApiSpec = Record<string, any>;

const SPEC_MAP: Record<string, OpenApiSpec> = {
  jellyseerr: jellyseerrSpec as OpenApiSpec,
  sonarr: sonarrSpec as OpenApiSpec,
  radarr: radarrSpec as OpenApiSpec,
  prowlarr: prowlarrSpec as OpenApiSpec,
  bazarr: bazarrSpec as OpenApiSpec,
};

const tryGetOperation = (pathObj: Record<string, any> | undefined, operationName: string) => {
  if (!pathObj) return undefined;

  // Find an operation object where operationId matches (case-insensitive)
  for (const method of Object.keys(pathObj)) {
    const op = pathObj[method];
    if (!op) continue;
    if (typeof op.operationId === 'string' && op.operationId.toLowerCase() === operationName.toLowerCase()) {
      return { method, operation: op };
    }
  }

  // Fallback: prefer GET/POST if present
  if (pathObj.get) return { method: 'get', operation: pathObj.get };
  if (pathObj.post) return { method: 'post', operation: pathObj.post };

  return undefined;
};

export const getOpenApiOperationHint = (
  serviceType: string,
  endpoint: string,
  operationName: string,
): string | undefined => {
  const spec = SPEC_MAP[serviceType];
  if (!spec) return undefined;

  const paths = spec.paths as Record<string, any> | undefined;
  if (!paths) return undefined;

  const pathObj = paths[endpoint] ?? paths[endpoint.replace(/\/$/, '')];
  const found = tryGetOperation(pathObj, operationName);
  if (!found) return undefined;

  const op = found.operation as Record<string, any>;

  const parts: string[] = [];

  // Parameters (query/path/header/cookie)
  if (Array.isArray(op.parameters) && op.parameters.length > 0) {
    const params = op.parameters.map((p: Record<string, any>) => {
      const name = p.name;
      const required = p.required ? 'required' : 'optional';
      const schema = p.schema ?? {};
      const type = schema.type ?? (schema.$ref ? 'object' : 'unknown');
      const constraints: string[] = [];
      if (typeof schema.minLength === 'number') constraints.push(`minLength:${schema.minLength}`);
      if (typeof schema.maxLength === 'number') constraints.push(`maxLength:${schema.maxLength}`);
      if (typeof schema.minimum === 'number') constraints.push(`minimum:${schema.minimum}`);
      if (typeof schema.maximum === 'number') constraints.push(`maximum:${schema.maximum}`);
      const constraintStr = constraints.length > 0 ? ` (${constraints.join(', ')})` : '';
      return `${name}: ${type}, ${required}${constraintStr}`;
    });

    parts.push(`Expected parameters: ${params.join('; ')}`);
  }

  // Request body hints
  if (op.requestBody && op.requestBody.content) {
    const content = op.requestBody.content;
    const mediaTypes = Object.keys(content).slice(0, 3);
    parts.push(`Request body allowed types: ${mediaTypes.join(', ')}`);
  }

  // Response hints (show common client-side response expectations)
  if (op.responses) {
    const resp400 = op.responses['400'] || op.responses['422'];
    if (resp400 && resp400.description) {
      parts.push(`API validation: ${resp400.description}`);
    }
  }

  if (parts.length === 0) return undefined;
  return parts.join(' — ');
};

export const hasOpenApiForService = (serviceType: string): boolean => Boolean(SPEC_MAP[serviceType]);
