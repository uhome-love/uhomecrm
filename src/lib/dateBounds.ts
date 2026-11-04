/** ISO calendar dates sort chronologically; equal boundary dates remain allowed. */
export function withinDateBounds(value: string, min?: string, max?: string): boolean {
  return (!min || value >= min) && (!max || value <= max);
}