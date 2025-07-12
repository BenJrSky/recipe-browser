// server.js
const express = require('express');
const path = require('path');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3000;

// Configurazione
const PRERENDER_SERVICE = 'https://service.prerender.io';
const YOUR_DOMAIN = 'https://ayisha-ssr.vercel.app/'; 

// Middleware per file statici
app.use(express.static('public'));

// Funzione per rilevare bot
function isBot(userAgent) {
  if (!userAgent) return false;
  
  const botPatterns = [
    'bot', 'crawler', 'spider', 'crawling',
    'googlebot', 'bingbot', 'slurp', 'duckduckbot',
    'baiduspider', 'yandexbot', 'facebookexternalhit',
    'twitterbot', 'rogerbot', 'linkedinbot',
    'embedly', 'quora link preview', 'showyoubot',
    'outbrain', 'pinterest', 'developers.google.com'
  ];
  
  return botPatterns.some(pattern => 
    userAgent.toLowerCase().includes(pattern)
  );
}

// Route principale con logica prerender
app.get('*', async (req, res) => {
  const userAgent = req.get('User-Agent') || '';
  
  console.log(`Request: ${req.path}`);
  console.log(`User-Agent: ${userAgent}`);
  console.log(`Is Bot: ${isBot(userAgent)}`);
  
  if (req.path === '/') {
    try {
      console.log('Prerender su / per tutti');
      const prerenderUrl = `${PRERENDER_SERVICE}/${YOUR_DOMAIN}`;
      console.log(`Fetching: ${prerenderUrl}`);
      const response = await fetch(prerenderUrl, {
        headers: {
          'User-Agent': userAgent,
          'X-Prerender-Token': process.env.PRERENDER_TOKEN || ''
        },
        timeout: 30000
      });
      if (!response.ok) {
        throw new Error(`Prerender service error: ${response.status}`);
      }
      const html = await response.text();
      res.set('Content-Type', 'text/html');
      res.send(html);
    } catch (error) {
      console.error('Errore prerender:', error);
      if (error.response) {
        try {
          const errorText = await error.response.text();
          console.error('Risposta errore dal servizio prerender:', errorText);
        } catch (e) {
          console.error('Impossibile leggere la risposta di errore dal servizio prerender');
        }
      }
      res.sendFile(path.join(__dirname, 'public', 'index.html'));
    }
  } else {
    // Tutte le altre richieste: serve file statico
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  }
});

// Gestione errori
app.use((error, req, res, next) => {
  console.error('Server error:', error);
  res.status(500).sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Avvio server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`🤖 Prerender service: ${PRERENDER_SERVICE}`);
  console.log(`🌐 Domain: ${YOUR_DOMAIN}`);
});

// Gestione shutdown graceful
process.on('SIGTERM', () => {
  console.log('👋 Server shutdown');
  process.exit(0);
});

module.exports = app;