import { useState } from 'react';
import { X, Calendar, DollarSign, Tag, FileText, Upload, AlertCircle } from 'lucide-react';

interface NewClaimModalProps {
  receiptRequiredLimit: number;
  onClose: () => void;
}

export default function NewClaimModal({ receiptRequiredLimit, onClose }: NewClaimModalProps) {
  const [claimData, setClaimData] = useState({
    claimType: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    description: '',
    attachments: [] as File[],
  });

  // These would be fetched from Administration settings
  const claimTypes = [
    'Accommodation',
    'Food & Meals',
    'Medical',
    'Training',
    'Travel',
    'Other',
  ];

  const requiresReceipt = parseFloat(claimData.amount) > receiptRequiredLimit;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setClaimData({ ...claimData, attachments: [...claimData.attachments, ...newFiles] });
    }
  };

  const removeAttachment = (index: number) => {
    setClaimData({
      ...claimData,
      attachments: claimData.attachments.filter((_, i) => i !== index),
    });
  };

  const handleSubmit = () => {
    console.log('Claim data:', claimData);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">New Claim</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Claim Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
              <Tag size={16} />
              Claim Type
            </label>
            <select
              value={claimData.claimType}
              onChange={(e) => setClaimData({ ...claimData, claimType: e.target.value })}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2"
              style={{ focusRing: '#2C3E7C' }}
            >
              <option value="">Select claim type</option>
              {claimTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>

          {/* Amount and Date Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                <DollarSign size={16} />
                Amount (INR)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={claimData.amount}
                onChange={(e) => setClaimData({ ...claimData, amount: e.target.value })}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2"
                style={{ focusRing: '#2C3E7C' }}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                <Calendar size={16} />
                Expense Date
              </label>
              <input
                type="date"
                value={claimData.date}
                onChange={(e) => setClaimData({ ...claimData, date: e.target.value })}
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
            </label>
            <textarea
              placeholder="Provide details about this expense (e.g., purpose, location, event)..."
              value={claimData.description}
              onChange={(e) => setClaimData({ ...claimData, description: e.target.value })}
              rows={3}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 resize-none"
              style={{ focusRing: '#2C3E7C' }}
            />
          </div>

          {/* Receipt Required Notice */}
          {requiresReceipt && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 flex items-start gap-2">
              <AlertCircle className="text-orange-600 flex-shrink-0 mt-0.5" size={18} />
              <div className="flex-1">
                <p className="text-sm font-medium text-orange-900">Receipt Required</p>
                <p className="text-xs text-orange-700 mt-1">
                  Supporting documents are mandatory for claims above ₹{receiptRequiredLimit}
                </p>
              </div>
            </div>
          )}

          {/* Attachments */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
              <Upload size={16} />
              Supporting Documents
              {requiresReceipt && <span className="text-red-600">*</span>}
              {!requiresReceipt && (
                <span className="text-xs text-gray-500 font-normal">(Optional)</span>
              )}
            </label>

            {/* Upload Area */}
            <label className="block">
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                multiple
                onChange={handleFileUpload}
                className="hidden"
              />
              <div
                className={`flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
                  requiresReceipt
                    ? 'border-orange-300 bg-orange-50 hover:bg-orange-100'
                    : 'border-gray-300 bg-gray-50 hover:bg-gray-100'
                }`}
              >
                <Upload size={18} className={requiresReceipt ? 'text-orange-600' : 'text-gray-600'} />
                <span className={`text-sm font-medium ${requiresReceipt ? 'text-orange-900' : 'text-gray-700'}`}>
                  Click to upload receipts, invoices, or bills
                </span>
              </div>
            </label>

            {/* Uploaded Files */}
            {claimData.attachments.length > 0 && (
              <div className="mt-3 space-y-2">
                {claimData.attachments.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg"
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <FileText size={16} className="text-gray-400 flex-shrink-0" />
                      <span className="text-sm text-gray-700 truncate">{file.name}</span>
                      <span className="text-xs text-gray-500 flex-shrink-0">
                        ({(file.size / 1024).toFixed(1)} KB)
                      </span>
                    </div>
                    <button
                      onClick={() => removeAttachment(index)}
                      className="p-1 hover:bg-gray-200 rounded text-gray-400 hover:text-red-600"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <p className="text-xs text-gray-500 mt-2">
              Accepted formats: PDF, JPG, PNG. Maximum 10MB per file.
            </p>
          </div>

          {/* Preview */}
          {claimData.amount && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-gray-900 mb-2">Claim Summary</h4>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Claim Type</span>
                  <span className="font-medium text-gray-900">{claimData.claimType || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Amount</span>
                  <span className="font-semibold text-gray-900">₹{claimData.amount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Date</span>
                  <span className="font-medium text-gray-900">
                    {new Date(claimData.date).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Attachments</span>
                  <span className="font-medium text-gray-900">
                    {claimData.attachments.length} file(s)
                  </span>
                </div>
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
            disabled={
              !claimData.claimType ||
              !claimData.amount ||
              !claimData.description.trim() ||
              (requiresReceipt && claimData.attachments.length === 0)
            }
            className={`px-4 py-2 rounded-lg text-sm font-medium text-white ${
              !claimData.claimType ||
              !claimData.amount ||
              !claimData.description.trim() ||
              (requiresReceipt && claimData.attachments.length === 0)
                ? 'bg-gray-300 cursor-not-allowed'
                : 'hover:opacity-90'
            }`}
            style={
              claimData.claimType &&
              claimData.amount &&
              claimData.description.trim() &&
              (!requiresReceipt || claimData.attachments.length > 0)
                ? { backgroundColor: '#2C3E7C' }
                : {}
            }
          >
            Submit Claim
          </button>
        </div>
      </div>
    </div>
  );
}
