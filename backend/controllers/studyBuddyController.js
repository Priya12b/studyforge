const User = require("../models/User");
const { sendBuddyInvitation } = require("../services/emailService");

// Helper to convert comma-separated string to clean array of strings
const sanitizeArray = (val) => {
  if (Array.isArray(val)) {
    return val.map((s) => s.trim()).filter(Boolean);
  }
  if (typeof val === "string") {
    return val
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
};

const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select(
      "subjects topicsNeeded topicsStrong availability skillLevel isMatchingEnabled"
    );

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    console.error("[StudyBuddyController] getProfile failed:", error.message);
    res.status(500).json({ message: "Failed to fetch study buddy profile" });
  }
};

const updateProfile = async (req, res) => {
  try {
    const {
      subjects,
      topicsNeeded,
      topicsStrong,
      availability,
      skillLevel,
      isMatchingEnabled,
    } = req.body;

    const updateFields = {
      subjects: sanitizeArray(subjects),
      topicsNeeded: sanitizeArray(topicsNeeded),
      topicsStrong: sanitizeArray(topicsStrong),
      availability: (availability || "").trim(),
      skillLevel: skillLevel || "Intermediate",
      isMatchingEnabled: !!isMatchingEnabled,
    };

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: updateFields },
      { returnDocument: "after", runValidators: true }
    ).select("name email subjects topicsNeeded topicsStrong availability skillLevel isMatchingEnabled");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({
      success: true,
      message: "Study Buddy profile updated successfully",
      data: user,
    });
  } catch (error) {
    console.error("[StudyBuddyController] updateProfile failed:", error.message);
    res.status(500).json({ message: "Failed to update study buddy profile" });
  }
};

const getMatches = async (req, res) => {
  try {
    const currentUser = await User.findById(req.user.id);
    if (!currentUser) {
      return res.status(404).json({ message: "User not found" });
    }

    // Find other users with matching enabled
    const potentialMatches = await User.find({
      _id: { $ne: currentUser._id },
      isMatchingEnabled: true,
    }).select("name email subjects topicsNeeded topicsStrong availability skillLevel");

    const matches = potentialMatches.map((buddy) => {
      let score = 20; // baseline score

      // 1. Subject match
      const commonSubjects = currentUser.subjects.filter((s) =>
        buddy.subjects.some((bs) => bs.toLowerCase() === s.toLowerCase())
      );
      if (commonSubjects.length > 0) {
        score += 20 + commonSubjects.length * 5;
      }

      // 2. Complementary Match (They teach what you need)
      const teachYou = buddy.topicsStrong.filter((t) =>
        currentUser.topicsNeeded.some((tn) => tn.toLowerCase() === t.toLowerCase())
      );
      if (teachYou.length > 0) {
        score += 30 + teachYou.length * 10;
      }

      // 3. Complementary Match (You teach what they need)
      const youTeach = currentUser.topicsStrong.filter((t) =>
        buddy.topicsNeeded.some((btn) => btn.toLowerCase() === t.toLowerCase())
      );
      if (youTeach.length > 0) {
        score += 20 + youTeach.length * 5;
      }

      // 4. Availability check
      if (
        currentUser.availability &&
        buddy.availability &&
        currentUser.availability.toLowerCase().trim() === buddy.availability.toLowerCase().trim()
      ) {
        score += 10;
      }

      // 5. Skill Level match
      if (currentUser.skillLevel === buddy.skillLevel) {
        score += 5;
      }

      // Caps score to max 98% (never 100% since no buddy is a perfect clone)
      const finalScore = Math.min(98, score);

      return {
        _id: buddy._id,
        name: buddy.name,
        email: buddy.email,
        subjects: buddy.subjects,
        topicsNeeded: buddy.topicsNeeded,
        topicsStrong: buddy.topicsStrong,
        availability: buddy.availability,
        skillLevel: buddy.skillLevel,
        matchScore: finalScore,
        sharedSubjects: commonSubjects,
        sharedStrong: teachYou, // topics they are strong in that you need
        sharedWeak: youTeach,   // topics you are strong in that they need
      };
    });

    // Sort matches by score desc
    matches.sort((a, b) => b.matchScore - a.matchScore);

    res.status(200).json({
      success: true,
      data: matches,
    });
  } catch (error) {
    console.error("[StudyBuddyController] getMatches failed:", error.message);
    res.status(500).json({ message: "Failed to query study buddy matches" });
  }
};

const sendInvite = async (req, res) => {
  try {
    const { buddyId } = req.body;
    if (!buddyId) {
      return res.status(400).json({ message: "Buddy ID is required" });
    }

    const currentUser = await User.findById(req.user.id);
    if (!currentUser) {
      return res.status(404).json({ message: "Current user not found" });
    }

    const buddy = await User.findById(buddyId);
    if (!buddy) {
      return res.status(404).json({ message: "Study buddy not found" });
    }

    if (!buddy.isMatchingEnabled) {
      return res.status(400).json({ message: "This user has matching disabled" });
    }

    // Calculate match score to display in the email
    let score = 20;

    // 1. Subject match
    const commonSubjects = currentUser.subjects.filter((s) =>
      buddy.subjects.some((bs) => bs.toLowerCase() === s.toLowerCase())
    );
    if (commonSubjects.length > 0) {
      score += 20 + commonSubjects.length * 5;
    }

    // 2. Complementary Match (They teach what you need)
    const teachYou = buddy.topicsStrong.filter((t) =>
      currentUser.topicsNeeded.some((tn) => tn.toLowerCase() === t.toLowerCase())
    );
    if (teachYou.length > 0) {
      score += 30 + teachYou.length * 10;
    }

    // 3. Complementary Match (You teach what they need)
    const youTeach = currentUser.topicsStrong.filter((t) =>
      buddy.topicsNeeded.some((btn) => btn.toLowerCase() === t.toLowerCase())
    );
    if (youTeach.length > 0) {
      score += 20 + youTeach.length * 5;
    }

    // 4. Availability check
    if (
      currentUser.availability &&
      buddy.availability &&
      currentUser.availability.toLowerCase().trim() === buddy.availability.toLowerCase().trim()
    ) {
      score += 10;
    }

    // 5. Skill Level match
    if (currentUser.skillLevel === buddy.skillLevel) {
      score += 5;
    }

    const finalScore = Math.min(98, score);

    // Send the email invitation via Nodemailer
    await sendBuddyInvitation({
      senderName: currentUser.name,
      senderEmail: currentUser.email,
      recipientEmail: buddy.email,
      recipientName: buddy.name,
      sharedSubjects: commonSubjects,
      senderStrong: youTeach, // topics sender is strong in that buddy needs
      matchScore: finalScore,
    });

    res.status(200).json({
      success: true,
      message: `Invitation email successfully sent to ${buddy.name}!`,
    });
  } catch (error) {
    console.error("[StudyBuddyController] sendInvite failed:", error.message);
    res.status(500).json({ message: "Failed to send study buddy invitation email" });
  }
};

module.exports = {
  getProfile,
  updateProfile,
  getMatches,
  sendInvite,
};
