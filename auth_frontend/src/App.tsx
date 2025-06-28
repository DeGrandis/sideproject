import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Degrandis from './pages/home/Degrandis';
import Auth from './pages/auth/Auth';
import NotFoundPage from './pages/NotFoundPage';

function App() {


  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Degrandis />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="*" element={<NotFoundPage />} />

      </Routes>
    </BrowserRouter>
  )
}

export default App
