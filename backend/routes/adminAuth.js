const express = require("express");
const router = express.Router();
const requireAdminAuth = require("../middlewares/requireAdminAuth");
const {
  createAdminByAdmin,
  adminSignin,
  adminLogout,
  changeOwnPassword,
  resetAdminPassword,
  superAdminChangePassword,
  deleteAdminBySuperAdmin,
} = require("../controllers/adminAuthController");

router.post("/create", requireAdminAuth, createAdminByAdmin);
router.post("/signin", adminSignin);
router.post("/logout", requireAdminAuth, adminLogout);
router.get("/me", requireAdminAuth, (req, res) => {
  res.json({
    admin: {
      id: req.admin._id,
      email: req.admin.email,
      username: req.admin.username,
      isSuperAdmin: req.admin.isSuperAdmin,
    },
  });
});
router.post("/change-password", requireAdminAuth, changeOwnPassword);
router.post("/reset-password", requireAdminAuth, resetAdminPassword);
router.post("/admin-change-password", requireAdminAuth, superAdminChangePassword);
router.delete("/delete/:adminId", requireAdminAuth, deleteAdminBySuperAdmin);

module.exports = router;
