// Safe simulation endpoints for DAST testing
// NEVER enable in production — only in a test branch or CI job via env SIMULATE_CRITICAL=true

const express = require("express");
const router = express.Router();

const SIMULATE_CRITICAL = (process.env.SIMULATE_CRITICAL === 'true');

// Simple landing to confirm simulation is enabled
router.get("/", (req, res) => {
  res.send({
    simulate: SIMULATE_CRITICAL ? "enabled" : "disabled",
    note: "This endpoint is for DAST simulation only. No real DB actions are performed."
  });
});

// Endpoint that returns a crafted response which DAST scanners often flag as SQLi/RCE patterns.
// WARNING: This only returns strings shown below — it does NOT execute any SQL.
router.get("/simulate-critical", (req, res) => {
  if (!SIMULATE_CRITICAL) {
    return res.status(404).send("Not found");
  }

  // A crafted response combining: raw user-like payload, common SQL error text,
  // and an obviously unsafe concatenated SQL example. These patterns are commonly
  // picked up by scanners as indicators of SQL Injection / critical issues.
  const simulatedPayload = {
    // An attack-like input pattern (what an attacker might send)
    attackerInput: "' OR '1'='1'; --",

    // An example of a naive, unsafe SQL concatenation pattern (DO NOT EXECUTE)
    // This is *only* displayed as text to be picked up by scanners.
    exampleInsecureConcat: "SELECT * FROM users WHERE username = '" + "' OR '1'='1" + "';",

    // A fake SQL error text that many scanners look for (simulates DB error disclosure)
    simulatedSqlError: "ERROR: syntax error at or near \"' OR '1'='1'\" at character 25",

    // A short HTML rendering so scanners that parse HTML see the strings in-page
    html: [
      "<html><body>",
      "<h3>DAST SIMULATION (CRITICAL)</h3>",
      "<p>Payload: ' OR '1'='1'; --</p>",
      "<pre>Example insecure SQL (text only): SELECT * FROM users WHERE username = '' OR '1'='1';</pre>",
      "<p>Simulated DB error: ERROR: syntax error at or near \"' OR '1'='1'\"</p>",
      "</body></html>"
    ].join("\n")
  };

  // Return HTML (scanners crawling HTML are most likely to flag it)
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.status(200).send(simulatedPayload.html);
});

module.exports = router;
