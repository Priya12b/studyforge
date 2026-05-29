// const axios = require("axios");

// const generateStudyPlan = async (data) => {
//   try {
//     const response = await axios.post(
//       `${process.env.AI_SERVICE_URL}/ai/generate-plan`,
//       data
//     );

//     return response.data;
//   } catch (error) {
//     console.log(error.message);

//     throw new Error("AI Service Error");
//   }
// };

// module.exports = {
//   generateStudyPlan,
// };

const generateStudyPlan = async (data) => {
    try {
        // MOCK AI RESPONSE

        return {
            study_plan: [
                {
                    day: "Monday",
                    task: `Study ${data.topic} basics`,
                },
                {
                    day: "Tuesday",
                    task: `Practice questions of ${data.topic}`,
                },
                {
                    day: "Wednesday",
                    task: `Revision of ${data.topic}`,
                },
            ],

            recommendations: [
                "Focus on weak areas",
                "Practice daily",
                "Revise before sleep",
            ],
        };
    } catch (error) {
        console.log(error.message);

        throw new Error("AI Service Error");
    }
};

const generateQuiz = async (data) => {
  try {
    return {
      questions: [
        {
          question: `What is ${data.topic}?`,
          options: [
            "Option A",
            "Option B",
            "Option C",
            "Option D",
          ],
          correctAnswer: "Option A",
        },

        {
          question: `Explain basics of ${data.topic}`,
          options: [
            "Choice 1",
            "Choice 2",
            "Choice 3",
            "Choice 4",
          ],
          correctAnswer: "Choice 2",
        },
      ],
    };
  } catch (error) {
    console.log(error);

    throw new Error("Quiz generation failed");
  }
};

module.exports = {
  generateStudyPlan,
  generateQuiz,
};