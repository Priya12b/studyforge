const fs = require("fs");

// Use the library entrypoint directly so we always get the parser function.
const pdfParse = require("pdf-parse/lib/pdf-parse");

const Notes = require("../models/Notes");

const {
  summarizeNotes,
  generateQuizFromNotes,
  generatePlanFromNotes,
} = require(
  "../services/notesAIService"
);

const {
  awardNotesUpload,
} = require("../services/gamificationService");

const uploadPDF = async (
  req,
  res
) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        message: "Please upload a PDF file",
      });
    }

    // file path
    const filePath = req.file.path;

    // read PDF buffer
    const dataBuffer =
      fs.readFileSync(filePath);

    // extract text
    const pdfData =
      await pdfParse(dataBuffer);

    const extractedText =
      pdfData.text;

    // AI summary
    const summary =
      await summarizeNotes(
        extractedText
      );

    // AI quiz
    const generatedQuiz =
      await generateQuizFromNotes(
        extractedText
      );

    // AI planner
    const generatedPlan =
      await generatePlanFromNotes(
        extractedText
      );

    // save in DB
    const savedNotes =
      await Notes.create({
        userId: req.user.id,

        title:
          req.file.originalname,

        originalText:
          extractedText,

        summary,

        generatedQuiz,

        generatedPlan,

        filePath,
      });

    try {
      await awardNotesUpload(req.user.id);
    } catch (rewardError) {
      console.error("[UploadController] awardNotesUpload failed:", rewardError.message || rewardError);
    }

    res.status(200).json({
      success: true,

      message:
        "PDF uploaded successfully",

      data: savedNotes,
    });
  } catch (error) {
    console.error("[UploadController] uploadPDF failed:", error.message || error);

    res.status(500).json({
      message:
        "PDF upload failed",
    });
  }
};

const getNotes = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const skip = (page - 1) * limit;

    const [notes, total] = await Promise.all([
      Notes.find({ userId: req.user.id }).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Notes.countDocuments({ userId: req.user.id }),
    ]);

    res.status(200).json({
      success: true,
      data: notes,
      notes,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    });
  } catch (error) {
    console.error("[UploadController] getNotes failed:", error.message || error);
    res.status(500).json({
      message: "Failed to fetch notes",
    });
  }
};

const deleteNote = async (req, res) => {
  try {
    const note = await Notes.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
    if (!note) {
      return res.status(404).json({ message: "Note not found" });
    }
    // Also delete the file from disk
    if (note.filePath) {
      try {
        fs.unlinkSync(note.filePath);
      } catch (e) {
        console.error("[UploadController] Failed to delete file on disk:", e.message);
      }
    }
    res.status(200).json({ success: true, message: "Note deleted" });
  } catch (error) {
    console.error("[UploadController] deleteNote failed:", error.message || error);
    res.status(500).json({ message: "Failed to delete note" });
  }
};

module.exports = {
  uploadPDF,
  getNotes,
  deleteNote,
};