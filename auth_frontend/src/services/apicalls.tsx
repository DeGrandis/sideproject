import axios from 'axios';

// src/services/apicalls.tsx


// const API_BASE_URL = import.meta.env.REACT_APP_API_BASE_URL || 'http://127.0.0.1:8000';
const API_BASE_URL = import.meta.env.REACT_APP_API_BASE_URL || 'http://degrand.is/api';


export interface LoginCredentials {
    username: string;
    password: string;
}

export interface LoginResponse {
    token: string;
    user: {
        id: string;
        username: string;
        // add other user fields as needed
    };
}

export async function login(credentials: LoginCredentials): Promise<LoginResponse> {
    // TODO: Implement API call to backend login endpoint
    const body = {
        username: credentials.username,
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

// Add more API call functions as needed, e.g., register, logout, etc.