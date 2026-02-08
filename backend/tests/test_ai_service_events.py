import json
import os
import unittest

os.environ.setdefault("GEMINI_API_KEY", "test-key")
os.environ.setdefault("ELEVENLABS_API_KEY", "test-key")

from app.services.ai_service import (
    _generate_events_from_content,
    _parse_chat_response,
    _repair_step_events,
)


class AiServiceEventTests(unittest.TestCase):
    def test_generate_events_from_content_includes_zone_defaults(self):
        step = {
            "step_number": 2,
            "title": "Differentiate",
            "content": "Use the power rule",
            "math_blocks": [{"latex": "x^2", "display": True}],
        }
        events = _generate_events_from_content(step)
        visuals = [e for e in events if e["type"] in {"write_text", "write_equation"}]
        self.assertTrue(all(v["payload"].get("zone") == "main" for v in visuals))
        self.assertTrue(all(v["payload"].get("anchor") == "work" for v in visuals))
        self.assertTrue(all(v["payload"].get("lane") == "derivation" for v in visuals))
        self.assertTrue(all(v["payload"].get("align") == "left" for v in visuals))

    def test_parse_chat_response_normalizes_whiteboard_events(self):
        payload = {
            "message": "Try this substitution.",
            "narration": "Try this substitution.",
            "math_blocks": [],
            "events": [
                {
                    "type": "write_equation",
                    "latex": "x = 4",
                    "display": True,
                    "zone": "scratch",
                },
                {
                    "type": "annotate",
                    "target": "previous",
                    "style": "box",
                },
                {
                    "type": "clear_section",
                    "clear_target": "zone",
                    "clear_zone": "scratch",
                },
            ],
        }
        result = _parse_chat_response(json.dumps(payload))
        self.assertIn("events", result)
        self.assertEqual(result["events"][0]["type"], "write_equation")
        self.assertEqual(result["events"][0]["payload"]["zone"], "scratch")
        self.assertEqual(result["events"][0]["payload"]["anchor"], "scratch")
        self.assertEqual(result["events"][0]["payload"]["lane"], "scratch")
        self.assertTrue(result["events"][0]["payload"]["temporary"])
        self.assertEqual(result["events"][1]["type"], "annotate")
        self.assertEqual(result["events"][1]["payload"]["annotation_type"], "box")
        self.assertTrue(
            any(
                ev["type"] == "clear_section"
                and ev["payload"].get("clear_target") == "id"
                for ev in result["events"]
            )
        )
        visual_like = {
            "write_equation",
            "write_text",
            "draw_line",
            "draw_arrow",
            "draw_rect",
            "draw_circle",
            "draw_axes",
            "plot_curve",
            "annotate",
        }
        self.assertLessEqual(
            len([ev for ev in result["events"] if ev["type"] in visual_like]), 4
        )
        self.assertLessEqual(
            len([ev for ev in result["events"] if ev["type"] == "narrate"]), 1
        )

    def test_repair_step_events_adds_missing_choreography(self):
        raw_events = [
            {
                "id": "s1_e0_x",
                "type": "write_equation",
                "duration": 800,
                "payload": {"latex": "x+1=2", "display": True},
            }
        ]
        repaired = _repair_step_events(raw_events, 1, "Solve")
        event_types = [e["type"] for e in repaired]
        self.assertIn("narrate", event_types)
        self.assertGreaterEqual(event_types.count("write_text") + event_types.count("write_equation"), 2)
        self.assertIn("annotate", event_types)
        self.assertEqual(repaired[-1]["type"], "pause")
        derivation_visuals = [
            event for event in repaired
            if event["type"] in {"write_text", "write_equation"}
            and event["payload"].get("lane") == "derivation"
        ]
        self.assertTrue(all("transform_chain_id" in event["payload"] for event in derivation_visuals))
        self.assertTrue(all("board_page" in event["payload"] for event in derivation_visuals))
        self.assertTrue(all("slot_index" in event["payload"] for event in derivation_visuals))
        self.assertTrue(all(event["payload"].get("layout_locked") is True for event in derivation_visuals))
        self.assertTrue(all(isinstance(event["payload"].get("render_order"), int) for event in derivation_visuals))
        content_events = [e for e in repaired if e.get("type") != "step_marker"]
        self.assertGreater(len(content_events), 0)
        self.assertEqual(content_events[0]["type"], "narrate")
        narrates = [e for e in repaired if e.get("type") == "narrate"]
        self.assertTrue(all(e.get("payload", {}).get("teaching_phase") for e in narrates))


if __name__ == "__main__":
    unittest.main()
