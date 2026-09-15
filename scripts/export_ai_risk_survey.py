#!/usr/bin/env python3
"""Export exact answer histograms from the supplied 2024 AI Impacts CSV.

Uses only the Python standard library. See docs/ai-risk-survey.md for the
question definitions, inclusion rules, and limitations of the source.
"""

import argparse
import csv
import hashlib
import json
import math
import statistics
from collections import Counter
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SOURCE = (
    ROOT.parent
    / "ai-impacts-survey-charts/data/2024-expert-survey-anonymized.csv"
)
DEFAULT_OUTPUT = ROOT / "src/data/ai-risk-survey.json"
SOURCE_SHA256 = "fd26d40b078aaa147e2fa8a020edef895b37d5d666ca27f52db5631efd01e39a"
SOURCE_URL = (
    "https://aiimpacts.org/wp-content/uploads/2026/09/"
    "2024-expert-survey-anonymized.csv"
)
METHODS_URL = "https://blog.aiimpacts.org/p/faq-expert-survey-on-progress-in"
WORDING_NOTE = (
    "Question meanings are inferred from matching fields in the published "
    "2023 questionnaire and codebook. Exact 2024 wording has not been "
    "independently verified. All answer counts and statistics come from the "
    "supplied 2024 CSV."
)
RISK_QUESTIONS = [
    {
        "id": "extinction",
        "shortLabel": "Extinction / disempowerment",
        "label": "Human extinction or severe permanent disempowerment",
        "description": (
            "Chance that future AI advances cause human extinction or similarly "
            "permanent and severe disempowerment of the human species, with no "
            "time limit specified."
        ),
        "group": "risk",
        "column": "extinction_all_1",
        "expected_n": 744,
    },
    {
        "id": "extinction-century",
        "shortLabel": "Within 100 years",
        "label": "Extinction or severe permanent disempowerment within 100 years",
        "description": (
            "Chance that future AI advances cause human extinction or similarly "
            "permanent and severe disempowerment of the human species within "
            "the next 100 years, measured from the survey."
        ),
        "group": "risk",
        "column": "extinction_100_1",
        "expected_n": 353,
    },
    {
        "id": "loss-of-control",
        "shortLabel": "From loss of control",
        "label": "Extinction or severe permanent disempowerment from loss of control",
        "description": (
            "Chance that human inability to control future advanced AI systems "
            "causes human extinction or similarly permanent and severe "
            "disempowerment of the human species. No time limit is specified."
        ),
        "group": "risk",
        "column": "extinction_control_1",
        "expected_n": 392,
    },
]
OUTCOME_QUESTIONS = [
    ("extremely-good", "Extremely good", "vb_1_1"),
    ("good", "On balance good", "vb_1_2"),
    ("neutral", "Approximately neutral", "vb_1_3"),
    ("bad", "On balance bad", "vb_1_4"),
    ("extremely-bad", "Extremely bad", "vb_1_5"),
]


def probability(raw):
    """Return a numeric probability in percent, or None for an invalid cell."""
    try:
        value = float(raw)
    except (TypeError, ValueError):
        return None
    return value if math.isfinite(value) and 0 <= value <= 100 else None


def summarize(answers):
    return {
        "n": len(answers),
        "mean": statistics.mean(answers),
        "median": statistics.median(answers),
        "values": [
            {"value": value, "count": count}
            for value, count in sorted(Counter(answers).items())
        ],
        "wordingNote": WORDING_NOTE,
    }


def export(source, output):
    source_bytes = source.read_bytes()
    digest = hashlib.sha256(source_bytes).hexdigest()
    if digest != SOURCE_SHA256:
        raise ValueError(f"Unexpected source SHA-256: {digest}")
    with source.open(newline="", encoding="utf-8-sig") as handle:
        rows = list(csv.DictReader(handle))
    if len(rows) != 1793:
        raise ValueError(f"Expected 1,793 source rows, found {len(rows)}")

    questions = []
    for definition in RISK_QUESTIONS:
        answers = [
            value
            for row in rows
            if (value := probability(row[definition["column"]])) is not None
        ]
        if len(answers) != definition["expected_n"]:
            raise ValueError(f"Unexpected valid-answer count for {definition['id']}")
        questions.append(
            {
                **{key: value for key, value in definition.items() if key != "expected_n"},
                **summarize(answers),
            }
        )

    vectors = []
    for row in rows:
        vector = [probability(row[column]) for _, _, column in OUTCOME_QUESTIONS]
        if all(value is not None for value in vector) and math.isclose(
            sum(vector), 100, rel_tol=0, abs_tol=1e-8
        ):
            vectors.append(vector)
    if len(vectors) != 1538:
        raise ValueError(f"Expected 1,538 complete outcome vectors, found {len(vectors)}")

    for index, (outcome_id, label, column) in enumerate(OUTCOME_QUESTIONS):
        description = (
            f"Probability of a long-run impact on humanity described as “{label.lower()}”, "
        )
        description += (
            "conditional on high-level machine intelligence eventually existing. "
            "Respondents divided 100% among five possible outcomes."
        )
        if outcome_id == "extremely-bad":
            description += (
                " Human extinction is an example of an extremely bad outcome, "
                "rather than the entire definition of this category."
            )
        questions.append(
            {
                "id": outcome_id,
                "shortLabel": label,
                "label": f"{label} long-run outcome",
                "description": description,
                "group": "outcomes",
                "column": column,
                **summarize([vector[index] for vector in vectors]),
            }
        )

    data = {
        "year": 2024,
        "sourceLabel": "Expert Survey on Progress in AI 2024, AI Impacts",
        "sourceUrl": SOURCE_URL,
        "methodsUrl": METHODS_URL,
        "questions": questions,
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(data, indent=2, allow_nan=False) + "\n", encoding="utf-8")
    print(f"Exported {len(questions)} questions to {output}")
    for question in questions:
        print(
            f"{question['id']}: n={question['n']}, "
            f"mean={question['mean']:.10f}%, median={question['median']:g}%"
        )


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=DEFAULT_SOURCE)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()
    export(args.source, args.output)
