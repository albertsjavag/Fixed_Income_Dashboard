// Shared SWR fetcher — throws on non-2xx so SWR populates `error` not `data`
// NEXT_PUBLIC_API_URL points to the FastAPI backend (empty string = same-origin Next.js routes)
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "";

export const fetcher = (url: string) => {
  const fullUrl = url.startsWith("http") ? url : `${API_BASE}${url}`;
  return fetch(fullUrl).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status} from ${fullUrl}`);
    return r.json();
  });
};
