import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Degrandis from './pages/home/Degrandis';
import Auth from './pages/auth/Auth';
import NotFoundPage from './pages/NotFoundPage';

function App() {


  function setAppHeight() {
    document.documentElement.style.setProperty('--app-height', `${window.innerHeight-80}px`);
    console.log(window.innerHeight)
  }

  window.addEventListener('resize', setAppHeight);
  setAppHeight();

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
