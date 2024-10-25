/**
 * Dictionary used to store parsed querystring and headers,
 * both of which can have multiple values per key.
 */
export type HttpDict = Record<string, string[]>;
