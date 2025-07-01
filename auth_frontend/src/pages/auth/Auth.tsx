import { useEffect} from 'react'
import '../../assets/styles/App.css'
import '../../assets/styles/degrandis.css'
import { verifyCurrentToken } from '../../services/apicalls';
import { SharedFooter } from '../../layouts/footer'; // Adjust the import path as needed
import { handleCommonRedirects } from 'src/services/commonalities';

function Auth() {

    const redirectTo = new URLSearchParams(window.location.search).get('redirectTo') || '';


    const attemptToVerify = async () => {
        console.log('Starting token verification...');
        const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
        await delay(2000); // Delay to simulate loading state
        try {
            const response = await verifyCurrentToken();
            console.log('Token verification successful:', response);
            await handleCommonRedirects(redirectTo);

        } catch (error) {
            console.error('Token verification failed1:', error);
        }
    };

    useEffect(() => {
        attemptToVerify();
    }, []);

    return (
        <>
            <div className='app-container '>
                <div className='app-top scroll-wheel-in'>
                    SSO
                </div>
                <div className='app-middle '>

                    <div className='form-animated'>
                        <div className='logo-text'>
                            <p>degrand.is</p>
                        </div>
                        <div className='spinner'>
                            <h3 className='authtext'>Authenticating</h3>
                            <div className='spinner-inner'></div>
                        </div>
                    </div>
                </div>
                <div className='app-bottom'>
                    <SharedFooter />
                </div>
            </div>
        </>
    )
}

export default Auth
