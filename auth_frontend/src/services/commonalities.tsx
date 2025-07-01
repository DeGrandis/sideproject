import { getTemporaryAuthorizationCode, verifyCurrentToken } from "./apicalls";

const servicesMap: Record<string, string> = {
    'budget.degrand.is': 'Budget',
    'invoice.degrand.is': 'Invoice',
    'mining.degrand.is': 'Mining',
    'video.degrand.is': 'Video',
    'budget.localhost': 'Budget',
};

const handleCommonRedirects = async (redirectTo: string) => {
    if (redirectTo && servicesMap[redirectTo]) {
        const authorizationToken = await getTemporaryAuthorizationCode().then(res => res.authorization_code);
        console.log('Authorization code:', authorizationToken);
        const redirectingTo = `https://${redirectTo}?authorization_code=${authorizationToken}`;
        console.log('Redirecting to:', redirectingTo);
        window.location.href = redirectingTo;
    } else {
        console.log('No valid redirectTo specified, redirecting to home.');
        window.location.href = '/';
    }
}

const amIloggedIn = async (): Promise<boolean> =>  {
    try {
        await verifyCurrentToken();
        return true;
    } catch (error) {
        console.error('Error checking authentication status:', error);
        return false;
    }
}

export { servicesMap, handleCommonRedirects, amIloggedIn };
