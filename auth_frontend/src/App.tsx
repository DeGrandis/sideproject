import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Degrandis from './pages/home/Degrandis';
import Auth from './pages/auth/Auth';

function App() {


  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Degrandis />} />
        <Route path="/auth" element={<Auth />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
