import type { OpenAPIV3_1 } from 'openapi-types'

import { type ItemType, ResponseHeaders, Type } from '../../../../v2'
import type { Route } from '../types'

import { getResourceParameters } from './parameters'
import { APIErrors } from './errors'

// eslint-disable-next-line jsdoc/require-jsdoc
function createBaseItem(resource: Type | ItemType) {
    return {
        id: {
            type: <const>'string',
        },
        type: {
            type: <const>'string',
            enum: [resource],
        },
    }
}

// eslint-disable-next-line jsdoc/require-jsdoc
function createResponse(resource: Type, array?: boolean) {
    const { includesKeys, resources } = getResourceParameters(resource)

    const data = {
        type: <const>'object',
        required: ['id', 'type'],
        properties: {
            ...createBaseItem(resource),
            attributes: {
                $ref: `#/components/schemas/${resource}`,
            },
            relationships: {
                properties: includesKeys.reduce((props, key) => ({
                    ...props,
                    [key.name]: {
                        required: ['data'],
                        properties: {
                            data: key.type === 'array'
                                ? { type: 'array', items: { properties: createBaseItem(key.resource), required: ['id', 'type'] } }
                                : { properties: createBaseItem(key.resource), required: ['id', 'type'] },
                            ...(!(key.type === 'array') ? { links: { properties: { related: { type: 'string', format: 'uri' } } } } : {}),
                        }
                    }
                }), {}),
            },
        }
    }

    return {
        type: 'object',
        required: ['data', !array ? 'links' : 'meta'],
        properties: {
            data: array ? { type: 'array', items: data } : data,
            included: {
                type: 'array',
                items: {
                    oneOf: resources.map(resource => ({
                        type: <const>'object',
                        required: ['attributes', 'type', 'id'],
                        properties: {
                            ...createBaseItem(resource),
                            attributes: {
                                $ref: `#/components/schemas/${resource}`,
                            },
                        }
                    })),
                }
            },
            ...(array
                ? { meta: { $ref: '#/components/schemas/JSONAPIResponseMeta' } }
                : { links: { $ref: '#/components/schemas/JSONAPIResponseLinks' } }
            )
        }
    } satisfies OpenAPIV3_1.SchemaObject
}

// eslint-disable-next-line jsdoc/require-jsdoc
export default function (routes: Route[]) {
    const headers = Object.values(ResponseHeaders).reduce((headers, name) => ({
        ...headers,
        [name]: {
            $ref: `#/components/headers/${name}`
        },
    }), {})

    return {
        ...Object.entries(APIErrors).reduce((response, table) => ({
            ...response,
            [table[0]]: {
                description: `${table[1].summary}: ${table[1].description}`,
                content: {
                    'application/json': {
                        schema: {
                            type: 'array',
                            items: {
                                $ref: '#/components/schemas/JSONAPIError',
                            },
                        }
                    }
                },
                headers,
            }
        }), {}),
        ...routes.reduce((obj, route) => ({
            ...obj,
            [`${route.resource}${route.response?.array ? 's' : ''}Response`]: {
                description: 'OK: Completed your request succesfully',
                content: {
                    'application/json': {
                        schema: createResponse(route.resource, route.response?.array),
                    }
                },
                headers,
            }
        }), {}),
    }
}
