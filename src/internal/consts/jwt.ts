export const HMAC_ALGORITHMS = ["HS256", "HS384", "HS512"] as const;

export type HmacAlgorithm = typeof HMAC_ALGORITHMS[number];

export function isHmacAlgorithm(value: unknown): value is HmacAlgorithm {
    return HMAC_ALGORITHMS.some(algorithm => algorithm === value);
}
