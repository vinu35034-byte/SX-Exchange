const API_BASE_URL = import.meta.env.VITE_API_URL || '/api/v1';

export const adminDeposits = {
  // Get deposit requests for admin review
  getDepositRequests: async (page = 1, limit = 20, status = 'submitted', network = '') => {
    const params = new URLSearchParams({ page, limit, status });
    if (network) params.append('network', network);
    
    const response = await fetch(`${API_BASE_URL}/admin/deposits/requests?${params}`, {
      method: 'GET',
      credentials: 'include',
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || 'Failed to fetch deposit requests');
    }
    return data;
  },

  // Approve a deposit request
  approveDeposit: async (depositId, confirmedAmount, blockConfirmations = 12) => {
    const response = await fetch(`${API_BASE_URL}/admin/deposits/approve/${depositId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ confirmedAmount, blockConfirmations }),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || 'Failed to approve deposit');
    }
    return data;
  },

  // Reject a deposit request
  rejectDeposit: async (depositId, rejectionReason) => {
    const response = await fetch(`${API_BASE_URL}/admin/deposits/reject/${depositId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ rejectionReason }),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || 'Failed to reject deposit');
    }
    return data;
  },

  // Get all deposits (for admin overview)
  getAllDeposits: async (page = 1, limit = 20, status = '', network = '') => {
    const params = new URLSearchParams({ page, limit });
    if (status) params.append('status', status);
    if (network) params.append('network', network);
    
    const response = await fetch(`${API_BASE_URL}/admin/deposits/all?${params}`, {
      method: 'GET',
      credentials: 'include',
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || 'Failed to fetch deposits');
    }
    return data;
  }
};
