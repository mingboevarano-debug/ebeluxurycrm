import fetch from 'node-fetch';

// URL of the Render web service to keep alive
const KEEPALIVE_URL = 'https://ebeluxurycrm.onrender.com/';

/**
 * Sends a GET request to the keep‑alive URL and logs the result.
 */
function ping() {
  fetch(KEEPALIVE_URL)
    .then((res) => {
      console.log(`[keepalive] ${new Date().toISOString()} – status: ${res.status}`);
    })
    .catch((err) => {
      console.error(`[keepalive] ${new Date().toISOString()} – error:`, err);
    });
}

// Initial ping immediately when the script starts
ping();

// Repeat every 10 minutes (600 000 ms)
const TEN_MINUTES = 10 * 60 * 1000;
setInterval(ping, TEN_MINUTES);
