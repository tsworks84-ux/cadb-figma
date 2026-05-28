import { useState } from 'react';
import { X, CheckCircle2, DollarSign, AlertCircle, FileText, Heart } from 'lucide-react';

interface LOPApprovalModalProps {
  lop: any;
  onClose: () => void;
}

export default function LOPApprovalModal({ lop, onClose }: LOPApprovalModalProps) {
  const [decision, setDecision] = useState<'approve' | 'waive' | null>(null);
  const [notes, setNotes] = useState('');

  const estimatedDeduction = lop.days * 2500; // Example calculation

  const handleSubmit = () => {
    console.log('LOP Decision:', decision, 'Notes:', notes);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-red-50">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Loss of Pay Review</h2>
            <p className="text-sm text-gray-600 mt-1">
              Handle with care - this impacts employee compensation
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-red-100 rounded-lg transition-colors"
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
                {lop.employee
                  .split(' ')
                  .map((n: string) => n[0])
                  .join('')}
              </div>
              <div>
                <p className="font-semibold text-gray-900">{lop.employee}</p>
                <p className="text-sm text-gray-500">Employee Code: {lop.employeeCode}</p>
              </div>
            </div>
          </div>

          {/* LOP Details */}
          <div className="bg-red-50 border-2 border-red-200 rounded-lg p-5">
            <div className="flex items-start gap-3 mb-4">
              <AlertCircle className="text-red-600 flex-shrink-0" size={24} />
              <div>
                <h3 className="text-base font-semibold text-red-900 mb-1">
                  Loss of Pay Triggered
                </h3>
                <p className="text-sm text-red-700">{lop.reason}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-4">
              <div className="bg-white rounded-lg p-3">
                <p className="text-xs text-gray-500 mb-1">LOP Days</p>
                <p className="text-2xl font-bold text-red-600">
                  {lop.days} {lop.days === 1 ? 'day' : 'days'}
                </p>
              </div>

              <div className="bg-white rounded-lg p-3">
                <p className="text-xs text-gray-500 mb-1">Estimated Deduction</p>
                <p className="text-2xl font-bold text-red-600">₹{estimatedDeduction}</p>
              </div>
            </div>

            <div className="mt-4 bg-white rounded-lg p-3">
              <p className="text-xs text-gray-500 mb-1">Affected Dates</p>
              <p className="text-sm font-medium text-gray-900">{lop.dates}</p>
            </div>
          </div>

          {/* Context Information */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
              <FileText size={16} />
              Additional Context
            </h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Employee Tenure</span>
                <span className="font-medium text-gray-900">2 years 3 months</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Previous LOP This Year</span>
                <span className="font-medium text-gray-900">0 days</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Performance Rating</span>
                <span className="font-medium text-gray-900">4.2 / 5.0</span>
              </div>
            </div>
          </div>

          {/* Decision Options */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Your Decision
            </label>
            <div className="grid grid-cols-2 gap-3">
              {/* Approve LOP */}
              <button
                onClick={() => setDecision('approve')}
                className={`p-4 rounded-lg border-2 transition-all ${
                  decision === 'approve'
                    ? 'border-red-500 bg-red-50'
                    : 'border-gray-200 hover:border-red-300'
                }`}
              >
                <div className="flex items-start gap-3">
                  <DollarSign
                    size={24}
                    className={decision === 'approve' ? 'text-red-600' : 'text-gray-400'}
                  />
                  <div className="text-left">
                    <p
                      className={`text-sm font-medium ${
                        decision === 'approve' ? 'text-red-900' : 'text-gray-700'
                      }`}
                    >
                      Approve LOP
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Deduct ₹{estimatedDeduction} from salary
                    </p>
                  </div>
                </div>
              </button>

              {/* Waive LOP */}
              <button
                onClick={() => setDecision('waive')}
                className={`p-4 rounded-lg border-2 transition-all ${
                  decision === 'waive'
                    ? 'border-green-500 bg-green-50'
                    : 'border-gray-200 hover:border-green-300'
                }`}
              >
                <div className="flex items-start gap-3">
                  <Heart
                    size={24}
                    className={decision === 'waive' ? 'text-green-600' : 'text-gray-400'}
                  />
                  <div className="text-left">
                    <p
                      className={`text-sm font-medium ${
                        decision === 'waive' ? 'text-green-900' : 'text-gray-700'
                      }`}
                    >
                      Waive LOP
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Excuse the absence, no deduction
                    </p>
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Manager Notes <span className="text-red-600">*</span>
            </label>
            <textarea
              placeholder={
                decision === 'waive'
                  ? 'Please provide justification for waiving the LOP (e.g., exceptional circumstances, first-time occurrence, medical emergency)...'
                  : 'Add any notes for record keeping...'
              }
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 resize-none"
              style={{ focusRing: '#2C3E7C' }}
            />
            <p className="text-xs text-gray-500 mt-1">
              {decision === 'waive'
                ? 'A detailed justification is required when waiving LOP for audit trail purposes'
                : 'These notes will be added to the employee record and payroll documentation'}
            </p>
          </div>

          {/* Impact Warning */}
          {decision === 'approve' && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-2">
              <AlertCircle className="text-red-600 flex-shrink-0 mt-0.5" size={18} />
              <div>
                <p className="text-sm font-medium text-red-900">
                  This will impact the employee's next salary
                </p>
                <p className="text-xs text-red-700 mt-1">
                  The deduction of ₹{estimatedDeduction} will be processed in the upcoming payroll
                  cycle. The employee will be notified via email.
                </p>
              </div>
            </div>
          )}

          {/* Compassion Note for Waiving */}
          {decision === 'waive' && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-2">
              <Heart className="text-green-600 flex-shrink-0 mt-0.5" size={18} />
              <div>
                <p className="text-sm font-medium text-green-900">
                  You are choosing compassion
                </p>
                <p className="text-xs text-green-700 mt-1">
                  Waiving LOP shows understanding and support during difficult times. This decision
                  will be documented and the employee will be notified.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50">
          <p className="text-xs text-gray-500 max-w-md">
            This decision will be recorded in the employee's file and reviewed during performance
            evaluations.
          </p>
          <div className="flex gap-3">
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
                  ? 'bg-red-600 hover:bg-red-700'
                  : 'bg-green-600 hover:bg-green-700'
              }`}
            >
              {decision === 'approve'
                ? 'Confirm LOP'
                : decision === 'waive'
                ? 'Waive LOP'
                : 'Submit Decision'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
