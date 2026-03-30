import { handleAuthLogout } from '../../server/middleware/auth.js';
export default function handler(req, res) {
  handleAuthLogout(req, res);
}
