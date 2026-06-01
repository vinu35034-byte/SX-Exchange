// Test script to check admin authentication status
const checkAdminAuth = async () => {
  try {
    const response = await fetch('http://localhost:5001/api/v1/admin/dashboard/stats', {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-Session-ID': localStorage.getItem('sessionId') || 'no-session',
        'X-Timestamp': new Date().toISOString(),
      }
    });
    
    console.log('Auth status:', response.status);
    console.log('Response headers:', [...response.headers.entries()]);
    
    if (response.status === 401) {
      console.log('❌ Admin not authenticated - need to login');
      const authData = await response.json();
      console.log('Auth error details:', authData);
    } else {
      const data = await response.json();
      console.log('✅ Admin authenticated - dashboard data:', data);
    }
    
  } catch (error) {
    console.error('Error checking auth:', error);
  }
};

checkAdminAuth();
