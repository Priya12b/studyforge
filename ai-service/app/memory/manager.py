"""
Conversation & Long-term Memory Manager
Manages per-session chat history and per-user long-term preferences.
Supports local in-memory backend and Redis for production scaling.
"""

import uuid
from typing import Optional, Dict, List
from collections import defaultdict
from datetime import datetime

from langchain_core.messages import BaseMessage, HumanMessage, AIMessage
from langchain_core.chat_history import BaseChatMessageHistory, InMemoryChatMessageHistory

from app.utils.logging import get_logger

logger = get_logger("memory_manager")


class UserProfile:
    """Long-term user memory storing preferences and learning patterns."""

    def __init__(self, user_id: str):
        self.user_id = user_id
        self.weak_topics: List[dict] = []
        self.preferred_subjects: List[str] = []
        self.learning_style: str = "visual"
        self.study_patterns: List[dict] = []
        self.last_interaction: Optional[datetime] = None
        self.interaction_count: int = 0
        self.custom_preferences: dict = {}

    def update_weak_topics(self, topics: List[dict]) -> None:
        """Update the user's known weak topics."""
        existing = {(t["subject"], t["topic"]) for t in self.weak_topics}
        for topic in topics:
            key = (topic.get("subject", ""), topic.get("topic", ""))
            if key not in existing:
                self.weak_topics.append(topic)
                existing.add(key)

    def record_interaction(self) -> None:
        """Track user interaction for personalization."""
        self.last_interaction = datetime.utcnow()
        self.interaction_count += 1

    def to_context_string(self) -> str:
        """Serialize user profile to a string for LLM context injection."""
        parts = [f"User ID: {self.user_id}"]
        if self.weak_topics:
            weak = ", ".join(f"{t['subject']}: {t['topic']}" for t in self.weak_topics[:5])
            parts.append(f"Known weak areas: {weak}")
        if self.preferred_subjects:
            parts.append(f"Preferred subjects: {', '.join(self.preferred_subjects)}")
        if self.learning_style:
            parts.append(f"Learning style: {self.learning_style}")
        parts.append(f"Total interactions: {self.interaction_count}")
        return "\n".join(parts)


class MemoryManager:
    """
    Manages conversation memory (per-session) and user profiles (per-user).

    Session memory: Short-term chat history for contextual conversations.
    User profiles: Long-term memory for personalization across sessions.
    """

    def __init__(self):
        # Session ID → ChatMessageHistory
        self._sessions: Dict[str, InMemoryChatMessageHistory] = {}

        # User ID → UserProfile
        self._user_profiles: Dict[str, UserProfile] = {}

        # Track session → user mapping
        self._session_user_map: Dict[str, str] = {}

        # Max messages per session to prevent context overflow
        self.max_history_length = 20

    def get_or_create_session(
        self,
        session_id: Optional[str] = None,
        user_id: Optional[str] = None,
    ) -> tuple[str, InMemoryChatMessageHistory]:
        """
        Get an existing session or create a new one.
        Returns (session_id, history).
        """
        if session_id and session_id in self._sessions:
            return session_id, self._sessions[session_id]

        # Create new session
        new_id = session_id or str(uuid.uuid4())[:12]
        self._sessions[new_id] = InMemoryChatMessageHistory()

        if user_id:
            self._session_user_map[new_id] = user_id

        logger.info("session_created", session_id=new_id, user_id=user_id)
        return new_id, self._sessions[new_id]

    def add_message(self, session_id: str, message: BaseMessage) -> None:
        """Add a message to a session, enforcing max history length."""
        if session_id not in self._sessions:
            self._sessions[session_id] = InMemoryChatMessageHistory()

        history = self._sessions[session_id]
        history.add_message(message)

        # Trim old messages if exceeding limit (keep most recent)
        messages = history.messages
        if len(messages) > self.max_history_length:
            trimmed = messages[-self.max_history_length:]
            history.clear()
            for msg in trimmed:
                history.add_message(msg)

    def get_history(self, session_id: str) -> List[BaseMessage]:
        """Get the message history for a session."""
        if session_id in self._sessions:
            return self._sessions[session_id].messages
        return []

    def get_user_profile(self, user_id: str) -> UserProfile:
        """Get or create a long-term user profile."""
        if user_id not in self._user_profiles:
            self._user_profiles[user_id] = UserProfile(user_id)
        return self._user_profiles[user_id]

    def update_user_profile(self, user_id: str, **kwargs) -> None:
        """Update fields on the user's long-term profile."""
        profile = self.get_user_profile(user_id)
        for key, value in kwargs.items():
            if hasattr(profile, key):
                setattr(profile, key, value)

    def clear_session(self, session_id: str) -> None:
        """Clear a session's message history."""
        if session_id in self._sessions:
            self._sessions[session_id].clear()
            logger.info("session_cleared", session_id=session_id)

    def get_session_count(self) -> int:
        """Get the number of active sessions."""
        return len(self._sessions)


# Singleton memory manager
memory_manager = MemoryManager()
