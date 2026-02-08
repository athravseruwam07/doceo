import logging
import re
from collections import Counter, defaultdict
from datetime import datetime, timezone
from typing import Any

from pydantic import ValidationError

from app.models.session import get_session, update_session
from app.schemas.exam_cram import ExamCramResponse

logger = logging.getLogger(__name__)

_MAX_MATERIAL_CHARS = 120000
_MIN_TOKEN_LEN = 4

_STOPWORDS = {
    "about",
    "after",
    "again",
    "also",
    "answer",
    "answers",
    "been",
    "before",
    "between",
    "choose",
    "could",
    "correct",
    "determine",
    "does",
    "during",
    "each",
    "exam",
    "evaluate",
    "find",
    "following",
    "from",
    "have",
    "into",
    "just",
    "lesson",
    "make",
    "marks",
    "material",
    "materials",
    "more",
    "most",
    "multiple",
    "number",
    "other",
    "only",
    "over",
    "question",
    "questions",
    "same",
    "sample",
    "show",
    "some",
    "such",
    "test",
    "than",
    "that",
    "their",
    "there",
    "these",
    "they",
    "this",
    "those",
    "through",
    "tutorial",
    "using",
    "very",
    "what",
    "when",
    "where",
    "which",
    "while",
    "whether",
    "with",
    "would",
}

_GENERIC_TOPICS = {
    "following",
    "only",
    "test",
    "question",
    "questions",
    "exam",
    "sample",
    "material",
    "materials",
    "answer",
    "answers",
}

# Topic patterns and coaching scaffolds.
_TOPIC_CATALOG: list[dict[str, Any]] = [
    {
        "topic": "Improper Integrals",
        "patterns": [r"\bimproper integral\b", r"\bintegral\b", r"\bdivergent\b"],
        "actions": [
            "Practice convergence setup before solving antiderivatives.",
            "Write domain/limit bounds first, then evaluate in one pass.",
        ],
        "template": "Evaluate an improper integral and justify convergence before computing the final value.",
    },
    {
        "topic": "Series Convergence Tests",
        "patterns": [
            r"\bconvergen",
            r"\bdivergen",
            r"\bcomparison theorem\b",
            r"\bratio test\b",
            r"\balternating series\b",
        ],
        "actions": [
            "Choose the convergence test first and state why it applies.",
            "Build a one-page decision tree for comparison/ratio/alternating tests.",
        ],
        "template": "Determine whether a series converges, selecting and justifying the best test.",
    },
    {
        "topic": "Sequences and Limits",
        "patterns": [r"\bsequence\b", r"\blimit\b", r"\bmonotonic\b", r"\bbounded\b"],
        "actions": [
            "State monotonicity and boundedness before claiming convergence.",
            "Use limit laws only after confirming sequence behavior assumptions.",
        ],
        "template": "Analyze a recursively-defined sequence for monotonicity, boundedness, and limit.",
    },
    {
        "topic": "Power Series and Radius of Convergence",
        "patterns": [
            r"\bpower series\b",
            r"\bradius of convergence\b",
            r"\binterval of convergence\b",
            r"\bmaclaurin\b",
            r"\btaylor\b",
        ],
        "actions": [
            "Compute radius first, then test endpoints separately.",
            "Summarize interval notation conventions to avoid endpoint mistakes.",
        ],
        "template": "Find radius and interval of convergence, including full endpoint analysis.",
    },
    {
        "topic": "Induction Proofs",
        "patterns": [r"\binduction\b", r"\bassume\b", r"\bshow that\b"],
        "actions": [
            "Structure proof into base case, inductive hypothesis, and inductive step explicitly.",
            "Rewrite target expression before substitution to avoid algebra slips.",
        ],
        "template": "Complete a mathematical induction proof and identify the correct inductive step.",
    },
    {
        "topic": "Infinite Series Sums and Partial Fractions",
        "patterns": [
            r"\bpartial sum\b",
            r"\bsum of the series\b",
            r"\btelescop",
            r"\bpartial fraction\b",
        ],
        "actions": [
            "Map each term to telescoping/partial fraction structure before summing.",
            "Track cancellation explicitly between consecutive terms.",
        ],
        "template": "Find the closed-form sum of an infinite series using partial fraction decomposition.",
    },
]

_TOPIC_ALIASES: dict[str, str] = {
    "integral": "Improper Integrals",
    "improper": "Improper Integrals",
    "convergence": "Series Convergence Tests",
    "convergent": "Series Convergence Tests",
    "divergent": "Series Convergence Tests",
    "comparison": "Series Convergence Tests",
    "alternating": "Series Convergence Tests",
    "ratio": "Series Convergence Tests",
    "sequence": "Sequences and Limits",
    "bounded": "Sequences and Limits",
    "limit": "Sequences and Limits",
    "power": "Power Series and Radius of Convergence",
    "radius": "Power Series and Radius of Convergence",
    "interval": "Power Series and Radius of Convergence",
    "induction": "Induction Proofs",
    "partial": "Infinite Series Sums and Partial Fractions",
    "telescoping": "Infinite Series Sums and Partial Fractions",
}


def _normalize_text(text: str) -> str:
    cleaned = text.replace("\r\n", "\n").replace("\r", "\n")
    cleaned = re.sub(r"[ \t]+", " ", cleaned)
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned).strip()
    return cleaned[:_MAX_MATERIAL_CHARS]


def _normalize_token(token: str) -> str:
    token = re.sub(r"[^a-zA-Z0-9+-]", "", token.lower())
    return token


def _is_useful_token(token: str) -> bool:
    if len(token) < _MIN_TOKEN_LEN:
        return False
    if token in _STOPWORDS:
        return False
    if token in _GENERIC_TOPICS:
        return False
    if token.isdigit():
        return False
    if token.count("-") > 1:
        return False
    return True


def _extract_question_blocks(material_texts: list[str]) -> list[dict[str, Any]]:
    blocks: list[dict[str, Any]] = []
    question_pattern = re.compile(r"(?m)(?:^|\n)\s*(\d{1,2})[.)]\s")

    for m_idx, text in enumerate(material_texts, start=1):
        matches = list(question_pattern.finditer(text))
        if not matches:
            lines = [line.strip() for line in text.splitlines() if line.strip()]
            for i, line in enumerate(lines[:20], start=1):
                snippet = re.sub(r"\s+", " ", line)[:220]
                blocks.append(
                    {"id": f"M{m_idx}-S{i}", "text": snippet, "material_index": m_idx}
                )
            continue

        for idx, match in enumerate(matches):
            start = match.end()
            end = matches[idx + 1].start() if idx + 1 < len(matches) else len(text)
            content = re.sub(r"\s+", " ", text[start:end]).strip()
            if not content:
                continue
            qid = match.group(1)
            blocks.append(
                {
                    "id": f"M{m_idx}-Q{qid}",
                    "text": content[:260],
                    "material_index": m_idx,
                }
            )
    return blocks


def _extract_term_counts(material_texts: list[str]) -> Counter[str]:
    counter: Counter[str] = Counter()
    for text in material_texts:
        for raw in re.findall(r"[a-zA-Z][a-zA-Z0-9+-]*", text.lower()):
            token = _normalize_token(raw)
            if not _is_useful_token(token):
                continue
            counter[token] += 1
    return counter


def _extract_top_terms(counter: Counter[str], limit: int = 20) -> list[str]:
    return [term for term, _ in counter.most_common(limit)]


def _detect_topic_hits(question_blocks: list[dict[str, Any]]) -> dict[str, list[dict[str, str]]]:
    topic_hits: dict[str, list[dict[str, str]]] = defaultdict(list)
    for block in question_blocks:
        text = block["text"]
        lower = text.lower()
        for entry in _TOPIC_CATALOG:
            topic = entry["topic"]
            if any(re.search(pattern, lower) for pattern in entry["patterns"]):
                topic_hits[topic].append(
                    {
                        "question_id": block["id"],
                        "snippet": text[:180],
                    }
                )
    return topic_hits


def _build_topic_scores(
    topic_hits: dict[str, list[dict[str, str]]], term_counts: Counter[str]
) -> dict[str, float]:
    scores: dict[str, float] = {}

    for topic, hits in topic_hits.items():
        unique_questions = len({hit["question_id"] for hit in hits})
        scores[topic] = unique_questions * 1.8 + len(hits) * 0.6

    for token, count in term_counts.items():
        mapped = _TOPIC_ALIASES.get(token)
        if not mapped:
            continue
        scores[mapped] = scores.get(mapped, 0.0) + min(5.0, count * 0.25)

    return scores


def _quality_filter_topics(
    topics: list[dict[str, Any]], term_counts: Counter[str]
) -> list[dict[str, Any]]:
    filtered: list[dict[str, Any]] = []
    for topic in topics:
        name = topic["topic"].strip()
        low = name.lower()
        if not name or low in _GENERIC_TOPICS:
            continue
        if len(low.split()) == 1 and low in _STOPWORDS:
            continue
        filtered.append(topic)

    if len(filtered) >= 4:
        return filtered

    # Backfill with strong, non-generic terms if extraction is sparse.
    for term, count in term_counts.most_common(25):
        if term in _GENERIC_TOPICS or term in _STOPWORDS:
            continue
        candidate = {
            "topic": term.title(),
            "raw_score": max(1.0, count * 0.4),
            "evidence": [f"Repeated term '{term}' ({count} mentions)"],
            "study_actions": [f"Review 2 worked examples focused on {term}."],
            "why": "High-frequency concept in uploaded materials.",
        }
        filtered.append(candidate)
        if len(filtered) >= 6:
            break
    return filtered


def _topic_actions(topic_name: str) -> list[str]:
    for entry in _TOPIC_CATALOG:
        if entry["topic"] == topic_name:
            return entry["actions"][:2]
    return [
        f"Practice 3 timed problems on {topic_name.lower()}.",
        f"Build a one-page summary for {topic_name.lower()} with key triggers.",
    ]


def _topic_template(topic_name: str) -> str:
    for entry in _TOPIC_CATALOG:
        if entry["topic"] == topic_name:
            return entry["template"]
    return f"Solve a multi-step exam question on {topic_name.lower()} and justify each step."


def _compose_prioritized_topics(
    *,
    topic_scores: dict[str, float],
    topic_hits: dict[str, list[dict[str, str]]],
    term_counts: Counter[str],
    limit: int = 8,
) -> list[dict[str, Any]]:
    if not topic_scores:
        return []

    sorted_items = sorted(topic_scores.items(), key=lambda item: item[1], reverse=True)
    raw_topics: list[dict[str, Any]] = []
    for topic_name, raw_score in sorted_items:
        hits = topic_hits.get(topic_name, [])
        evidence = []
        for hit in hits[:3]:
            evidence.append(f"{hit['question_id']}: {hit['snippet']}")
        if not evidence:
            evidence.append(f"Detected repeated concept markers for '{topic_name}'.")

        raw_topics.append(
            {
                "topic": topic_name,
                "raw_score": raw_score,
                "why": "Appears repeatedly across question formats in uploaded material.",
                "evidence": evidence,
                "study_actions": _topic_actions(topic_name),
            }
        )

    raw_topics = _quality_filter_topics(raw_topics, term_counts)[:limit]
    if not raw_topics:
        return []

    max_score = max(topic["raw_score"] for topic in raw_topics) or 1.0
    min_floor = 0.35
    spread = 0.60
    for topic in raw_topics:
        normalized = min_floor + spread * (topic["raw_score"] / max_score)
        topic["likelihood"] = round(min(0.95, max(0.0, normalized)), 2)
        del topic["raw_score"]
    return raw_topics


def _compose_recurring_patterns(
    prioritized_topics: list[dict[str, Any]],
    topic_hits: dict[str, list[dict[str, str]]],
) -> list[str]:
    patterns: list[str] = []
    for topic in prioritized_topics[:4]:
        topic_name = topic["topic"]
        count = len(topic_hits.get(topic_name, []))
        if count > 0:
            patterns.append(f"{topic_name} appears in at least {count} identified question blocks.")
    if not patterns:
        patterns = [
            "Question families repeat across the uploaded materials.",
            "Method selection and execution speed are recurring pressure points.",
        ]
    return patterns[:6]


def _compose_focused_lessons(prioritized_topics: list[dict[str, Any]]) -> list[dict[str, Any]]:
    if not prioritized_topics:
        return [
            {
                "title": "Core Concept Sweep",
                "objective": "Rebuild fundamentals before timed practice.",
                "key_points": ["Definitions", "Core methods", "Error checks"],
                "estimated_minutes": 25,
            }
        ]

    top = [topic["topic"] for topic in prioritized_topics[:5]]
    lessons = [
        {
            "title": f"{top[0]} Deep Dive",
            "objective": f"Master setup and execution for {top[0].lower()} questions.",
            "key_points": [
                "Prompt cues",
                "Method selection",
                "Common grading deductions",
            ],
            "estimated_minutes": 25,
        }
    ]
    if len(top) > 1:
        lessons.append(
            {
                "title": f"{top[1]} Decision Practice",
                "objective": f"Select the right strategy quickly for {top[1].lower()} problems.",
                "key_points": [
                    "Decision rules",
                    "Edge cases",
                    "Verification checklist",
                ],
                "estimated_minutes": 20,
            }
        )
    if len(top) > 2:
        lessons.append(
            {
                "title": f"Mixed Drill: {top[0]} + {top[2]}",
                "objective": "Switch methods under timed pressure.",
                "key_points": [
                    "Transition cues between methods",
                    "Time budgeting",
                    "Final-answer validation",
                ],
                "estimated_minutes": 30,
            }
        )
    lessons.append(
        {
            "title": "Final Exam Simulation",
            "objective": "Run an exam-style set with post-mortem error analysis.",
            "key_points": [
                "Strict timing",
                "Attempt ordering strategy",
                "Mistake log and remediation",
            ],
            "estimated_minutes": 30,
        }
    )
    return lessons[:5]


def _compose_practice_questions(
    prioritized_topics: list[dict[str, Any]],
    topic_hits: dict[str, list[dict[str, str]]],
) -> list[dict[str, Any]]:
    questions: list[dict[str, Any]] = []
    for i, topic in enumerate(prioritized_topics[:10], start=1):
        topic_name = topic["topic"]
        difficulty = "easy" if i <= 3 else "medium" if i <= 7 else "hard"
        evidence = topic_hits.get(topic_name, [])
        if evidence:
            stem_context = evidence[0]["snippet"][:95]
            question_text = (
                f"Q{i}: { _topic_template(topic_name) } "
                f"Use this style cue from your material: \"{stem_context}\"."
            )
        else:
            question_text = f"Q{i}: {_topic_template(topic_name)}"

        questions.append(
            {
                "question": question_text,
                "difficulty": difficulty,
                "concept": topic_name,
                "answer_outline": (
                    "Identify the method trigger, execute clean algebra/calculus steps, "
                    "and finish with a concise justification."
                ),
            }
        )
    return questions


def _is_low_quality_ai_result(ai_result: dict[str, Any]) -> bool:
    topics = ai_result.get("prioritized_topics", []) or []
    questions = ai_result.get("practice_questions", []) or []
    if len(topics) < 4 or len(questions) < 4:
        return True

    bad_topics = 0
    for item in topics:
        topic = str(item.get("topic", "")).strip().lower()
        if not topic or topic in _GENERIC_TOPICS:
            bad_topics += 1
    if bad_topics >= max(2, len(topics) // 2):
        return True

    generic_questions = 0
    for item in questions:
        text = str(item.get("question", "")).lower()
        if "multi-step setting" in text or len(text) < 35:
            generic_questions += 1
    return generic_questions >= max(3, len(questions) // 2)


def _merge_ai_if_useful(
    deterministic: dict[str, Any], ai_result: dict[str, Any]
) -> dict[str, Any]:
    if _is_low_quality_ai_result(ai_result):
        return deterministic

    merged = dict(deterministic)
    ai_patterns = [str(x).strip() for x in (ai_result.get("recurring_patterns", []) or [])]
    if ai_patterns:
        merged["recurring_patterns"] = ai_patterns[:6]

    # Keep deterministic priorities/evidence; optionally borrow richer lesson phrasing.
    ai_lessons = ai_result.get("focused_lessons", []) or []
    if ai_lessons:
        curated_lessons = []
        for lesson in ai_lessons[:5]:
            title = str(lesson.get("title", "")).strip()
            objective = str(lesson.get("objective", "")).strip()
            if not title or not objective:
                continue
            key_points = [
                str(x).strip()
                for x in (lesson.get("key_points", []) or [])
                if str(x).strip()
            ][:5]
            try:
                estimated = int(lesson.get("estimated_minutes", 20))
            except Exception:
                estimated = 20
            curated_lessons.append(
                {
                    "title": title,
                    "objective": objective,
                    "key_points": key_points or ["Method selection", "Execution", "Verification"],
                    "estimated_minutes": max(5, min(60, estimated)),
                }
            )
        if len(curated_lessons) >= 3:
            merged["focused_lessons"] = curated_lessons

    return merged


def _build_deterministic_payload(
    *,
    subject: str,
    material_texts: list[str],
    top_terms: list[str],
) -> dict[str, Any]:
    question_blocks = _extract_question_blocks(material_texts)
    term_counts = _extract_term_counts(material_texts)
    topic_hits = _detect_topic_hits(question_blocks)
    topic_scores = _build_topic_scores(topic_hits, term_counts)

    prioritized_topics = _compose_prioritized_topics(
        topic_scores=topic_scores,
        topic_hits=topic_hits,
        term_counts=term_counts,
    )
    recurring_patterns = _compose_recurring_patterns(prioritized_topics, topic_hits)
    focused_lessons = _compose_focused_lessons(prioritized_topics)
    practice_questions = _compose_practice_questions(prioritized_topics, topic_hits)

    if not prioritized_topics:
        prioritized_topics = [
            {
                "topic": "Core Exam Methods",
                "likelihood": 0.75,
                "why": "Detected repeated method-focused prompts across materials.",
                "evidence": ["Method cues are repeatedly present in uploaded text."],
                "study_actions": [
                    "Create a one-page method selection checklist.",
                    "Run a timed mixed-topic drill and review errors.",
                ],
            }
        ]
    if not practice_questions:
        practice_questions = [
            {
                "question": "Build a timed exam set from your uploaded topics and solve with full reasoning.",
                "difficulty": "medium",
                "concept": prioritized_topics[0]["topic"],
                "answer_outline": "Select the best method, show all intermediate steps, and verify the final result.",
            }
        ]

    return {
        "subject": subject,
        "recurring_patterns": recurring_patterns,
        "prioritized_topics": prioritized_topics,
        "focused_lessons": focused_lessons,
        "practice_questions": practice_questions,
        "top_terms": top_terms,
    }


def _build_safe_fallback_payload(
    *,
    session_id: str,
    subject: str,
    exam_name: str | None,
    source_count: int,
    deterministic_payload: dict[str, Any],
    material_summaries: list[dict[str, Any]],
) -> dict[str, Any]:
    return {
        "session_id": session_id,
        "subject": subject,
        "exam_name": exam_name,
        "source_count": source_count,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "top_terms": deterministic_payload.get("top_terms", []),
        "recurring_patterns": deterministic_payload.get("recurring_patterns", []),
        "prioritized_topics": deterministic_payload.get("prioritized_topics", []),
        "focused_lessons": deterministic_payload.get("focused_lessons", []),
        "practice_questions": deterministic_payload.get("practice_questions", []),
        "materials": material_summaries,
    }


async def build_exam_cram_plan(
    session_id: str,
    materials: list[dict[str, str]],
    subject_hint: str | None = None,
    exam_name: str | None = None,
) -> dict[str, Any] | None:
    """Build and persist an exam-cram plan for a session."""
    try:
        session = get_session(session_id)
        if session is None:
            return None

        cleaned_materials: list[dict[str, str]] = []
        for item in materials:
            raw_text = item.get("content", "")
            if not isinstance(raw_text, str):
                continue
            normalized = _normalize_text(raw_text)
            if not normalized:
                continue
            cleaned_materials.append(
                {
                    "name": item.get("name", "Material"),
                    "source_type": item.get("source_type", "text"),
                    "content": normalized,
                }
            )

        if not cleaned_materials:
            return None

        material_texts = [item["content"] for item in cleaned_materials]
        term_counts = _extract_term_counts(material_texts)
        top_terms = _extract_top_terms(term_counts)
        subject = subject_hint or session.get("subject", "General STEM")

        deterministic_payload = _build_deterministic_payload(
            subject=subject,
            material_texts=material_texts,
            top_terms=top_terms,
        )

        ai_result = {}
        try:
            from app.services.ai_service import generate_exam_cram_plan

            ai_result = await generate_exam_cram_plan(
                subject_hint=subject,
                exam_name=exam_name,
                materials=cleaned_materials,
                top_terms=top_terms,
            )
        except Exception:
            logger.exception(
                "AI generation failed for exam cram session %s; using deterministic result",
                session_id,
            )

        merged_payload = _merge_ai_if_useful(deterministic_payload, ai_result)

        material_summaries = [
            {
                "name": item["name"],
                "source_type": item["source_type"],
                "char_count": len(item["content"]),
            }
            for item in cleaned_materials
        ]

        payload = {
            "session_id": session_id,
            "subject": subject,
            "exam_name": exam_name,
            "source_count": len(cleaned_materials),
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "top_terms": merged_payload.get("top_terms", top_terms),
            "recurring_patterns": merged_payload.get("recurring_patterns", []),
            "prioritized_topics": merged_payload.get("prioritized_topics", []),
            "focused_lessons": merged_payload.get("focused_lessons", []),
            "practice_questions": merged_payload.get("practice_questions", []),
            "materials": material_summaries,
        }

        try:
            payload = ExamCramResponse(**payload).model_dump()
        except ValidationError:
            logger.exception(
                "Exam cram response validation failed for session %s; using safe fallback payload",
                session_id,
            )
            payload = _build_safe_fallback_payload(
                session_id=session_id,
                subject=subject,
                exam_name=exam_name,
                source_count=len(cleaned_materials),
                deterministic_payload=deterministic_payload,
                material_summaries=material_summaries,
            )
            payload = ExamCramResponse(**payload).model_dump()

        update_session(session_id, exam_cram=payload, exam_materials=material_summaries)
        return payload
    except Exception:
        logger.exception("Exam cram plan generation failed for session %s", session_id)
        return None
