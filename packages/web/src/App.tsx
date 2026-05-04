import { BrowserRouter, Route, Routes } from 'react-router';
import { Workspace } from './Workspace';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Workspace />} />
      </Routes>
    </BrowserRouter>
  );
}
