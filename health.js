// health.js
export function healthRoutes(app) {
  app.get("/health", (req, res) => res.status(200).send("ok"));
}


