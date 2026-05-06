import { BrowserRouter, Route, Routes } from 'react-router';
import { Workspace } from './Workspace';
import { RedesignedWorkspace } from './workspace/RedesignedWorkspace';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<RedesignedWorkspace />} />
        <Route path="/legacy" element={<Workspace />} />
      </Routes>
    </BrowserRouter>
  );
}
