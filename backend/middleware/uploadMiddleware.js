const multer = require("multer");
const fs = require("fs");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const { cloudinary, isConfigured } = require("../config/cloudinary");

let storage;

if (isConfigured) {
  storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: async (req, file) => {
      const isPdf = file.mimetype === "application/pdf";
      const cleanName = file.originalname.split(".")[0].replace(/[^a-zA-Z0-9]/g, "_");
      return {
        folder: "studyforge",
        resource_type: isPdf ? "raw" : "image",
        format: isPdf ? "pdf" : undefined,
        public_id: `${Date.now()}-${cleanName}`,
      };
    },
  });
} else {
  if (!fs.existsSync("uploads")) {
    fs.mkdirSync("uploads", { recursive: true });
  }
  storage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, "uploads/");
    },
    filename: function (req, file, cb) {
      cb(
        null,
        Date.now() +
        "-" +
        file.originalname
      );
    },
  });
}

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
  fileFilter: function (req, file, cb) {
    const allowedTypes = ["application/pdf", "image/png", "image/jpeg", "image/jpg"];
    if (!allowedTypes.includes(file.mimetype)) {
      return cb(new Error("Only PDF and image files (PNG/JPG/JPEG) are allowed"));
    }
    cb(null, true);
  },
});

module.exports = upload;