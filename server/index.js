import express from 'express';
import morgan from 'morgan';
import { authMiddleware, authRoutes } from './middleware/auth.js';
import { gamesRouter } from './routes/games.js';
import { teamsRouter } from './routes/teams.js';
import { healthRouter } from './routes/health.js';

const PORT = parseInt(process.env.PORT || '8080', 10);

const app = express();
app.use(morgan('tiny'));

// CORS
app.use((req, res, next) => {
  res.set('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.set('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  res.set('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// Auth endpoints (before auth middleware)
authRoutes(app);

// Auth gate — all API routes below require a valid session
app.use('/api', authMiddleware);

// API routes
app.use('/api/games', gamesRouter);
app.use('/api/teams', teamsRouter);
app.use('/api/health', healthRouter);

app.listen(PORT, () => {
  console.log(`Sports Viewer API listening on http://localhost:${PORT}`);
  if (process.env.AUTH_PASSWORD) {
    console.log('Authentication: ENABLED');
  } else {
    console.log('Authentication: DISABLED (set AUTH_PASSWORD to enable)');
  }
});
