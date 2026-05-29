const express = require("express");

const router = express.Router();

const protect = require("../middleware/authMiddleware");

const upload = require(
  "../middleware/uploadMiddleware"
);

const {
  uploadPDF,
} = require(
  "../controllers/uploadController"
);

router.post(
  "/pdf",
  protect,
  upload.single("pdf"),
  uploadPDF
);

module.exports = router;