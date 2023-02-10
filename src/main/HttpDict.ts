/**
 * Dictionary used to store parsed querystring and headers,
 * both of which can have multiple values per key.
 */
export interface HttpDict {
    [key: string]: string[];
}
