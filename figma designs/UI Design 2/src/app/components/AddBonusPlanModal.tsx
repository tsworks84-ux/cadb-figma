import { useState } from 'react';
import { X, Calendar, DollarSign, AlertCircle } from 'lucide-react';

interface AddBonusPlanModalProps {
  onClose: () => void;
  onAdd: (bonusPlan: any) => void;
}

export default function AddBonusPlanModal({ onClose, onAdd }: AddBonusPlanModalProps) {
  const [bonusPlanData, setBonusPlanData] = useState({
    name: '',
    type: '',
    amount: '',
    frequency: '',
    effectiveDate: '',
    description: '',
  });

  const bonusTypes = [
    'Performance Bonus',
    'Annual Bonus',
    'Quarterly Bonus',
    'Festival Bonus',
    'Retention Bonus',
    'Referral Bonus',
    'Project Completion Bonus',
    'Other',
  ];

  const frequencies = ['One-time', 'Monthly', 'Quarterly', 'Half-yearly', 'Annually'];

  const handleSubmit = () => {
    onAdd(bonusPlanData);
    onClose();
  };

  const isFormValid =
    bonusPlanData.name &&
    bonusPlanData.type &&
    bonusPlanData.amount &&
    bonusPlanData.frequency &&
    bonusPlanData.effectiveDate;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Add Bonus Plan</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Plan Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Plan Name <span className="text-red-600">*</span>
            </label>
            <input
              type="text"
              placeholder="e.g., Annual Performance Bonus 2026"
              value={bonusPlanData.name}
              onChange={(e) => setBonusPlanData({ ...bonusPlanData, name: e.target.value })}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2"
              style={{ focusRing: '#2C3E7C' }}
            />
          </div>

          {/* Type and Frequency */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Bonus Type <span className="text-red-600">*</span>
              </label>
              <select
                value={bonusPlanData.type}
                onChange={(e) => setBonusPlanData({ ...bonusPlanData, type: e.target.value })}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2"
                style={{ focusRing: '#2C3E7C' }}
              >
                <option value="">Select type</option>
                {bonusTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Frequency <span className="text-red-600">*</span>
              </label>
              <select
                value={bonusPlanData.frequency}
                onChange={(e) =>
                  setBonusPlanData({ ...bonusPlanData, frequency: e.target.value })
                }
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2"
                style={{ focusRing: '#2C3E7C' }}
              >
                <option value="">Select frequency</option>
                {frequencies.map((freq) => (
                  <option key={freq} value={freq}>
                    {freq}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Amount and Effective Date */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                <DollarSign size={16} />
                Amount (₹) <span className="text-red-600">*</span>
              </label>
              <input
                type="number"
                placeholder="e.g., 50000"
                value={bonusPlanData.amount}
                onChange={(e) => setBonusPlanData({ ...bonusPlanData, amount: e.target.value })}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2"
                style={{ focusRing: '#2C3E7C' }}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                <Calendar size={16} />
                Effective Date <span className="text-red-600">*</span>
              </label>
              <input
                type="date"
                value={bonusPlanData.effectiveDate}
                onChange={(e) =>
                  setBonusPlanData({ ...bonusPlanData, effectiveDate: e.target.value })
                }
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2"
                style={{ focusRing: '#2C3E7C' }}
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description
              <span className="text-xs text-gray-500 font-normal ml-2">(Optional)</span>
            </label>
            <textarea
              placeholder="Add details about this bonus plan..."
              value={bonusPlanData.description}
              onChange={(e) =>
                setBonusPlanData({ ...bonusPlanData, description: e.target.value })
              }
              rows={3}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 resize-none"
              style={{ focusRing: '#2C3E7C' }}
            />
          </div>

          {/* Info Note */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-2">
            <AlertCircle className="text-blue-600 flex-shrink-0 mt-0.5" size={16} />
            <p className="text-xs text-blue-900">
              Bonus plans will be reflected in the employee's compensation details.
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
            Add Bonus Plan
          </button>
        </div>
      </div>
    </div>
  );
}
