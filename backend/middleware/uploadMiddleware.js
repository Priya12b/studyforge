const multer = require("multer");
const fs = require("fs");

if (!fs.existsSync("uploads")) {
  fs.mkdirSync("uploads", { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (
    req,
    file,
    cb
  ) {
    cb(null, "uploads/");
  },

  filename: function (
    req,
    file,
    cb
  ) {
    cb(
      null,
      Date.now() +
      "-" +
      file.originalname
    );
  },
});

const upload = multer({
  storage,
  fileFilter: function (req, file, cb) {
    if (file.mimetype !== "application/pdf") {
      return cb(new Error("Only PDF files are allowed"));
    }

    cb(null, true);
  },
});

module.exports = upload;