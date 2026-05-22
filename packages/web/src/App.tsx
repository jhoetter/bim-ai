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
const AgentsIndex = lazy(() =>
  import('./agents/AgentsIndex').then((m) => ({ default: m.AgentsIndex })),
);
const AgentSessionDetail = lazy(() =>
  import('./agents/AgentSessionDetail').then((m) => ({ default: m.AgentSessionDetail })),
);
const AgentHouseDashboard = lazy(() =>
  import('./agents/AgentHouseDashboard').then((m) => ({ default: m.AgentHouseDashboard })),
);

export function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<div className="app-route-loading" aria-hidden="true" />}>
        <Routes>
          <Route path="/" element={<Workspace />} />
          <Route path="/p/:token" element={<PublicPresentationRoute />} />
          <Route path="/icons" element={<IconGallery />} />
          <Route path="/family-editor" element={<FamilyEditorWorkbench />} />
          <Route path="/agents" element={<AgentsIndex />} />
          <Route path="/agents/sessions/:sessionId" element={<AgentSessionDetail />} />
          <Route path="/agents/houses/:house" element={<AgentHouseDashboard />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

function PublicPresentationRoute() {
  const { token } = useParams<{ token: string }>();
  return <PresentationViewer token={token ?? ''} />;
}
