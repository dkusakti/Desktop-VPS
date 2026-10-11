const isProduction = () => process.env.APP_ENV === 'production' || process.env.NODE_ENV === 'production';

export const cookieOptions = (maxAge) => {
  const secure = isProduction();
  return `Path=/; Max-Age=${Math.max(0, Math.floor(maxAge))}; HttpOnly; SameSite=Strict${secure ? '; Secure' : ''}`;
};

export const serializeCookie = (name, value, maxAge) =>
  `${encodeURIComponent(name)}=${encodeURIComponent(value)}; ${cookieOptions(maxAge)}`;

export const clearCookie = (name) => serializeCookie(name, '', 0);

export const getCookie = (req, name) => {
  const raw = String(req.headers.cookie || '');
  for (const part of raw.split(';')) {
    const idx = part.indexOf('=');
    if (idx < 0) continue;
    const key = decodeURIComponent(part.slice(0, idx).trim());
    if (key !== name) continue;
    return decodeURIComponent(part.slice(idx + 1).trim());
  }
  return '';
};
