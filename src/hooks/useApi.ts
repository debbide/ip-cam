import { useAuth } from '@/contexts/AuthContext';

export function useApi() {
    const { token, logout } = useAuth();

    const fetchWithAuth = async (url: string, options: RequestInit = {}) => {
        const headers: HeadersInit = {
            'Content-Type': 'application/json',
            ...options.headers,
        };

        if (token) {
            // @ts-ignore
            headers['Authorization'] = `Bearer ${token}`;
        }

        try {
            const response = await fetch(url, { ...options, headers });

            if (response.status === 401) {
                if (token) {
                    logout();
                }
            }

            return response;
        } catch (error) {
            console.error('API Request failed:', error);
            throw error;
        }
    };

    return { fetchWithAuth };
}
