import httpx
import json

data = {
  "user_id": "string",
  "subjects": [
    {
      "name": "Harshil",
      "confidence_level": 100,
      "priority": "medium",
      "exam_date": "23-05-2026",
      "syllabus_topics": ["Wireless Sensor Network - Mobile IP and Network Architecture"],
      "credits": 3
    }
  ],
  "available_hours_per_day": 5,
  "start_date": "21-05-2026",
  "end_date": "23-05-2026",
  "preferred_start_time": "09:00",
  "preferred_end_time": "21:00",
  "break_duration_minutes": 15,
  "weak_subjects": ["Wireless Sensor Network"],
  "goals": "string"
}

print("Sending request to generate plan using Ollama locally... This may take a few minutes depending on your hardware.")

try:
    with httpx.Client(timeout=1000.0) as client:
        response = client.post("http://127.0.0.1:8000/ai/generate-plan", json=data)
        if response.status_code == 200:
            print(json.dumps(response.json(), indent=2))
        else:
            print("Error:", response.status_code, response.text)
except Exception as e:
    print("Failed:", e)
