from __future__ import annotations

import math

import pytest

from bim_ai.expression_evaluator import (
    ExpressionError,
    evaluate_formula,
    evaluate_formula_or_throw,
    validate_formula,
)

# ---------------------------------------------------------------------------
# Arithmetic
# ---------------------------------------------------------------------------


def test_arithmetic_add_sub_mul_div_paren():
    assert evaluate_formula("2400 + 200") == 2600
    assert evaluate_formula("(100 + 50) * 2") == 300
    assert evaluate_formula("1500 / 2") == 750
    assert evaluate_formula("10 - 3") == 7


def test_power_and_unary_minus():
    assert evaluate_formula("2 ** 8") == 256
    assert evaluate_formula("-5 + 10") == 5
    assert evaluate_formula("--7") == 7


def test_mod_infix_and_function_and_percent():
    assert evaluate_formula("17 mod 5") == 2
    assert evaluate_formula("mod(17, 5)") == 2
    assert evaluate_formula("17 % 5") == 2


# ---------------------------------------------------------------------------
# Functions
# ---------------------------------------------------------------------------


def test_rounding_functions():
    assert evaluate_formula("rounddown(3.7)") == 3
    assert evaluate_formula("roundup(3.2)") == 4
    assert evaluate_formula("round(3.5)") == 4
    assert evaluate_formula("round(3.4)") == 3
    # Half-away-from-zero (matches Revit), not Python's banker's rounding
    assert evaluate_formula("round(0.5)") == 1
    assert evaluate_formula("round(2.5)") == 3


def test_min_max_abs_sqrt():
    assert evaluate_formula("min(5, 2, 8)") == 2
    assert evaluate_formula("max(5, 2, 8)") == 8
    assert evaluate_formula("abs(-7)") == 7
    assert evaluate_formula("sqrt(81)") == 9


def test_if_returns_then_when_truthy():
    assert evaluate_formula("if(1, 100, 200)") == 100
    assert evaluate_formula("if(0, 100, 200)") == 200


# ---------------------------------------------------------------------------
# Boolean coercion
# ---------------------------------------------------------------------------


def test_comparison_ops_return_one_or_zero():
    assert evaluate_formula("5 < 10") == 1
    assert evaluate_formula("5 > 10") == 0
    assert evaluate_formula("5 <= 5") == 1
    assert evaluate_formula("5 >= 6") == 0
    assert evaluate_formula("5 = 5") == 1
    assert evaluate_formula("5 <> 6") == 1


def test_not_and_or():
    assert evaluate_formula("not(0)") == 1
    assert evaluate_formula("not(1)") == 0
    assert evaluate_formula("and(1, 1)") == 1
    assert evaluate_formula("and(1, 0)") == 0
    assert evaluate_formula("or(0, 0)") == 0
    assert evaluate_formula("or(0, 1)") == 1


def test_true_false_constants():
    assert evaluate_formula("if(true, 1, 2)") == 1
    assert evaluate_formula("if(false, 1, 2)") == 2


# ---------------------------------------------------------------------------
# Parameters
# ---------------------------------------------------------------------------


def test_parameter_references():
    assert evaluate_formula("Width / 2", {"Width": 1600}) == 800
    assert evaluate_formula("Width + Frame", {"Width": 1500, "Frame": 100}) == 1600


def test_unknown_identifier_returns_none():
    assert evaluate_formula("Unknown + 1") is None


def test_boolean_parameter_coerced_to_one_or_zero():
    assert evaluate_formula("if(HasFrame, 100, 0)", {"HasFrame": True}) == 100
    assert evaluate_formula("if(HasFrame, 100, 0)", {"HasFrame": False}) == 0


# ---------------------------------------------------------------------------
# FAM-04 acceptance — chair-array formula
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "width,expected",
    [
        (1200, 1),
        (1400, 3),
        (1800, 4),
        (2200, 5),
        (2800, 6),
    ],
)
def test_chair_array_formula_sweep(width: int, expected: int) -> None:
    formula = "if(Width < 1400, 1, rounddown((Width - 200) / (320 + 80)))"
    assert evaluate_formula(formula, {"Width": width}) == expected


# ---------------------------------------------------------------------------
# Security
# ---------------------------------------------------------------------------


def test_rejects_global_access_via_unknown_identifiers():
    assert evaluate_formula("alert(1)") is None
    assert evaluate_formula("__import__('os')") is None
    assert evaluate_formula("os.system('rm -rf /')") is None


def test_rejects_empty_and_malformed_input():
    assert evaluate_formula("") is None
    assert evaluate_formula("   ") is None
    assert evaluate_formula("1 +") is None
    assert evaluate_formula("(1 + 2") is None
    # Wrong arity
    assert evaluate_formula("if(1, 2)") is None


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def test_evaluate_formula_or_throw_raises_on_bad_input():
    with pytest.raises(ExpressionError):
        evaluate_formula_or_throw("1 +")
    assert evaluate_formula_or_throw("1 + 2") == 3


def test_validate_formula_returns_none_on_success():
    assert validate_formula("Width + 1", ["Width"]) is None


def test_validate_formula_returns_message_on_failure():
    err = validate_formula("Width +", ["Width"])
    assert isinstance(err, str)
    assert err  # non-empty


def test_validate_formula_reports_unknown_identifier():
    err = validate_formula("Mystery + 1", [])
    assert err is not None
    assert "Mystery" in err


def test_pi_and_e_constants_available():
    pi = evaluate_formula("pi")
    e = evaluate_formula("e")
    assert pi is not None and math.isclose(pi, math.pi)
    assert e is not None and math.isclose(e, math.e)
