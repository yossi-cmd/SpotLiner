import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { useAuthStore } from './store/authStore';
import Layout from './components/Layout';
import Login from './pages/Login';
import Register from './pages/Register';
import Home from './pages/Home';
import Search from './pages/Search';
import Library from './pages/Library';
import Upload from './pages/Upload';
import Playlist from './pages/Playlist';
import Artists from './pages/Artists';
import Artist from './pages/Artist';
import CreateArtist from './pages/CreateArtist';
import Albums from './pages/Albums';
import Album from './pages/Album';
import CreateAlbum from './pages/CreateAlbum';

function UploadGuard() {
  const canUpload = useAuthStore((s) => s.canUpload());
  if (!canUpload) return <Navigate to="/" replace />;
  return <Upload />;
}

function CreateArtistGuard() {
  const canUpload = useAuthStore((s) => s.canUpload());
  if (!canUpload) return <Navigate to="/artists" replace />;
  return <CreateArtist />;
}

function CreateAlbumGuard() {
  const canUpload = useAuthStore((s) => s.canUpload());
  if (!canUpload) return <Navigate to="/albums" replace />;
  return <CreateAlbum />;
}

function ProtectedRoute({ children, requireAuth = true }) {
  const { user, token, loadUser } = useAuthStore();
  useEffect(() => {
    if (token && !user) loadUser();
  }, [token, user, loadUser]);
  if (requireAuth && !token) return <Navigate to="/login" replace />;
  return children;
}

function App() {
  return (
    <>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Home />} />
          <Route path="search" element={<Search />} />
          <Route path="library" element={<Library />} />
          <Route path="library/favorites" element={<Library />} />
          <Route path="library/history" element={<Library />} />
          <Route path="upload" element={<UploadGuard />} />
          <Route path="playlist/:id" element={<Playlist />} />
          <Route path="artists" element={<Artists />} />
          <Route path="artists/new" element={<CreateArtistGuard />} />
          <Route path="artist/:id" element={<Artist />} />
          <Route path="albums" element={<Albums />} />
          <Route path="albums/new" element={<CreateAlbumGuard />} />
          <Route path="album/:id" element={<Album />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <SpeedInsights />
    </>
  );
}

export default App;
