import { handleAuthCheck } from '../../server/middleware/auth.js';
export default function handler(req, res) {
  handleAuthCheck(req, res);
}
