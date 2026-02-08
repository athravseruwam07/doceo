"""Confusion detection and adaptive tutoring policy."""

from __future__ import annotations

import re
from datetime import datetime
from typing import Any

CONFUSION_PATTERNS: list[tuple[re.Pattern[str], float, str]] = [
    (re.compile(r"\b(i\s+don'?t\s+get\s+it|i'?m\s+confused|i\s+am\s+confused)\b"), 0.28, "explicit_confusion"),
    (re.compile(r"\b(still\s+don'?t\s+understand|still\s+confused|not\s+clicking)\b"), 0.32, "persistent_confusion"),
    (re.compile(r"\b(can\s+you\s+explain\s+again|again\??|one\s+more\s+time)\b"), 0.2, "repeat_request"),
    (re.compile(r"\b(too\s+fast|slow\s+down|lost\s+me)\b"), 0.24, "pacing_issue"),
    (re.compile(r"\b(what\s+is\s+a|what\s+is\s+an|remind\s+me\s+what)\b"), 0.22, "prerequisite_gap"),
    (re.compile(r"\b(this\s+makes\s+no\s+sense|this\s+is\s+wrong|i\s+give\s+up)\b"), 0.35, "frustration"),
]

CLEAR_PATTERNS: list[tuple[re.Pattern[str], float, str]] = [
    (re.compile(r"\b(got\s+it|that\s+makes\s+sense|understand\s+now)\b"), 0.24, "clear_understanding"),
    (re.compile(r"\b(thanks|thank\s+you|helpful)\b"), 0.12, "positive_feedback"),
]

STOPWORDS = {
    "the",
    "and",
    "that",
    "this",
    "with",
    "from",
    "have",
    "what",
    "when",
    "where",
    "which",
    "about",
    "just",
    "into",
    "then",
    "than",
    "your",
    "their",
    "they",
    "them",
    "because",
    "would",
    "could",
    "should",
    "please",
    "again",
    "still",
    "dont",
    "doesnt",
    "cant",
    "into",
}


def _utc_now_iso() -> str:
    return datetime.utcnow().isoformat(timespec="seconds") + "Z"


def default_confusion_state() -> dict[str, Any]:
    return {
        "score": 0.08,
        "level": "low",
        "adaptation_mode": "standard",
        "last_reason": "No strong confusion signals yet.",
        "signals": [],
        "misconception_topics": [],
        "consecutive_confused_turns": 0,
        "consecutive_clear_turns": 0,
        "last_updated": _utc_now_iso(),
    }


def _normalize_text(text: str) -> str:
    return re.sub(r"\s+", " ", text.lower()).strip()


def _tokenize(text: str) -> set[str]:
    tokens = re.findall(r"[a-zA-Z][a-zA-Z0-9_'-]{2,}", text.lower())
    return {token for token in tokens if token not in STOPWORDS}


def _extract_topic_candidates(text: str, limit: int = 3) -> list[str]:
    tokens = [token for token in _tokenize(text) if len(token) >= 4]
    if not tokens:
        return []
    ranked: dict[str, int] = {}
    for token in tokens:
        ranked[token] = ranked.get(token, 0) + 1
    sorted_tokens = sorted(ranked.items(), key=lambda row: (-row[1], row[0]))
    return [token for token, _ in sorted_tokens[:limit]]


def _jaccard_similarity(a: set[str], b: set[str]) -> float:
    if not a or not b:
        return 0.0
    union = a | b
    if not union:
        return 0.0
    return len(a & b) / len(union)


def _recent_student_messages(chat_log: list[dict[str, Any]], limit: int = 6) -> list[str]:
    rows: list[str] = []
    for entry in reversed(chat_log):
        if entry.get("role") != "student":
            continue
        message = entry.get("message")
        if isinstance(message, str) and message.strip():
            rows.append(message.strip())
        if len(rows) >= limit:
            break
    rows.reverse()
    return rows


def _next_level(score: float) -> str:
    if score >= 0.66:
        return "high"
    if score >= 0.34:
        return "medium"
    return "low"


def _choose_adaptation_mode(level: str, signals: list[str]) -> str:
    if level == "high":
        if "prerequisite_gap" in signals:
            return "prerequisite_refresher"
        if "pacing_issue" in signals:
            return "slow_step_by_step"
        return "analogy_plus_scaffold"
    if level == "medium":
        if "repeat_request" in signals or "persistent_confusion" in signals:
            return "guided_breakdown"
        if "prerequisite_gap" in signals:
            return "quick_prereq_check"
        return "scaffolded"
    return "standard"


def _adaptation_reason(level: str, signals: list[str], repeated_count: int) -> str:
    if level == "low":
        return "Student appears comfortable. Keep normal pacing."

    notable = ", ".join(signals[:3]) if signals else "subtle confusion signals"
    if level == "high":
        return (
            f"High confusion detected ({notable}). "
            "Slow down and provide a more foundational walkthrough."
        )
    if repeated_count >= 2:
        return (
            f"Repeated misunderstanding detected ({notable}). "
            "Use scaffolded explanation with a short check for understanding."
        )
    return f"Moderate confusion detected ({notable}). Add clarifications and one analogy."


def analyze_confusion(
    *,
    message: str,
    chat_log: list[dict[str, Any]],
    previous_state: dict[str, Any] | None = None,
    context: dict[str, Any] | None = None,
) -> dict[str, Any]:
    normalized = default_confusion_state()
    if isinstance(previous_state, dict):
        normalized.update(previous_state)

    prev_score = float(normalized.get("score", 0.08))
    signal_labels: list[str] = []
    confusion_delta = 0.0

    text = _normalize_text(message)
    for pattern, weight, label in CONFUSION_PATTERNS:
        if pattern.search(text):
            confusion_delta += weight
            signal_labels.append(label)

    clarity_delta = 0.0
    for pattern, weight, label in CLEAR_PATTERNS:
        if pattern.search(text):
            clarity_delta += weight
            signal_labels.append(label)

    question_marks = message.count("?")
    if question_marks >= 2:
        confusion_delta += 0.08
        signal_labels.append("multiple_questions")

    recent_students = _recent_student_messages(chat_log, limit=6)
    current_tokens = _tokenize(message)
    repeated_similar = 0
    for previous in recent_students[-4:]:
        similarity = _jaccard_similarity(current_tokens, _tokenize(previous))
        if similarity >= 0.62:
            repeated_similar += 1

    if repeated_similar >= 1:
        confusion_delta += 0.12 * repeated_similar
        signal_labels.append("repeated_topic")

    current_step_title = ""
    if isinstance(context, dict):
        value = context.get("current_step_title")
        if isinstance(value, str):
            current_step_title = value.strip().lower()
    if current_step_title:
        seen_on_same_step = 0
        for previous in recent_students[-5:]:
            if current_step_title and current_step_title in previous.lower():
                seen_on_same_step += 1
        if seen_on_same_step >= 2:
            confusion_delta += 0.15
            signal_labels.append("stuck_on_step")

    consecutive_confused = int(normalized.get("consecutive_confused_turns", 0))
    consecutive_clear = int(normalized.get("consecutive_clear_turns", 0))

    confusion_signal_score = max(0.0, confusion_delta - clarity_delta * 0.35)
    if confusion_signal_score > 0.14:
        consecutive_confused += 1
        consecutive_clear = 0
    elif clarity_delta >= 0.12:
        consecutive_clear += 1
        consecutive_confused = max(0, consecutive_confused - 1)
    else:
        consecutive_confused = max(0, consecutive_confused - 1)
        consecutive_clear = max(0, consecutive_clear - 1)

    score = prev_score * 0.76 + confusion_delta - clarity_delta
    if repeated_similar >= 2:
        score += 0.08
    if consecutive_confused >= 2:
        score += 0.06
    if consecutive_clear >= 2:
        score -= 0.07
    score = max(0.0, min(1.0, score))

    level = _next_level(score)
    mode = _choose_adaptation_mode(level, signal_labels)
    reason = _adaptation_reason(level, signal_labels, repeated_similar)

    prev_topics = normalized.get("misconception_topics", [])
    topics: list[str] = [topic for topic in prev_topics if isinstance(topic, str)]
    for topic in _extract_topic_candidates(message):
        if topic not in topics:
            topics.append(topic)
    topics = topics[-8:]

    signal_labels = signal_labels[-8:]
    signal_labels = list(dict.fromkeys(signal_labels))

    adaptation = {
        "score": round(score, 3),
        "level": level,
        "mode": mode,
        "reason": reason,
        "signals": signal_labels,
        "misconception_topics": topics,
        "recommended_pacing": "slower" if level in {"medium", "high"} else "normal",
        "recommended_depth": (
            "foundational" if mode in {"prerequisite_refresher", "slow_step_by_step"} else
            "scaffolded" if level == "medium" else
            "standard"
        ),
        "consecutive_confused_turns": consecutive_confused,
        "consecutive_clear_turns": consecutive_clear,
    }

    state = {
        "score": adaptation["score"],
        "level": level,
        "adaptation_mode": mode,
        "last_reason": reason,
        "signals": signal_labels,
        "misconception_topics": topics,
        "consecutive_confused_turns": consecutive_confused,
        "consecutive_clear_turns": consecutive_clear,
        "last_updated": _utc_now_iso(),
    }

    return {"state": state, "adaptation": adaptation}

