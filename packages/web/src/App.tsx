import { BrowserRouter, Route, Routes, useParams } from 'react-router';
import { Workspace } from './workspace/Workspace';
import { IconGallery } from './design-systems/IconGallery';
import { FamilyEditorWorkbench } from './familyEditor/FamilyEditorWorkbench';
import { PresentationViewer } from './viewer/PresentationViewer';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Workspace />} />
        <Route path="/p/:token" element={<PublicPresentationRoute />} />
        <Route path="/icons" element={<IconGallery />} />
        <Route path="/family-editor" element={<FamilyEditorWorkbench />} />
      </Routes>
    </BrowserRouter>
  );
}

function PublicPresentationRoute() {
  const { token } = useParams<{ token: string }>();
  return <PresentationViewer token={token ?? ''} />;
}
