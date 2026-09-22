import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import App from './App';
import Home from './pages/Home';
import Explorer from './pages/Explorer';
import Simulator from './pages/Simulator';
import AnalyticsLab from './pages/AnalyticsLab';
import Methodology from './pages/Methodology';

const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { index: true,          element: <Home /> },
      { path: 'explorer',     element: <Explorer /> },
      { path: 'simulator',    element: <Simulator /> },
      { path: 'analytics',    element: <AnalyticsLab /> },
      { path: 'methodology',  element: <Methodology /> },
    ],
  },
]);

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>
);
