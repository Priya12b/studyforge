const buildAdaptivePrompt = (
    userData
) => {
    return `
Generate a personalized study plan.

Student Weak Topics:
${userData.weakTopics.join(", ")}

Tasks Completed:
${userData.tasksCompleted}

Study Streak:
${userData.streak}

Target Subject:
${userData.subject}

Target Topic:
${userData.topic}

Create:
1. Daily study schedule
2. More focus on weak topics
3. Revision strategy
4. Practice recommendations
`;
};

module.exports = {
    buildAdaptivePrompt,
};