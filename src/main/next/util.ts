import { HttpDict } from './HttpDict.js';

export function headersToDict(headers: Record<string, string | string[] | undefined>): HttpDict {
    const dict: HttpDict = {};
    for (const [key, value] of Object.entries(headers)) {
        const val = Array.isArray(value) ? value : [value ?? ''];
        dict[key.toLowerCase()] = val;
    }
    return dict;
}

export function searchParamsToDict(search: URLSearchParams): HttpDict {
    const dict: HttpDict = {};
    for (const [key, value] of search) {
        const values = dict[key] ?? [];
        values.push(value);
        dict[key] = values;
    }
    return dict;
}
