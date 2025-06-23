import { useEffect, useRef, useState } from 'react'
import './App.css'
import './degrandis.css';
import { login, type LoginCredentials } from './services/apicalls';
import { SharedFooter } from 'src/footer'; // Adjust the import path as needed

function App() {

  // const [authstate, setAuthState] = useState('prelogin')
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const buttonRef = useRef<HTMLButtonElement>(null); // Create a ref to access the button element


  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault(); // Prevent default form submission behavior

    console.log('Email:', email);
    console.log('Password:', password);

    const credentials: LoginCredentials = {
      username: email,
      password: password
    };

    login(credentials)
      .then((response) => {
        console.log('Login successful:', response);
        // Handle successful login, e.g., store token, redirect, etc.
      })
      .catch((error) => {
        console.error('Login failed:', error);
        // Handle login error, e.g., show error message
      });

    // setAuthState('postlogin');
  };

  useEffect(() => {
    const handleKeyDown = (event: { key: string; }) => {
      if (event.key === 'Enter') {

        if (buttonRef.current) {
          buttonRef.current.focus();

        }
        console.log(event)
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return (
    <>
      <div className='app-container'>
        <div className='app-top'>
          SSO
        </div>
        <div className='app-middle'>
          <div className='logo-text'>
            <h1>DEGRAND.IS</h1>
          </div>
          <div className='auth-box'>
            <form noValidate onSubmit={handleLogin}>
              <div>
                <h3>LOGIN</h3>
                <input
                  type="email"
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder='Email'
                />
              </div>
              <div>
                <input
                  type="password"
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder='Password'
                />
              </div>
              <button ref={buttonRef} type="submit" className='action-button'>ENTER</button>
            </form>
          </div>
        </div>
        <div className='app-bottom'>
          <SharedFooter />
        </div>
      </div>
    </>
  )
}

export default App
