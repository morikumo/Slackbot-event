// admin.js
export function requireAdmin(req, res, next) {
  const token = req.headers["x-admin-token"];
  const adminToken = process.env.ADMIN_TOKEN;

  if (!adminToken || token !== adminToken) {
    return res.status(403).send("Forbidden");
  }
  next();
}
