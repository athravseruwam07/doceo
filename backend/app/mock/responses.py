MOCK_SESSION_TITLE = "Differentiating a Polynomial Function"
MOCK_SESSION_SUBJECT = "Calculus"

MOCK_LESSON_STEPS = [
    {
        "step_number": 1,
        "title": "Identify the Function",
        "content": (
            "We are given the polynomial function $f(x) = 3x^4 - 2x^2 + 7x - 5$. "
            "Before differentiating, let's identify each term and its degree:\n\n"
            "- $3x^4$ is a **degree-4** term with coefficient 3\n"
            "- $-2x^2$ is a **degree-2** term with coefficient -2\n"
            "- $7x$ is a **degree-1** term with coefficient 7\n"
            "- $-5$ is a **constant** term (degree 0)\n\n"
            "Since this is a polynomial, we can differentiate it term by term using the **power rule**."
        ),
        "math_blocks": [
            {"latex": "f(x) = 3x^4 - 2x^2 + 7x - 5", "display": True},
        ],
        "hint": "A polynomial is a sum of terms of the form $ax^n$. Each term can be differentiated independently.",
    },
    {
        "step_number": 2,
        "title": "Recall the Power Rule",
        "content": (
            "The **power rule** states that if $f(x) = x^n$, then $f'(x) = nx^{n-1}$. "
            "When a coefficient $a$ is present, we have:\n\n"
            "$$\\frac{d}{dx}[ax^n] = a \\cdot n \\cdot x^{n-1}$$\n\n"
            "For constant terms, the derivative is always **zero** because constants do not change."
        ),
        "math_blocks": [
            {"latex": "\\frac{d}{dx}[x^n] = n \\cdot x^{n-1}", "display": True},
            {"latex": "\\frac{d}{dx}[c] = 0", "display": True},
        ],
        "hint": "The power rule works by bringing the exponent down as a coefficient and reducing the exponent by 1.",
    },
    {
        "step_number": 3,
        "title": "Differentiate Each Term",
        "content": (
            "Now let's apply the power rule to each term individually:\n\n"
            "1. $\\frac{d}{dx}[3x^4] = 3 \\cdot 4 \\cdot x^{4-1} = 12x^3$\n"
            "2. $\\frac{d}{dx}[-2x^2] = -2 \\cdot 2 \\cdot x^{2-1} = -4x$\n"
            "3. $\\frac{d}{dx}[7x] = 7 \\cdot 1 \\cdot x^{1-1} = 7$\n"
            "4. $\\frac{d}{dx}[-5] = 0$\n\n"
            "Notice how each term is handled independently -- this is the **sum rule** in action."
        ),
        "math_blocks": [
            {"latex": "\\frac{d}{dx}[3x^4] = 12x^3", "display": True},
            {"latex": "\\frac{d}{dx}[-2x^2] = -4x", "display": True},
            {"latex": "\\frac{d}{dx}[7x] = 7", "display": True},
            {"latex": "\\frac{d}{dx}[-5] = 0", "display": True},
        ],
        "hint": "Remember: bring the exponent down, multiply by the coefficient, then subtract 1 from the exponent.",
    },
    {
        "step_number": 4,
        "title": "Combine the Results",
        "content": (
            "Now we combine the derivatives of each term to get the final derivative:\n\n"
            "$$f'(x) = 12x^3 - 4x + 7$$\n\n"
            "This is our answer! The derivative $f'(x) = 12x^3 - 4x + 7$ tells us the "
            "**instantaneous rate of change** of $f(x)$ at any point $x$."
        ),
        "math_blocks": [
            {"latex": "f'(x) = 12x^3 - 4x + 7", "display": True},
        ],
        "hint": "Simply add up all the individual derivatives. The constant term disappears.",
    },
    {
        "step_number": 5,
        "title": "Verify the Result",
        "content": (
            "Let's verify our answer by checking a specific value. At $x = 1$:\n\n"
            "- $f(1) = 3(1)^4 - 2(1)^2 + 7(1) - 5 = 3 - 2 + 7 - 5 = 3$\n"
            "- $f'(1) = 12(1)^3 - 4(1) + 7 = 12 - 4 + 7 = 15$\n\n"
            "This means at $x = 1$, the function value is $3$ and the slope of the tangent line "
            "is $15$. We can also verify the degree: since $f(x)$ is degree 4, "
            "$f'(x)$ should be degree 3 -- and indeed $12x^3$ is the leading term."
        ),
        "math_blocks": [
            {"latex": "f(1) = 3(1)^4 - 2(1)^2 + 7(1) - 5 = 3", "display": True},
            {"latex": "f'(1) = 12(1)^3 - 4(1) + 7 = 15", "display": True},
        ],
        "hint": "Plug in a simple value like $x = 1$ to check your work. The derivative's degree should be one less than the original.",
    },
]

MOCK_CHAT_RESPONSES = {
    "why": {
        "role": "tutor",
        "message": (
            "Great question! The power rule works because of how limits define the derivative. "
            "When we compute $\\lim_{h \\to 0} \\frac{(x+h)^n - x^n}{h}$, "
            "we can expand $(x+h)^n$ using the binomial theorem. Most terms vanish as $h \\to 0$, "
            "leaving us with exactly $nx^{n-1}$.\n\n"
            "Intuitively, the exponent $n$ counts how many \"copies\" of $x$ are multiplied together, "
            "and the derivative picks each copy one at a time (giving $n$ terms), while reducing the "
            "power by one."
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
            "1. **Break it apart**: Write each term separately (sum rule)\n"
            "2. **Apply the power rule** to each term: multiply by the exponent, then reduce the exponent by 1\n"
            "3. **Handle constants**: Any constant term becomes $0$\n"
            "4. **Combine**: Add all the individual derivatives together\n\n"
            "For our function $f(x) = 3x^4 - 2x^2 + 7x - 5$, we get $f'(x) = 12x^3 - 4x + 7$."
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
            "So $g'(x) = 15x^2 + 4x - 9$. Try doing one yourself!"
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
            "Would you like me to explain a specific step in more detail, or would you like "
            "to see another example?"
        ),
        "math_blocks": [
            {"latex": "\\frac{d}{dx}[ax^n] = a \\cdot n \\cdot x^{n-1}", "display": True},
        ],
        "related_step": None,
    },
}
