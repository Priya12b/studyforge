const express = require("express");
const multer = require("multer");

const router = express.Router();

const protect = require("../middleware/authMiddleware");
const upload = require("../middleware/uploadMiddleware");

const {
  uploadPDF,
  getNotes,
  deleteNote,
} = require(
  "../controllers/uploadController"
);

router.post(
  "/pdf",
  protect,
  (req, res, next) => {
    upload.single("pdf")(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return res.status(400).json({ message: "File size exceeds limit of 10MB" });
        }
        return res.status(400).json({ message: err.message });
      } else if (err) {
        return res.status(400).json({ message: err.message });
      }
      next();
    });
  },
  uploadPDF
);

router.get(
  "/notes",
  protect,
  getNotes
);

router.delete(
  "/:id",
  protect,
  deleteNote
);

module.exports = router;