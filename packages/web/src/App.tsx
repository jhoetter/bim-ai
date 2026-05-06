import { BrowserRouter, Route, Routes } from 'react-router';
import { RedesignedWorkspace } from './workspace/RedesignedWorkspace';
import { IconGallery } from './design-systems/IconGallery';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<RedesignedWorkspace />} />
        <Route path="/icons" element={<IconGallery />} />
      </Routes>
    </BrowserRouter>
  );
}
