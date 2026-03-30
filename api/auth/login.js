import { handleAuthLogin } from '../../server/middleware/auth.js';
export default function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  handleAuthLogin(req, res);
}
