"""Research integrity screening engine.

Automated, rule-based screening runs on user-submitted content (research
requests, project descriptions, opportunities, feed posts, profiles, portfolio
items). It classifies content into LOW / POTENTIAL / PROHIBITED risk:

- LOW         -> content proceeds (legitimate research assistance).
- POTENTIAL   -> content is held and a moderation case is opened for
                 administrative review.
- PROHIBITED  -> content is rejected; the user is shown a respectful
                 explanation and pointed to legitimate alternatives.

The engine deliberately errs toward POTENTIAL rather than PROHIBITED so that
legitimate professional research assistance is never blocked outright, while
academic-misconduct requests are caught for human review.
"""
from __future__ import annotations

import re

from app.models_enums import RiskLevel

# --- Prohibited: clear academic misconduct / fraud indicators ---------------
_PROHIBITED: list[tuple[str, re.Pattern]] = [
    ("exam impersonation", r"\b(sit|take|write|do)\s+(my|the)\s+(exam|examination|test|quiz)\b"),
    ("assignment ghostwriting", r"\b(do|complete|write|finish)\s+my\s+(assignment|homework|coursework)\b"),
    ("thesis ghostwriting for submission", r"\b(write|draft|compose)\s+(my|the|a)\s+(thesis|dissertation)\s+(for me|from scratch)\b"),
    ("submit-as-own-work", r"\b(pass|submit)\s+.{0,40}\b(as my own|my own work)\b"),
    ("plagiarism evasion", r"\b(bypass|beat|evade|cheat|trick|fool)\s+(turnitin|plagiarism|similarity|ai detection|detector)\b"),
    ("plagiarism evasion", r"\b(turnitin|plagiarism checker|ai detector)\s+(bypass|rewrite|spinner)\b"),
    ("data fabrication", r"\b(fabricate|make up|invent|fake)\s+(the\s+)?(data|results|findings|responses|samples|interviews)\b"),
    ("fabricated references", r"\b(fake|fabricated?|made[- ]up|invented|nonexistent)\s+(references?|citations?|sources?|literature|publications?)\b"),
    ("forged documents", r"\b(forget? forged? fake? )\b"),  # handled below
    ("forgery", r"\bforg(e|ing|ed)\s+(certificate|transcript|degree|document|signature|letter)\b"),
    ("impersonation", r"\bimpersonat(e|ing)\s+(a\s+)?(student|researcher|professor|examiner|doctor)\b"),
    ("contract cheating", r"\bcontract cheating\b"),
    ("paid degree", r"\b(buy|purchase)\s+(a\s+)?(degree|diploma|transcript|certificate)\b"),
]

# --- Potential: context that may be legitimate but warrants review ----------
_POTENTIAL: list[tuple[str, re.Pattern]] = [
    ("thesis writing support", r"\b(thesis|dissertation)\b.{0,60}\b(writ(e|ing)|chapter|chapters)\b"),
    ("full manuscript drafting", r"\bwrite\s+(the\s+)?(entire|full|whole)\s+(paper|manuscript|article|report)\b"),
    ("publication guarantee", r"\b(guarantee(d)?|assured)\s+(publication|acceptance|approval)\b"),
    ("predatory outlet hint", r"\b(any journal|fast publication|quick publication|no review|paid journal)\b"),
    ("essay for submission", r"\b(essay|paper)\s+(for|to)\s+(my|the)\s+(class|course|professor|lecturer|submission)\b"),
    ("urgent suspicious", r"\b(no questions asked|don'?t ask questions|keep it between us)\b"),
    ("survey response farming", r"\b(fill|complete)\s+(in\s+)?(my|the)\s+(survey|questionnaire)\s+(responses|for me)\b"),
    ("grade assurance", r"\b(guarantee|ensure)\s+(me\s+)?(an?\s+)?(a\+|a |full |good )?(grade|marks|distinction)\b"),
]

# Over-blocking guard: strong legitimate research signals suppress borderline flags.
_LEGITIMATE_SIGNALS = [
    "statistical analysis", "data cleaning", "power analysis", "sample size",
    "systematic review", "literature search", "data visualization", "methodology consultation",
    "questionnaire development", "survey design", "editing", "proofreading", "formatting",
    "manuscript preparation", "journal submission", "data management", "spss", "stata", "r analysis",
    "regression", "anova", "thematic analysis", "mixed methods", "evidence synthesis",
]


def _has_legitimate_signal(text: str) -> bool:
    lowered = text.lower()
    return any(sig in lowered for sig in _LEGITIMATE_SIGNALS)


def screen_content(text: str | None) -> dict:
    """Screen text; returns {risk, rules, excerpt}."""
    if not text or not text.strip():
        return {"risk": RiskLevel.LOW.value, "rules": [], "excerpt": (text or "")[:400]}

    lowered = text.lower()
    prohibited = [name for name, pattern in _PROHIBITED if re.search(pattern, lowered)]
    potential = [name for name, pattern in _POTENTIAL if re.search(pattern, lowered)]

    if prohibited:
        return {"risk": RiskLevel.PROHIBITED.value, "rules": prohibited, "excerpt": text[:400]}
    if potential and not _has_legitimate_signal(lowered):
        return {"risk": RiskLevel.POTENTIAL.value, "rules": potential, "excerpt": text[:400]}
    if potential:
        return {"risk": RiskLevel.LOW.value, "rules": potential, "excerpt": text[:400]}
    return {"risk": RiskLevel.LOW.value, "rules": [], "excerpt": text[:400]}


INTEGRITY_EXPLANATION = (
    "Wulweth supports legitimate research: statistical analysis, data services, research design, "
    "literature searching, editing, formatting and publishing support. We cannot assist with work "
    "intended to be submitted dishonestly, fabricated data or references, exam or assignment "
    "cheating, plagiarism evasion, or forged documents."
)
