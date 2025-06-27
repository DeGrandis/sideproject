import { useEffect, useRef, useState } from 'react'
import '../../assets/styles/App.css'
import '../../assets/styles/degrandis.css'
import { createAccount, login, testprotected, type LoginCredentials } from '../../services/apicalls';
import { SharedFooter } from '../../layouts/footer'; // Adjust the import path as needed

function Auth() {

  // const [authstate, setAuthState] = useState('prelogin')
  const [email, setEmail] = useState('');
  const [ username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [authMode, setAuthMode] = useState<'login' | 'create'>('login'); // State to toggle between login and create modes
  const buttonRef = useRef<HTMLButtonElement>(null); // Create a ref to access the button element
  const [authErrors, setAuthErrors] = useState<string[]>([]); // State to hold authentication errors


  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault(); // Prevent default form submission behavior

    console.log('Email:', email);
    console.log('Password:', password);

    const credentials: LoginCredentials = {
      email: email,
      password: password
    };

    login(credentials)
      .then((response) => {
        console.log('Login successful:', response);
        // Handle successful login, e.g., store token, redirect, etc.
      })
      .catch((error: any) => {
        console.log(error.response?.data || error.message);

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


  const [passwordConfirm, setPasswordConfirm] = useState('');
  
  const handleCreateAccount = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (password !== passwordConfirm) {
      alert('Passwords do not match.');
      return;
    }

    const credentials: LoginCredentials = {
      email: email,
      password: password,
      confirmedPassword: passwordConfirm, 
      username: username
    };

    try {
      // Replace with your actual create account API call
      const response = await createAccount(credentials); // You likely want a register function here
      console.log('Account created:', response);
      // Optionally switch to login mode or auto-login
      setAuthMode('login');
    } catch (error: any) {
      console.log(error.response?.data || error.message);
      console.error('Account creation failed:', error);
    }
  };

  const handleTestProtected = async () => {


    try {
      const response = await testprotected();
      console.log('Protected resource accessed:', response);
    } catch (error: any) {
      console.log(error.response?.data || error.message);
      console.error('Failed to access protected resource:', error);
    }
  };

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
            <div style={{ display: 'flex', gap: '1rem', margin: '1rem 0 1rem' }}>
              <h3
                style={{
                  cursor: 'pointer',
                  borderBottom: authMode === 'login' ? '2px solid #333' : 'none',
                  color: authMode === 'login' ? '#333' : '#888',
                  margin: 0,
                  paddingBottom: '0.25rem'
                }}
                onClick={() => setAuthMode('login')}
              >
                LOGIN
              </h3>
              <h3
                style={{
                  cursor: 'pointer',
                  borderBottom: authMode === 'create' ? '2px solid #333' : 'none',
                  color: authMode === 'create' ? '#333' : '#888',
                  margin: 0,
                  paddingBottom: '0.25rem',
                  marginLeft: 'auto', // This pushes it to the right in a flex container
                }}
                onClick={() => setAuthMode('create')}
              >
                CREATE
              </h3>
            </div>

            {authMode === 'login' && (
              
            <form noValidate onSubmit={handleLogin}>
              <div>

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
            )}

            {authMode === 'create' && (
              <div className='create-account'>
                <form noValidate onSubmit={handleCreateAccount}>
                  <div>
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
                      type="text"
                      id="username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder='Username'
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
                                    <div>
                    <input
                      type="password"
                      id="passwordconfirm"
                      value={passwordConfirm}
                      onChange={(e) => setPasswordConfirm(e.target.value)}
                      placeholder='Confirm Password'
                    />
                  </div>
                  <button ref={buttonRef} type="submit" className='action-button'>CREATE ACCOUNT</button>
                </form>
              </div>
            )}
          </div>
        </div>
        <button onClick={handleTestProtected}>
          TEST PROTECTED
        </button>
        <div className='app-bottom'>
          <SharedFooter />
        </div>
      </div>
    </>
  )
}

export default Auth
