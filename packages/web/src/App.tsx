import { BrowserRouter, Route, Routes } from 'react-router';
import { Workspace } from './workspace/Workspace';
import { IconGallery } from './design-systems/IconGallery';
import { FamilyEditorWorkbench } from './familyEditor/FamilyEditorWorkbench';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Workspace />} />
        <Route path="/icons" element={<IconGallery />} />
        <Route path="/family-editor" element={<FamilyEditorWorkbench />} />
      </Routes>
    </BrowserRouter>
  );
}
