"""SUN-V3-01: engine tests for sun_settings singleton."""

from __future__ import annotations

import pytest

from bim_ai.document import Document
from bim_ai.elements import SUN_SETTINGS_ID, SunSettingsElem
from bim_ai.engine import ensure_sun_settings, try_commit


def _empty_doc() -> Document:
    return Document(revision=1, elements={})


class TestEnsureSunSettings:
    def test_creates_when_absent(self):
        doc = _empty_doc()
        ensure_sun_settings(doc)
        assert any(isinstance(e, SunSettingsElem) for e in doc.elements.values())

    def test_idempotent(self):
        doc = _empty_doc()
        ensure_sun_settings(doc)
        ensure_sun_settings(doc)
        count = sum(1 for e in doc.elements.values() if isinstance(e, SunSettingsElem))
        assert count == 1

    def test_default_values(self):
        doc = _empty_doc()
        ensure_sun_settings(doc)
        el = doc.elements[SUN_SETTINGS_ID]
        assert isinstance(el, SunSettingsElem)
        assert el.latitude_deg == 48.13
        assert el.longitude_deg == 11.58


class TestCreateSunSettings:
    def test_create_succeeds(self):
        ok, doc, _, _, code = try_commit(
            _empty_doc(),
            {
                "type": "createSunSettings",
                "latitudeDeg": 48.13,
                "longitudeDeg": 11.58,
                "dateIso": "2026-06-21",
            },
        )
        assert ok, code
        sun = next((e for e in doc.elements.values() if isinstance(e, SunSettingsElem)), None)
        assert sun is not None
        assert sun.latitude_deg == 48.13

    def test_create_rejects_duplicate(self):
        ok, doc, _, _, _ = try_commit(
            _empty_doc(),
            {"type": "createSunSettings", "latitudeDeg": 48.13, "longitudeDeg": 11.58},
        )
        assert ok
        with pytest.raises(ValueError, match="already exists"):
            try_commit(doc, {"type": "createSunSettings", "latitudeDeg": 52.0, "longitudeDeg": 13.0})

    def test_wire_format_camelCase(self):
        """Verify camelCase wire format is accepted (populate_by_name=True)."""
        ok, doc, _, _, code = try_commit(
            _empty_doc(),
            {
                "type": "createSunSettings",
                "latitudeDeg": 51.5,
                "longitudeDeg": -0.12,
                "daylightSavingStrategy": "on",
            },
        )
        assert ok, code


class TestUpdateSunSettings:
    def _doc_with_sun(self) -> Document:
        _, doc, _, _, _ = try_commit(
            _empty_doc(),
            {"type": "createSunSettings", "latitudeDeg": 48.13, "longitudeDeg": 11.58},
        )
        return doc

    def test_update_latitude(self):
        doc = self._doc_with_sun()
        ok, doc2, _, _, code = try_commit(doc, {"type": "updateSunSettings", "latitudeDeg": 52.52})
        assert ok, code
        sun = next(e for e in doc2.elements.values() if isinstance(e, SunSettingsElem))
        assert sun.latitude_deg == 52.52

    def test_update_partial_no_clobber(self):
        doc = self._doc_with_sun()
        ok, doc2, _, _, code = try_commit(
            doc, {"type": "updateSunSettings", "dateIso": "2026-12-21"}
        )
        assert ok, code
        sun = next(e for e in doc2.elements.values() if isinstance(e, SunSettingsElem))
        assert sun.date_iso == "2026-12-21"
        assert sun.latitude_deg == 48.13  # unchanged

    def test_update_time_of_day(self):
        doc = self._doc_with_sun()
        ok, doc2, _, _, code = try_commit(
            doc, {"type": "updateSunSettings", "timeOfDay": {"hours": 9, "minutes": 0}}
        )
        assert ok, code
        sun = next(e for e in doc2.elements.values() if isinstance(e, SunSettingsElem))
        assert sun.time_of_day.hours == 9

    def test_update_no_sun_settings_raises(self):
        with pytest.raises(ValueError, match="no sun_settings exists"):
            try_commit(_empty_doc(), {"type": "updateSunSettings", "latitudeDeg": 0.0})
