MOCK_SESSION_TITLE = "Differentiating a Polynomial Function"
MOCK_SESSION_SUBJECT = "Calculus"

MOCK_LESSON_STEPS = [
    {
        "step_number": 1,
        "title": "Identify the Function",
        "content": (
            "We are given the polynomial function $f(x) = 3x^4 - 2x^2 + 7x - 5$. "
            "Before differentiating, let's identify each term and its degree."
        ),
        "math_blocks": [
            {"latex": "f(x) = 3x^4 - 2x^2 + 7x - 5", "display": True},
        ],
        "hint": "A polynomial is a sum of terms of the form $ax^n$.",
        "events": [
            {
                "id": "s1_e0_mock01",
                "type": "step_marker",
                "duration": 300,
                "payload": {"step_number": 1, "step_title": "Identify the Function"},
            },
            {
                "id": "s1_e1_mock01",
                "type": "narrate",
                "duration": 5000,
                "payload": {
                    "text": "Alright, let's start by looking at the function we need to differentiate. We have f of x equals three x to the fourth, minus two x squared, plus seven x, minus five.",
                    "step_number": 1,
                },
            },
            {
                "id": "s1_e2_mock01",
                "type": "write_equation",
                "duration": 2500,
                "payload": {
                    "latex": "f(x) = 3x^4 - 2x^2 + 7x - 5",
                    "display": True,
                    "step_number": 1,
                },
            },
            {
                "id": "s1_e3_mock01",
                "type": "write_text",
                "duration": 1200,
                "payload": {
                    "text": "Degree 4 polynomial, 4 terms",
                    "step_number": 1,
                },
            },
            {
                "id": "s1_e4_mock01",
                "type": "narrate",
                "duration": 4500,
                "payload": {
                    "text": "This is a degree four polynomial with four terms. Since it's a polynomial, we can differentiate it term by term using the power rule.",
                    "step_number": 1,
                },
            },
            {
                "id": "s1_e5_mock01",
                "type": "annotate",
                "duration": 600,
                "payload": {
                    "annotation_type": "underline",
                    "target_id": "s1_e2_mock01",
                    "step_number": 1,
                },
            },
            {
                "id": "s1_e6_mock01",
                "type": "pause",
                "duration": 1200,
                "payload": {"step_number": 1},
            },
        ],
    },
    {
        "step_number": 2,
        "title": "Recall the Power Rule",
        "content": (
            "The power rule states that if $f(x) = x^n$, then $f'(x) = nx^{n-1}$."
        ),
        "math_blocks": [
            {"latex": "\\frac{d}{dx}[x^n] = n \\cdot x^{n-1}", "display": True},
            {"latex": "\\frac{d}{dx}[c] = 0", "display": True},
        ],
        "hint": "The power rule brings the exponent down and reduces it by 1.",
        "events": [
            {
                "id": "s2_e0_mock01",
                "type": "step_marker",
                "duration": 300,
                "payload": {"step_number": 2, "step_title": "Recall the Power Rule"},
            },
            {
                "id": "s2_e1_mock01",
                "type": "narrate",
                "duration": 5000,
                "payload": {
                    "text": "Before we dive in, let me remind you of the key rule. The power rule says: bring the exponent down as a coefficient, then subtract one from the exponent.",
                    "step_number": 2,
                },
            },
            {
                "id": "s2_e2_mock01",
                "type": "write_equation",
                "duration": 2200,
                "payload": {
                    "latex": "\\frac{d}{dx}[x^n] = n \\cdot x^{n-1}",
                    "display": True,
                    "step_number": 2,
                },
            },
            {
                "id": "s2_e3_mock01",
                "type": "write_text",
                "duration": 900,
                "payload": {
                    "text": "Power Rule",
                    "step_number": 2,
                },
            },
            {
                "id": "s2_e4_mock01",
                "type": "narrate",
                "duration": 4000,
                "payload": {
                    "text": "When we already have a coefficient, we just multiply it through. So the derivative of a times x to the n is a n x to the n minus one.",
                    "step_number": 2,
                },
            },
            {
                "id": "s2_e5_mock01",
                "type": "write_equation",
                "duration": 2000,
                "payload": {
                    "latex": "\\frac{d}{dx}[ax^n] = a \\cdot n \\cdot x^{n-1}",
                    "display": True,
                    "step_number": 2,
                },
            },
            {
                "id": "s2_e6_mock01",
                "type": "narrate",
                "duration": 3000,
                "payload": {
                    "text": "And one more thing \u2014 the derivative of any constant is simply zero.",
                    "step_number": 2,
                },
            },
            {
                "id": "s2_e7_mock01",
                "type": "write_equation",
                "duration": 1500,
                "payload": {
                    "latex": "\\frac{d}{dx}[c] = 0",
                    "display": True,
                    "step_number": 2,
                },
            },
            {
                "id": "s2_e8_mock01",
                "type": "annotate",
                "duration": 600,
                "payload": {
                    "annotation_type": "box",
                    "target_id": "s2_e2_mock01",
                    "step_number": 2,
                },
            },
            {
                "id": "s2_e9_mock01",
                "type": "pause",
                "duration": 1200,
                "payload": {"step_number": 2},
            },
        ],
    },
    {
        "step_number": 3,
        "title": "Differentiate Each Term",
        "content": "Now let's apply the power rule to each term individually.",
        "math_blocks": [
            {"latex": "\\frac{d}{dx}[3x^4] = 12x^3", "display": True},
            {"latex": "\\frac{d}{dx}[-2x^2] = -4x", "display": True},
            {"latex": "\\frac{d}{dx}[7x] = 7", "display": True},
            {"latex": "\\frac{d}{dx}[-5] = 0", "display": True},
        ],
        "hint": "Bring the exponent down, multiply by the coefficient, then subtract 1.",
        "events": [
            {
                "id": "s3_e0_mock01",
                "type": "step_marker",
                "duration": 300,
                "payload": {"step_number": 3, "step_title": "Differentiate Each Term"},
            },
            {
                "id": "s3_e1_mock01",
                "type": "narrate",
                "duration": 4500,
                "payload": {
                    "text": "Great, now let's apply the power rule to each term one at a time. Starting with three x to the fourth \u2014 we bring down the four, multiply by three, and reduce the exponent by one.",
                    "step_number": 3,
                },
            },
            {
                "id": "s3_e2_mock01",
                "type": "write_equation",
                "duration": 2000,
                "payload": {
                    "latex": "\\frac{d}{dx}[3x^4] = 3 \\cdot 4 \\cdot x^{3} = 12x^3",
                    "display": True,
                    "step_number": 3,
                },
            },
            {
                "id": "s3_e3_mock01",
                "type": "narrate",
                "duration": 3500,
                "payload": {
                    "text": "Next, negative two x squared. Bring down the two, multiply, and reduce the exponent. That gives us negative four x.",
                    "step_number": 3,
                },
            },
            {
                "id": "s3_e4_mock01",
                "type": "write_equation",
                "duration": 2000,
                "payload": {
                    "latex": "\\frac{d}{dx}[-2x^2] = -2 \\cdot 2 \\cdot x^{1} = -4x",
                    "display": True,
                    "step_number": 3,
                },
            },
            {
                "id": "s3_e5_mock01",
                "type": "narrate",
                "duration": 3000,
                "payload": {
                    "text": "For seven x, the exponent is one, so we just get the coefficient \u2014 seven. And the constant negative five becomes zero.",
                    "step_number": 3,
                },
            },
            {
                "id": "s3_e6_mock01",
                "type": "write_equation",
                "duration": 1500,
                "payload": {
                    "latex": "\\frac{d}{dx}[7x] = 7",
                    "display": True,
                    "step_number": 3,
                },
            },
            {
                "id": "s3_e7_mock01",
                "type": "write_equation",
                "duration": 1500,
                "payload": {
                    "latex": "\\frac{d}{dx}[-5] = 0",
                    "display": True,
                    "step_number": 3,
                },
            },
            {
                "id": "s3_e8_mock01",
                "type": "pause",
                "duration": 1200,
                "payload": {"step_number": 3},
            },
        ],
    },
    {
        "step_number": 4,
        "title": "Combine the Results",
        "content": "Now we combine the derivatives of each term to get the final derivative.",
        "math_blocks": [
            {"latex": "f'(x) = 12x^3 - 4x + 7", "display": True},
        ],
        "hint": "Simply add up all the individual derivatives.",
        "events": [
            {
                "id": "s4_e0_mock01",
                "type": "step_marker",
                "duration": 300,
                "payload": {"step_number": 4, "step_title": "Combine the Results"},
            },
            {
                "id": "s4_e1_mock01",
                "type": "narrate",
                "duration": 4000,
                "payload": {
                    "text": "Now let's put it all together. We combine each term's derivative to get f prime of x equals twelve x cubed minus four x plus seven.",
                    "step_number": 4,
                },
            },
            {
                "id": "s4_e2_mock01",
                "type": "write_equation",
                "duration": 2500,
                "payload": {
                    "latex": "f'(x) = 12x^3 - 4x + 7",
                    "display": True,
                    "step_number": 4,
                },
            },
            {
                "id": "s4_e3_mock01",
                "type": "annotate",
                "duration": 600,
                "payload": {
                    "annotation_type": "box",
                    "target_id": "s4_e2_mock01",
                    "step_number": 4,
                },
            },
            {
                "id": "s4_e4_mock01",
                "type": "narrate",
                "duration": 4000,
                "payload": {
                    "text": "And there's our answer! This derivative tells us the instantaneous rate of change of f at any point x.",
                    "step_number": 4,
                },
            },
            {
                "id": "s4_e5_mock01",
                "type": "write_text",
                "duration": 800,
                "payload": {
                    "text": "Rate of change at any x",
                    "step_number": 4,
                },
            },
            {
                "id": "s4_e6_mock01",
                "type": "pause",
                "duration": 1200,
                "payload": {"step_number": 4},
            },
        ],
    },
    {
        "step_number": 5,
        "title": "Verify the Result",
        "content": "Let's verify our answer by checking a specific value.",
        "math_blocks": [
            {"latex": "f(1) = 3(1)^4 - 2(1)^2 + 7(1) - 5 = 3", "display": True},
            {"latex": "f'(1) = 12(1)^3 - 4(1) + 7 = 15", "display": True},
        ],
        "hint": "Plug in a simple value like x = 1 to check your work.",
        "events": [
            {
                "id": "s5_e0_mock01",
                "type": "step_marker",
                "duration": 300,
                "payload": {"step_number": 5, "step_title": "Verify the Result"},
            },
            {
                "id": "s5_e1_mock01",
                "type": "narrate",
                "duration": 4500,
                "payload": {
                    "text": "Let's do a quick sanity check. We'll plug in x equals one into both the original function and the derivative to make sure everything looks right.",
                    "step_number": 5,
                },
            },
            {
                "id": "s5_e2_mock01",
                "type": "write_equation",
                "duration": 2500,
                "payload": {
                    "latex": "f(1) = 3(1)^4 - 2(1)^2 + 7(1) - 5 = 3",
                    "display": True,
                    "step_number": 5,
                },
            },
            {
                "id": "s5_e3_mock01",
                "type": "write_text",
                "duration": 700,
                "payload": {
                    "text": "f(1) = 3",
                    "step_number": 5,
                },
            },
            {
                "id": "s5_e4_mock01",
                "type": "narrate",
                "duration": 3500,
                "payload": {
                    "text": "So f of one gives us three. Now the derivative at x equals one...",
                    "step_number": 5,
                },
            },
            {
                "id": "s5_e5_mock01",
                "type": "write_equation",
                "duration": 2500,
                "payload": {
                    "latex": "f'(1) = 12(1)^3 - 4(1) + 7 = 15",
                    "display": True,
                    "step_number": 5,
                },
            },
            {
                "id": "s5_e6_mock01",
                "type": "narrate",
                "duration": 5000,
                "payload": {
                    "text": "The slope of the tangent line at x equals one is fifteen. That makes sense \u2014 our original was degree four, and the derivative is degree three. Everything checks out!",
                    "step_number": 5,
                },
            },
            {
                "id": "s5_e7_mock01",
                "type": "annotate",
                "duration": 600,
                "payload": {
                    "annotation_type": "highlight",
                    "target_id": "s5_e5_mock01",
                    "step_number": 5,
                },
            },
            {
                "id": "s5_e8_mock01",
                "type": "write_text",
                "duration": 700,
                "payload": {
                    "text": "Slope = 15 at x = 1",
                    "step_number": 5,
                },
            },
            {
                "id": "s5_e9_mock01",
                "type": "pause",
                "duration": 1200,
                "payload": {"step_number": 5},
            },
        ],
    },
]

MOCK_CHAT_RESPONSES = {
    "why": {
        "role": "tutor",
        "message": (
            "Great question! The power rule works because of how limits define the derivative. "
            "When we compute $\\lim_{h \\to 0} \\frac{(x+h)^n - x^n}{h}$, "
            "we can expand $(x+h)^n$ using the binomial theorem. Most terms vanish as $h \\to 0$, "
            "leaving us with exactly $nx^{n-1}$."
        ),
        "math_blocks": [
            {"latex": "\\frac{d}{dx}[x^n] = \\lim_{h \\to 0} \\frac{(x+h)^n - x^n}{h} = nx^{n-1}", "display": True},
        ],
        "related_step": 2,
    },
    "how": {
        "role": "tutor",
        "message": (
            "Here's the step-by-step process for differentiating any polynomial:\n\n"
            "1. Break it apart: Write each term separately (sum rule)\n"
            "2. Apply the power rule to each term\n"
            "3. Handle constants: Any constant term becomes $0$\n"
            "4. Combine: Add all the individual derivatives together"
        ),
        "math_blocks": [
            {"latex": "f(x) = 3x^4 - 2x^2 + 7x - 5 \\implies f'(x) = 12x^3 - 4x + 7", "display": True},
        ],
        "related_step": 3,
    },
    "example": {
        "role": "tutor",
        "message": (
            "Sure! Let's try another example. Differentiate $g(x) = 5x^3 + 2x^2 - 9x + 1$.\n\n"
            "Applying the power rule term by term:\n"
            "- $\\frac{d}{dx}[5x^3] = 15x^2$\n"
            "- $\\frac{d}{dx}[2x^2] = 4x$\n"
            "- $\\frac{d}{dx}[-9x] = -9$\n"
            "- $\\frac{d}{dx}[1] = 0$\n\n"
            "So $g'(x) = 15x^2 + 4x - 9$."
        ),
        "math_blocks": [
            {"latex": "g(x) = 5x^3 + 2x^2 - 9x + 1", "display": True},
            {"latex": "g'(x) = 15x^2 + 4x - 9", "display": True},
        ],
        "related_step": 3,
    },
    "default": {
        "role": "tutor",
        "message": (
            "That's a thoughtful question! For the problem $f(x) = 3x^4 - 2x^2 + 7x - 5$, "
            "remember that we differentiate term by term using the power rule. "
            "The key formula is $\\frac{d}{dx}[ax^n] = anx^{n-1}$.\n\n"
            "Would you like me to explain a specific step in more detail?"
        ),
        "math_blocks": [
            {"latex": "\\frac{d}{dx}[ax^n] = a \\cdot n \\cdot x^{n-1}", "display": True},
        ],
        "related_step": None,
    },
}
