// Deprecated — replaced by /api/forward-rates
// Kept to avoid 404s if any client has this URL cached.
import type { NextApiRequest, NextApiResponse } from "next";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  res.redirect(308, "/api/forward-rates");
}
