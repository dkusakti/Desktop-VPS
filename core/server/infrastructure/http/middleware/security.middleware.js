const securityMiddleware = (req, res, next) => {
  if (
    process.env.APP_MODE === 'SERVER_VPS' &&
    (process.env.APP_ENV === 'production' ||
      process.env.NODE_ENV === 'production') &&
    process.env.ALLOW_HTTP === 'false' &&
    !req.secure
  ) {
    return res.status(400).json({
      success: false,
      error: 'Koneksi HTTPS wajib digunakan.'
    });
  }

  res.set('X-Content-Type-Options', 'nosniff');
  res.set('X-Frame-Options', 'DENY');
  res.set('Referrer-Policy', 'no-referrer');
  res.set(
    'Content-Security-Policy',
    "default-src 'self'; " +
    "script-src 'self'; " +
    "style-src 'self' 'unsafe-inline'; " +
    "font-src 'self'; " +
    "img-src 'self' data:; " +
    "connect-src 'self'; " +
    "object-src 'none'; " +
    "base-uri 'self'; " +
    "frame-ancestors 'none'; " +
    "form-action 'self'"
  );

  if (
    process.env.APP_ENV === 'production' ||
    process.env.NODE_ENV === 'production'
  ) {
    res.set(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains'
    );
  }

  return next();
};

export default securityMiddleware;
