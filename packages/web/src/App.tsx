import { BrowserRouter, Route, Routes } from 'react-router';
import { Workspace } from './workspace/Workspace';
import { IconGallery } from './design-systems/IconGallery';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Workspace />} />
        <Route path="/icons" element={<IconGallery />} />
      </Routes>
    </BrowserRouter>
  );
}
