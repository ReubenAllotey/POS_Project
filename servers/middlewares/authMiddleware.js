import { findUserById } from "../models/userModel.js";

function parseCookies(cookieHeader = "") {
  return cookieHeader
    .split(";")
    .map((pair) => pair.trim())
    .filter(Boolean)
    .reduce((cookies, pair) => {
      const separatorIndex = pair.indexOf("=");
      if (separatorIndex === -1) return cookies;

      const key = pair.slice(0, separatorIndex).trim();
      const value = pair.slice(separatorIndex + 1).trim();
      cookies[key] = decodeURIComponent(value);
      return cookies;
    }, {});
}

export async function attachCurrentUser(req, res, next) {
  const cookies = parseCookies(req.headers.cookie);
  const userId = cookies.pos_user_id;

  req.user = userId ? await findUserById(userId) : null;
  res.locals.currentUser = req.user;
  res.locals.currentPath = req.path;

  next();
}

export function requireAuth(req, res, next) {
  if (!req.user || req.user.isActive === false) {
    res.clearCookie("pos_user_id");
    return res.redirect("/auth/login");
  }

  return next();
}
