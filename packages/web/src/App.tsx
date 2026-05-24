import { lazy, Suspense } from 'react';
import { BrowserRouter, Route, Routes, useParams } from 'react-router';

const Workspace = lazy(() =>
  import('./workspace/Workspace').then((m) => ({ default: m.Workspace })),
);
const IconGallery = lazy(() =>
  import('./design-systems/IconGallery').then((m) => ({ default: m.IconGallery })),
);
const FamilyEditorWorkbench = lazy(() =>
  import('./familyEditor/FamilyEditorWorkbench').then((m) => ({
    default: m.FamilyEditorWorkbench,
  })),
);
const PresentationViewer = lazy(() =>
  import('./viewer/PresentationViewer').then((m) => ({ default: m.PresentationViewer })),
);
// The /agents web pages moved to bim-agent (separate repo, port :32000).
// bim-ai keeps the BIM viewer + project workspace; agent run history
// is the agent's concern, not the modeling engine's. Backend REST
// `/api/agent-runs/*` routes remain in bim-ai for now because the
// (still-unported) driver in scripts/testhouse_drive.py uses them
// to look up model_id by house name — split tracker phase 3 will
// move the driver to bim-agent, after which agent_runs.py can also
// be deleted from bim-ai.

export function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<div className="app-route-loading" aria-hidden="true" />}>
        <Routes>
          <Route path="/" element={<Workspace />} />
          <Route path="/p/:token" element={<PublicPresentationRoute />} />
          <Route path="/icons" element={<IconGallery />} />
          <Route path="/family-editor" element={<FamilyEditorWorkbench />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

function PublicPresentationRoute() {
  const { token } = useParams<{ token: string }>();
  return <PresentationViewer token={token ?? ''} />;
}
