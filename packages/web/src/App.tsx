import { lazy, Suspense } from 'react';
import { BrowserRouter, Route, Routes, useParams } from 'react-router';

const Workspace = lazy(() => import('./workspace/Workspace').then((m) => ({ default: m.Workspace })));
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
