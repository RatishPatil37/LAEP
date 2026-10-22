import { StrictMode, Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';
const App = lazy(() => import('./App'));
const Home = lazy(() => import('./pages/Home'));
const Explorer = lazy(() => import('./pages/Explorer'));
const Simulator = lazy(() => import('./pages/Simulator'));
const AnalyticsLab = lazy(() => import('./pages/AnalyticsLab'));
const Methodology = lazy(() => import('./pages/Methodology'));
const IceDemo = lazy(() => import('./pages/IceDemo'));
const LunarExplorer = lazy(() => import('./features/lunar-explorer/LunarExplorer'));

const router = createBrowserRouter([
  { path: '/ice-demo', element: <Navigate to="/ice-deposits" replace /> },
  {
    path: '/',
    element: <App />,
    children: [
      { index: true,          element: <Home /> },
      { path: 'moon',         element: <LunarExplorer /> },
      { path: 'ice-deposits', element: <IceDemo /> },
      { path: 'explorer',     element: <Explorer /> },
      { path: 'simulator',    element: <Simulator /> },
      { path: 'analytics',    element: <AnalyticsLab /> },
      { path: 'methodology',  element: <Methodology /> },
    ],
  },
]);

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Suspense fallback={<p role="status" style={{ padding: 24 }}>Loading LAEP…</p>}>
      <RouterProvider router={router} />
    </Suspense>
  </StrictMode>
);
