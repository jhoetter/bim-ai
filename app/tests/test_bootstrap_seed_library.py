from __future__ import annotations

from types import SimpleNamespace
from uuid import uuid4

import pytest

from bim_ai.routes.api import bootstrap
from bim_ai.seed_library import SEED_PROJECT_ID


class _Scalars:
    def __init__(self, rows):
        self._rows = rows

    def all(self):
        return self._rows


class _Result:
    def __init__(self, rows):
        self._rows = rows

    def scalars(self):
        return _Scalars(self._rows)


class _BootstrapSession:
    def __init__(self, projects, models_by_project):
        self._projects = projects
        self._models_by_project = models_by_project
        self._model_index = 0

    async def execute(self, stmt):
        if self._model_index == 0:
            self._model_index += 1
            return _Result(self._projects)
        project = self._projects[self._model_index - 1]
        self._model_index += 1
        return _Result(self._models_by_project.get(project.id, []))


@pytest.mark.asyncio
async def test_bootstrap_marks_only_canonical_seed_project_as_seed_library() -> None:
    ordinary_project_id = uuid4()
    session = _BootstrapSession(
        [
            SimpleNamespace(id=ordinary_project_id, slug="m2-wave5-1234abcd", title="Disposable"),
            SimpleNamespace(id=SEED_PROJECT_ID, slug="seeds", title="Seed Library"),
        ],
        {
            ordinary_project_id: [
                SimpleNamespace(id=uuid4(), slug="old-disposable", revision=1),
            ],
            SEED_PROJECT_ID: [
                SimpleNamespace(id=uuid4(), slug="sample-house-1", revision=42),
            ],
        },
    )

    body = await bootstrap(session=session)

    projects = {project["slug"]: project for project in body["projects"]}
    assert projects["seeds"]["seedLibrary"] is True
    assert projects["seeds"]["kind"] == "seed-library"
    assert projects["seeds"]["models"][0]["seedArtifact"] is True
    assert projects["m2-wave5-1234abcd"]["seedLibrary"] is False
    assert projects["m2-wave5-1234abcd"]["kind"] == "project"
    assert projects["m2-wave5-1234abcd"]["models"][0]["seedArtifact"] is False
