const summarizeNotes = async (
  text
) => {
  try {
    // MOCK AI SUMMARY

    return `
Summary:
${text.slice(0, 300)}

Key Topics:
- Important Concepts
- Revision Needed
- Practice Questions Recommended
`;
  } catch (error) {
    console.log(error);

    throw error;
  }
};


const generateQuizFromNotes =
  async () => {
    return [
      {
        question:
          "What is the main concept?",
        options: [
          "A",
          "B",
          "C",
          "D",
        ],
        correctAnswer: "A",
      },
    ];
  };


const generatePlanFromNotes =
  async () => {
    return {
      study_plan: [
        {
          day: "Monday",
          task:
            "Revise uploaded notes",
        },
      ],
    };
  };

module.exports = {
  summarizeNotes,
  generateQuizFromNotes,
  generatePlanFromNotes,
};