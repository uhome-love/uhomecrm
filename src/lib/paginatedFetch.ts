/**
 * paginatedFetch.ts — Shared paginated fetch utility
 * 
 * Bypasses the Supabase default 1000-row limit by fetching
 * in pages using .range() and concatenating all results.
 */

/**
 * Fetch all rows from a Supabase query that may exceed 1000 results.
 * 
 * @param buildQuery - Function that receives (from, to) range offsets
 *   and returns a Supabase query builder (the promise itself).
 * @param pageSize - Number of rows per page (default 1000).
 * @returns All rows concatenated.
 * 
 * @example
 * const allRows = await fetchAllRows<MyType>((from, to) =>
 *   supabase
 *     .from("my_table")
 *     .select("id, name")
 *     .gte("created_at", start)
 *     .range(from, to)
 * );
 */
export async function fetchAllRows<T = any>(
  buildQuery: (from: number, to: number) => any,
  pageSize = 1000,
): Promise<T[]> {
  const all: T[] = [];
  let offset = 0;
  while (true) {
    const { data, error } = await buildQuery(offset, offset + pageSize - 1);
    if (error) {
      console.error("fetchAllRows error:", error);
      break;
    }
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < pageSize) break;
    offset += pageSize;
  }
  return all;
}
