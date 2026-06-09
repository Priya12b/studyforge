const mongoose = require("mongoose");

const seedAdminUser = async () => {
  try {
    const User = require("../models/User");
    const bcrypt = require("bcryptjs");

    const adminEmail = "admin@studyforge.com";
    const adminExists = await User.findOne({ email: adminEmail });

    if (!adminExists) {
      const hashedPassword = await bcrypt.hash("admin", 10);
      await User.create({
        name: "Admin User",
        email: adminEmail,
        password: hashedPassword,
        role: "admin",
        authProvider: "local",
      });
      console.log("Default admin user seeded successfully (admin@studyforge.com / admin)");
    }
  } catch (error) {
    console.error("Admin user seeding failed:", error.message);
  }
};

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("MongoDB Connected");
    await seedAdminUser();
  } catch (error) {
    console.error("MongoDB connection failed:", error.message);
    process.exit(1);
  }
};

module.exports = connectDB;