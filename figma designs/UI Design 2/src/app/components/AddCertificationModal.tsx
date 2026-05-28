import { useState } from 'react';
import { X, Calendar, Upload, File, AlertCircle } from 'lucide-react';

interface AddCertificationModalProps {
  onClose: () => void;
  onAdd: (certification: any) => void;
}

export default function AddCertificationModal({ onClose, onAdd }: AddCertificationModalProps) {
  const [certificationData, setCertificationData] = useState({
    name: '',
    issuingOrganization: '',
    issueDate: '',
    expiryDate: '',
    credentialId: '',
    certificate: null as File | null,
  });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setCertificationData({ ...certificationData, certificate: e.target.files[0] });
    }
  };

  const handleSubmit = () => {
    onAdd(certificationData);
    onClose();
  };

  const isFormValid = certificationData.name && certificationData.issuingOrganization;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Add Certification</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Certification Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Certification Name <span className="text-red-600">*</span>
            </label>
            <input
              type="text"
              placeholder="e.g., Certified Teacher, Google Educator Level 1"
              value={certificationData.name}
              onChange={(e) => setCertificationData({ ...certificationData, name: e.target.value })}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2"
              style={{ focusRing: '#2C3E7C' }}
            />
          </div>

          {/* Issuing Organization */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Issuing Organization <span className="text-red-600">*</span>
            </label>
            <input
              type="text"
              placeholder="e.g., NCTE, Google, Microsoft"
              value={certificationData.issuingOrganization}
              onChange={(e) => setCertificationData({ ...certificationData, issuingOrganization: e.target.value })}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2"
              style={{ focusRing: '#2C3E7C' }}
            />
          </div>

          {/* Issue Date and Expiry Date */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                <Calendar size={16} />
                Issue Date
              </label>
              <input
                type="date"
                value={certificationData.issueDate}
                onChange={(e) => setCertificationData({ ...certificationData, issueDate: e.target.value })}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2"
                style={{ focusRing: '#2C3E7C' }}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                <Calendar size={16} />
                Expiry Date
                <span className="text-xs text-gray-500 font-normal">(Optional)</span>
              </label>
              <input
                type="date"
                value={certificationData.expiryDate}
                onChange={(e) => setCertificationData({ ...certificationData, expiryDate: e.target.value })}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2"
                style={{ focusRing: '#2C3E7C' }}
              />
            </div>
          </div>

          {/* Credential ID */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Credential ID
              <span className="text-xs text-gray-500 font-normal ml-2">(Optional)</span>
            </label>
            <input
              type="text"
              placeholder="Certificate or credential ID"
              value={certificationData.credentialId}
              onChange={(e) => setCertificationData({ ...certificationData, credentialId: e.target.value })}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2"
              style={{ focusRing: '#2C3E7C' }}
            />
          </div>

          {/* Certificate Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
              <Upload size={16} />
              Certificate
              <span className="text-xs text-gray-500 font-normal">(Optional)</span>
            </label>

            {!certificationData.certificate ? (
              <label className="block cursor-pointer">
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <div className="flex flex-col items-center justify-center gap-2 px-4 py-8 border-2 border-dashed border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                  <Upload size={32} className="text-gray-400" />
                  <p className="text-sm font-medium text-gray-700">
                    Click to upload certificate
                  </p>
                  <p className="text-xs text-gray-500">PDF, JPG, or PNG (Max 5MB)</p>
                </div>
              </label>
            ) : (
              <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <File size={24} className="text-gray-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {certificationData.certificate.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {(certificationData.certificate.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setCertificationData({ ...certificationData, certificate: null })}
                  className="p-2 hover:bg-gray-200 rounded text-gray-400 hover:text-red-600"
                >
                  <X size={18} />
                </button>
              </div>
            )}
          </div>

          {/* Info Note */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-2">
            <AlertCircle className="text-blue-600 flex-shrink-0 mt-0.5" size={16} />
            <p className="text-xs text-blue-900">
              Professional certifications help showcase your expertise and credentials.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!isFormValid}
            className={`px-4 py-2 rounded-lg text-sm font-medium text-white ${
              !isFormValid ? 'bg-gray-300 cursor-not-allowed' : 'hover:opacity-90'
            }`}
            style={isFormValid ? { backgroundColor: '#2C3E7C' } : {}}
          >
            Add Certification
          </button>
        </div>
      </div>
    </div>
  );
}
