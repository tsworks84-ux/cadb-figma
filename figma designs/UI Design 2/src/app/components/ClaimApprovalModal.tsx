import { useState } from 'react';
import {
  X,
  CheckCircle2,
  XCircle,
  Calendar,
  DollarSign,
  FileText,
  Download,
  AlertCircle,
} from 'lucide-react';

interface ClaimApprovalModalProps {
  claim: any;
  onClose: () => void;
}

export default function ClaimApprovalModal({ claim, onClose }: ClaimApprovalModalProps) {
  const [decision, setDecision] = useState<'approve' | 'reject' | null>(null);
  const [notes, setNotes] = useState('');

  const handleSubmit = () => {
    console.log('Claim Decision:', decision, 'Notes:', notes);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Review Claim</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Employee Info */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center text-white font-medium"
                style={{ backgroundColor: '#2C3E7C' }}
              >
                {claim.employee
                  .split(' ')
                  .map((n: string) => n[0])
                  .join('')}
              </div>
              <div>
                <p className="font-semibold text-gray-900">{claim.employee}</p>
                <p className="text-sm text-gray-500">Employee Code: {claim.employeeCode}</p>
              </div>
            </div>
          </div>

          {/* Claim Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <p className="text-xs text-gray-500 mb-1">Claim Type</p>
              <p className="text-sm font-medium text-gray-900">{claim.claimType}</p>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <p className="text-xs text-gray-500 mb-1">Amount</p>
              <p className="text-lg font-semibold text-gray-900">₹{claim.amount}</p>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <p className="text-xs text-gray-500 mb-1">Expense Date</p>
              <p className="text-sm font-medium text-gray-900">
                {new Date(claim.date).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </p>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <p className="text-xs text-gray-500 mb-1">Submitted On</p>
              <p className="text-sm font-medium text-gray-900">
                {new Date(claim.submittedOn).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </p>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
              <FileText size={16} />
              Description
            </label>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <p className="text-sm text-gray-700">{claim.description}</p>
            </div>
          </div>

          {/* Attachments */}
          {claim.attachments && claim.attachments.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Supporting Documents
              </label>
              <div className="space-y-2">
                {claim.attachments.map((file: string, index: number) => (
                  <div
                    key={index}
                    className="flex items-center justify-between px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg"
                  >
                    <div className="flex items-center gap-2">
                      <FileText size={16} className="text-gray-400" />
                      <span className="text-sm text-gray-700">{file}</span>
                    </div>
                    <button className="p-1.5 hover:bg-gray-200 rounded text-gray-600">
                      <Download size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Decision Buttons */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Your Decision
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setDecision('approve')}
                className={`p-4 rounded-lg border-2 transition-all flex items-center gap-3 ${
                  decision === 'approve'
                    ? 'border-green-500 bg-green-50'
                    : 'border-gray-200 hover:border-green-300'
                }`}
              >
                <CheckCircle2
                  size={24}
                  className={decision === 'approve' ? 'text-green-600' : 'text-gray-400'}
                />
                <div className="text-left">
                  <p
                    className={`text-sm font-medium ${
                      decision === 'approve' ? 'text-green-900' : 'text-gray-700'
                    }`}
                  >
                    Approve
                  </p>
                  <p className="text-xs text-gray-500">Authorize reimbursement</p>
                </div>
              </button>

              <button
                onClick={() => setDecision('reject')}
                className={`p-4 rounded-lg border-2 transition-all flex items-center gap-3 ${
                  decision === 'reject'
                    ? 'border-red-500 bg-red-50'
                    : 'border-gray-200 hover:border-red-300'
                }`}
              >
                <XCircle
                  size={24}
                  className={decision === 'reject' ? 'text-red-600' : 'text-gray-400'}
                />
                <div className="text-left">
                  <p
                    className={`text-sm font-medium ${
                      decision === 'reject' ? 'text-red-900' : 'text-gray-700'
                    }`}
                  >
                    Reject
                  </p>
                  <p className="text-xs text-gray-500">Decline claim</p>
                </div>
              </button>
            </div>
          </div>

          {/* Manager Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
              <FileText size={16} />
              Manager Notes <span className="text-red-600">*</span>
              <span className="text-xs text-gray-500 font-normal">(Required for record purposes)</span>
            </label>
            <textarea
              placeholder={
                decision === 'approve'
                  ? 'Add notes for approval record (e.g., verified receipts, amount is reasonable, within policy guidelines)...'
                  : decision === 'reject'
                  ? 'Please provide a clear reason for rejection (e.g., insufficient documentation, exceeds policy limits, duplicate claim)...'
                  : 'Add your notes here after making a decision...'
              }
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 resize-none"
              style={{ focusRing: '#2C3E7C' }}
              disabled={!decision}
            />
            <p className="text-xs text-gray-500 mt-1">
              {decision
                ? 'These notes will be saved to the claim record for audit and payment processing'
                : 'Make a decision above to add notes'}
            </p>
          </div>

          {/* Warning Messages */}
          {decision === 'approve' && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-2">
              <CheckCircle2 className="text-green-600 flex-shrink-0 mt-0.5" size={18} />
              <div>
                <p className="text-sm font-medium text-green-900">Claim will be processed for payment</p>
                <p className="text-xs text-green-700 mt-1">
                  The approved amount will be included in the next payroll cycle. The employee will be notified.
                </p>
              </div>
            </div>
          )}

          {decision === 'reject' && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-2">
              <AlertCircle className="text-red-600 flex-shrink-0 mt-0.5" size={18} />
              <div>
                <p className="text-sm font-medium text-red-900">This action will notify the employee</p>
                <p className="text-xs text-red-700 mt-1">
                  Please ensure you have provided a clear reason for rejection to help the employee understand your decision.
                </p>
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
            disabled={!decision || !notes.trim()}
            className={`px-4 py-2 rounded-lg text-sm font-medium text-white ${
              !decision || !notes.trim()
                ? 'bg-gray-300 cursor-not-allowed'
                : decision === 'approve'
                ? 'bg-green-600 hover:bg-green-700'
                : 'bg-red-600 hover:bg-red-700'
            }`}
          >
            {decision === 'approve'
              ? 'Approve Claim'
              : decision === 'reject'
              ? 'Reject Claim'
              : 'Submit Decision'}
          </button>
        </div>
      </div>
    </div>
  );
}
