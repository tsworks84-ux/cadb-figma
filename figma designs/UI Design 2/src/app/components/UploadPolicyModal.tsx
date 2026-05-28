import { useState } from 'react';
import { X, Upload, FileText, Tag, Calendar, AlertCircle, File } from 'lucide-react';

interface UploadPolicyModalProps {
  onClose: () => void;
}

export default function UploadPolicyModal({ onClose }: UploadPolicyModalProps) {
  const [policyData, setPolicyData] = useState({
    title: '',
    category: '',
    description: '',
    effectiveDate: new Date().toISOString().split('T')[0],
    file: null as File | null,
  });

  const categories = [
    'HR Policies',
    'Finance Policies',
    'Academic Policies',
    'IT Policies',
    'Safety Policies',
    'General Policies',
  ];

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setPolicyData({ ...policyData, file: e.target.files[0] });
    }
  };

  const handleSubmit = () => {
    console.log('Policy data:', policyData);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Upload Policy</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Policy Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Policy Title
            </label>
            <input
              type="text"
              placeholder="e.g., Leave Policy, Reimbursement Policy"
              value={policyData.title}
              onChange={(e) => setPolicyData({ ...policyData, title: e.target.value })}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2"
              style={{ focusRing: '#2C3E7C' }}
            />
          </div>

          {/* Category and Effective Date */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                <Tag size={16} />
                Category
              </label>
              <select
                value={policyData.category}
                onChange={(e) => setPolicyData({ ...policyData, category: e.target.value })}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2"
              >
                <option value="">Select category</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                <Calendar size={16} />
                Effective Date
              </label>
              <input
                type="date"
                value={policyData.effectiveDate}
                onChange={(e) => setPolicyData({ ...policyData, effectiveDate: e.target.value })}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2"
                style={{ focusRing: '#2C3E7C' }}
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
              <FileText size={16} />
              Description
              <span className="text-xs text-gray-500 font-normal">(Optional)</span>
            </label>
            <textarea
              placeholder="Brief description of this policy..."
              value={policyData.description}
              onChange={(e) => setPolicyData({ ...policyData, description: e.target.value })}
              rows={3}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 resize-none"
              style={{ focusRing: '#2C3E7C' }}
            />
          </div>

          {/* File Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
              <Upload size={16} />
              Policy Document <span className="text-red-600">*</span>
            </label>

            {!policyData.file ? (
              <label className="block cursor-pointer">
                <input
                  type="file"
                  accept=".pdf,.doc,.docx"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <div className="flex flex-col items-center justify-center gap-2 px-4 py-8 border-2 border-dashed border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                  <Upload size={32} className="text-gray-400" />
                  <p className="text-sm font-medium text-gray-700">
                    Click to upload policy document
                  </p>
                  <p className="text-xs text-gray-500">PDF, DOC, or DOCX (Max 10MB)</p>
                </div>
              </label>
            ) : (
              <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <File size={24} className="text-gray-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {policyData.file.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {(policyData.file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setPolicyData({ ...policyData, file: null })}
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
            <div>
              <p className="text-sm font-medium text-blue-900 mb-1">Policy Visibility</p>
              <p className="text-xs text-blue-800">
                Once uploaded, this policy will be immediately visible to all employees. They can
                view and download the document from the Policies section.
              </p>
            </div>
          </div>

          {/* Preview */}
          {policyData.title && policyData.category && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-gray-900 mb-3">Preview</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Title</span>
                  <span className="font-medium text-gray-900">{policyData.title}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Category</span>
                  <span className="font-medium text-gray-900">{policyData.category}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Effective Date</span>
                  <span className="font-medium text-gray-900">
                    {new Date(policyData.effectiveDate).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </span>
                </div>
                {policyData.file && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Document</span>
                    <span className="font-medium text-gray-900">{policyData.file.name}</span>
                  </div>
                )}
              </div>
            </div>
          )}
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
            disabled={!policyData.title.trim() || !policyData.category || !policyData.file}
            className={`px-4 py-2 rounded-lg text-sm font-medium text-white ${
              !policyData.title.trim() || !policyData.category || !policyData.file
                ? 'bg-gray-300 cursor-not-allowed'
                : 'hover:opacity-90'
            }`}
            style={
              policyData.title.trim() && policyData.category && policyData.file
                ? { backgroundColor: '#2C3E7C' }
                : {}
            }
          >
            Upload Policy
          </button>
        </div>
      </div>
    </div>
  );
}
