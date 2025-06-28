import axios from 'axios';

// src/services/apicalls.tsx


// const API_BASE_URL = import.meta.env.REACT_APP_API_BASE_URL || 'http://127.0.0.1:8000';
const API_BASE_URL = import.meta.env.REACT_APP_API_BASE_URL || 'http://degrand.is/api';


export interface LoginCredentials {
    email: string;
    password: string;
    username?: string; // Optional for login, required for account creation
    confirmedPassword?: string; // Optional for login, required for account creation
}

export interface LoginResponse {
    token: string;
    user: {
        id: string;
        email: string;
        // add other user fields as needed
    };
}

export async function login(credentials: LoginCredentials): Promise<LoginResponse> {
    // TODO: Implement API call to backend login endpoint
    const body = {
        email: credentials.email,
        password: credentials.password
    };  


    const response = await axios.post<LoginResponse>(`${API_BASE_URL}/login`,
         body,
        {
            headers: {
                'Content-Type': 'application/json',
            },  
            withCredentials: true, // Include credentials for CORS requests
        }
    );
    return response.data;
}


export async function createAccount(credentials: LoginCredentials): Promise<LoginResponse> {
    const body = {
        email: credentials.email,
        username: credentials.username,
        password: credentials.password,
        confirmedPassword: credentials.confirmedPassword
    };

    const response = await axios.post<LoginResponse>(`${API_BASE_URL}/create-account`,
        body,
        {
            headers: {
                'Content-Type': 'application/json',
            },
            withCredentials: true, // Include credentials for CORS requests
        }
    );
    return response.data;
}

export async function testprotected(): Promise<any> {

    const response = await axios.get<any>(`${API_BASE_URL}/protected`, {
        
        headers: {
            'Content-Type': 'application/json',
        },
        withCredentials: true, // Include credentials for CORS requests
    });
    return response.data;
}

// Add more API call functions as needed, e.g., register, logout, etc.