export function authorizeRoles(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.redirect("/auth/login");
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).render("Auth/login", {
        title: "Access denied",
        error: "You do not have permission to view that page.",
        formData: {},
      });
    }

    return next();
  };
}
