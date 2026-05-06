import { BrowserRouter, Route, Routes } from 'react-router';
import { RedesignedWorkspace } from './workspace/RedesignedWorkspace';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<RedesignedWorkspace />} />
      </Routes>
    </BrowserRouter>
  );
}
