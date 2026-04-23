import app from "../server/src/index";

// Fallback to static assets for all non-API routes
app.all("*", (c) => {
  return c.env.ASSETS.fetch(c.req.raw);
});

export default app;
