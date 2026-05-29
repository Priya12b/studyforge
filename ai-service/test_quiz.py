import httpx
import json

payload = {
    "user_id": "test_user_001",
    "subject": "Wireless Sensor Networks",
    "topic": "WSN Architecture and Protocols",
    "num_questions": 10,
    "difficulty": "mixed"
}

print("Sending quiz request to Gemini 1.5 Flash...")
with httpx.Client(timeout=120.0) as client:
    r = client.post("http://127.0.0.1:8000/ai/generate-quiz", json=payload)
    print("Status:", r.status_code)
    if r.status_code == 200:
        data = r.json()
        if data.get("success"):
            quiz = data["data"]
            print()
            print("=== QUIZ GENERATED SUCCESSFULLY ===")
            print("Title:", quiz.get("title", ""))
            print("Total Questions:", quiz.get("total_questions", ""))
            print("Estimated Time:", quiz.get("estimated_time_minutes", ""), "mins")
            print()
            questions = quiz.get("questions", [])
            for i, q in enumerate(questions, 1):
                question_text = q["question"]
                print(f"Q{i}: {question_text}")
                for opt in q["options"]:
                    print(f"   - {opt}")
                answer = q["correct_answer"]
                explanation = q["explanation"]
                print(f"   ANSWER: {answer}")
                print(f"   EXPLANATION: {explanation}")
                print()
            print(f"Trace: {data.get('trace', {})}")
        else:
            print("Error:", data.get("error"))
    else:
        print("HTTP Error:", r.text[:500])
