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
      console.log(rewardError);
    }

    res.status(200).json({
      success: true,

      message:
        "PDF uploaded successfully",

      data: savedNotes,
    });
  } catch (error) {
    console.log(error);

    res.status(500).json({
      message:
        "PDF upload failed",
    });
  }
};

module.exports = {
  uploadPDF,
};