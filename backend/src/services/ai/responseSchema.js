/**
 * Shallow JSON Schema for a zod object: top-level keys and their basic types.
 * Enough for Gemini to guarantee an object with the right fields; zod still does the full validation.
 */
export function toResponseSchema(schema) {
  const shape = schema?.shape;
  if (!shape) return undefined;
  const properties = {};
  const required = [];
  for (const [key, field] of Object.entries(shape)) {
    const { type, optional } = unwrap(field);
    properties[key] = type;
    if (!optional) required.push(key);
  }
  return { type: 'object', properties, required };
}

function unwrap(field) {
  let f = field;
  let optional = false;
  for (;;) {
    const t = f?._def?.typeName;
    if (t === 'ZodOptional' || t === 'ZodDefault') optional = true;
    if (t === 'ZodOptional' || t === 'ZodDefault' || t === 'ZodCatch' || t === 'ZodEffects') {
      f = f._def.innerType || f._def.schema;
      continue;
    }
    break;
  }
  const t = f?._def?.typeName;
  if (t === 'ZodString') return { type: { type: 'string' }, optional };
  if (t === 'ZodNumber') return { type: { type: 'number' }, optional };
  if (t === 'ZodBoolean') return { type: { type: 'boolean' }, optional };
  if (t === 'ZodEnum') return { type: { type: 'string', enum: f._def.values }, optional };
  if (t === 'ZodArray') return { type: { type: 'array' }, optional };
  return { type: {}, optional };
}
