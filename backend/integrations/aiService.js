/**
 * AI Service Integration Layer
 * 
 * Connects the Express backend to the FastAPI AI agent service.
 * All AI calls (study plans, quizzes, chat) go through here.
 * 
 * The AI service runs on AI_SERVICE_URL (default: http://localhost:8000)
 * and is powered by Gemini 2.5 Flash via multi-agent orchestration.
 */

const axios = require("axios");

const AI_BASE = process.env.AI_SERVICE_URL || "http://localhost:8000";

// Axios instance with generous timeout (AI can take 15-30s on free tier)
const aiClient = axios.create({
  baseURL: AI_BASE,
  timeout: 180000, // 3 minutes — increased for complex plan generation
  headers: { "Content-Type": "application/json" },
});

// ============================================================
// Study Plan Generation
// ============================================================

const generateStudyPlan = async (data) => {
  try {
    // Build the payload matching the AI service's StudyPlanRequest schema
    const payload = {
      user_id: data.user_id || data.userId || "anonymous",
      subjects: data.subjects || [
        {
          name: data.subject || "General",
          confidence_level: data.confidence_level || 50,
          priority: data.priority || "medium",
          exam_date: data.exam_date || null,
          syllabus_topics: data.syllabus_topics || [data.topic || "General"],
          credits: 3,
        },
      ],
      available_hours_per_day: data.available_hours_per_day || 4,
      start_date: data.start_date || new Date().toLocaleDateString("en-GB"),
      end_date:
        data.end_date ||
        new Date(Date.now() + 7 * 86400000).toLocaleDateString("en-GB"),
      preferred_start_time: data.preferred_start_time || "09:00",
      preferred_end_time: data.preferred_end_time || "21:00",
      break_duration_minutes: data.break_duration_minutes || 15,
      weak_subjects: data.weak_subjects || [],
      goals: data.goals || data.prompt || null,
      model: data.model || null,
      provider: data.provider || null,
    };

    console.log(`\n[Study Plan] Sending to ${AI_BASE}/ai/generate-plan`);
    console.log(`[Study Plan] Payload:`, JSON.stringify(payload, null, 2));

    const response = await aiClient.post("/ai/generate-plan", payload);
    const aiData = response.data;

    console.log(`[Study Plan] Response received!`);
    console.log(`[Study Plan] Response status: ${response.status}`);
    console.log(`[Study Plan] Response data:`, JSON.stringify(aiData, null, 2));

    if (!aiData.success) {
      const errorMsg = aiData.error || "AI plan generation failed";
      console.error(`[Study Plan] AI Service error: ${errorMsg}`);
      throw new Error(errorMsg);
    }

    const planData = aiData.data;

    // Transform AI response to match what the frontend/controllers expect
    // Frontend expects: { study_plan: [{ day, task }], recommendations: [...] }
    const study_plan = [];

    if (planData.daily_schedules) {
      planData.daily_schedules.forEach((schedule) => {
        const tasks = schedule.blocks
          .filter((b) => b.block_type !== "break")
          .map((b) => `${b.topic} (${b.duration_minutes}min)`)
          .join(", ");

        study_plan.push({
          day: schedule.date,
          task: tasks || schedule.daily_goal || "Study session",
        });
      });
    }

    return {
      study_plan:
        study_plan.length > 0
          ? study_plan
          : [{ day: "Today", task: "AI plan generated — check details" }],
      recommendations: planData.recommendations || [
        "Follow the generated schedule",
        "Take regular breaks",
      ],
      // Also pass through the full AI response for advanced usage
      _raw: planData,
    };
  } catch (error) {
    console.error("\n[Study Plan] ============ FULL ERROR DETAILS ============");
    console.error("[Study Plan] Error type:", error.name);
    console.error("[Study Plan] Error message:", error.message);
    console.error("[Study Plan] Error code:", error.code);

    if (error.response) {
      console.error("[Study Plan] Response status:", error.response.status);
      console.error("[Study Plan] Response statusText:", error.response.statusText);
      console.error("[Study Plan] Response headers:", error.response.headers);
      console.error("[Study Plan] Response data:", JSON.stringify(error.response.data, null, 2));

      // Extract the actual error from the response
      const detail = error.response.data?.detail;
      if (detail) {
        console.error("[Study Plan] Extracted detail:", detail);
        if (typeof detail === 'object') {
          console.error("[Study Plan] Detail object:", JSON.stringify(detail, null, 2));
        }
      }
    } else if (error.code === 'ECONNREFUSED') {
      console.error(`[Study Plan] Connection refused - AI Service not running at ${AI_BASE}`);
      console.error("[Study Plan] Start AI Service: python -m uvicorn app.main:app --port 8000 --reload");
    } else if (error.code === 'ENOTFOUND') {
      console.error(`[Study Plan] Host not found: ${AI_BASE}`);
    } else if (error.message && error.message.includes('timeout')) {
      console.error("[Study Plan] Timeout - AI Service is slow or unresponsive");
    }

    console.error("[Study Plan] ================================================");

    // Pass through the actual error from the AI service
    const detail = error.response?.data?.detail;
    const errorMsg = typeof detail === 'object' ? detail.error : (detail || error.message);
    throw new Error("AI Service Error: " + errorMsg);
  }
};

// ============================================================
// Quiz Generation
// ============================================================

const generateQuiz = async (data) => {
  try {
    const payload = {
      user_id: data.userId || data.user_id || "anonymous",
      subject: data.subject || "General",
      topic: data.topic || data.subject || "General",
      num_questions: data.num_questions || 5,
      difficulty: data.difficulty || "mixed",
      use_notes: data.use_notes || false,
      document_ids: data.document_ids || [],
      model: data.model || null,
      provider: data.provider || null,
    };

    console.log(`\n[Quiz Generation] Sending to ${AI_BASE}/ai/generate-quiz`);
    console.log(`[Quiz Generation] Payload:`, JSON.stringify(payload, null, 2));

    const response = await aiClient.post("/ai/generate-quiz", payload);
    const aiData = response.data;

    console.log(`[Quiz Generation] Response received!`);
    console.log(`[Quiz Generation] Response status: ${response.status}`);
    console.log(`[Quiz Generation] Response data:`, JSON.stringify(aiData, null, 2));

    if (!aiData.success) {
      // AI Service returned an error - log the actual error message
      const errorMsg = aiData.error || "AI quiz generation failed";
      console.error(`[Quiz Generation] AI Service error: ${errorMsg}`);
      throw new Error(errorMsg);
    }

    const quizData = aiData.data;

    // Transform AI response to match MongoDB Quiz schema:
    // { question: String, options: [String], correctAnswer: String }
    const questions = (quizData.questions || []).map((q) => ({
      question: q.question,
      options: q.options || [],
      correctAnswer: q.correct_answer || q.options?.[0] || "A",
      explanation: q.explanation || "",
      difficulty: q.difficulty || "medium",
    }));

    return { questions };
  } catch (error) {
    console.error("\n[Quiz Generation] ============ FULL ERROR DETAILS ============");
    console.error("[Quiz Generation] Error type:", error.name);
    console.error("[Quiz Generation] Error message:", error.message);
    console.error("[Quiz Generation] Error code:", error.code);

    if (error.response) {
      console.error("[Quiz Generation] Response status:", error.response.status);
      console.error("[Quiz Generation] Response statusText:", error.response.statusText);
      console.error("[Quiz Generation] Response data:", JSON.stringify(error.response.data, null, 2));

      if (error.response.data?.detail) {
        console.error("[Quiz Generation] Detail:", JSON.stringify(error.response.data.detail, null, 2));
      }
    } else if (error.code === 'ECONNREFUSED') {
      console.error(`[Quiz Generation] Cannot connect to AI Service at ${AI_BASE}`);
      console.error("[Quiz Generation] Make sure AI Service is running: python -m uvicorn app.main:app --port 8000");
    }

    console.error("[Quiz Generation] ================================================");

    throw new Error(`Quiz generation failed: ${error.message}`);
  }
};

// ============================================================
// AI Chat / Tutoring
// ============================================================

const chatWithAI = async (data) => {
  try {
    const payload = {
      user_id: data.user_id || data.userId || "anonymous",
      message: data.message || "",
      session_id: data.session_id || null,
      subject_context: data.subject || null,
      use_rag: false,
      document_ids: [],
      model: data.model || null,
      provider: data.provider || null,
    };

    console.log(`[Chat] Sending to ${AI_BASE}/ai/chat`);
    const response = await aiClient.post("/ai/chat", payload);
    const aiData = response.data;

    if (!aiData.success) {
      const errorMsg = aiData.error || "AI chat failed";
      console.error(`[Chat] AI Service error: ${errorMsg}`);
      throw new Error(errorMsg);
    }

    return {
      reply: aiData.data.response || "I'm not sure how to help with that.",
      session_id: aiData.data.session_id || null,
      sources: aiData.data.sources || [],
    };
  } catch (error) {
    console.error("[Chat] Error:", error.message);

    if (error.code === 'ECONNREFUSED') {
      console.error(`[Chat] Cannot connect to AI Service at ${AI_BASE}`);
    }

    throw new Error("AI Chat failed: " + error.message);
  }
};

// ============================================================
// AI Health Check
// ============================================================

const checkAIHealth = async () => {
  try {
    console.log(`[Health Check] Testing connection to ${AI_BASE}`);
    const response = await aiClient.get("/", { timeout: 5000 });

    const status = {
      status: "online",
      service: response.data.service || "AI Service",
      version: response.data.version || "unknown",
    };

    console.log("[Health Check] ✓ AI Service is online");
    return status;
  } catch (error) {
    console.error("[Health Check] ✗ AI Service health check failed");
    console.error(`[Health Check] Error: ${error.message}`);

    if (error.code === 'ECONNREFUSED') {
      console.error(`[Health Check] Connection refused - AI Service not running at ${AI_BASE}`);
      console.error("[Health Check] Start AI Service: python -m uvicorn app.main:app --port 8000 --reload");
    } else if (error.code === 'ENOTFOUND') {
      console.error(`[Health Check] Host not found: ${AI_BASE}`);
    } else if (error.message.includes('timeout')) {
      console.error("[Health Check] Timeout - AI Service is slow or unresponsive");
    }

    return {
      status: "offline",
      error: error.message,
      details: `Cannot reach AI Service at ${AI_BASE}`,
    };
  }
};

const generateFlashcards = async (data) => {
  try {
    const payload = {
      user_id: data.user_id || data.userId || "anonymous",
      subject: data.subject || "General",
      topic: data.topic || "General",
      num_cards: data.num_cards || 10,
      document_ids: data.document_ids || [],
      model: data.model || null,
      provider: data.provider || null,
    };
    console.log(`\n[Flashcards] Sending to ${AI_BASE}/ai/generate-flashcards`);
    const response = await aiClient.post("/ai/generate-flashcards", payload);
    const aiData = response.data;
    if (!aiData.success) {
      const errorMsg = aiData.error || "AI flashcards generation failed";
      throw new Error(errorMsg);
    }
    return aiData.data;
  } catch (error) {
    console.error("[Flashcards] Error:", error.message);
    throw error;
  }
};

const generateRevisionSchedule = async (data) => {
  try {
    const payload = {
      user_id: data.user_id || data.userId || "anonymous",
      topics_studied: data.topics_studied || [],
      study_history: data.study_history || [],
      weak_topics: data.weak_topics || [],
      daily_capacity_minutes: data.daily_capacity_minutes || 120,
      model: data.model || null,
      provider: data.provider || null,
    };
    console.log(`\n[Revision Schedule] Sending to ${AI_BASE}/ai/revision-schedule`);
    const response = await aiClient.post("/ai/revision-schedule", payload);
    const aiData = response.data;
    if (!aiData.success) {
      const errorMsg = aiData.error || "AI revision schedule generation failed";
      throw new Error(errorMsg);
    }
    return aiData.data;
  } catch (error) {
    console.error("[Revision Schedule] Error:", error.message);
    throw error;
  }
};

const analyzePerformance = async (data) => {
  try {
    const payload = {
      user_id: data.user_id || data.userId || "anonymous",
      study_logs: data.study_logs || [],
      quiz_scores: data.quiz_scores || [],
      days_to_analyze: data.days_to_analyze || 7,
      model: data.model || null,
      provider: data.provider || null,
    };
    console.log(`\n[Performance Analysis] Sending to ${AI_BASE}/ai/analyze-performance`);
    const response = await aiClient.post("/ai/analyze-performance", payload);
    const aiData = response.data;
    if (!aiData.success) {
      const errorMsg = aiData.error || "AI performance analysis failed";
      throw new Error(errorMsg);
    }
    return aiData.data;
  } catch (error) {
    console.error("[Performance Analysis] Error:", error.message);
    throw error;
  }
};

module.exports = {
  generateStudyPlan,
  generateQuiz,
  chatWithAI,
  checkAIHealth,
  generateFlashcards,
  generateRevisionSchedule,
  analyzePerformance,
};