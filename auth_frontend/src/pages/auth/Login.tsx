import { useEffect, useRef, useState } from 'react'
import '../../assets/styles/App.css'
import '../../assets/styles/degrandis.css'
import { createAccount, login, type LoginCredentials } from '../../services/apicalls';
import { SharedFooter } from '../../layouts/footer'; // Adjust the import path as needed
import { amIloggedIn, handleCommonRedirects, servicesMap } from 'src/services/commonalities';

function Login() {

  // const [authstate, setAuthState] = useState('prelogin')
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [authMode, setAuthMode] = useState<'login' | 'create'>('login'); 
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [authError, setAuthError] = useState(''); 
  const redirectTo = new URLSearchParams(window.location.search).get('redirectTo') || '';
 
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault(); 

    setAuthError("");
    console.log('Email:', email);
    console.log('Password:', password);

    const credentials: LoginCredentials = {
      email: email,
      password: password
    };

  try {
    const response = await login(credentials);
    console.log('Login successful:', response);
    setAuthError('');
    
    await handleCommonRedirects(redirectTo);

  } catch (error: any) {
    console.log(error.response?.data || error.message);
    console.error('Login failed:', error);
    setAuthError(
      error?.response?.data?.detail ||
      error?.message ||
      "Login failed."
    );
  }

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

  useEffect(() => {
    setAuthError('')
  }, [email, password])

  // run on pageload once



  useEffect(() => {
    const checkLogin = async () => {
      if (await amIloggedIn()) {
        console.log('User is already logged in, redirecting...');
        handleCommonRedirects(redirectTo);
      }
    };
    checkLogin();
  }, []);


  const [passwordConfirm, setPasswordConfirm] = useState('');

  const handleCreateAccount = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAuthError("");

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
      const response = await createAccount(credentials); 
      console.log('Account created:', response);
      setAuthMode('login');
    } catch (error: any) {
      console.log(error.response?.data || error.message);
      console.error('Account creation failed:', error);
      setAuthError(
        error?.response?.data?.detail ||
        error?.message ||
        "Login failed."
      );
    }
  };

  // const handleTestProtected = async () => {


  //   try {
  //     const response = await testprotected();
  //     console.log('Protected resource accessed:', response);
  //   } catch (error: any) {
  //     console.log(error.response?.data || error.message);
  //     console.error('Failed to access protected resource:', error);
  //   }
  // };

  return (
    <>
      <div className='app-container '>
        <div className='app-top scroll-wheel-in'>
          SSO
        </div>
        <div className='app-middle '>
          <div className='logo-text form-animated2'>
            {redirectTo && servicesMap[redirectTo] ? (
              <h2>Authentication for <span style={{ color: 'var(--custom-red)' }}>{servicesMap[redirectTo]}</span></h2>
            ) : (
              <h2></h2>
            )}

          </div>
          <div className='auth-box form-animated'>
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
              <div className=' '>
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
              </div>
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
          {authError && (
            <div className='errorbox'>
              {authError}
            </div>
          )}
        </div>

        <div className='app-bottom'>
          <SharedFooter />
        </div>
      </div>
    </>
  )
}

export default Login;


