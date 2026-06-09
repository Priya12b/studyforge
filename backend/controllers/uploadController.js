const fs = require("fs");
const axios = require("axios");
const Notes = require("../models/Notes");
const { cloudinary, isConfigured } = require("../config/cloudinary");
const { extractTextFromDoc } = require("../integrations/aiService");

const {
  summarizeNotes,
  generateQuizFromNotes,
  generatePlanFromNotes,
} = require("../services/notesAIService");

const { awardNotesUpload } = require("../services/gamificationService");

// Helper to extract Cloudinary public ID from URL
const getPublicIdFromUrl = (url) => {
  try {
    const parts = url.split("/");
    const uploadIndex = parts.findIndex(part => part === "upload");
    if (uploadIndex === -1) return null;
    
    // public_id starts after version (vXXXXXX) or directly after upload
    let resourcePathParts = parts.slice(uploadIndex + 1);
    if (resourcePathParts[0].startsWith("v") && !isNaN(resourcePathParts[0].substring(1))) {
      resourcePathParts = resourcePathParts.slice(1);
    }
    
    const resourcePath = resourcePathParts.join("/");
    // Strip file extension
    return resourcePath.substring(0, resourcePath.lastIndexOf("."));
  } catch (error) {
    console.error("[UploadController] Error parsing public ID:", error.message);
    return null;
  }
};

const uploadPDF = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        message: "Please upload a PDF or an image file",
      });
    }

    const filePath = req.file.path;
    let dataBuffer;

    console.log(`[UploadController] Processing upload. File path: ${filePath}`);

    // If file is stored on Cloudinary (starts with http), download the buffer. Otherwise read local file.
    if (filePath.startsWith("http")) {
      const response = await axios.get(filePath, { responseType: "arraybuffer" });
      dataBuffer = Buffer.from(response.data);
    } else {
      dataBuffer = fs.readFileSync(filePath);
    }

    // Extract text using Python OCR / Document processor endpoint
    let extractedText = "";
    let ragData = null;

    if (req.file.mimetype === "application/pdf") {
      console.log("[UploadController] Extracting text from PDF via AI service...");
      extractedText = await extractTextFromDoc(dataBuffer, req.file.originalname, req.file.mimetype);
    } else {
      console.log("[UploadController] Uploading image note to RAG via AI service...");
      const { uploadNoteToAI } = require("../integrations/aiService");
      ragData = await uploadNoteToAI(dataBuffer, req.file.originalname, req.file.mimetype, req.user.id);
      extractedText = ragData.extracted_text || ragData.text_preview || "";
    }

    if (!extractedText || !extractedText.trim()) {
      return res.status(400).json({
        message: "Failed to extract text from the uploaded document. Please check if the file is readable.",
      });
    }

    // AI summary
    console.log("[UploadController] Generating summary...");
    const summary = await summarizeNotes(extractedText);

    // AI quiz
    console.log("[UploadController] Generating quiz...");
    const generatedQuiz = await generateQuizFromNotes(extractedText);

    // AI planner
    console.log("[UploadController] Generating plan...");
    const generatedPlan = await generatePlanFromNotes(extractedText);

    // save in DB
    const savedNotes = await Notes.create({
      userId: req.user.id,
      title: req.file.originalname,
      originalText: extractedText,
      summary,
      generatedQuiz,
      generatedPlan,
      filePath, // Save local path or Cloudinary HTTPS URL
    });

    try {
      await awardNotesUpload(req.user.id);
    } catch (rewardError) {
      console.error("[UploadController] awardNotesUpload failed:", rewardError.message || rewardError);
    }

    res.status(200).json({
      success: true,
      message: "Document uploaded and processed successfully",
      data: savedNotes,
    });
  } catch (error) {
    console.error("[UploadController] uploadPDF failed:", error.message || error);
    res.status(500).json({
      message: "Document upload and processing failed",
      error: error.message,
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

    if (note.filePath) {
      if (note.filePath.startsWith("http")) {
        // Cloudinary deletion
        if (isConfigured) {
          try {
            const publicId = getPublicIdFromUrl(note.filePath);
            if (publicId) {
              const isPdf = note.filePath.toLowerCase().endsWith(".pdf");
              console.log(`[UploadController] Deleting from Cloudinary. Public ID: ${publicId}, type: ${isPdf ? "raw" : "image"}`);
              await cloudinary.uploader.destroy(publicId, {
                resource_type: isPdf ? "raw" : "image",
              });
            }
          } catch (cloudinaryError) {
            console.error("[UploadController] Failed to delete from Cloudinary:", cloudinaryError.message);
          }
        }
      } else {
        // Local disk deletion
        try {
          if (fs.existsSync(note.filePath)) {
            fs.unlinkSync(note.filePath);
          }
        } catch (e) {
          console.error("[UploadController] Failed to delete file on disk:", e.message);
        }
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