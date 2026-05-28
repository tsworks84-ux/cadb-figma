import { useState } from 'react';
import { X, CreditCard, AlertCircle, Save } from 'lucide-react';

interface EditBankDetailsModalProps {
  onClose: () => void;
  onSave: (bankDetails: any) => void;
  currentDetails?: any;
}

export default function EditBankDetailsModal({
  onClose,
  onSave,
  currentDetails,
}: EditBankDetailsModalProps) {
  const [bankData, setBankData] = useState({
    bankName: currentDetails?.bankName || 'HDFC Bank',
    accountNumber: currentDetails?.accountNumber || '',
    ifscCode: currentDetails?.ifscCode || 'HDFC0001234',
    branch: currentDetails?.branch || 'Bangalore - MG Road',
    accountHolderName: currentDetails?.accountHolderName || 'Priya Sharma',
    accountType: currentDetails?.accountType || 'Savings Account',
  });

  const handleSubmit = () => {
    onSave(bankData);
    onClose();
  };

  const isFormValid =
    bankData.bankName &&
    bankData.accountNumber &&
    bankData.ifscCode &&
    bankData.branch &&
    bankData.accountHolderName &&
    bankData.accountType;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70] p-4">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: '#2C3E7C' }}
            >
              <CreditCard className="text-white" size={20} />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Edit Bank Account Details</h2>
              <p className="text-sm text-gray-600">Update employee's bank account information</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Bank Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Bank Name <span className="text-red-600">*</span>
            </label>
            <input
              type="text"
              placeholder="e.g., HDFC Bank, ICICI Bank, SBI"
              value={bankData.bankName}
              onChange={(e) => setBankData({ ...bankData, bankName: e.target.value })}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2"
              style={{ focusRing: '#2C3E7C' }}
            />
          </div>

          {/* Account Number and IFSC Code */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Account Number <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                placeholder="Enter full account number"
                value={bankData.accountNumber}
                onChange={(e) => setBankData({ ...bankData, accountNumber: e.target.value })}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2"
                style={{ focusRing: '#2C3E7C' }}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                IFSC Code <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g., HDFC0001234"
                value={bankData.ifscCode}
                onChange={(e) => setBankData({ ...bankData, ifscCode: e.target.value.toUpperCase() })}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2"
                style={{ focusRing: '#2C3E7C' }}
              />
            </div>
          </div>

          {/* Branch */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Branch <span className="text-red-600">*</span>
            </label>
            <input
              type="text"
              placeholder="e.g., Bangalore - MG Road"
              value={bankData.branch}
              onChange={(e) => setBankData({ ...bankData, branch: e.target.value })}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2"
              style={{ focusRing: '#2C3E7C' }}
            />
          </div>

          {/* Account Holder Name and Account Type */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Account Holder Name <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                placeholder="As per bank records"
                value={bankData.accountHolderName}
                onChange={(e) => setBankData({ ...bankData, accountHolderName: e.target.value })}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2"
                style={{ focusRing: '#2C3E7C' }}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Account Type <span className="text-red-600">*</span>
              </label>
              <select
                value={bankData.accountType}
                onChange={(e) => setBankData({ ...bankData, accountType: e.target.value })}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2"
                style={{ focusRing: '#2C3E7C' }}
              >
                <option value="">Select account type</option>
                <option value="Savings Account">Savings Account</option>
                <option value="Current Account">Current Account</option>
                <option value="Salary Account">Salary Account</option>
              </select>
            </div>
          </div>

          {/* Info Note */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-2">
            <AlertCircle className="text-blue-600 flex-shrink-0 mt-0.5" size={16} />
            <div>
              <p className="text-sm font-medium text-blue-900 mb-1">Important</p>
              <p className="text-xs text-blue-800">
                Please ensure the bank account details are accurate. This account will be used for
                salary transfers and other payments.
              </p>
            </div>
          </div>

          {/* Preview */}
          {isFormValid && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-gray-900 mb-3">Preview</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Bank Name</span>
                  <span className="font-medium text-gray-900">{bankData.bankName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Account Number</span>
                  <span className="font-medium text-gray-900">
                    {'X'.repeat(Math.max(0, bankData.accountNumber.length - 4))}
                    {bankData.accountNumber.slice(-4)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">IFSC Code</span>
                  <span className="font-medium text-gray-900">{bankData.ifscCode}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Branch</span>
                  <span className="font-medium text-gray-900">{bankData.branch}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Account Holder</span>
                  <span className="font-medium text-gray-900">{bankData.accountHolderName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Account Type</span>
                  <span className="font-medium text-gray-900">{bankData.accountType}</span>
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
            disabled={!isFormValid}
            className={`px-4 py-2 rounded-lg text-sm font-medium text-white flex items-center gap-2 ${
              !isFormValid ? 'bg-gray-300 cursor-not-allowed' : 'hover:opacity-90'
            }`}
            style={isFormValid ? { backgroundColor: '#2C3E7C' } : {}}
          >
            <Save size={16} />
            Save Bank Details
          </button>
        </div>
      </div>
    </div>
  );
}
