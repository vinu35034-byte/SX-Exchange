import React, { useState, useEffect } from 'react';
import { useAdminAuth } from '../../contexts/AdminAuthContext';
import { ApiUtils, API_BASE_URL } from '../../services/api';
import { adminTheme } from '../../styles/adminTheme';
import { Shield, CheckCircle, XCircle, Clock, Eye, User, FileText, Calendar, MapPin } from 'lucide-react';

const AdminKYCManager = () => {
  const { admin: adminUser } = useAdminAuth();
  const [kycSubmissions, setKycSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [filter, setFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    fetchKycSubmissions();
  }, [currentPage, filter]);

  const fetchKycSubmissions = async () => {
    try {
      const params = new URLSearchParams({
        page: currentPage,
        limit: 10,
        ...(filter !== 'all' && { status: filter })
      });

      const data = await ApiUtils.get(`/kyc/admin/submissions?${params}`);
      setKycSubmissions(data.users);
      setTotalPages(data.totalPages);
    } catch (error) {
      console.error('Error fetching KYC submissions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (userId, status, reason = '') => {
    try {
      // Update KYC status and request file deletion
      await ApiUtils.put(`/kyc/admin/status/${userId}`, { 
        status, 
        reason,
        deleteFiles: true // Request backend to delete associated files
      });
      
      fetchKycSubmissions();
      setSelectedSubmission(null);
      
      // Show success message with file deletion confirmation
      const action = status === 'approved' ? 'approved' : 'rejected';
      alert(`KYC ${action} successfully. Associated documents have been removed from server.`);
    } catch (error) {
      console.error('Error updating KYC status:', error);
      alert(`Failed to update KYC status: ${error.message}`);
    }
  };

  const handleDocumentView = async (doc) => {
    try {
      setLoading(true);
      console.log('Attempting to fetch document:', doc._id, 'Type:', doc.type);
      
      if (!API_BASE_URL) {
        throw new Error('API_BASE_URL is not configured. Please check your environment variables.');
      }
      
      const documentUrl = `${API_BASE_URL}/kyc/admin/document/${doc._id}`;
      console.log('Fetching from URL:', documentUrl);
      console.log('API_BASE_URL value:', API_BASE_URL);
      
      // Now use direct fetch for blob handling
      const response = await fetch(documentUrl, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Accept': 'image/*,application/pdf,*/*',
          'X-Timestamp': new Date().toISOString(),
        }
      });
      
      console.log('Response status:', response.status);
      console.log('Response headers:', [...response.headers.entries()]);
      
      if (response.ok) {
        const contentType = response.headers.get('content-type');
        console.log('Content-Type:', contentType);
        
        const blob = await response.blob();
        console.log('Blob received:', blob.type, blob.size, 'bytes');
        
        if (blob.size === 0) {
          throw new Error('Empty file received from server');
        }
        
        const url = URL.createObjectURL(blob);
        
        setSelectedDocument({
          ...doc,
          url: url,
          type: doc.type,
          filename: doc.filename || `${doc.type}_${doc.side || 'document'}.${blob.type.split('/')[1] || 'bin'}`,
          contentType: blob.type || contentType
        });
      } else {
        let errorText;
        try {
          errorText = await response.text();
        } catch (e) {
          errorText = 'Unable to read error response';
        }
        console.error('Document fetch failed:', response.status, response.statusText, errorText);
        alert(`Failed to load document: ${response.status} - ${response.statusText}\n${errorText}`);
      }
    } catch (error) {
      console.error('Error fetching document:', error);
      alert(`Error loading document: ${error.message}\n\nCheck the browser console for more details.`);
    } finally {
      setLoading(false);
    }
  };

  const closeDocumentViewer = () => {
    if (selectedDocument?.url) {
      URL.revokeObjectURL(selectedDocument.url);
    }
    setSelectedDocument(null);
  };

  const handleResubmission = async (userId, reason) => {
    try {
      await ApiUtils.post(`/kyc/admin/request-resubmission/${userId}`, { reason });
      fetchKycSubmissions();
      setSelectedSubmission(null);
      alert('Resubmission request sent to user');
    } catch (error) {
      console.error('Error requesting resubmission:', error);
      alert('Failed to request resubmission');
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'approved':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'rejected':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'pending':
      case 'pending_review':
      case 'documents_uploaded':
        return <Clock className="w-5 h-5 text-yellow-500" />;
      case 'personal_info_submitted':
        return <User className="w-5 h-5 text-blue-500" />;
      default:
        return <Shield className="w-5 h-5 text-gray-500" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'approved':
        return 'text-emerald-400 bg-emerald-500/10';
      case 'rejected':
        return 'text-red-400 bg-red-500/10';
      case 'pending':
      case 'pending_review':
      case 'documents_uploaded':
        return 'text-yellow-400 bg-yellow-500/10';
      case 'personal_info_submitted':
        return 'text-blue-500 bg-blue-500/10';
      default:
        return 'text-[#EAECEF]/40 bg-[#333A47]/30';
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className={`min-h-screen ${adminTheme.primary} flex items-center justify-center`}>
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-[#FCD535]"></div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${adminTheme.primary}`}>
      <div className="max-w-7xl mx-auto p-6">
        <div className={`${adminTheme.card} ${adminTheme.border} rounded-2xl ${adminTheme.shadow}`}>
          <div className={`p-6 border-b ${adminTheme.border}`}>
            <div className="flex items-center gap-4">
              <div className={`p-3 ${adminTheme.accent} rounded-xl ${adminTheme.shadow}`}>
                <Shield className="w-8 h-8 text-[#FCD535]" />
              </div>
              <div>
                <h1 className={`text-3xl font-bold ${adminTheme.textPrimary}`}>KYC Management</h1>
                <p className={`${adminTheme.textSecondary} mt-1`}>Review and manage user KYC submissions</p>
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className={`p-6 border-b ${adminTheme.border}`}>
            <div className="flex items-center space-x-4">
              <label className={`text-sm font-medium ${adminTheme.textSecondary}`}>Filter by status:</label>
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className={`px-3 py-2 ${adminTheme.surface} ${adminTheme.border} rounded-md focus:outline-none focus:ring-2 focus:ring-[#FCD535] ${adminTheme.textPrimary}`}
              >
                <option value="all">All</option>
                <option value="pending">Pending (Legacy)</option>
                <option value="personal_info_submitted">Personal Info Submitted</option>
                <option value="documents_uploaded">Documents Uploaded</option>
                <option value="pending_review">Pending Review</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
          </div>

          {/* KYC Submissions Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className={`${adminTheme.surface}`}>
                <tr>
                  <th className={`px-6 py-3 text-left text-xs font-medium ${adminTheme.textSecondary} uppercase tracking-wider`}>
                    User
                  </th>
                  <th className={`px-6 py-3 text-left text-xs font-medium ${adminTheme.textSecondary} uppercase tracking-wider`}>
                    Status
                  </th>
                  <th className={`px-6 py-3 text-left text-xs font-medium ${adminTheme.textSecondary} uppercase tracking-wider`}>
                    Submitted
                  </th>
                  <th className={`px-6 py-3 text-left text-xs font-medium ${adminTheme.textSecondary} uppercase tracking-wider`}>
                    Documents
                  </th>
                  <th className={`px-6 py-3 text-left text-xs font-medium ${adminTheme.textSecondary} uppercase tracking-wider`}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className={`${adminTheme.card} divide-y ${adminTheme.border}`}>
              {kycSubmissions.map((submission) => (
                <tr key={submission._id} className={`${adminTheme.hover} transition-colors`}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="w-10 h-10 bg-[#FCD535]/10 rounded-full flex items-center justify-center">
                        <User className="w-5 h-5 text-[#FCD535]" />
                      </div>
                      <div className="ml-4">
                        <div className={`text-sm font-medium ${adminTheme.textPrimary}`}>
                          {submission.firstName} {submission.lastName}
                        </div>
                        <div className={`text-sm ${adminTheme.textSecondary}`}>{submission.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(submission.kycStatus)}`}>
                      {getStatusIcon(submission.kycStatus)}
                      <span className="ml-1">{submission.kycStatus}</span>
                    </span>
                  </td>
                  <td className={`px-6 py-4 whitespace-nowrap text-sm ${adminTheme.textPrimary}`}>
                    {formatDate(submission.createdAt)}
                  </td>
                  <td className={`px-6 py-4 whitespace-nowrap text-sm ${adminTheme.textPrimary}`}>
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-500/10 text-blue-500">
                      <FileText className="w-3 h-3 mr-1" />
                      {submission.kycDocuments?.length || 0} docs
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button
                      onClick={() => setSelectedSubmission(submission)}
                      className="text-[#FCD535] hover:text-[#E6C228] flex items-center transition-colors"
                    >
                      <Eye className="w-4 h-4 mr-1" />
                      Review
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className={`px-6 py-4 border-t ${adminTheme.border}`}>
          <div className="flex items-center justify-between">
            <div className={`text-sm ${adminTheme.textSecondary}`}>
              Page {currentPage} of {totalPages}
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className={`px-3 py-1 text-sm ${adminTheme.buttonSecondary} rounded hover:scale-105 transition-transform disabled:opacity-50`}
              >
                Previous
              </button>
              <button
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                className={`px-3 py-1 text-sm ${adminTheme.buttonSecondary} rounded hover:scale-105 transition-transform disabled:opacity-50`}
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Review Modal */}
      {selectedSubmission && (
        <div className={`fixed inset-0 ${adminTheme.modalOverlay} flex items-center justify-center z-50`}>
          <div className={`${adminTheme.card} ${adminTheme.border} rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto m-4 ${adminTheme.shadow}`}>
            <div className={`p-6 border-b ${adminTheme.border}`}>
              <div className="flex items-center justify-between">
                <h2 className={`text-xl font-bold ${adminTheme.textPrimary}`}>
                  KYC Review - {selectedSubmission.firstName} {selectedSubmission.lastName}
                </h2>
                <button
                  onClick={() => setSelectedSubmission(null)}
                  className={`${adminTheme.textSecondary} hover:text-red-400 transition-colors`}
                >
                  <XCircle className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Personal Information */}
              <div>
                <h3 className={`text-lg font-semibold ${adminTheme.textPrimary} mb-4`}>Personal Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={`block text-sm font-medium ${adminTheme.textSecondary}`}>Full Name</label>
                    <p className={`text-sm ${adminTheme.textPrimary}`}>{selectedSubmission.firstName} {selectedSubmission.lastName}</p>
                  </div>
                  <div>
                    <label className={`block text-sm font-medium ${adminTheme.textSecondary}`}>Email</label>
                    <p className={`text-sm ${adminTheme.textPrimary}`}>{selectedSubmission.email}</p>
                  </div>
                  <div>
                    <label className={`block text-sm font-medium ${adminTheme.textSecondary}`}>Date of Birth</label>
                    <p className={`text-sm ${adminTheme.textPrimary}`}>
                      {selectedSubmission.dateOfBirth ? formatDate(selectedSubmission.dateOfBirth) : 'Not provided'}
                    </p>
                  </div>
                  <div>
                    <label className={`block text-sm font-medium ${adminTheme.textSecondary}`}>Nationality</label>
                    <p className={`text-sm ${adminTheme.textPrimary}`}>{selectedSubmission.nationality || 'Not provided'}</p>
                  </div>
                  <div>
                    <label className={`block text-sm font-medium ${adminTheme.textSecondary}`}>Country</label>
                    <p className={`text-sm ${adminTheme.textPrimary}`}>{selectedSubmission.country || 'Not provided'}</p>
                  </div>

                </div>
              </div>

              {/* Documents */}
              <div>
                <h3 className={`text-lg font-semibold ${adminTheme.textPrimary} mb-4`}>Documents</h3>
                <div className="space-y-3">
                  {selectedSubmission.kycDocuments?.map((doc, index) => (
                    <div key={index} className={`flex items-center justify-between p-3 ${adminTheme.surface} rounded-xl`}>
                      <div className="flex items-center">
                        <FileText className={`w-5 h-5 ${adminTheme.textSecondary} mr-3`} />
                        <div>
                          <p className={`text-sm font-medium ${adminTheme.textPrimary}`}>
                            {doc.type.replace('_', ' ').toUpperCase()}
                            {doc.side && (
                              <span className={`ml-2 px-2 py-1 text-xs rounded-full ${
                                doc.side === 'front' ? 'bg-blue-500/20 text-blue-500' : 'bg-green-500/20 text-green-400'
                              }`}>
                                {doc.side.toUpperCase()}
                              </span>
                            )}
                          </p>
                          <p className={`text-xs ${adminTheme.textSecondary}`}>
                            Uploaded: {formatDate(doc.uploadedAt)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(doc.status)}`}>
                          {doc.status}
                        </span>
                        <button
                          onClick={() => handleDocumentView(doc)}
                          className="text-[#FCD535] hover:text-[#E6C228] text-sm transition-colors flex items-center gap-1"
                        >
                          <Eye className="w-3 h-3" />
                          View
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Actions */}
              {(selectedSubmission.kycStatus !== 'approved' && selectedSubmission.kycStatus !== 'rejected') && (
                <div className={`flex flex-wrap gap-4 pt-4 border-t ${adminTheme.border}`}>
                  <button
                    onClick={() => handleStatusUpdate(selectedSubmission.userId, 'approved')}
                    className={`flex items-center px-4 py-2 ${adminTheme.buttonSuccess} rounded-xl hover:scale-105 transition-transform`}
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Approve
                  </button>
                  <button
                    onClick={() => {
                      const reason = prompt('Enter rejection reason:');
                      if (reason) {
                        handleStatusUpdate(selectedSubmission.userId, 'rejected', reason);
                      }
                    }}
                    className={`flex items-center px-4 py-2 ${adminTheme.buttonDanger} rounded-xl hover:scale-105 transition-transform`}
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    Reject
                  </button>
                  <button
                    onClick={() => {
                      const reason = prompt('Enter reason for resubmission request:');
                      if (reason) {
                        handleResubmission(selectedSubmission.userId, reason);
                      }
                    }}
                    className={`flex items-center px-4 py-2 ${adminTheme.buttonSecondary} rounded-xl hover:scale-105 transition-transform`}
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    Request Resubmission
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Document Viewer Modal */}
      {selectedDocument && (
        <div className={`fixed inset-0 ${adminTheme.modalOverlay} flex items-center justify-center z-50`}>
          <div className={`${adminTheme.card} ${adminTheme.border} rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden m-4 ${adminTheme.shadow}`}>
            <div className={`p-4 border-b ${adminTheme.border} flex items-center justify-between`}>
              <div>
                <h3 className={`text-lg font-semibold ${adminTheme.textPrimary}`}>
                  Document: {selectedDocument.type.replace('_', ' ').toUpperCase()}
                </h3>
                <p className={`text-sm ${adminTheme.textSecondary}`}>
                  {selectedDocument.filename}
                </p>
              </div>
              <button
                onClick={closeDocumentViewer}
                className={`${adminTheme.textSecondary} hover:text-red-400 transition-colors`}
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-4 max-h-[calc(90vh-100px)] overflow-auto">
              {selectedDocument.contentType?.startsWith('image/') ? (
                <div className="flex justify-center">
                  <img
                    src={selectedDocument.url}
                    alt={selectedDocument.type}
                    className="max-w-full max-h-full object-contain"
                    style={{ maxHeight: 'calc(90vh - 200px)' }}
                  />
                </div>
              ) : selectedDocument.contentType === 'application/pdf' ? (
                <div className="w-full h-full min-h-[500px]">
                  <iframe
                    src={selectedDocument.url}
                    className="w-full h-full border-0"
                    style={{ minHeight: '70vh' }}
                    title={selectedDocument.type}
                  />
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className={`${adminTheme.textSecondary} mb-4`}>
                    Cannot preview this file type. 
                  </p>
                  <a
                    href={selectedDocument.url}
                    download={selectedDocument.filename}
                    className={`inline-flex items-center px-4 py-2 ${adminTheme.buttonPrimary} rounded-lg hover:scale-105 transition-transform`}
                  >
                    Download File
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
};

export default AdminKYCManager;
