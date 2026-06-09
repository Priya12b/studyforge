const cloudinary = require("cloudinary").v2;

const isConfigured = !!(
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET
);

if (isConfigured) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
  console.log("[Cloudinary] Configured successfully.");
} else {
  console.log("[Cloudinary] Credentials missing in .env. Falling back to local storage.");
}

module.exports = {
  cloudinary,
  isConfigured,
};
